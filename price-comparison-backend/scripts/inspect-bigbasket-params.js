const axios = require("axios");

async function main() {
  const chunkUrl =
    "https://www.bbassets.com/monsters-inc/static/_next/static/chunks/pages/%5Blisting%5D/%5B%5B...slug%5D%5D-2a7c1c13be53f4df.js";
  const response = await axios.get(chunkUrl, { timeout: 30000 });
  const text = String(response.data || "");

  const needles = [
    "lat-long",
    "AddressId",
    "Mid",
    "address",
    "mid",
    "_bb_nhid",
    "listing-svc/v2/products",
    "headers",
  ];

  for (const needle of needles) {
    let idx = text.indexOf(needle);
    console.log("\nneedle", needle, "first", idx);
    let count = 0;
    while (idx >= 0 && count < 5) {
      const from = Math.max(0, idx - 300);
      const to = Math.min(text.length, idx + 500);
      console.log("---", idx, "---");
      console.log(text.slice(from, to));
      idx = text.indexOf(needle, idx + needle.length);
      count += 1;
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
