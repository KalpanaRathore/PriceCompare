const axios = require("axios");

async function findModule(text, moduleKey) {
  const marker = `${moduleKey}:function`;
  const idx = text.indexOf(marker);
  if (idx < 0) {
    return null;
  }

  const start = Math.max(0, idx - 200);
  const end = Math.min(text.length, idx + 3000);
  return text.slice(start, end);
}

async function main() {
  const appUrl =
    "https://instamart-media-assets.swiggy.com/swiggy/raw/upload/dash-front-assets/js/app.es6.adadc1c61f04f7ae.js";
  const searchUrl =
    "https://instamart-media-assets.swiggy.com/swiggy/raw/upload/dash-front-assets/js/instamart-search-4.es6.e4e02f9c303532b6.js";

  const appText = String((await axios.get(appUrl, { timeout: 20000 })).data || "");
  const searchText = String((await axios.get(searchUrl, { timeout: 20000 })).data || "");

  const moduleKeys = ["3aJF2H", "Gotloh", "1cLlrj", "5PDyIm"];

  for (const key of moduleKeys) {
    const fromSearch = await findModule(searchText, key);
    const fromApp = await findModule(appText, key);

    console.log("\n=== MODULE", key, "in search chunk ===");
    console.log(fromSearch || "not found");

    console.log("\n=== MODULE", key, "in app chunk ===");
    console.log(fromApp || "not found");
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
