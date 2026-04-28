const axios = require("axios");

async function main() {
  const url =
    "https://instamart-media-assets.swiggy.com/swiggy/raw/upload/dash-front-assets/js/instamart-search-4.es6.e4e02f9c303532b6.js";
  const response = await axios.get(url, { timeout: 20000 });
  const text = String(response.data || "");

  const needles = [
    "/api/instamart/search/v2",
    "/api/instamart/search/mart/v2",
    "/api/instamart/search/suggest-items/v2",
  ];

  for (const needle of needles) {
    const index = text.indexOf(needle);
    console.log("\n===", needle, "index", index, "===");
    if (index < 0) {
      continue;
    }

    const start = Math.max(0, index - 800);
    const end = Math.min(text.length, index + 1200);
    console.log(text.slice(start, end));
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
