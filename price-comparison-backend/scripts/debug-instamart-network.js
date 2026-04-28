const { createBrowser } = require("../src/services/scrapers/browser.factory");
const env = require("../src/config/env");

async function main() {
  const browser = await createBrowser("instamart");
  const page = await browser.newPage({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  });

  const seen = [];

  page.on("response", async (response) => {
    try {
      const url = response.url();
      const status = response.status();
      const ct = response.headers()["content-type"] || "";

      if (!url.includes("swiggy") && !url.includes("instamart")) {
        return;
      }

      if (seen.length >= 40) {
        return;
      }

      const item = { url, status, contentType: ct, bodySnippet: "" };

      if (ct.includes("application/json") || url.includes("dapi") || url.includes("api")) {
        try {
          const text = await response.text();
          item.bodySnippet = String(text || "").slice(0, 500);
        } catch (error) {
          item.bodySnippet = `read-failed: ${error.message}`;
        }
      }

      seen.push(item);
    } catch (error) {
      // Ignore response inspection failures.
    }
  });

  const url = "https://www.swiggy.com/instamart/search?query=milk";
  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: env.scrapeTimeoutMs,
  });

  await page.waitForTimeout(5000);

  console.log("FINAL_URL", page.url());
  console.log("TITLE", await page.title());
  console.log("RESPONSES", JSON.stringify(seen, null, 2));

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
