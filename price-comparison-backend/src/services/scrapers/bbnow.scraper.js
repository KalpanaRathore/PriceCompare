const axios = require("axios");
const { randomDelay, withRetry } = require("../../utils/http");
const env = require("../../config/env");
const { getAxiosProxyConfig } = require("./proxy.config");
const {
  fetchHtml,
  makeProductId,
  getBrandFromName,
  resolveProductUrl,
} = require("./scraper.utils");

const MAX_RESULTS_PER_PLATFORM = 80;

function normalizeText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function parseBigBasketPrice(product = {}) {
  const discount = product?.pricing?.discount || {};
  const primary = discount?.prim_price || {};

  const sellingPrice = toNumber(primary.sp, 0);
  const mrp = toNumber(discount.mrp, 0);

  return {
    price: sellingPrice || mrp || 0,
    originalPrice: mrp || sellingPrice || 0,
  };
}

function parseBigBasketAvailability(product = {}) {
  const availability = product?.availability || {};

  if (availability.not_for_sale === true) {
    return false;
  }

  if (String(availability.button || "").toLowerCase() === "notify me") {
    return false;
  }

  return String(availability.avail_status || "001") === "001";
}

function getBigBasketImage(product = {}) {
  const firstImage = Array.isArray(product.images) ? product.images[0] : null;
  return (
    firstImage?.m ||
    firstImage?.s ||
    firstImage?.l ||
    ""
  );
}

function getBigBasketBrand(product = {}, fallbackName = "") {
  if (typeof product.brand === "string") {
    return normalizeText(product.brand) || getBrandFromName(fallbackName);
  }

  if (product.brand && typeof product.brand === "object") {
    const candidate =
      product.brand.name ||
      product.brand.brand_name ||
      product.brand.brand ||
      "";

    return normalizeText(candidate) || getBrandFromName(fallbackName);
  }

  return getBrandFromName(fallbackName);
}

function getBigBasketCategory(product = {}) {
  if (typeof product.category === "string") {
    return normalizeText(product.category) || "Grocery";
  }

  if (product.category && typeof product.category === "object") {
    const candidate =
      product.category.l3_name ||
      product.category.l2_name ||
      product.category.l1_name ||
      product.category.l0_name ||
      product.category.name ||
      "";

    return normalizeText(candidate) || "Grocery";
  }

  return "Grocery";
}

function parseBigBasketProducts(products = [], searchUrl = "") {
  const rows = [];
  const seen = new Set();

  for (const product of products) {
    if (rows.length >= MAX_RESULTS_PER_PLATFORM) {
      break;
    }

    const name = normalizeText(product?.desc || product?.name || "");
    if (!name) {
      continue;
    }

    const { price, originalPrice } = parseBigBasketPrice(product);
    if (!price) {
      continue;
    }

    const dedupeKey = `${name.toLowerCase()}::${price}`;
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);

    rows.push({
      productId: String(product?.id || product?.requested_sku_id || makeProductId(name)),
      platform: "BigBasket BB Now",
      name,
      brand: getBigBasketBrand(product, name),
      category: getBigBasketCategory(product),
      image: getBigBasketImage(product),
      price,
      originalPrice: originalPrice || price,
      rating: toNumber(product?.rating_info?.avg_rating, 0),
      inStock: parseBigBasketAvailability(product),
      delivery: "Instant",
      productUrl:
        resolveProductUrl("bbnow", product?.absolute_url || "", name) ||
        searchUrl,
    });
  }

  return rows;
}

function extractVisitorCookies(html = "") {
  const match = String(html || "").match(
    /<script id=\"__NEXT_DATA__\"[^>]*>([\s\S]*?)<\/script>/i
  );

  if (!match || !match[1]) {
    return {};
  }

  try {
    const nextData = JSON.parse(match[1]);
    return nextData?.props?.visitorCookies || {};
  } catch (error) {
    return {};
  }
}

function buildCookieHeader(visitorCookies = {}) {
  const fallbackCookies = {
    _bb_nhid: visitorCookies._bb_nhid || "7427",
    _bb_dseid: visitorCookies._bb_dseid || "7427",
  };

  return Object.entries({
    ...visitorCookies,
    ...fallbackCookies,
  })
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "")
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
}

async function fetchBigBasketApiProducts(query) {
  const encodedQuery = encodeURIComponent(String(query || "").trim());
  const searchUrl = `https://www.bigbasket.com/ps/?q=${encodedQuery}`;

  const html = await fetchHtml(searchUrl, env.scrapeTimeoutMs, {
    platform: "bbnow",
  });

  const visitorCookies = extractVisitorCookies(html);
  const cookieHeader = buildCookieHeader(visitorCookies);

  const listingUrl = `https://www.bigbasket.com/listing-svc/v2/products?type=ps&slug=${encodedQuery}&page=1`;

  const response = await axios.get(listingUrl, {
    timeout: env.scrapeTimeoutMs,
    ...getAxiosProxyConfig("bbnow"),
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
      "accept-language": "en-IN,en;q=0.9",
      referer: searchUrl,
      cookie: cookieHeader,
      "osmos-enabled": "true",
      accept: "application/json, text/plain, */*",
    },
  });

  const products = response.data?.tabs?.[0]?.product_info?.products || [];
  return parseBigBasketProducts(products, searchUrl);
}

exports.scrapeBbNow = async (query) => {
  const run = async () => {
    await randomDelay(120, 380);

    const products = await fetchBigBasketApiProducts(query);

    if (!products.length) {
      const error = new Error("No products parsed from BigBasket BB Now");
      error.platform = "BigBasket BB Now";
      throw error;
    }

    return products;
  };

  return withRetry(run, {
    retries: 1,
    platform: "BigBasket BB Now",
  });
};