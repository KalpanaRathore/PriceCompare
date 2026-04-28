const axios = require("axios");

async function inspect(url) {
  const response = await axios.get(url, { timeout: 20000 });
  const text = String(response.data || "");

  const endpointRegex = /https?:\/\/[^\"'\s)]+|\/dapi[^\"'\s)]+|\/api[^\"'\s)]+/g;
  const matches = text.match(endpointRegex) || [];

  const unique = Array.from(new Set(matches))
    .filter((value) =>
      value.includes("dapi") ||
      value.includes("instamart") ||
      value.includes("search") ||
      value.includes("api")
    )
    .slice(0, 200);

  console.log("URL", url);
  console.log("FOUND", unique.length);
  console.log(unique);
}

async function main() {
  await inspect(
    "https://instamart-media-assets.swiggy.com/swiggy/raw/upload/dash-front-assets/js/instamart-search-4.es6.e4e02f9c303532b6.js"
  );
  await inspect(
    "https://instamart-media-assets.swiggy.com/swiggy/raw/upload/dash-front-assets/js/instamart-4.es6.34fe132c695819a2.js"
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
