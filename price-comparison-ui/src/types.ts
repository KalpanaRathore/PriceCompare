export type PlatformName = string

export interface PlatformOffer {
  platform: PlatformName
  price: number
  originalPrice: number
  rating: number
  inStock: boolean
  delivery: string
  productUrl: string
  history: number[]
}

export interface ProductComparison {
  bestOffer?: PlatformOffer
  priceSpread?: number
}

export interface Product {
  id: string
  name: string
  brand: string
  category: string
  image: string
  qualityScore: number
  offers: PlatformOffer[]
  comparison?: ProductComparison
}

export type SortMode = 'best-deal' | 'lowest-price' | 'highest-rating'
