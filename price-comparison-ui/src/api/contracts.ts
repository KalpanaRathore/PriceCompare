export interface BackendPricePoint {
  timestamp: string
  price: number
}

export interface BackendPlatformOffer {
  platform: string
  price: number
  originalPrice: number
  rating: number
  inStock: boolean
  delivery: string
  productUrl: string
  priceHistory: BackendPricePoint[]
}

export interface BackendProductComparison {
  bestOffer?: {
    platform: string
    price: number
    productUrl: string
    delivery: string
    inStock: boolean
    originalPrice?: number
    rating?: number
    priceHistory?: BackendPricePoint[]
  }
  priceSpread?: number
}

export interface BackendProductResult {
  id: string
  name: string
  brand: string
  category: string
  image: string
  qualityScore: number
  offers: BackendPlatformOffer[]
  comparison?: BackendProductComparison
}

export interface BackendSearchResponse {
  query: string
  meta?: {
    mode?: 'fast' | 'full'
  }
  platforms?: {
    requested?: string[]
    status?: Array<{
      platform: string
      ok: boolean
      resultCount: number
      error?: string
    }>
  }
  warning?: {
    message: string
    failedPlatforms: string[]
  }
  total: number
  page: number
  pageSize: number
  totalPages: number
  hasMore: boolean
  fetchedAt: string
  products: BackendProductResult[]
}

export const sampleSearchResponse: BackendSearchResponse = {
  query: 'sony xm5',
  total: 1,
  page: 1,
  pageSize: 20,
  totalPages: 1,
  hasMore: false,
  fetchedAt: '2026-03-17T10:20:30.000Z',
  products: [
    {
      id: 'sony-wh1000xm5',
      name: 'Sony WH-1000XM5 Wireless Headphones',
      brand: 'Sony',
      category: 'Audio',
      image: 'https://cdn.example.com/products/sony-wh1000xm5.jpg',
      qualityScore: 9.4,
      comparison: {
        bestOffer: {
          platform: 'Amazon',
          price: 26990,
          originalPrice: 34990,
          rating: 4.7,
          inStock: true,
          delivery: 'Tomorrow',
          productUrl:
            'https://www.amazon.in/example-product-link',
          priceHistory: [
            { timestamp: '2026-03-10', price: 31990 },
            { timestamp: '2026-03-12', price: 29990 },
            { timestamp: '2026-03-14', price: 28990 },
            { timestamp: '2026-03-17', price: 26990 },
          ],
        },
        priceSpread: 509,
      },
      offers: [
        {
          platform: 'Amazon',
          price: 26990,
          originalPrice: 34990,
          rating: 4.7,
          inStock: true,
          delivery: 'Tomorrow',
          productUrl:
            'https://www.amazon.in/example-product-link',
          priceHistory: [
            { timestamp: '2026-03-10', price: 31990 },
            { timestamp: '2026-03-12', price: 29990 },
            { timestamp: '2026-03-14', price: 28990 },
            { timestamp: '2026-03-17', price: 26990 },
          ],
        },
        {
          platform: 'Flipkart',
          price: 27499,
          originalPrice: 34990,
          rating: 4.6,
          inStock: true,
          delivery: '2 days',
          productUrl:
            'https://www.flipkart.com/example-product-link',
          priceHistory: [
            { timestamp: '2026-03-10', price: 32499 },
            { timestamp: '2026-03-12', price: 30499 },
            { timestamp: '2026-03-14', price: 28999 },
            { timestamp: '2026-03-17', price: 27499 },
          ],
        },
      ],
    },
  ],
}
