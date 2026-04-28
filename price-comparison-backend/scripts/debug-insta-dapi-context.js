const axios = require("axios");

async function main() {
  const urls = [
    "https://instamart-media-assets.swiggy.com/swiggy/raw/upload/dash-front-assets/js/vendors.es6.05fe88f6a9b4ef83.js",
    "https://instamart-media-assets.swiggy.com/swiggy/raw/upload/dash-front-assets/js/app.es6.adadc1c61f04f7ae.js",
    "https://instamart-media-assets.swiggy.com/swiggy/raw/upload/dash-front-assets/js/instamart-search-4.es6.e4e02f9c303532b6.js",
  ];

  for (const url of urls) {
    const response = await axios.get(url, { timeout: 20000 });
    const text = String(response.data || "");
    console.log("\nFILE", url);
    console.log("contains /dapi", text.includes("/dapi"));

    const idx = text.indexOf("/dapi");
    if (idx >= 0) {
      console.log(text.slice(Math.max(0, idx - 500), idx + 1200));
    }

    const idx2 = text.indexOf("BNMGbr");
    if (idx2 >= 0) {
      console.log("BNMGbr near:");
      console.log(text.slice(Math.max(0, idx2 - 500), idx2 + 1200));
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
