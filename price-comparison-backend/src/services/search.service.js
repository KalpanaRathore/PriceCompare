const pLimit = require("p-limit").default;
const { scrapeBlinkit } = require("./scrapers/blinkit.scraper");
const { scrapeBbNow } = require("./scrapers/bbnow.scraper");
const { scrapeFlipkartMinutes } = require("./scrapers/flipkartminutes.scraper");
const { scrapeZepto } = require("./scrapers/zepto.scraper");
const { scrapeInstamart } = require("./scrapers/instamart.scraper");
const { normalizeProducts } = require("./normalization.service");
const cacheService = require("./cache.service");
const historyService = require("./history.service");
const logger = require("../config/logger");
const env = require("../config/env");

const limit = pLimit(5);
const MAX_CANDIDATES_PER_PLATFORM = {
  fast: 20,
  full: 80,
};

function withTimeout(promise, timeoutMs, platformLabel) {
  if (!timeoutMs || timeoutMs <= 0) {
    return promise;
  }

  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${platformLabel} scraper timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    }),
  ]);
}

function getPlatformTimeoutMs(platform = "") {
  const normalized = String(platform || "").toLowerCase();

  if (normalized === "flipkartminutes") {
    return Math.max(env.platformTimeoutMs, 16000);
  }

  return env.platformTimeoutMs;
}

const PLATFORM_SCRAPERS = {
  blinkit: {
    displayName: "Blinkit",
    run: scrapeBlinkit,
  },
  bbnow: {
    displayName: "BigBasket BB Now",
    run: scrapeBbNow,
  },
  flipkartminutes: {
    displayName: "Flipkart Minutes",
    run: scrapeFlipkartMinutes,
  },
  zepto: {
    displayName: "Zepto",
    run: scrapeZepto,
  },
  instamart: {
    displayName: "Swiggy Instamart",
    run: scrapeInstamart,
  },
};

function getPlatformsSeen(products = []) {
  return new Set(
    products.flatMap((product) =>
      Array.isArray(product.offers)
        ? product.offers.map((offer) => offer.platform)
        : []
    )
  );
}

function normalizePlatformLabel(platform = "") {
  return String(platform).trim().toLowerCase();
}

function isUsableCachedResponse(cachedResponse, normalizedPlatforms = []) {
  if (!cachedResponse || !Array.isArray(normalizedPlatforms) || !normalizedPlatforms.length) {
    return false;
  }

  const requested = new Set(normalizedPlatforms.map(normalizePlatformLabel));
  const statusList = Array.isArray(cachedResponse.platforms?.status)
    ? cachedResponse.platforms.status
    : [];

  if (statusList.length) {
    const statusByPlatform = new Map(statusList.map((item) => [
      normalizePlatformLabel(item.platform),
      Boolean(item.ok),
    ]));

    for (const platform of requested) {
      if (!statusByPlatform.has(platform)) {
        return false;
      }
    }

    return Array.isArray(cachedResponse.products) && cachedResponse.products.length > 0;
  }

  const seen = getPlatformsSeen(cachedResponse.products || []);
  return seen.size > 0;
}

function paginateProducts(catalog = [], page = 1, pageSize = 20) {
  const total = catalog.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.max(1, Math.min(page, totalPages));
  const start = (currentPage - 1) * pageSize;
  const products = catalog.slice(start, start + pageSize);

  return {
    products,
    total,
    page: currentPage,
    pageSize,
    totalPages,
    hasMore: currentPage < totalPages,
  };
}

function buildResponseFromCatalog(catalogPayload, { q, page, pageSize, mode }) {
  const pagination = paginateProducts(catalogPayload.products || [], page, pageSize);

  return {
    query: q,
    results: pagination.products.map((product) => ({
      id: product.id,
      name: product.name,
      bestDeal: product.comparison?.bestOffer?.platform || null,
      platforms: product.offers.map((offer) => ({
        platform: offer.platform,
        price: offer.price,
        productUrl: offer.productUrl,
        inStock: offer.inStock,
      })),
    })),
    platforms: catalogPayload.platforms,
    warning: catalogPayload.warning,
    total: pagination.total,
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalPages: pagination.totalPages,
    hasMore: pagination.hasMore,
    fetchedAt: new Date().toISOString(),
    products: pagination.products,
    meta: {
      mode,
      matchStrategy: "union",
    },
  };
}

