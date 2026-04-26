const { randomDelay, withRetry } = require("../../utils/http");
const env = require("../../config/env");
const { createBrowser } = require("./browser.factory");
const {
  fetchHtml,
  parsePrice,
  makeProductId,
  getBrandFromName,
  toCheerio,
} = require("./scraper.utils");

const MAX_RESULTS_PER_PLATFORM = 80;

function parseZeptoProducts(html) {
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

  $("[data-testid*='product'], [class*='ProductCard'], a[href*='/pn/'], a[href*='/p/']").each(
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
        card.find("a[href*='/pn/'], a[href*='/p/']").first().attr("href") ||
        "";

      const priceText =
        card.find("[class*='Price'], [data-testid*='price']").first().text() || rawText;
      const price = parsePrice(priceText) || rupeeValues[0] || 0;

      pushProduct({
        productId: makeProductId(name),
        platform: "Zepto",
        name,
        brand: getBrandFromName(name),
        category: "Grocery",
        image,
        price,
        originalPrice: rupeeValues[1] || price,
        rating: 0,
        inStock: true,
        delivery: "Instant",
        productUrl: href.startsWith("http") ? href : `https://www.zeptonow.com${href}`,
      });
    }
  );

  return products;
}

function normalizeZeptoDomProducts(items = [], searchUrl = "") {
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
    const productUrl = item?.productUrl
      ? item.productUrl.startsWith("http")
        ? item.productUrl
        : `https://www.zeptonow.com${item.productUrl}`
      : searchUrl;

    products.push({
      productId: makeProductId(name),
      platform: "Zepto",
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

async function fetchWithPlaywright(searchUrl) {
  const browser = await createBrowser("zepto");
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
      await page.waitForSelector("a[href*='/pn/'], a[href*='/p/'], [class*='Product']", {
        timeout: 7000,
      });
    } catch (error) {
      // Continue with page parsing even if Zepto markup differs in this session.
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
          "[data-testid*='product'], [class*='ProductCard'], a[href*='/pn/'], a[href*='/p/']"
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

    const normalizedDomProducts = normalizeZeptoDomProducts(domProducts, searchUrl);
    if (normalizedDomProducts.length) {
      return normalizedDomProducts;
    }

    const html = await page.content();
    return parseZeptoProducts(html);
  } finally {
    await browser.close();
  }
}

exports.scrapeZepto = async (query) => {
  const searchUrl = `https://www.zeptonow.com/search?query=${encodeURIComponent(query)}`;

  const run = async () => {
    await randomDelay(500, 1500);

    let products = [];
    let httpError = null;

    try {
      const html = await fetchHtml(searchUrl, env.scrapeTimeoutMs, {
        platform: "zepto",
      });
      products = parseZeptoProducts(html);
    } catch (error) {
      httpError = error;
    }

    if (!products.length) {
      products = await fetchWithPlaywright(searchUrl);
    }

    if (!products.length) {
      const reason = httpError?.message ? ` (${httpError.message})` : "";
      const error = new Error(`No products parsed from Zepto${reason}`);
      error.platform = "Zepto";
      throw error;
    }

    return products;
  };

  return withRetry(run, {
    retries: 1,
    platform: "Zepto",
  });
};
