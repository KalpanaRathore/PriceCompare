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
        amazon.scraper.js
        flipkart.scraper.js
        blinkit.scraper.js
        zepto.scraper.js
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

`GET /api/products/search?q=iphone&page=1&pageSize=20&platforms=amazon,flipkart,blinkit,zepto`

Unified comparison block included in response:

```json
{
  "query": "iphone",
  "results": [
    {
      "id": "iphone-14",
      "name": "iPhone 14",
      "bestDeal": "Flipkart",
      "platforms": [
        { "platform": "Amazon", "price": 70000, "productUrl": "...", "inStock": true },
        { "platform": "Flipkart", "price": 68000, "productUrl": "...", "inStock": true },
        { "platform": "Blinkit", "price": 71000, "productUrl": "...", "inStock": true },
        { "platform": "Zepto", "price": 70500, "productUrl": "...", "inStock": true }
      ]
    }
  ]
}
```

2. Product history

`GET /api/products/:productId/history?platform=Amazon&days=30`

## Notes

- Search flow: cache first, scrape second, normalize third, persist history fourth.
- Scraper failures are isolated with `Promise.allSettled`; partial results are returned when possible.
- Search response includes unified comparison data per product:
  - `comparison.bestOffer` (lowest price offer)
  - `comparison.minPrice`, `comparison.maxPrice`, `comparison.priceSpread`, `comparison.avgPrice`
  - `comparison.offerCount`, `comparison.platformCount`
- Search response includes platform metadata under `platforms`:
  - `platforms.requested`
  - `platforms.status` with per-platform success/failure and result counts.
- Cache defaults to in-memory for development. Set `USE_REDIS=true` to use Redis.

## Proxy Configuration (For Blocked Platforms)

Some platforms (especially Blinkit) may block data-center IPs and return 403 for server-side scraping.

You can configure a proxy without changing code:

- `SCRAPE_PROXY_URL=http://username:password@host:port` (global fallback)
- `AMAZON_PROXY_URL=http://username:password@host:port` (Amazon only)
- `FLIPKART_PROXY_URL=http://username:password@host:port` (Flipkart only)
- `BLINKIT_PROXY_URL=http://username:password@host:port` (Blinkit only)
- `ZEPTO_PROXY_URL=http://username:password@host:port` (Zepto only)

Platform-specific proxy values take priority over `SCRAPE_PROXY_URL`.