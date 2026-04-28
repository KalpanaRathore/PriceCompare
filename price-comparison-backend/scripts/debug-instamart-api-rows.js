const { createBrowser } = require("../src/services/scrapers/browser.factory");
const env = require("../src/config/env");

async function main() {
  const searchUrl = "https://www.swiggy.com/instamart/search?query=milk";
  const browser = await createBrowser("instamart");
  const page = await browser.newPage({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  });

  await page.goto(searchUrl, {
    waitUntil: "domcontentloaded",
    timeout: env.scrapeTimeoutMs,
  });

  await page.waitForTimeout(2200);

  const apiProducts = await page.evaluate(async ({ maxResults, query }) => {
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

    function extractProducts(payload) {
      const cards = Array.isArray(payload?.data?.cards) ? payload.data.cards : [];
      const cardShape = cards.slice(0, 8).map((entry) => ({
        keys: Object.keys(entry || {}),
        cardKeys: Object.keys((entry || {}).card || {}),
        nestedCardKeys: Object.keys(((entry || {}).card || {}).card || {}),
        type:
          (entry || {}).card?.card?.["@type"] ||
          (entry || {}).card?.["@type"] ||
          (entry || {})["@type"] ||
          "",
      }));
      const rows = [];

      for (const cardWrapper of cards) {
        const card = cardWrapper?.card?.card;
        const type = String(card?.["@type"] || "");
        if (!type.includes("ItemCollectionCard")) {
          continue;
        }

        const items = Array.isArray(card?.items) ? card.items : [];

        for (const item of items) {
          const variations = Array.isArray(item?.variations) && item.variations.length
            ? item.variations
            : [item];

          for (const variation of variations) {
            rows.push({ item, variation });
            if (rows.length >= maxResults) {
              return rows;
            }
          }
        }
      }

      return rows;

      // eslint-disable-next-line no-unreachable
      return {
        rows,
        cardShape,
      };
    }

    const attempts = [];

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const result = await callSearchMart();
      attempts.push({
        attempt,
        status: result.status,
        wafAction: result.wafAction,
        textLen: result.text ? result.text.length : 0,
        snippet: (result.text || "").slice(0, 80),
      });

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
        const extracted = extractProducts(payload);
        if (extracted.length) {
          return {
            attempts,
            rowsCount: extracted.length,
            sample: extracted[0],
          };
        }

        attempts.push({
          attempt,
          noRows: true,
          cardShape: (Array.isArray(payload?.data?.cards) ? payload.data.cards : [])
            .slice(0, 6)
            .map((entry) => ({
              keys: Object.keys(entry || {}),
              cardKeys: Object.keys((entry || {}).card || {}),
              nestedCardKeys: Object.keys(((entry || {}).card || {}).card || {}),
              type:
                (entry || {}).card?.card?.["@type"] ||
                (entry || {}).card?.["@type"] ||
                (entry || {})["@type"] ||
                "",
            })),
        });
      } catch (error) {
        attempts.push({ attempt, parseError: String(error?.message || error) });
      }
    }

    return {
      attempts,
      rowsCount: 0,
      sample: null,
    };
  }, {
    maxResults: 80,
    query: "milk",
  });

  console.log(JSON.stringify(apiProducts, null, 2));

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
