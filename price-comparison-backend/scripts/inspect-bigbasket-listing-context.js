const axios = require("axios");

async function main() {
  const chunkUrl =
    "https://www.bbassets.com/monsters-inc/static/_next/static/chunks/pages/%5Blisting%5D/%5B%5B...slug%5D%5D-2a7c1c13be53f4df.js";
  const response = await axios.get(chunkUrl, { timeout: 30000 });
  const text = String(response.data || "");

  const needles = ["/listing-svc/v2/products", "listing-svc", "products:", "fetch(", "axios", "facets"];

  for (const needle of needles) {
    let start = 0;
    let idx = text.indexOf(needle, start);
    let count = 0;
    while (idx >= 0 && count < 5) {
      const from = Math.max(0, idx - 500);
      const to = Math.min(text.length, idx + 800);
      console.log("\n=== needle", needle, "idx", idx, "===");
      console.log(text.slice(from, to));
      start = idx + needle.length;
      idx = text.indexOf(needle, start);
      count += 1;
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
