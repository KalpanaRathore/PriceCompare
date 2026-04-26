import type {
  BackendProductResult,
  BackendSearchResponse,
} from '../api/contracts'
import type { PlatformOffer, Product } from '../types'

function mapOffer(
  offer: BackendProductResult['offers'][number] | {
    platform: string
    price: number
    productUrl: string
    delivery: string
    inStock: boolean
    originalPrice?: number
    rating?: number
    priceHistory?: Array<{ price: number }>
  },
): PlatformOffer {
  return {
    platform: offer.platform,
    price: offer.price,
    originalPrice: offer.originalPrice ?? offer.price,
    rating: Number(offer.rating ?? 0),
    inStock: offer.inStock,
    delivery: offer.delivery,
    productUrl: offer.productUrl,
    history: (offer.priceHistory ?? []).map((item) => item.price),
  }
}

export function mapSearchResponseToProducts(
  response: BackendSearchResponse,
): Product[] {
  return response.products.map((product) => ({
    id: product.id,
    name: product.name,
    brand: product.brand,
    category: product.category,
    image: product.image,
    qualityScore: product.qualityScore,
    offers: product.offers.map(mapOffer),
    comparison: product.comparison
      ? {
          bestOffer: product.comparison.bestOffer
            ? mapOffer(product.comparison.bestOffer)
            : undefined,
          priceSpread: product.comparison.priceSpread,
        }
      : undefined,
  }))
}
