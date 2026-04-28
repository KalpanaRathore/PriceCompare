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

function parseBlinkitProducts(html) {
  const $ = toCheerio(html);
  const products = [];

  const seen = new Set();

  function extractRupeeValues(textValue = "") {
    const matches = String(textValue).match(/\u20B9\s?[\d,]+/g) || [];
    return matches.map((item) => parsePrice(item)).filter((value) => value > 0);
  }

  function pushProduct(candidate) {
    const name = candidate.name;
    const price = candidate.price;

    if (!name || !price) {
      return;
    }

    const key = `${String(name).toLowerCase()}::${price}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);

    products.push(candidate);
  }

  $(
    "[data-testid*='product-card'], [class*='ProductCard'], a[href*='/prn/'], a[href*='/p/']"
  ).each((index, element) => {
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
      card.find("a[href*='/prn/'], a[href*='/p/']").first().attr("href") ||
      "";

    const priceText =
      card.find("[class*='Price'], [data-testid*='price']").first().text() || rawText;
    const price = parsePrice(priceText) || rupeeValues[0] || 0;

    pushProduct({
      productId: makeProductId(name),
      platform: "Blinkit",
      name,
      brand: getBrandFromName(name),
      category: "Grocery",
      image,
      price,
      originalPrice: price,
      rating: 0,
      inStock: true,
      delivery: "Instant",
      productUrl: resolveProductUrl("blinkit", href, name),
    });
  });

  if (!products.length) {
    $("[data-testid='product-card'], [class*='ProductCard']").each((index, element) => {
      if (index >= MAX_RESULTS_PER_PLATFORM) return;
      const card = $(element);

      const name =
        card.find("img").attr("alt") ||
        card.find("h3, h4, [class*='name'], [class*='title']").first().text().trim();

      const rawText = card.text().replace(/\s+/g, " ").trim();
      const rupeeValues = extractRupeeValues(rawText);

      const priceText = card.find("[class*='Price'], [data-testid*='price']").first().text();
      const price = parsePrice(priceText) || rupeeValues[0] || 0;

      const href =
        card.find("a[href*='/prn/'], a[href*='/p/']").first().attr("href") || "";
      const image = card.find("img").first().attr("src") || "";

      pushProduct({
        productId: makeProductId(name),
        platform: "Blinkit",
        name,
        brand: getBrandFromName(name),
        category: "Grocery",
        image,
        price,
        originalPrice: price,
        rating: 0,
        inStock: true,
        delivery: "Instant",
        productUrl: resolveProductUrl("blinkit", href, name),
      });
    });
  }

  return products;
}

function normalizeBlinkitDomProducts(items = [], searchUrl = "") {
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
      "blinkit",
      item?.productUrl,
      name
    ) || searchUrl;

    products.push({
      productId: makeProductId(name),
      platform: "Blinkit",
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
  const browser = await createBrowser("blinkit");
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
      await page.waitForSelector("text=Showing results", {
        timeout: 7000,
      });
    } catch (error) {
      // Continue to other waits if initial marker is not present.
    }

    try {
      await page.waitForFunction(
        () => {
          const text = document.body?.innerText || "";
          return text.includes("ADD") && text.includes("₹");
        },
        { timeout: 7000 }
      );
    } catch (error) {
      // Continue with full-page parse even if wait times out.
    }

    try {
      await page.waitForSelector("a[href*='/prn/'], a[href*='/p/'], [class*='tw-relative']", {
        timeout: 6000,
      });
    } catch (error) {
      // Continue with full-page HTML parse even if selector wait times out.
    }

    await page.waitForTimeout(2000);

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

      const containers = Array.from(
        document.querySelectorAll(
          "div.tw-relative.tw-flex.tw-h-full.tw-flex-col.tw-items-start, div[class*='tw-relative'][class*='tw-flex'][class*='tw-h-full']"
        )
      );

      const rows = [];

      for (const container of containers) {
        const text = cleanText(container.innerText || "");
        if (!text.includes("ADD") || !text.includes("₹")) {
          continue;
        }

        const prices = parseRupees(text);
        if (!prices.length) {
          continue;
        }

        const tokens = text
          .split(/\n|\s{2,}/)
          .map((item) => cleanText(item))
          .filter(Boolean);

        const titleFromText = cleanText(
          text
            .replace(/^\d+%\s*OFF\s*/i, "")
            .replace(/^\d+\s*MINS\s*/i, "")
            .replace(/\s+₹\s?[\d,]+.*$/i, "")
            .replace(/\s+ADD\s*$/i, "")
        );

        const name =
          cleanText(
            container.querySelector("h3, h4, [class*='name'], [class*='title']")?.textContent || ""
          ) ||
          titleFromText ||
          tokens.find(
            (token) =>
              !/^(\d+\s*MINS|ADD|\d+%\s*OFF|₹|\d+\s?g|\d+\s?kg)$/i.test(token) &&
              !token.includes("₹") &&
              token.length > 6
          ) ||
          "";

        if (!name) {
          continue;
        }

        const link = container.querySelector("a[href]")?.getAttribute("href") || "";
        const image =
          container.querySelector("img")?.getAttribute("src") ||
          container.querySelector("img")?.getAttribute("data-src") ||
          "";
        const deliveryMatch = text.match(/\b\d+\s*MINS\b/i);
        const delivery = deliveryMatch ? deliveryMatch[0].toUpperCase() : "Instant";

        rows.push({
          name,
          price: prices[0],
          originalPrice: prices[1] || prices[0],
          delivery,
          image,
          productUrl: link,
        });
      }

      return rows;
    });

    const normalizedDomProducts = normalizeBlinkitDomProducts(domProducts, searchUrl);
    if (normalizedDomProducts.length) {
      return normalizedDomProducts;
    }

    const html = await page.content();
    return parseBlinkitProducts(html);
  } finally {
    await browser.close();
  }
}

exports.scrapeBlinkit = async (query) => {
  const searchUrl = `https://blinkit.com/s/?q=${encodeURIComponent(query)}`;

  const run = async () => {
    await randomDelay(500, 1500);

    let products = [];
    let httpError = null;

    try {
      const html = await fetchHtml(searchUrl, env.scrapeTimeoutMs, {
        platform: "blinkit",
      });
      products = parseBlinkitProducts(html);
    } catch (error) {
      httpError = error;
    }

    if (!products.length) {
      products = await fetchWithPlaywright(searchUrl);
    }

    if (!products.length) {
      const reason = httpError?.message ? ` (${httpError.message})` : "";
      const error = new Error(`No products parsed from Blinkit${reason}`);
      error.platform = "Blinkit";
      throw error;
    }

    return products;
  };

  return withRetry(run, {
    retries: 1,
    platform: "Blinkit",
  });
};