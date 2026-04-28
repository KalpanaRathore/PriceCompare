const axios = require("axios");

async function main() {
  const pageUrl = "https://www.bigbasket.com/ps/?q=milk";
  const pageRes = await axios.get(pageUrl, {
    timeout: 25000,
    headers: {
      "user-agent": "Mozilla/5.0",
      "accept-language": "en-IN,en;q=0.9",
    },
  });

  const html = String(pageRes.data || "");
  const scriptMatches = [...html.matchAll(/<script[^>]+src=\"([^\"]+)\"/gi)];
  const scripts = scriptMatches
    .map((item) => item[1])
    .filter((src) => src.includes("bbassets.com") || src.includes("_next/static"));

  console.log("scriptCount", scripts.length);

  for (const src of scripts) {
    const url = src.startsWith("http") ? src : `https://www.bigbasket.com${src}`;

    try {
      const res = await axios.get(url, { timeout: 30000 });
      const text = String(res.data || "");
      const hasQueryBuilder = text.includes("getListingQuery");
      const hasListingSvc = text.includes("/listing-svc/v2/products");

      if (!hasQueryBuilder && !hasListingSvc) {
        continue;
      }

      console.log("\nMATCH", url, "len", text.length, "queryBuilder", hasQueryBuilder, "listingSvc", hasListingSvc);

      if (hasQueryBuilder) {
        let idx = text.indexOf("getListingQuery");
        let count = 0;
        while (idx >= 0 && count < 3) {
          const from = Math.max(0, idx - 600);
          const to = Math.min(text.length, idx + 1600);
          console.log(text.slice(from, to));
          idx = text.indexOf("getListingQuery", idx + 1);
          count += 1;
        }
      }
    } catch (error) {
      // ignore chunk errors
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
