const { createBrowser } = require("../src/services/scrapers/browser.factory");
const env = require("../src/config/env");

function walk(node, visitor) {
  if (!node || typeof node !== "object") {
    return;
  }

  visitor(node);

  if (Array.isArray(node)) {
    for (const item of node) {
      walk(item, visitor);
    }
    return;
  }

  for (const value of Object.values(node)) {
    walk(value, visitor);
  }
}

async function main() {
  const browser = await createBrowser("instamart");
  const page = await browser.newPage({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  });

  await page.goto("https://www.swiggy.com/instamart/search?query=milk", {
    waitUntil: "domcontentloaded",
    timeout: env.scrapeTimeoutMs,
  });
  await page.waitForTimeout(2500);

  const text = await page.evaluate(async () => {
    async function callOnce() {
      const response = await fetch("/api/instamart/search/mart/v2?query=milk&isCartPresent=false", {
        method: "GET",
        credentials: "same-origin",
        headers: {
          "x-channel": "Swiggy-Dweb",
          "x-device-id": "instamart-debug-device",
        },
      });

      return {
        status: response.status,
        text: await response.text(),
      };
    }

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const result = await callOnce();
      if (result.text && result.text.trim()) {
        return result.text;
      }
    }

    return "";
  });

  let json;
  try {
    json = JSON.parse(text);
  } catch (error) {
    console.log("NON_JSON", text.slice(0, 800));
    await browser.close();
    return;
  }

  const collectionCards = [];
  const productLikeItems = [];
  walk(json, (value) => {
    const keys = Object.keys(value || {});

    if (Array.isArray(value.items) && value.items.length) {
      const firstItem = value.items[0];
      const firstVariation =
        firstItem && Array.isArray(firstItem.variations) && firstItem.variations.length
          ? firstItem.variations[0]
          : null;

      collectionCards.push({
        type: value["@type"] || value.viewType || value.widgetType || "unknown",
        title: value.title || value.headerTitle || value.name || "",
        itemCount: value.items.length,
        firstItem,
        firstVariation,
        firstVariationPrice: firstVariation?.price,
        firstVariationPriceJson: firstVariation?.price
          ? JSON.stringify(firstVariation.price)
          : null,
        firstVariationMedias: firstVariation?.medias,
        firstVariationImageIds: firstVariation?.imageIds,
      });
    }

    if (
      ("name" in value || "title" in value || "display_name" in value) &&
      ("price" in value || "offerPrice" in value || "final_price" in value || "mrp" in value)
    ) {
      productLikeItems.push(value);
    }
  });

  console.log("JSON_KEYS", Object.keys(json));
  console.log("TEXT_LEN", text.length);
  console.log("COLLECTION_CARDS", collectionCards.slice(0, 25));
  console.log("PRODUCT_LIKE_ITEMS", productLikeItems.slice(0, 25));

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
