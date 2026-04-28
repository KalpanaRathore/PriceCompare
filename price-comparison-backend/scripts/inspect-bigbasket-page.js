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
  console.log("len", html.length);

  const needles = [
    "product_name",
    "discounted_price",
    "ProductCard",
    "__NEXT_DATA__",
    "sku",
    "brand",
    "\u20B9",
  ];

  for (const needle of needles) {
    console.log(needle, html.toLowerCase().includes(needle.toLowerCase()));
  }

  const match = html.match(/<script id=\"__NEXT_DATA__\"[^>]*>([\s\S]*?)<\/script>/i);
  if (!match) {
    console.log("no-next-data");
    return;
  }

  console.log("nextDataLen", match[1].length);
  const nextData = JSON.parse(match[1]);
  const payload = JSON.stringify(nextData);
  console.log("containsSearchResult", payload.includes("search_result"));
  console.log("containsProduct", payload.includes("product"));
  console.log(payload.slice(0, 1200));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
