const { randomDelay, withRetry } = require("../../utils/http");
const env = require("../../config/env");
const { createBrowser } = require("./browser.factory");
const {
  fetchHtml,
  parsePrice,
  makeProductId,
  getBrandFromName,
  toCheerio,
  resolveProductUrl,
} = require("./scraper.utils");

const MAX_RESULTS_PER_PLATFORM = 80;
const INSTAMART_RELEVANCE_MIN_SCORE = 50;
const INSTAMART_STOP_WORDS = new Set([
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
    .filter((token) => !INSTAMART_STOP_WORDS.has(token));
}

function computeInstamartRelevance(candidate = {}, query = "") {
  const queryNorm = normalizeText(query);
  const queryTokens = tokenizeRelevant(queryNorm);

  if (!queryNorm || !queryTokens.length) {
    return {
      tier: 0,
      score: 0,
      matchedKeywords: 0,
      totalKeywords: 0,
    };
  }

  const titleNorm = normalizeText(candidate.name || "");
  const brandNorm = normalizeText(candidate.brand || "");
  const categoryNorm = normalizeText(candidate.category || "");
  const combinedNorm = `${titleNorm} ${brandNorm} ${categoryNorm}`.trim();

  const matchedKeywords = queryTokens.filter((token) => combinedNorm.includes(token)).length;
  const matchRatio = matchedKeywords / Math.max(1, queryTokens.length);

  const exactMatch =
    titleNorm === queryNorm ||
    brandNorm === queryNorm ||
    categoryNorm === queryNorm;

  const phraseMatch =
    titleNorm.includes(queryNorm) ||
    brandNorm.includes(queryNorm) ||
    categoryNorm.includes(queryNorm);

  const partialMatch =
    matchedKeywords >= 2 ||
    matchRatio >= 0.6 ||
    (queryTokens.length === 1 && matchedKeywords === 1);

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

  if (tier === 0) {
    return {
      tier,
      score: 0,
      matchedKeywords,
      totalKeywords: queryTokens.length,
    };
  }

  // Tier ordering dominates while keyword coverage fine-tunes ordering.
  const tierBase = tier === 4 ? 100 : tier === 3 ? 80 : tier === 2 ? 60 : 35;
  const precisionBonus = titleNorm.includes(queryTokens[0]) ? 4 : 0;
  const score = tierBase + Math.round(matchRatio * 20) + precisionBonus;

  return {
    tier,
    score,
    matchedKeywords,
    totalKeywords: queryTokens.length,
  };
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function extractMoneyUnits(money = {}) {
  if (!money || typeof money !== "object") {
    return 0;
  }

  const units = toNumber(money.units, 0);
  const nanos = toNumber(money.nanos, 0);
  return Math.max(0, Math.round(units + nanos / 1e9));
}

function normalizeImageUrl(imageId = "") {
  const value = String(imageId || "").trim();
  if (!value) {
    return "";
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  return `https://media-assets.swiggy.com/swiggy/image/upload/${value}`;
}

function parseInstamartApiRows(rows = [], searchUrl = "", query = "") {
  const products = [];
  const seen = new Set();

  function pushProduct(candidate) {
    const name = String(candidate.name || "").trim();
    const price = Number(candidate.price || 0);

    if (!name || !price) {
      return;
    }

    const dedupeKey = `${name.toLowerCase()}::${price}`;
    if (seen.has(dedupeKey)) {
      return;
    }
    seen.add(dedupeKey);
    products.push(candidate);
  }

  const mappedRows = [];

  for (const row of rows) {
    if (products.length >= MAX_RESULTS_PER_PLATFORM) {
      return products;
    }

    const item = row?.item || {};
    const variation = row?.variation || {};

    const priceBlock = variation?.price || {};
    const offerPrice = extractMoneyUnits(priceBlock.offerPrice);
    const mrp = extractMoneyUnits(priceBlock.mrp);
    const price = offerPrice || mrp;

    const name =
      variation?.displayName ||
      item?.displayName ||
      variation?.name ||
      item?.name ||
      "";

    const brand = variation?.brandName || item?.brand || getBrandFromName(name);

    const imageId =
      (Array.isArray(variation?.imageIds) && variation.imageIds[0]) ||
      (Array.isArray(item?.imageIds) && item.imageIds[0]) ||
      (Array.isArray(variation?.medias) && variation.medias[0]?.url) ||
      "";

    const image = normalizeImageUrl(imageId);

    const productId =
      variation?.spinId ||
      variation?.skuId ||
      item?.productId ||
      makeProductId(name);

    const inStock =
      Boolean(item?.inStock) ||
      Boolean(item?.isAvail) ||
      Boolean(variation?.inventory?.inStock) ||
      !Boolean(variation?.inventory?.outOfStock);

    const rating = toNumber(variation?.rating?.avgRating, 0);

    const candidate = {
      productId,
      platform: "Swiggy Instamart",
      name,
      brand,
      category: variation?.category || item?.category || "Grocery",
      image,
      price,
      originalPrice: mrp || price,
      rating,
      inStock,
      delivery: "Instant",
      productUrl:
        resolveProductUrl(
          "instamart",
          variation?.deeplink ||
            variation?.url ||
            item?.deeplink ||
            item?.url ||
            "",
          name
        ) || searchUrl,
    };

    const relevance = computeInstamartRelevance(candidate, query);

    mappedRows.push({
      candidate,
      relevance,
    });
  }

  const selected = mappedRows
    .filter((row) => row.relevance.tier > 0)
    .filter((row) => row.relevance.score >= INSTAMART_RELEVANCE_MIN_SCORE)
    .sort((first, second) => {
      if (second.relevance.tier !== first.relevance.tier) {
        return second.relevance.tier - first.relevance.tier;
      }

      if (second.relevance.score !== first.relevance.score) {
        return second.relevance.score - first.relevance.score;
      }

      return first.candidate.price - second.candidate.price;
    });

  for (const row of selected) {
    if (products.length >= MAX_RESULTS_PER_PLATFORM) {
      break;
    }

    pushProduct(row.candidate);
  }

  return products;
}

function parseInstamartProducts(html) {
  const $ = toCheerio(html);
  const products = [];
  const seen = new Set();

  function extractRupeeValues(textValue = "") {
    const matches = String(textValue).match(/\u20B9\s?[\d,]+/g) || [];
    return matches.map((item) => parsePrice(item)).filter((value) => value > 0);
  }

  function pushProduct(candidate) {
    const name = String(candidate.name || "").trim();
    const price = Number(candidate.price || 0);

    if (!name || !price) {
      return;
    }

    const key = `${name.toLowerCase()}::${price}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);

    products.push(candidate);
  }

  $("[data-testid*='product'], [class*='ProductCard'], a[href*='instamart'], a[href*='/product']").each(
    (index, element) => {
      if (index >= MAX_RESULTS_PER_PLATFORM) return;

      const card = $(element);
      const rawText = card.text().replace(/\s+/g, " ").trim();
      const rupeeValues = extractRupeeValues(rawText);

      const name =
        card.find("h3, h4, [class*='name'], [class*='title']").first().text().trim() ||
        card.find("img").first().attr("alt") ||
        rawText.slice(0, 140);

      const image =
        card.find("img").first().attr("src") ||
        card.find("img").first().attr("data-src") ||
        "";

      const href =
        card.attr("href") ||
        card.find("a[href*='instamart'], a[href*='/product']").first().attr("href") ||
        "";

      const priceText =
        card.find("[class*='Price'], [data-testid*='price']").first().text() || rawText;
      const price = parsePrice(priceText) || rupeeValues[0] || 0;

      pushProduct({
        productId: makeProductId(name),
        platform: "Swiggy Instamart",
        name,
        brand: getBrandFromName(name),
        category: "Grocery",
        image,
        price,
        originalPrice: rupeeValues[1] || price,
        rating: 0,
        inStock: true,
        delivery: "Instant",
        productUrl: resolveProductUrl("instamart", href, name),
      });
    }
  );

  return products;
}

function filterInstamartResults(products = [], query = "") {
  const filtered = products
    .map((candidate) => ({
      candidate,
      relevance: computeInstamartRelevance(candidate, query),
    }))
    .filter((row) => row.relevance.tier > 0)
    .filter((row) => row.relevance.score >= INSTAMART_RELEVANCE_MIN_SCORE)
    .sort((first, second) => {
      if (second.relevance.tier !== first.relevance.tier) {
        return second.relevance.tier - first.relevance.tier;
      }

      if (second.relevance.score !== first.relevance.score) {
        return second.relevance.score - first.relevance.score;
      }

      return Number(first.candidate.price || 0) - Number(second.candidate.price || 0);
    })
    .map((row) => row.candidate)
    .slice(0, MAX_RESULTS_PER_PLATFORM);

  return filtered;
}

function normalizeInstamartDomProducts(items = [], searchUrl = "") {
  const seen = new Set();
  const products = [];

  for (const item of items) {
    const name = String(item?.name || "").replace(/\s+/g, " ").trim();
    const price = Number(item?.price || 0);

    if (!name || !price) {
      continue;
    }

    const dedupeKey = `${name.toLowerCase()}::${price}`;
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);

    const originalPrice = Number(item?.originalPrice || 0) || price;
    const productUrl = resolveProductUrl(
      "instamart",
      item?.productUrl,
      name
    ) || searchUrl;

    products.push({
      productId: makeProductId(name),
      platform: "Swiggy Instamart",
      name,
      brand: getBrandFromName(name),
      category: "Grocery",
      image: item?.image || "",
      price,
      originalPrice,
      rating: 0,
      inStock: true,
      delivery: item?.delivery || "Instant",
      productUrl,
    });
  }

  return products;
}

async function fetchWithPlaywright(searchUrl, rawQuery = "") {
  const browser = await createBrowser("instamart");
  try {
    const page = await browser.newPage({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    });

    await page.setExtraHTTPHeaders({
      "accept-language": "en-IN,en;q=0.9",
      referer: "https://www.google.com/",
    });

    await page.goto(searchUrl, {
      waitUntil: "domcontentloaded",
      timeout: env.scrapeTimeoutMs,
    });

    await page.waitForTimeout(2200);

    const apiRows = await page.evaluate(async ({ maxResults, query }) => {
      async function callSearchV2() {
        const payload = {
          facets: [],
          sortAttribute: "",
          query,
          search_results_offset: 0,
          page_type: "SEARCH_PAGE",
          is_pre_search_tag: false,
        };

        const response = await fetch("/api/instamart/search/v2", {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "content-type": "application/json",
            "x-channel": "Swiggy-Dweb",
            "x-device-id": "instamart-scraper-device",
          },
          body: JSON.stringify(payload),
        });

        const text = await response.text();

        return {
          status: response.status,
          text,
          wafAction: response.headers.get("x-amzn-waf-action") || "",
        };
      }

      async function callSearchMart() {
        const response = await fetch(
          `/api/instamart/search/mart/v2?query=${encodeURIComponent(query)}&isCartPresent=false`,
          {
            method: "GET",
            credentials: "same-origin",
            headers: {
              "x-channel": "Swiggy-Dweb",
              "x-device-id": "instamart-scraper-device",
            },
          }
        );

        const text = await response.text();

        return {
          status: response.status,
          text,
          wafAction: response.headers.get("x-amzn-waf-action") || "",
        };
      }

      function walk(node, visitor) {
        if (!node || typeof node !== "object") {
          return;
        }

        visitor(node);

        if (Array.isArray(node)) {
          for (const value of node) {
            walk(value, visitor);
          }
          return;
        }

        for (const value of Object.values(node)) {
          walk(value, visitor);
        }
      }

      function extractProducts(payload) {
        const rows = [];

        walk(payload, (node) => {
          if (rows.length >= maxResults) {
            return;
          }

          const type = String(node?.["@type"] || "");
          const items = Array.isArray(node?.items) ? node.items : null;
          if (!type.includes("ItemCollectionCard") || !items) {
            return;
          }

          for (const item of items) {
            const variations = Array.isArray(item?.variations) && item.variations.length
              ? item.variations
              : [item];

            for (const variation of variations) {
              rows.push({ item, variation });
              if (rows.length >= maxResults) {
                return;
              }
            }
          }
        });

        return rows;
      }

      async function tryExtract(callApi) {
        for (let attempt = 0; attempt < 6; attempt += 1) {
          const result = await callApi();

          if (result.wafAction === "challenge") {
            await new Promise((resolve) => setTimeout(resolve, 500));
            continue;
          }

          if (!result.text || !result.text.trim()) {
            await new Promise((resolve) => setTimeout(resolve, 350));
            continue;
          }

          try {
            const payload = JSON.parse(result.text);
            const body = payload?.data && typeof payload.data === "object" ? payload.data : payload;
            const extracted = extractProducts(body);
            if (extracted.length) {
              return extracted;
            }
          } catch (error) {
            // Ignore JSON parse errors and continue retries.
          }
        }

        return [];
      }

      const fromSearchV2 = await tryExtract(callSearchV2);
      if (fromSearchV2.length) {
        return fromSearchV2;
      }

      return tryExtract(callSearchMart);
    }, {
      maxResults: MAX_RESULTS_PER_PLATFORM,
      query: String(rawQuery || "").trim(),
    });

    const normalizedApiProducts = parseInstamartApiRows(
      apiRows || [],
      searchUrl,
      String(rawQuery || "").trim()
    );

    if (normalizedApiProducts.length) {
      return filterInstamartResults(normalizedApiProducts, rawQuery);
    }

    try {
      await page.waitForSelector("a[href*='instamart'], a[href*='/product'], [class*='Product']", {
        timeout: 7000,
      });
    } catch (error) {
      // Continue with full page parse even when selectors vary for region/city.
    }

    await page.waitForTimeout(1800);

    const domProducts = await page.evaluate(() => {
      function cleanText(value) {
        return String(value || "")
          .replace(/\s+/g, " ")
          .trim();
      }

      function parseRupees(value) {
        const matches = cleanText(value).match(/₹\s?[\d,]+/g) || [];
        return matches
          .map((match) => Number(String(match).replace(/[^\d]/g, "")))
          .filter((number) => Number.isFinite(number) && number > 0);
      }

      const cards = Array.from(
        document.querySelectorAll(
          "[data-testid*='product'], [class*='ProductCard'], a[href*='instamart'], a[href*='/product']"
        )
      ).slice(0, 80);

      const rows = [];

      for (const card of cards) {
        const rawText = cleanText(card.textContent || "");
        const prices = parseRupees(rawText);
        if (!prices.length) {
          continue;
        }

        const name =
          cleanText(
            card.querySelector("h3, h4, [class*='name'], [class*='title']")?.textContent || ""
          ) ||
          cleanText(card.querySelector("img")?.getAttribute("alt") || "") ||
          "";

        if (!name) {
          continue;
        }

        const image =
          card.querySelector("img")?.getAttribute("src") ||
          card.querySelector("img")?.getAttribute("data-src") ||
          "";

        const link = card.querySelector("a[href]")?.getAttribute("href") || "";
        const deliveryMatch = rawText.match(/\b\d+\s*MINS?\b/i);

        rows.push({
          name,
          price: prices[0],
          originalPrice: prices[1] || prices[0],
          delivery: deliveryMatch ? deliveryMatch[0].toUpperCase() : "Instant",
          image,
          productUrl: link,
        });
      }

      return rows;
    });

    const normalizedDomProducts = normalizeInstamartDomProducts(domProducts, searchUrl);
    if (normalizedDomProducts.length) {
      return filterInstamartResults(normalizedDomProducts, rawQuery);
    }

    const html = await page.content();
    return filterInstamartResults(parseInstamartProducts(html), rawQuery);
  } finally {
    await browser.close();
  }
}

exports.scrapeInstamart = async (query) => {
  const rawQuery = String(query || "").trim();
  const searchUrl = `https://www.swiggy.com/instamart/search?query=${encodeURIComponent(rawQuery)}`;

  const run = async () => {
    await randomDelay(500, 1500);

    let products = [];
    let httpError = null;

    try {
      const html = await fetchHtml(searchUrl, env.scrapeTimeoutMs, {
        platform: "instamart",
      });
      products = filterInstamartResults(parseInstamartProducts(html), rawQuery);
    } catch (error) {
      httpError = error;
    }

    if (!products.length) {
      products = await fetchWithPlaywright(searchUrl, rawQuery);
    }

    if (!products.length) {
      const reason = httpError?.message ? ` (${httpError.message})` : "";
      const error = new Error(`No products parsed from Swiggy Instamart${reason}`);
      error.platform = "Swiggy Instamart";
      throw error;
    }

    return products;
  };

  return withRetry(run, {
    retries: 1,
    platform: "Swiggy Instamart",
  });
};
