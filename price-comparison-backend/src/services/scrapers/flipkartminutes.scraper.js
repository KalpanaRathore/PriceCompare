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
const REQUEST_TIMEOUT_MS = Math.min(env.scrapeTimeoutMs, 5000);

function getSearchUrlCandidates(query) {
  const encoded = encodeURIComponent(query);
  return [
    `https://www.flipkart.com/search?q=${encoded}`,
    `https://www.flipkart.com/minutes/search?q=${encoded}`,
  ];
}

function parseFlipkartMinutesProducts(html, searchUrl = "") {
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

  $("[data-testid*='product'], [class*='ProductCard'], a[href*='/p/'], a[href*='minutes'], div[data-id]").each(
    (index, element) => {
      if (index >= MAX_RESULTS_PER_PLATFORM) return;

      const card = $(element);
      const rawText = card.text().replace(/\s+/g, " ").trim();
      const rupeeValues = extractRupeeValues(rawText);

      const name =
        card.find("a[title]").first().text().trim() ||
        card.find("div.KzDlHZ").first().text().trim() ||
        card.find("a.wjcEIp").first().text().trim() ||
        card.find("h3, h4, [class*='name'], [class*='title']").first().text().trim() ||
        card.find("img").first().attr("alt") ||
        rawText.slice(0, 140);

      const image =
        card.find("img").first().attr("src") ||
        card.find("img").first().attr("data-src") ||
        "";

      const href =
        card.find("a.k7wcnx").first().attr("href") ||
        card.attr("href") ||
        card.find("a[href*='/p/'], a[href*='minutes']").first().attr("href") ||
        "";

      const priceText =
        card.find("div.Nx9bqj, div._30jeq3, [class*='Price'], [data-testid*='price']").first().text() || rawText;
      const price = parsePrice(priceText) || rupeeValues[0] || 0;

      pushProduct({
        productId: makeProductId(name),
        platform: "Flipkart Minutes",
        name,
        brand: getBrandFromName(name),
        category: "Grocery",
        image,
        price,
        originalPrice: rupeeValues[1] || price,
        rating: 0,
        inStock: true,
        delivery: "Instant",
        productUrl: resolveProductUrl("flipkartminutes", href, name) || searchUrl,
      });
    }
  );

  return products;
}

function normalizeFlipkartMinutesDomProducts(items = [], searchUrl = "") {
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
    const productUrl =
      resolveProductUrl("flipkartminutes", item?.productUrl, name) || searchUrl;

    products.push({
      productId: makeProductId(name),
      platform: "Flipkart Minutes",
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

async function fetchWithPlaywright(searchUrls = []) {
  const browser = await createBrowser("flipkartminutes");
  try {
    for (const searchUrl of searchUrls) {
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
        timeout: REQUEST_TIMEOUT_MS,
      });

      try {
        await page.waitForSelector("a[href*='/p/'], [class*='Product'], [data-testid*='product'], div[data-id]", {
          timeout: 3500,
        });
      } catch (error) {
        // Continue with page parsing even if markup differs.
      }

      await page.waitForTimeout(800);

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
          "[data-testid*='product'], [class*='ProductCard'], [class*='Product'], a[href*='/p/'], a[href*='minutes'], div[data-id]"
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

      const normalizedDomProducts = normalizeFlipkartMinutesDomProducts(domProducts, searchUrl);
      if (normalizedDomProducts.length) {
        await page.close();
        return normalizedDomProducts;
      }

      const html = await page.content();
      const parsed = parseFlipkartMinutesProducts(html, searchUrl);
      await page.close();

      if (parsed.length) {
        return parsed;
      }
    }

    return [];
  } finally {
    await browser.close();
  }
}

exports.scrapeFlipkartMinutes = async (query) => {
  const searchUrls = getSearchUrlCandidates(query);

  const run = async () => {
    await randomDelay(150, 450);

    let products = [];
    let httpError = null;

    for (const searchUrl of searchUrls) {
      try {
        const html = await fetchHtml(searchUrl, REQUEST_TIMEOUT_MS, {
          platform: "flipkartminutes",
        });
        products = parseFlipkartMinutesProducts(html, searchUrl);
        if (products.length) {
          break;
        }
      } catch (error) {
        httpError = error;
      }
    }

    if (!products.length) {
      products = await fetchWithPlaywright(searchUrls);
    }

    if (!products.length) {
      const reason = httpError?.message ? ` (${httpError.message})` : "";
      const error = new Error(`No products parsed from Flipkart Minutes${reason}`);
      error.platform = "Flipkart Minutes";
      throw error;
    }

    return products;
  };

  return withRetry(run, {
    retries: 0,
    platform: "Flipkart Minutes",
  });
};