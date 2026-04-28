const axios = require("axios");

async function main() {
  const pageUrl = "https://www.bigbasket.com/ps/?q=milk";
  const pageRes = await axios.get(pageUrl, {
    timeout: 25000,
    headers: {
      "user-agent": "Mozilla/5.0",
      "accept-language": "en-IN,en;q=0.9",
    },
  });

  const html = String(pageRes.data || "");
  const match = html.match(/<script id=\"__NEXT_DATA__\"[^>]*>([\s\S]*?)<\/script>/i);
  const nextData = match ? JSON.parse(match[1]) : {};
  const visitorCookies = nextData?.props?.visitorCookies || {};

  const cookieHeader = Object.entries(visitorCookies)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");

  const nhid = String(visitorCookies._bb_nhid || "7427");
  const dseid = String(visitorCookies._bb_dseid || "7427");

  const queries = [
    `?type=ps&slug=milk&page=1`,
    `?type=ps&slug=milk&page=1&nc=as`,
    `?type=ps&slug=milk&page=1&mid=${encodeURIComponent(nhid)}`,
    `?type=ps&slug=milk&page=1&address_id=${encodeURIComponent(dseid)}`,
    `?type=ps&slug=milk&page=1&mid=${encodeURIComponent(nhid)}&address_id=${encodeURIComponent(dseid)}`,
    `?type=ps&slug=milk&page=1&lat-long=12.9716,77.5946`,
    `?type=ps&slug=milk&page=1&mid=${encodeURIComponent(nhid)}&lat-long=12.9716,77.5946`,
  ];

  for (const query of queries) {
    const url = `https://www.bigbasket.com/listing-svc/v2/products${query}`;

    try {
      const response = await axios.get(url, {
        timeout: 25000,
        headers: {
          "user-agent": "Mozilla/5.0",
          "accept-language": "en-IN,en;q=0.9",
          referer: pageUrl,
          cookie: cookieHeader,
          "osmos-enabled": "true",
        },
      });

      const data = response.data;
      const products = data?.tabs?.[0]?.product_info?.products;

      console.log("\nOK", query, "status", response.status, "products", Array.isArray(products) ? products.length : "na");

      if (Array.isArray(products) && products.length) {
        console.log("first", products[0]?.desc || products[0]?.name || "");
        console.log("keys", Object.keys(products[0] || {}));
        console.log("pricingKeys", Object.keys((products[0] || {}).pricing || {}));
        console.log("discountKeys", Object.keys(((products[0] || {}).pricing || {}).discount || {}));
        console.log("sample", JSON.stringify(products[0] || {}, null, 2).slice(0, 2200));
        break;
      }

      console.log(JSON.stringify(data).slice(0, 220));
    } catch (error) {
      console.log("\nERR", query, "->", error.response?.status || error.code || error.message);
      console.log(JSON.stringify(error.response?.data || {}).slice(0, 260));
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
