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

function parseFlipkartProducts(html) {
  const $ = toCheerio(html);
  const products = [];

  function extractRupeeValues(textValue = "") {
    const matches = String(textValue).match(/\u20B9\s?[\d,]+/g) || [];
    return matches.map((item) => parsePrice(item)).filter((value) => value > 0);
  }

  $("div[data-id]").each((index, element) => {
    if (index >= MAX_RESULTS_PER_PLATFORM) return;
    const card = $(element);
    const rawText = card.text().replace(/\s+/g, " ").trim();
    const rupeeValues = extractRupeeValues(rawText);

    const name =
      text(card, "a[title]") ||
      text(card, "div.KzDlHZ") ||
      text(card, "a.wjcEIp") ||
      attr(card, "img", "alt");

    const price =
      parsePrice(text(card, "div.Nx9bqj")) ||
      parsePrice(text(card, "div._30jeq3")) ||
      (rupeeValues[0] || 0);

    if (!name || !price) {
      return;
    }

    const href =
      attr(card, "a.k7wcnx", "href") ||
      attr(card, "a[href*='/p/']", "href") ||
      attr(card, "a", "href");

    const ratingMatch =
      rawText.match(/([0-5](?:\.[0-9])?)\s*[0-9,]+\s+Ratings/i) ||
      rawText.match(/([0-5](?:\.[0-9])?)\s*★/i);
    const rating =
      parseRating(text(card, "div.XQDdHH")) ||
      parseRating(text(card, "div._3LWZlK")) ||
      parseRating(ratingMatch ? ratingMatch[1] : "");

    const image = attr(card, "img.UCc1lI", "src") || attr(card, "img", "src");
    const plausibleOriginal = rupeeValues.find(
      (value) => value > price && value <= price * 2.5
    );
    const originalPrice = plausibleOriginal || price;

    products.push({
      productId: makeProductId(name),
      platform: "Flipkart",
      name,
      brand: getBrandFromName(name),
      category: "General",
      image,
      price,
      originalPrice,
      rating,
      inStock: true,
      delivery: text(card, "div._1sdMkc") || "Check on site",
      productUrl: href
        ? `https://www.flipkart.com${href}`
        : `https://www.flipkart.com/search?q=${encodeURIComponent(name)}`,
    });
  });

  return products;
}

function normalizeFlipkartDomProducts(items = [], searchUrl = "") {
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

    const href = item?.productUrl || "";
    const productUrl = href
      ? href.startsWith("http")
        ? href
        : `https://www.flipkart.com${href}`
      : searchUrl;

    const rating = Number(item?.rating || 0);
    const originalPrice = Number(item?.originalPrice || 0) || price;

    products.push({
      productId: makeProductId(name),
      platform: "Flipkart",
      name,
      brand: getBrandFromName(name),
      category: "General",
      image: item?.image || "",
      price,
      originalPrice,
      rating,
      inStock: true,
      delivery: item?.delivery || "Check on site",
      productUrl,
    });
  }

  return products;
}

async function fetchWithPlaywright(searchUrl) {
  const browser = await createBrowser("flipkart");
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

    try {
      await page.waitForSelector("div[data-id], a[href*='/p/']", {
        timeout: 6000,
      });
    } catch (error) {
      // Continue with full-page HTML parse even if selector wait times out.
    }

    await page.waitForTimeout(1200);

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

      function parseRating(value) {
        const match = cleanText(value).match(/([0-5](?:\.[0-9])?)/);
        return match ? Number(match[1]) : 0;
      }

      const cards = Array.from(document.querySelectorAll("div[data-id]")).slice(0, 80);
      const rows = [];

      for (const card of cards) {
        const rawText = cleanText(card.textContent || "");
        const prices = parseRupees(rawText);
        if (!prices.length) {
          continue;
        }

        const price = prices[0];
        const plausibleOriginal = prices.find(
          (value) => value > price && value <= price * 2.5
        );

        const name =
          cleanText(card.querySelector("a.pIpigb")?.textContent || "") ||
          cleanText(card.querySelector("a[title]")?.getAttribute("title") || "") ||
          cleanText(card.querySelector("img")?.getAttribute("alt") || "");

        if (!name) {
          continue;
        }

        const link =
          card.querySelector("a.pIpigb")?.getAttribute("href") ||
          card.querySelector("a[href*='/p/']")?.getAttribute("href") ||
          "";

        const image =
          card.querySelector("img.UCc1lI")?.getAttribute("src") ||
          card.querySelector("img")?.getAttribute("src") ||
          "";

        const explicitRating =
          parseRating(card.querySelector("div.XQDdHH")?.textContent || "") ||
          parseRating(card.querySelector("div._3LWZlK")?.textContent || "");

        const ratingMatch = rawText.match(/([0-5](?:\.[0-9])?)\s*\([\d,]+\)/i);
        const rating = explicitRating || (ratingMatch ? Number(ratingMatch[1]) : 0);

        const delivery =
          cleanText(card.querySelector("div._1sdMkc")?.textContent || "") ||
          (rawText.includes("Only few left") ? "Only few left" : "Check on site");

        rows.push({
          name,
          price,
          originalPrice: plausibleOriginal || price,
          rating,
          delivery,
          image,
          productUrl: link,
        });
      }

      return rows;
    });

    const normalizedDomProducts = normalizeFlipkartDomProducts(domProducts, searchUrl);
    if (normalizedDomProducts.length) {
      return normalizedDomProducts;
    }

    const html = await page.content();
    return parseFlipkartProducts(html);
  } finally {
    await browser.close();
  }
}

exports.scrapeFlipkart = async (query) => {
  const searchUrl = `https://www.flipkart.com/search?q=${encodeURIComponent(query)}`;

  const run = async () => {
    await randomDelay(500, 1500);

    let products = [];
    let httpError = null;

    try {
      const html = await fetchHtml(searchUrl, env.scrapeTimeoutMs, {
        platform: "flipkart",
      });
      products = parseFlipkartProducts(html);
    } catch (error) {
      httpError = error;
    }

    if (!products.length) {
      products = await fetchWithPlaywright(searchUrl);
    }

    if (!products.length) {
      const reason = httpError?.message ? ` (${httpError.message})` : "";
      const error = new Error(`No products parsed from Flipkart${reason}`);
      error.platform = "Flipkart";
      throw error;
    }

    return products;
  };

  return withRetry(run, {
    retries: 1,
    platform: "Flipkart",
  });
};