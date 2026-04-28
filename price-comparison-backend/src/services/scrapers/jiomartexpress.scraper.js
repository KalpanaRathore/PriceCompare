const axios = require("axios");
const { randomDelay, withRetry } = require("../../utils/http");
const env = require("../../config/env");
const { fetchHtml, makeProductId, getBrandFromName, resolveProductUrl } = require("./scraper.utils");
const { getAxiosProxyConfig } = require("./proxy.config");

const MAX_RESULTS_PER_PLATFORM = 80;
const RELEVANCE_MIN_SCORE = 50;
const STOP_WORDS = new Set([
  "with",
  "and",
  "for",
  "the",
  "of",
  "pack",
  "combo",
  "piece",
  "pieces",
  "fresh",
  "new",
  "premium",
  "best",
  "buy",
]);

function normalizeText(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeRelevant(value = "") {
  return normalizeText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => token.length > 1)
    .filter((token) => !STOP_WORDS.has(token));
}

function extractNumericValue(value) {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (Array.isArray(value)) {
    const candidates = value.map(extractNumericValue).filter((item) => item > 0);
    return candidates.length ? Math.max(...candidates) : 0;
  }

  if (typeof value === "object") {
    if (Array.isArray(value.numbers) && value.numbers.length) {
      const candidates = value.numbers.map((item) => Number(item)).filter((item) => Number.isFinite(item) && item > 0);
      if (candidates.length) {
        return Math.max(...candidates);
      }
    }

    if (Array.isArray(value.text) && value.text.length) {
      const candidates = value.text.flatMap((item) => String(item).match(/[0-9]+(?:\.[0-9]+)?/g) || []).map(Number).filter((item) => Number.isFinite(item) && item > 0);
      if (candidates.length) {
        return Math.max(...candidates);
      }
    }

    return 0;
  }

  const matches = String(value).match(/[0-9]+(?:\.[0-9]+)?/g) || [];
  const candidates = matches.map(Number).filter((item) => Number.isFinite(item) && item > 0);
  return candidates.length ? Math.max(...candidates) : 0;
}

function extractFirstTextValue(value) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return String(value || "").trim();
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const text = extractFirstTextValue(item);
      if (text) {
        return text;
      }
    }
    return "";
  }

  if (typeof value === "object") {
    if (Array.isArray(value.text) && value.text.length) {
      return extractFirstTextValue(value.text[0]);
    }

    if (Array.isArray(value.numbers) && value.numbers.length) {
      return String(value.numbers[0]);
    }
  }

  return String(value || "").trim();
}

function parseJioMartPrice(value) {
  return Math.round(extractNumericValue(value));
}

function parseCategory(categoryPath = "") {
  const segments = String(categoryPath || "")
    .split(">")
    .map((item) => item.trim())
    .filter(Boolean);

  return segments.length ? segments[segments.length - 1] : "Grocery";
}

function buildSearchUrl(query = "") {
  return `https://www.jiomart.com/search/${encodeURIComponent(String(query || "").trim())}`;
}

function parseTrexConfig(html = "") {
  const searchApiUrl = (String(html).match(/"search_api_url"\s*:\s*"([^"]+)"/i) || [])[1] || "/trex/search";
  const autoSearchUrl = (String(html).match(/"autocomplete_search_url"\s*:\s*"([^"]+)"/i) || [])[1] || "/trex/autoSearch";
  const branch = (String(html).match(/"branch"\s*:\s*"([^"]+)"/i) || [])[1] || "";

  return {
    searchApiUrl,
    autoSearchUrl,
    branch,
  };
}

function computeRelevance(candidate = {}, query = "") {
  const queryTokens = tokenizeRelevant(query);
  if (!queryTokens.length) {
    return { tier: 0, score: 0 };
  }

  const titleNorm = normalizeText(candidate.name || "");
  const brandNorm = normalizeText(candidate.brand || "");
  const categoryNorm = normalizeText(candidate.category || "");
  const combinedNorm = `${titleNorm} ${brandNorm} ${categoryNorm}`.trim();

  const matchedKeywords = queryTokens.filter((token) => combinedNorm.includes(token)).length;
  const matchRatio = matchedKeywords / Math.max(1, queryTokens.length);

  const exactMatch =
    titleNorm === normalizeText(query) ||
    brandNorm === normalizeText(query) ||
    categoryNorm === normalizeText(query);

  const phraseMatch =
    titleNorm.includes(normalizeText(query)) ||
    brandNorm.includes(normalizeText(query)) ||
    categoryNorm.includes(normalizeText(query));

  const partialMatch = matchedKeywords >= 2 || matchRatio >= 0.6 || (queryTokens.length === 1 && matchedKeywords === 1);
  const weakMatch = matchedKeywords >= 1;

  let tier = 0;
  if (exactMatch) {
    tier = 4;
  } else if (phraseMatch) {
    tier = 3;
  } else if (partialMatch) {
    tier = 2;
  } else if (weakMatch) {
    tier = 1;
  }

  if (!tier) {
    return { tier, score: 0 };
  }

  const tierBase = tier === 4 ? 100 : tier === 3 ? 80 : tier === 2 ? 60 : 35;
  const precisionBonus = queryTokens[0] && titleNorm.includes(queryTokens[0]) ? 4 : 0;

  return {
    tier,
    score: tierBase + Math.round(matchRatio * 20) + precisionBonus,
  };
}

