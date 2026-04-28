const searchService = require("../src/services/search.service");

async function main() {
  const res = await searchService.search({
    q: "milk",
    page: 1,
    pageSize: 40,
    platforms: ["blinkit", "bbnow", "flipkartminutes", "zepto", "instamart"],
    mode: "fast",
  });

  const onlyFm = res.products.filter(
    (product) =>
      Array.isArray(product.offers) &&
      product.offers.length === 1 &&
      product.offers[0].platform === "Flipkart Minutes"
  );

  const withFm = res.products.filter(
    (product) =>
      Array.isArray(product.offers) &&
      product.offers.some((offer) => offer.platform === "Flipkart Minutes")
  );

  console.log("totalProducts", res.products.length);
  console.log("withFlipkartMinutes", withFm.length);
  console.log("onlyFlipkartMinutes", onlyFm.length);
  console.log(
    "onlyFlipkartMinutesSample",
    onlyFm.slice(0, 5).map((product) => product.name)
  );
}

main().catch((error) => {
  console.error(error.message);
  console.error(JSON.stringify(error.details || {}, null, 2));
  process.exit(1);
});
