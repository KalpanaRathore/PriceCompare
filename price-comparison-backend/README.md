# Price Comparison Backend

Express + MongoDB backend skeleton for price search and history APIs.

## Project Structure

```text
price-comparison-backend/
  src/
    app.js
    server.js
    config/
      env.js
      db.js
      logger.js
    routes/
      index.js
      search.routes.js
      history.routes.js
    controllers/
      search.controller.js
      history.controller.js
    services/
      search.service.js
      normalization.service.js
      cache.service.js
      history.service.js
      scrapers/
        blinkit.scraper.js
        bbnow.scraper.js
        flipkartminutes.scraper.js
        zepto.scraper.js
        instamart.scraper.js
        browser.factory.js
    models/
      ProductSnapshot.model.js
      PriceHistory.model.js
    middlewares/
      error.middleware.js
      notFound.middleware.js
      rateLimit.middleware.js
      validateQuery.middleware.js
    utils/
      asyncHandler.js
      time.js
      http.js
  .env
  .env.example
  package.json
  README.md
```

## Setup

1. Install dependencies:

```bash
npm install
```

2. Start development server:

```bash
npm run dev
```

3. Start production mode:

```bash
npm start
```

## API Endpoints

1. Search products

`GET /api/products/search?q=iphone&page=1&pageSize=20`

Optional platform filter:

`GET /api/products/search?q=iphone&page=1&pageSize=20&platforms=blinkit,bbnow,flipkartminutes,zepto,instamart`

Unified comparison block included in response:

```json
{
  "query": "iphone",
  "results": [
    {
      "id": "iphone-14",
      "name": "iPhone 14",
        "bestDeal": "Blinkit",
      "platforms": [
        { "platform": "Blinkit", "price": 71000, "productUrl": "...", "inStock": true },
        { "platform": "BigBasket BB Now", "price": 69800, "productUrl": "...", "inStock": true },
        { "platform": "Flipkart Minutes", "price": 70300, "productUrl": "...", "inStock": true },
        { "platform": "Zepto", "price": 70500, "productUrl": "...", "inStock": true },
        { "platform": "Swiggy Instamart", "price": 69900, "productUrl": "...", "inStock": true }
      ]
    }
  ]
}
```

2. Product history

`GET /api/products/:productId/history?platform=Blinkit&days=30`

## Notes

  - `comparison.bestOffer` (lowest price offer)
  - `comparison.minPrice`, `comparison.maxPrice`, `comparison.priceSpread`, `comparison.avgPrice`
  - `comparison.offerCount`, `comparison.platformCount`
  - `platforms.requested`
  - `platforms.status` with per-platform success/failure and result counts.

## Proxy Configuration (For Blocked Platforms)

Some platforms (especially Blinkit) may block data-center IPs and return 403 for server-side scraping.

You can configure a proxy without changing code:


Platform-specific proxy values take priority over `SCRAPE_PROXY_URL`.