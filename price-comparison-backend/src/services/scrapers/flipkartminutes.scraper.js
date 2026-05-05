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

  function extractFirstPrice(textValue = "") {
    // Extract only the FIRST rupee value to avoid concatenation issues
    const match = String(textValue).match(/\u20B9\s?[\d,]+/);
    if (!match) return 0;
    return parsePrice(match[0]);
  }

  function extractPrices(textValue = "") {
    const matches = String(textValue).match(/\u20B9\s?[\d,]+/g) || [];
    return matches
      .map((item) => parsePrice(item))
      .filter((value) => value > 0);
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

      // Try to extract price from specific price element first
      const priceElement = card.find(
        "div[class*='Price'] span, div[class*='price'] span, div[class*='_1vC4OE'], div[class*='Nx9bqj'], span[class*='_30jeq3'], [data-testid*='price']"
      ).first();

      let price = 0;
      if (priceElement.length) {
        price = extractFirstPrice(priceElement.text());
      }

      // If no specific price element found or price is 0, try looking for price in common structures
      if (!price) {
        const allPrices = extractPrices(rawText);
        // Pick the first price that's reasonable (not too small to be discount %)
        price = allPrices.find((p) => p > 5) || allPrices[0] || 0;
      }

      if (!price) {
        return; // Skip if no valid price found
      }

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

      // Extract original/MRP price
      const allPrices = extractPrices(rawText);
      let originalPrice = price;
      for (const p of allPrices) {
        if (p > price) {
          originalPrice = p;
          break;
        }
      }

      pushProduct({
        productId: makeProductId(name),
        platform: "Flipkart Minutes",
        name,
        brand: getBrandFromName(name),
        category: "Grocery",
        image,
        price,
        originalPrice,
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

      function extractFirstPrice(element) {
        if (!element) return 0;
        const text = cleanText(element.textContent || "");
        // Extract only the FIRST rupee value to avoid concatenation issues
        const match = text.match(/₹\s?[\d,]+/);
        if (!match) return 0;
        const price = Number(String(match[0]).replace(/[^\d]/g, ""));
        return Number.isFinite(price) && price > 0 ? price : 0;
      }

      function getPrice(card) {
        // Try specific price element selectors (in order of priority)
        const priceSelectors = [
          "div[class*='Price'] span",
          "div[class*='price'] span",
          "div[class*='_1vC4OE']",  // Flipkart common price class
          "div[class*='Nx9bqj']",   // Alternative Flipkart price class
          "span[class*='_30jeq3']", // Flipkart price span
          "div[class*='Price']",
          "[data-testid*='price']",
        ];

        for (const selector of priceSelectors) {
          const priceEl = card.querySelector(selector);
          if (priceEl) {
            const price = extractFirstPrice(priceEl);
            if (price > 0) return price;
          }
        }

        // Fallback: extract from price-related text patterns
        const fullText = cleanText(card.textContent || "");
        // Look for "₹XX" pattern but stop at certain keywords
        const priceMatch = fullText.match(/₹\s?[\d,]+(?=\s*(off|%|MRP|Original|save))/i);
        if (priceMatch) {
          const price = Number(String(priceMatch[0]).replace(/[^\d]/g, ""));
          if (Number.isFinite(price) && price > 0) return price;
        }

        // Last resort: get first valid price
        const firstPriceMatch = fullText.match(/₹\s?[\d,]+/);
        if (firstPriceMatch) {
          const price = Number(String(firstPriceMatch[0]).replace(/[^\d]/g, ""));
          if (Number.isFinite(price) && price > 0) return price;
        }

        return 0;
      }

      function getOriginalPrice(card, currentPrice) {
        // Look for MRP or original price (usually larger or has specific indicator)
        const fullText = cleanText(card.textContent || "");
        const allPrices = fullText.match(/₹\s?[\d,]+/g) || [];

        for (const priceStr of allPrices) {
          const price = Number(String(priceStr).replace(/[^\d]/g, ""));
          if (Number.isFinite(price) && price > currentPrice) {
            return price; // MRP is usually higher than selling price
          }
        }

        return currentPrice;
      }

      const cards = Array.from(
        document.querySelectorAll(
          "[data-testid*='product'], [class*='ProductCard'], [class*='Product'], a[href*='/p/'], a[href*='minutes'], div[data-id]"
        )
      ).slice(0, 80);

      const rows = [];

      for (const card of cards) {
        const name =
          cleanText(
            card.querySelector("h3, h4, [class*='name'], [class*='title']")?.textContent || ""
          ) ||
          cleanText(card.querySelector("img")?.getAttribute("alt") || "") ||
          "";

        if (!name) {
          continue;
        }

        const price = getPrice(card);
        if (!price) {
          continue;
        }

        const originalPrice = getOriginalPrice(card, price);
        const rawText = cleanText(card.textContent || "");
        const deliveryMatch = rawText.match(/\b\d+\s*MINS?\b/i);

        const image =
          card.querySelector("img")?.getAttribute("src") ||
          card.querySelector("img")?.getAttribute("data-src") ||
          "";

        const link = card.querySelector("a[href]")?.getAttribute("href") || "";

        rows.push({
          name,
          price,
          originalPrice,
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