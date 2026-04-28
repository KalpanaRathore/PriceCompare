const axios = require("axios");

async function main() {
  const chunkUrl =
    "https://www.bbassets.com/monsters-inc/static/_next/static/chunks/pages/%5Blisting%5D/%5B%5B...slug%5D%5D-2a7c1c13be53f4df.js";

  const response = await axios.get(chunkUrl, { timeout: 30000 });
  const text = String(response.data || "");

  const needles = [
    "api",
    "search",
    "product",
    "bbnow",
    "listing",
    "graphql",
    "rest",
    "_next/data",
    "ps/?q",
  ];

  for (const needle of needles) {
    console.log(needle, text.toLowerCase().includes(needle.toLowerCase()));
  }

  const regex = /(https?:\/\/[^\"'\s)]+|\/[a-z0-9_\-/]*api[a-z0-9_\-/?.=&]*|\/[a-z0-9_\-/]*(search|product|listing)[a-z0-9_\-/?.=&]*)/gi;
  const matches = text.match(regex) || [];
  const unique = Array.from(new Set(matches))
    .filter((item) => /api|search|product|listing|bbnow|graphql|rest/i.test(item))
    .slice(0, 400);

  console.log("matches", unique.length);
  console.log(unique);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
