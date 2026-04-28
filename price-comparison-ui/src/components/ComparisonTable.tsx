import type { PlatformOffer, Product } from '../types'
import { getPlatformBadgeMeta } from '../utils/platformBrand'

interface ComparisonTableProps {
  products: Product[]
}

function resolveBestOffer(offers: PlatformOffer[]) {
  const inStock = offers.filter((offer) => offer.inStock)
  const list = inStock.length > 0 ? inStock : offers
  return [...list].sort((a, b) => a.price - b.price || b.rating - a.rating)[0]
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value)
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

export function ComparisonTable({ products }: ComparisonTableProps) {
  return (
    <section className="table-shell" aria-label="Product comparison table">
      <h2>Quick comparison table</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Best platform</th>
              <th>Best price</th>
              <th>Rating</th>
              <th>Quality score</th>
              <th>Delivery</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const bestOffer = product.comparison?.bestOffer ?? resolveBestOffer(product.offers)

              if (!bestOffer) {
                return null
              }

              return (
                <tr key={product.id}>
                  <td>
                    <strong>{product.name}</strong>
                    <span>{product.brand}</span>
                  </td>
                  <td>{renderPlatformBadge(bestOffer.platform)}</td>
                  <td>{formatCurrency(bestOffer.price)}</td>
                  <td>{bestOffer.rating.toFixed(1)}</td>
                  <td>{product.qualityScore.toFixed(1)}/10</td>
                  <td>
                    {bestOffer.delivery}
                    <span>
                      <a href={bestOffer.productUrl} target="_blank" rel="noopener noreferrer">
                        Visit listing
                      </a>
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