function buildOfferFromResult(result = {}, query = "", searchUrl = "") {
  const product = result.product || {};
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const queryNorm = normalizeText(query);

  const scoredVariants = variants.length ? variants : [null];
  const ranked = scoredVariants
    .map((variant) => {
      const title = String(variant?.title || product.title || "").trim();
      const brand = extractFirstTextValue(variant?.brands) || getBrandFromName(title);
      const category = parseCategory(product.categories?.[0] || "");
      const price = parseJioMartPrice(variant?.attributes?.avg_selling_price);
      const discountPct = parseJioMartPrice(variant?.attributes?.avg_discount_pct);
      const originalPriceFromText = parseJioMartPrice(variant?.attributes?.buybox_mrp);
      const computedOriginalPrice =
        discountPct > 0 && price > 0
          ? Math.round(price / Math.max(0.01, 1 - discountPct / 100))
          : price;
      const originalPrice =
        originalPriceFromText > price && originalPriceFromText <= Math.max(price * 5, price + 1)
          ? originalPriceFromText
          : computedOriginalPrice;

      const candidate = {
        productId: String(variant?.id || result.id || makeProductId(title)),
        platform: "JioMart Express",
        name: title,
        brand,
        category,
        image: extractFirstTextValue(variant?.images?.[0]?.uri),
        price,
        originalPrice,
        rating: 0,
        inStock: Boolean(price > 0) && String(variant?.attributes?.pre_order_enabled?.numbers?.[0] || "0") !== "1",
        delivery: "Express",
        productUrl: resolveProductUrl("jiomartexpress", variant?.uri || "", title) || searchUrl,
      };

      return {
        candidate,
        relevance: computeRelevance(candidate, queryNorm),
      };
    })
    .filter((row) => row.candidate.name && row.candidate.price > 0)
    .filter((row) => row.relevance.tier > 0)
    .filter((row) => row.relevance.score >= RELEVANCE_MIN_SCORE)
    .sort((first, second) => {
      if (second.relevance.tier !== first.relevance.tier) {
        return second.relevance.tier - first.relevance.tier;
      }

      if (second.relevance.score !== first.relevance.score) {
        return second.relevance.score - first.relevance.score;
      }

      return first.candidate.price - second.candidate.price;
    });

  return ranked[0]?.candidate || null;
}

function dedupeAndTrim(products = []) {
  const seen = new Set();
  const output = [];

  for (const item of products) {
    const name = String(item?.name || "").trim();
    const price = Number(item?.price || 0);

    if (!name || !price) {
      continue;
    }

    const key = `${name.toLowerCase()}::${price}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(item);

    if (output.length >= MAX_RESULTS_PER_PLATFORM) {
      break;
    }
  }

  return output;
}

async function requestTrexEndpoint(url, body) {
  const response = await axios.post(url, body, {
    timeout: env.scrapeTimeoutMs,
    ...getAxiosProxyConfig("jiomartexpress"),
    headers: {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
      "accept-language": "en-IN,en;q=0.9",
      "content-type": "application/json",
      accept: "application/json, text/plain, */*",
      referer: "https://www.jiomart.com/",
      origin: "https://www.jiomart.com",
    },
  });

  return response.data || {};
}

async function loadSearchPageConfig(query) {
  const searchUrl = buildSearchUrl(query);

  try {
    const html = await fetchHtml(searchUrl, env.scrapeTimeoutMs, {
      platform: "jiomartexpress",
    });
    return {
      searchUrl,
      ...parseTrexConfig(html),
    };
  } catch (error) {
    return {
      searchUrl,
      searchApiUrl: "/trex/search",
      autoSearchUrl: "/trex/autoSearch",
      branch: "",
    };
  }
}

async function fetchJioMartProducts(query) {
  const config = await loadSearchPageConfig(query);
  const visitorId = `anonymous-${makeProductId(query) || "query"}`;

  const commonBody = {
    query: String(query || "").trim(),
    pageCategories: ["GROCERIES"],
    pageSize: 50,
    visitorId,
    searchMode: "PRODUCT_SEARCH_ONLY",
  };

  if (config.branch) {
    commonBody.branch = config.branch;
  }

  const attempts = [
    { url: config.searchApiUrl || "/trex/search", body: commonBody },
    { url: config.autoSearchUrl || "/trex/autoSearch", body: commonBody },
  ];

  for (const attempt of attempts) {
    try {
      const data = await requestTrexEndpoint(`https://www.jiomart.com${attempt.url}`, attempt.body);
      const results = Array.isArray(data.results) ? data.results : [];

      if (!results.length) {
        continue;
      }

      const mapped = results
        .map((result) => buildOfferFromResult(result, query, config.searchUrl))
        .filter(Boolean);

      if (mapped.length) {
        return dedupeAndTrim(mapped);
      }
    } catch (error) {
      // Continue to the next endpoint.
    }
  }

  return [];
}

exports.scrapeJioMartExpress = async (query) => {
  const run = async () => {
    await randomDelay(120, 380);

    const products = await fetchJioMartProducts(query);

    if (!products.length) {
      const error = new Error("No products parsed from JioMart Express");
      error.platform = "JioMart Express";
      throw error;
    }

    return products;
  };

  return withRetry(run, {
    retries: 1,
    platform: "JioMart Express",
  });
};