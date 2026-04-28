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

  await page.waitForTimeout(1500);

  const result = await page.evaluate(async () => {
    const payload = {
      facets: [],
      sortAttribute: "",
      query: "milk",
      search_results_offset: 0,
      page_type: "SEARCH_PAGE",
      is_pre_search_tag: false,
    };

    async function callOnce(headers = {}) {
      try {
        const response = await fetch("/api/instamart/search/v2", {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "content-type": "application/json",
            ...headers,
          },
          body: JSON.stringify(payload),
        });

        const text = await response.text();
        return {
          status: response.status,
          ok: response.ok,
          length: text.length,
          snippet: text.slice(0, 300),
          url: response.url,
          headers: Array.from(response.headers.entries()),
        };
      } catch (error) {
        return {
          status: -1,
          ok: false,
          length: 0,
          snippet: String(error?.message || error),
          url: "/api/instamart/search/v2",
        };
      }
    }

    const calls = [];
    calls.push(await callOnce());
    calls.push(await callOnce());
    calls.push(
      await callOnce({
        "x-channel": "Swiggy-Dweb",
        "x-device-id": "instamart-debug-device",
      })
    );
    calls.push(
      await callOnce({
        "x-build-version": "debug",
        "x-channel": "Swiggy-Dweb",
        "x-device-id": "instamart-debug-device",
      })
    );

    return {
      calls,
      locationHref: window.location.href,
      cookie: document.cookie,
      localStorageKeys: Object.keys(localStorage || {}),
    };
  });

  console.log(JSON.stringify(result, null, 2));

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
