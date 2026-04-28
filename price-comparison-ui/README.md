# Price Comparison UI (React + TypeScript)

Frontend for a product price comparison website that fetches real data from a backend API.

## Features

- Live search input with backend API calls
- Marketplace comparison (Blinkit, BigBasket BB Now, Flipkart Minutes, Zepto, and Swiggy Instamart)
- Platform filter chips and max-price slider
- Pagination and infinite scroll for large result sets
- Product cards with offer links and price history sparkline
- Comparison table for quick deal evaluation
- Loading, retry, toast notifications, error, and empty states
- Responsive professional UI

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure backend API URL:

```bash
cp .env.example .env
```

Set this variable:

```env
VITE_API_BASE_URL=http://localhost:4000/api
VITE_HTTP_CLIENT=fetch
VITE_AUTH_TOKEN_STORAGE_KEY=pricepilot_auth_token
VITE_USE_SAMPLE_FALLBACK=true
```

Notes:

- Set `VITE_HTTP_CLIENT=axios` to use Axios client with interceptors and auth header support.
- Set `VITE_USE_SAMPLE_FALLBACK=true` while backend is not ready.
- Once backend is live, set `VITE_USE_SAMPLE_FALLBACK=false`.

3. Run app:

```bash
npm run dev
```

## API Contract

The frontend expects:

`GET /products/search?q=<query>&page=<number>&pageSize=<number>`

Sample response:

```json
{
  "query": "sony xm5",
  "total": 1,
  "page": 1,
  "pageSize": 20,
  "totalPages": 1,
  "hasMore": false,
  "fetchedAt": "2026-03-17T10:20:30.000Z",
  "products": [
    {
      "id": "sony-wh1000xm5",
      "name": "Sony WH-1000XM5 Wireless Headphones",
      "brand": "Sony",
      "category": "Audio",
      "image": "https://cdn.example.com/products/sony-wh1000xm5.jpg",
      "qualityScore": 9.4,
      "offers": [
        {
          "platform": "Blinkit",
          "price": 71000,
          "originalPrice": 74900,
          "rating": 4.5,
          "inStock": true,
          "delivery": "Tomorrow",
          "productUrl": "https://blinkit.com/example-product-link",
          "priceHistory": [
            { "timestamp": "2026-03-10", "price": 31990 },
            { "timestamp": "2026-03-12", "price": 29990 },
            { "timestamp": "2026-03-14", "price": 28990 },
            { "timestamp": "2026-03-17", "price": 26990 }
          ]
        }
      ]
    }
  ]
}
```

## Mapping To UI

- API request is handled in `src/api/productsApi.ts`
- Axios client, timeout, and auth interceptor are in `src/api/axiosClient.ts`
- API types and sample payload are in `src/api/contracts.ts`
- Backend response is mapped to UI product type in `src/utils/productMappers.ts`
- UI consumes mapped `Product[]` in `src/App.tsx`

## New UI Behavior

- Backend pagination is loaded page-by-page.
- Infinite scroll auto-loads the next backend page when the sentinel enters viewport.
- Local page controls (`Previous`/`Next`) paginate visible cards.
- Retry button is shown for failed searches.
- Error toasts appear for failed initial and incremental requests.

This keeps backend contract logic separate from components, so replacing or extending backend data sources remains simple.
