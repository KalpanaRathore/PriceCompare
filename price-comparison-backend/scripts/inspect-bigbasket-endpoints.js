const axios = require("axios");

async function main() {
  const url = "https://www.bigbasket.com/ps/?q=milk";
  const response = await axios.get(url, {
    timeout: 20000,
    headers: {
      "user-agent": "Mozilla/5.0",
      "accept-language": "en-IN,en;q=0.9",
    },
  });

  const html = String(response.data || "");
  const regex = /(https?:\/\/[^\"'\s<]+|\/[a-z0-9\-_/]*api[a-z0-9\-_/?.=&]*|\/[a-z0-9\-_/]*(search|product)[a-z0-9\-_/?.=&]*)/gi;
  const matches = html.match(regex) || [];

  const unique = Array.from(new Set(matches))
    .filter((item) => /api|search|product|bbnow|listing/i.test(item))
    .slice(0, 200);

  console.log("count", unique.length);
  console.log(unique);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
