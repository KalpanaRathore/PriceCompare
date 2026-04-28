import type { Product, PlatformOffer } from '../types'
import { getPlatformBadgeMeta } from '../utils/platformBrand'
import { SparklineChart } from './SparklineChart'

interface ProductCardProps {
  product: Product
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value)
}

function getBestOffer(offers: PlatformOffer[]) {
  const inStock = offers.filter((offer) => offer.inStock)
  const list = inStock.length > 0 ? inStock : offers
  return [...list].sort((a, b) => a.price - b.price || b.rating - a.rating)[0]
}

function getPriceSpread(offers: PlatformOffer[]) {
  if (offers.length < 2) {
    return 0
  }

  const prices = offers.map((offer) => offer.price)
  return Math.max(...prices) - Math.min(...prices)
}

function getDiscountLabel(offer: PlatformOffer, isLowest: boolean) {
  if (offer.originalPrice > offer.price) {
    const percentage = Math.round(((offer.originalPrice - offer.price) / offer.originalPrice) * 100)
    if (percentage >= 1) {
      return `${percentage}% Off`
    }
  }

  return isLowest ? 'Best Price' : 'Deal'
}

function getDeliveryLabel(delivery: string, inStock: boolean) {
  if (!inStock) {
    return 'Out of stock'
  }

  return delivery || 'Check on site'
}

function formatCompact(value: number) {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(value)
}

function buildStars(rating: number) {
  const rounded = Math.max(0, Math.min(5, Math.round(rating)))
  return '★'.repeat(rounded) + '☆'.repeat(5 - rounded)
}

function renderPlatformBadge(platform: string) {
  const badge = getPlatformBadgeMeta(platform)

  return (
    <span className={`seller-badge platform-badge platform-${badge.key || 'unknown'}`}>
      <span className="platform-logo" aria-hidden="true">{badge.short}</span>
      <span>{badge.label}</span>
    </span>
  )
}

export function ProductCard({ product }: ProductCardProps) {
  const bestOffer = product.comparison?.bestOffer ?? getBestOffer(product.offers)

  if (!bestOffer) {
    return null
  }

  const priceSpread = product.comparison?.priceSpread ?? getPriceSpread(product.offers)
  const discount = Math.max(0, bestOffer.originalPrice - bestOffer.price)
  const sortedOffers = [...product.offers].sort((a, b) => a.price - b.price)
  const platformOrder = [...new Set(sortedOffers.map((offer) => offer.platform))]

  const offersByPlatform = new Map(sortedOffers.map((offer) => [offer.platform, offer]))
  const reviewCount = product.offers.length * 1000 + Math.round(product.qualityScore * 100)

  return (
    <article className="product-card">
      <div className="product-card-body">
        <div className="product-summary">
          <img src={product.image} alt={product.name} loading="lazy" />
          <div className="product-summary-text">
            <h3>{product.name}</h3>
            <p>
              {product.brand} | {product.category} | Quality {product.qualityScore.toFixed(1)}/10
            </p>
            <div className="rating-line" aria-label={`Rated ${bestOffer.rating.toFixed(1)} out of 5`}>
              <span>{buildStars(bestOffer.rating)}</span>
              <b>{bestOffer.rating.toFixed(1)}</b>
              <small>({formatCompact(reviewCount)} reviews)</small>
            </div>
          </div>
        </div>

        <div className="compare-header">
          <h4>Compare Prices</h4>
          <p>
            Best deal: {bestOffer.platform} at {formatCurrency(bestOffer.price)}
            {discount > 0 && <> | Save {formatCurrency(discount)}</>}
            {priceSpread > 0 && <> | Spread {formatCurrency(priceSpread)}</>}
          </p>
        </div>

        <div className="offer-table-wrap">
          <table className="offer-table">
            <thead>
              <tr>
                <th>Seller</th>
                <th>Price</th>
                <th>Discount</th>
                <th>Delivery</th>
                <th>Offer</th>
              </tr>
            </thead>
            <tbody>
              {platformOrder.map((platform) => {
                const offer = offersByPlatform.get(platform)
                const isLowest = offer ? offer.platform === bestOffer.platform : false

                if (!offer) {
                  return null
                }

                return (
                  <tr
                    key={`${offer.platform}-${offer.productUrl}`}
                    className={`seller-row ${isLowest ? 'best-row' : ''} ${!offer.inStock ? 'unavailable-row' : ''}`}
                  >
                    <td>
                      {renderPlatformBadge(offer.platform)}
                    </td>
                    <td>
                      <div className="price-cell">
                        <strong>{formatCurrency(offer.price)}</strong>
                        {offer.originalPrice > offer.price && <small>~{formatCurrency(offer.originalPrice)}</small>}
                      </div>
                    </td>
                    <td>
                      <span className={`discount-badge ${isLowest ? 'best-badge' : ''}`}>
                        {getDiscountLabel(offer, isLowest)}
                      </span>
                    </td>
                    <td>{getDeliveryLabel(offer.delivery, offer.inStock)}</td>
                    <td>
                      <a
                        className="visit-button"
                        href={offer.productUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Visit Store
                      </a>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="history-panel">
          <p>Recent price trend (best platform)</p>
          <SparklineChart values={bestOffer.history} />
        </div>
      </div>
    </article>
  )
}
