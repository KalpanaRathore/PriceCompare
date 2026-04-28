const axios = require("axios");

async function main() {
  const chunkUrl =
    "https://www.bbassets.com/monsters-inc/static/_next/static/chunks/pages/%5Blisting%5D/%5B%5B...slug%5D%5D-2a7c1c13be53f4df.js";
  const response = await axios.get(chunkUrl, { timeout: 30000 });
  const text = String(response.data || "");

  const needles = ["getListingQuery", "listingQuery", "listing-svc/v2/products", "campaign_types", "filter="];

  for (const needle of needles) {
    const idx = text.indexOf(needle);
    console.log("\nneedle", needle, "idx", idx);
    if (idx >= 0) {
      const from = Math.max(0, idx - 1200);
      const to = Math.min(text.length, idx + 2500);
      console.log(text.slice(from, to));
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
