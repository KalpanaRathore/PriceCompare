const { randomDelay, withRetry } = require("../../utils/http");
const env = require("../../config/env");
const { createBrowser } = require("./browser.factory");
const {
  fetchHtml,
  text,
  attr,
  parsePrice,
  parseRating,
  makeProductId,
  getBrandFromName,
  toCheerio,
} = require("./scraper.utils");

const MAX_RESULTS_PER_PLATFORM = 80;

function parseAmazonProducts(html) {
  const $ = toCheerio(html);
  const products = [];

  $("[data-component-type='s-search-result']").each((index, element) => {
    if (index >= MAX_RESULTS_PER_PLATFORM) return;

    const card = $(element);
    const name =
      text(card, "h2 a span") ||
      text(card, "h2 a") ||
      attr(card, "img.s-image", "alt");
    const price = parsePrice(text(card, ".a-price .a-offscreen"));

    if (!name || !price) {
      return;
    }

    const href = attr(card, "h2 a", "href");
    const url = href ? `https://www.amazon.in${href}` : "";
    const originalPrice = parsePrice(text(card, ".a-text-price .a-offscreen"));
    const rating = parseRating(text(card, ".a-icon-alt"));
    const image = attr(card, ".s-image", "src");
    const delivery = text(card, "[data-cy='delivery-recipe']") || "Check on site";
    const combinedText = card.text().toLowerCase();
    const inStock = !combinedText.includes("currently unavailable");

    products.push({
      productId: makeProductId(name),
      platform: "Amazon",
      name,
      brand: getBrandFromName(name),
      category: "General",
      image,
      price,
      originalPrice: originalPrice || price,
      rating,
      inStock,
      delivery,
      productUrl: url || `https://www.amazon.in/s?k=${encodeURIComponent(name)}`,
    });
  });

  return products;
}

async function fetchWithPlaywright(searchUrl) {
  const browser = await createBrowser("amazon");
  try {
    const page = await browser.newPage({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    });

    await page.goto(searchUrl, {
      waitUntil: "domcontentloaded",
      timeout: env.scrapeTimeoutMs,
    });

    await page.waitForTimeout(1000);
    const html = await page.content();
    return parseAmazonProducts(html);
  } finally {
    await browser.close();
  }
}

exports.scrapeAmazon = async (query) => {
  const searchUrl = `https://www.amazon.in/s?k=${encodeURIComponent(query)}`;

  const run = async () => {
    await randomDelay(500, 1500);

    let products = [];
    let httpError = null;

    try {
      const html = await fetchHtml(searchUrl, env.scrapeTimeoutMs, {
        platform: "amazon",
      });
      products = parseAmazonProducts(html);
    } catch (error) {
      httpError = error;
    }

    if (!products.length) {
      products = await fetchWithPlaywright(searchUrl);
    }

    if (!products.length) {
      const reason = httpError?.message ? ` (${httpError.message})` : "";
      const error = new Error(`No products parsed from Amazon${reason}`);
      error.platform = "Amazon";
      throw error;
    }

    return products;
  };

  return withRetry(run, {
    retries: 1,
    platform: "Amazon",
  });
};