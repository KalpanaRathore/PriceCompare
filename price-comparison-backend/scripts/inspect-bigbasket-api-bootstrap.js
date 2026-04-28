const axios = require("axios");

async function main() {
  const pageUrl = "https://www.bigbasket.com/ps/?q=milk";
  const pageResponse = await axios.get(pageUrl, {
    timeout: 25000,
    headers: {
      "user-agent": "Mozilla/5.0",
      "accept-language": "en-IN,en;q=0.9",
    },
  });

  const html = String(pageResponse.data || "");
  const match = html.match(/<script id=\"__NEXT_DATA__\"[^>]*>([\s\S]*?)<\/script>/i);
  if (!match) {
    console.log("no_next_data");
    return;
  }

  const nextData = JSON.parse(match[1]);
  const visitorCookies = nextData?.props?.visitorCookies || {};

  const cookieHeader = Object.entries(visitorCookies)
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");

  const nhid = String(visitorCookies._bb_nhid || "");
  const dseid = String(visitorCookies._bb_dseid || "");

  const testCalls = [
    {
      name: "plain",
      url: "https://www.bigbasket.com/listing-svc/v2/products?q=milk&page=1",
      headers: {
        "user-agent": "Mozilla/5.0",
        "accept-language": "en-IN,en;q=0.9",
        referer: pageUrl,
        cookie: cookieHeader,
        "osmos-enabled": "true",
      },
    },
    {
      name: "with-mid-header",
      url: "https://www.bigbasket.com/listing-svc/v2/products?q=milk&page=1",
      headers: {
        "user-agent": "Mozilla/5.0",
        "accept-language": "en-IN,en;q=0.9",
        referer: pageUrl,
        cookie: cookieHeader,
        "osmos-enabled": "true",
        mid: nhid,
        Mid: nhid,
        "x-mid": nhid,
        "x-address-id": dseid,
      },
    },
    {
      name: "with-latlong-header",
      url: "https://www.bigbasket.com/listing-svc/v2/products?q=milk&page=1",
      headers: {
        "user-agent": "Mozilla/5.0",
        "accept-language": "en-IN,en;q=0.9",
        referer: pageUrl,
        cookie: cookieHeader,
        "osmos-enabled": "true",
        "lat-long": "12.9716,77.5946",
        latitude: "12.9716",
        longitude: "77.5946",
      },
    },
    {
      name: "with-query-mid",
      url: `https://www.bigbasket.com/listing-svc/v2/products?q=milk&page=1&mid=${encodeURIComponent(nhid)}`,
      headers: {
        "user-agent": "Mozilla/5.0",
        "accept-language": "en-IN,en;q=0.9",
        referer: pageUrl,
        cookie: cookieHeader,
        "osmos-enabled": "true",
      },
    },
  ];

  for (const test of testCalls) {
    try {
      const response = await axios.get(test.url, {
        timeout: 25000,
        headers: test.headers,
      });

      const data = response.data;
      const products = data?.tabs?.[0]?.product_info?.products;

      console.log("\nOK", test.name, "status", response.status, "products", Array.isArray(products) ? products.length : "na");
      if (Array.isArray(products) && products.length) {
        console.log("sample", products[0]?.desc || products[0]?.name || "");
      } else {
        console.log(JSON.stringify(data).slice(0, 300));
      }
    } catch (error) {
      console.log("\nERR", test.name, error.response?.status || error.code || error.message);
      console.log(JSON.stringify(error.response?.data || {}).slice(0, 320));
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