exports.search = async ({ q, page, pageSize, platforms = [], mode = "fast" }) => {
  const normalizedMode = String(mode || "full").toLowerCase() === "fast" ? "fast" : "full";

  const normalizedPlatforms = Array.from(
    new Set(
      (Array.isArray(platforms) && platforms.length
        ? platforms
        : Object.keys(PLATFORM_SCRAPERS)
      )
        .map((platform) => String(platform).toLowerCase())
        .filter((platform) => PLATFORM_SCRAPERS[platform])
    )
  );

  const cacheKey = `search-catalog:${q}:${normalizedPlatforms.join(",")}:${normalizedMode}`;
  const cached = await cacheService.get(cacheKey);
  if (cached) {
    if (isUsableCachedResponse(cached, normalizedPlatforms)) {
      return buildResponseFromCatalog(cached, {
        q,
        page,
        pageSize,
        mode: normalizedMode,
      });
    }

    logger.info("Skipping incomplete cache", {
      cacheKey,
      requestedPlatforms: normalizedPlatforms,
      cachedPlatforms: Array.from(getPlatformsSeen(cached.products || [])),
    });
  }

  const jobs = normalizedPlatforms.map((platform) => {
    const scraper = PLATFORM_SCRAPERS[platform];

    return {
      platform,
      displayName: scraper.displayName,
      task: limit(() =>
        withTimeout(
          scraper.run(q),
          getPlatformTimeoutMs(platform),
          scraper.displayName
        )
      ),
    };
  });

  const settled = new Array(jobs.length);
  const collectors = jobs.map((job, index) =>
    Promise.resolve(job.task)
      .then((data) => {
        settled[index] = {
          status: "fulfilled",
          value: data,
        };
      })
      .catch((error) => {
        settled[index] = {
          status: "rejected",
          reason: error,
        };
      })
  );

  const allSettledPromise = Promise.allSettled(collectors);
  await allSettledPromise;

  for (let index = 0; index < settled.length; index += 1) {
    if (!settled[index]) {
      settled[index] = {
        status: "rejected",
        reason: new Error("Platform scraper did not settle"),
      };
    }
  }

  const platformStatus = jobs.map((job, index) => {
    const result = settled[index];

    if (result.status === "fulfilled") {
      return {
        platform: job.displayName,
        ok: true,
        resultCount: Array.isArray(result.value) ? result.value.length : 0,
      };
    }

    return {
      platform: job.displayName,
      ok: false,
      resultCount: 0,
      error: result.reason?.message || "Scraper failed",
    };
  });

  const platformResults = settled
    .filter((result) => result.status === "fulfilled")
    .flatMap((result) => {
      if (!Array.isArray(result.value)) {
        return [];
      }

      const maxCandidates =
        MAX_CANDIDATES_PER_PLATFORM[normalizedMode] || MAX_CANDIDATES_PER_PLATFORM.full;
      return result.value.slice(0, maxCandidates);
    });

  const failedPlatforms = platformStatus
    .filter((platform) => !platform.ok)
    .map((platform) => platform.platform);

  if (!platformResults.length) {
    const error = new Error("Could not fetch product data");
    error.statusCode = 503;
    error.code = "SCRAPE_PARTIAL_FAILURE";
    error.details = {
      failedPlatforms,
      platformStatus,
    };
    throw error;
  }

  const normalizedCatalog = normalizeProducts(platformResults, {
    q,
    requestedPlatforms: jobs.map((job) => job.displayName),
    platformStatus,
  });

  if (failedPlatforms.length) {
    normalizedCatalog.warning = {
      message: "Some platforms are temporarily unavailable. Showing partial catalog.",
      failedPlatforms,
    };
  }

  Promise.resolve()
    .then(() => historyService.saveSnapshot(normalizedCatalog.products, q))
    .catch((error) => {
      logger.warn("Skipping snapshot persistence", { error: error.message });
    });
  await cacheService.set(
    cacheKey,
    normalizedCatalog,
    failedPlatforms.length ? env.partialCacheTtlSeconds : env.cacheTtlSeconds
  );

  return buildResponseFromCatalog(normalizedCatalog, {
    q,
    page,
    pageSize,
    mode: normalizedMode,
  });
};