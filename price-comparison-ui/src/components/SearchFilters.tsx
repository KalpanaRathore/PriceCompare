import type { SortMode } from '../types'
import { getPlatformBadgeMeta } from '../utils/platformBrand'

interface SearchFiltersProps {
  query: string
  category: string
  minRating: number
  maxPrice: number
  maxPriceUpperBound: number
  platforms: string[]
  selectedPlatforms: string[]
  inStockOnly: boolean
  sortMode: SortMode
  categories: readonly string[]
  resultCount: number
  isLoading: boolean
  onQueryChange: (value: string) => void
  onCategoryChange: (value: string) => void
  onMinRatingChange: (value: number) => void
  onMaxPriceChange: (value: number) => void
  onTogglePlatform: (platform: string) => void
  onInStockChange: (checked: boolean) => void
  onSortModeChange: (value: SortMode) => void
}

export function SearchFilters({
  query,
  category,
  minRating,
  maxPrice,
  maxPriceUpperBound,
  platforms,
  selectedPlatforms,
  inStockOnly,
  sortMode,
  categories,
  resultCount,
  isLoading,
  onQueryChange,
  onCategoryChange,
  onMinRatingChange,
  onMaxPriceChange,
  onTogglePlatform,
  onInStockChange,
  onSortModeChange,
}: SearchFiltersProps) {
  return (
    <section className="controls-panel" aria-label="Search and filters">
      <div className="search-box">
        <label htmlFor="query">Search product</label>
        <input
          id="query"
          type="search"
          value={query}
          placeholder="Try: iQOO Neo 10R, Sony XM5, Dell G15"
          onChange={(event) => onQueryChange(event.target.value)}
          autoComplete="off"
        />
      </div>

      <div className="filters-grid">
        <label>
          Category
          <select
            value={category}
            onChange={(event) => onCategoryChange(event.target.value)}
          >
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label>
          Min rating
          <select
            value={minRating}
            onChange={(event) => onMinRatingChange(Number(event.target.value))}
          >
            <option value={0}>Any</option>
            <option value={3.5}>3.5+</option>
            <option value={4}>4.0+</option>
            <option value={4.3}>4.3+</option>
            <option value={4.5}>4.5+</option>
          </select>
        </label>

        <label>
          Sort by
          <select
            value={sortMode}
            onChange={(event) => onSortModeChange(event.target.value as SortMode)}
          >
            <option value="best-deal">Best deal score</option>
            <option value="lowest-price">Lowest price</option>
            <option value="highest-rating">Highest rating</option>
          </select>
        </label>

        <label className="stock-only">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(event) => onInStockChange(event.target.checked)}
          />
          In-stock offers only
        </label>
      </div>

      <div className="platform-chip-row" aria-label="Platform filters">
        {platforms.length === 0 ? (
          <span className="chip-placeholder">Platforms will appear after search results.</span>
        ) : (
          platforms.map((platform) => {
            const isActive = selectedPlatforms.includes(platform)
            const badge = getPlatformBadgeMeta(platform)

            return (
              <button
                key={platform}
                type="button"
                className={isActive ? 'platform-chip active-chip' : 'platform-chip'}
                onClick={() => onTogglePlatform(platform)}
              >
                <span className={`platform-logo chip-logo platform-${badge.key || 'unknown'}`} aria-hidden="true">
                  {badge.short}
                </span>
                <span>{badge.label}</span>
              </button>
            )
          })
        )}
      </div>

      <div className="price-range">
        <label htmlFor="maxPrice">
          Max price: {new Intl.NumberFormat('en-IN').format(maxPrice)}
        </label>
        <input
          id="maxPrice"
          type="range"
          min={0}
          max={Math.max(maxPriceUpperBound, 1)}
          value={Math.min(maxPrice, Math.max(maxPriceUpperBound, 1))}
          onChange={(event) => onMaxPriceChange(Number(event.target.value))}
          disabled={maxPriceUpperBound <= 0}
        />
      </div>

      <p className="result-meta">
        {isLoading
          ? 'Fetching live prices...'
          : `Showing ${resultCount} products across marketplaces`}
      </p>
    </section>
  )
}
