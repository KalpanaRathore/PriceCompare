const axios = require("axios");

async function main() {
  const url = "https://www.bigbasket.com/listing-svc/v2/products?type=ps&slug=milk&page=1";
  const response = await axios.get(url, {
    timeout: 25000,
    headers: {
      "user-agent": "Mozilla/5.0",
      "accept-language": "en-IN,en;q=0.9",
      referer: "https://www.bigbasket.com/ps/?q=milk",
      "osmos-enabled": "true",
    },
  });

  const products = response.data?.tabs?.[0]?.product_info?.products || [];
  console.log("count", products.length);

  if (!products.length) {
    return;
  }

  const first = products[0];
  console.log("keys", Object.keys(first));
  console.log("pricingKeys", Object.keys(first.pricing || {}));
  console.log("discountKeys", Object.keys((first.pricing || {}).discount || {}));
  console.log("brand", first.brand);
  console.log("sample", JSON.stringify(first, null, 2).slice(0, 3000));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
