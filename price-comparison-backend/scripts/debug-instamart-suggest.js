const { createBrowser } = require("../src/services/scrapers/browser.factory");
const env = require("../src/config/env");

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

  const result = await page.evaluate(async () => {
    const candidates = [
      "/api/instamart/search/suggest-items/v2?query=milk",
      "/api/instamart/search/suggest-items/v2?q=milk",
      "/api/instamart/search/suggest-items/v2?search_query=milk",
      "/api/instamart/search/suggest-items/v2?searchTerm=milk",
      "/api/instamart/search/mart/v2?query=milk",
      "/api/instamart/search/mart/v2?query=milk&isCartPresent=false",
      "/api/instamart/search/mart/v2?isCartPresent=false",
    ];

    async function call(url) {
      try {
        const response = await fetch(url, {
          method: "GET",
          credentials: "same-origin",
          headers: {
            "x-channel": "Swiggy-Dweb",
            "x-device-id": "instamart-debug-device",
          },
        });
        const text = await response.text();
        return {
          url,
          status: response.status,
          ok: response.ok,
          headers: Array.from(response.headers.entries()),
          body: text.slice(0, 600),
        };
      } catch (error) {
        return {
          url,
          status: -1,
          ok: false,
          headers: [],
          body: String(error?.message || error),
        };
      }
    }

    const responses = [];
    for (const url of candidates) {
      responses.push(await call(url));
    }

    return responses;
  });

  console.log(JSON.stringify(result, null, 2));

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
