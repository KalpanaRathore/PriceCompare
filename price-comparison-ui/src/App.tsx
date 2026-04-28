import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { searchProducts } from './api/productsApi'
import { ComparisonTable } from './components/ComparisonTable'
import { ProductCard } from './components/ProductCard'
import { SearchFilters } from './components/SearchFilters'
import { ToastStack, type ToastItem } from './components/ToastStack'
import { useInfiniteScroll } from './hooks/useInfiniteScroll'
import type { PlatformOffer, Product, SortMode } from './types'
import { mapSearchResponseToProducts } from './utils/productMappers'
import './App.css'

const API_PAGE_SIZE = 36
const UI_PAGE_SIZE = 6
const SEARCH_DEBOUNCE_MS = 400

function getBestOffer(offers: PlatformOffer[]) {
  const inStock = offers.filter((offer) => offer.inStock)
  const list = inStock.length > 0 ? inStock : offers
  return [...list].sort((a, b) => a.price - b.price || b.rating - a.rating)[0]
}

function getBestOfferFromProduct(product: Product) {
  return product.comparison?.bestOffer ?? getBestOffer(product.offers)
}

function dealScore(product: Product, offer: PlatformOffer) {
  const priceWeight = 1 / offer.price
  const qualityWeight = product.qualityScore / 10
  const ratingWeight = offer.rating / 5
  return priceWeight * 60000 + qualityWeight * 0.3 + ratingWeight * 0.2
}

function App() {
  const [query, setQuery] = useState('')
  const [apiProducts, setApiProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [category, setCategory] = useState<string>('All')
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [minRating, setMinRating] = useState(0)
  const [maxPrice, setMaxPrice] = useState(0)
  const [inStockOnly, setInStockOnly] = useState(false)
  const [sortMode, setSortMode] = useState<SortMode>('best-deal')
  const [apiPage, setApiPage] = useState(0)
  const [hasMoreFromApi, setHasMoreFromApi] = useState(false)
  const [uiPage, setUiPage] = useState(1)
  const [retrySeed, setRetrySeed] = useState(0)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [platformWarning, setPlatformWarning] = useState<string | null>(null)
  const activeSearchAbortRef = useRef<AbortController | null>(null)
  const activeSearchRequestIdRef = useRef(0)

  const addToast = useCallback((title: string, message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000)
    setToasts((current) => [...current, { id, title, message }])
  }, [])

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const mergeByProductId = useCallback((current: Product[], incoming: Product[]) => {
    const seen = new Set(current.map((item) => item.id))
    const additions = incoming.filter((item) => !seen.has(item.id))
    return [...current, ...additions]
  }, [])

  const cancelActiveSearch = useCallback(() => {
    activeSearchAbortRef.current?.abort()
    activeSearchAbortRef.current = null
  }, [])

  const loadSearchPage = useCallback(
    async ({
      searchTerm,
      page,
      append,
      requestId,
      signal,
      mode = 'full',
    }: {
      searchTerm: string
      page: number
      append: boolean
      requestId: number
      signal?: AbortSignal
      mode?: 'fast' | 'full'
    }) => {
      if (append) {
        setIsLoadingMore(true)
      } else {
        setIsLoading(true)
      }

      try {
        const response = await searchProducts({
          query: searchTerm,
          page,
          pageSize: API_PAGE_SIZE,
          signal,
          mode,
        })

        if (requestId !== activeSearchRequestIdRef.current) {
          return
        }

        const mapped = mapSearchResponseToProducts(response)
        setApiProducts((current) =>
          append ? mergeByProductId(current, mapped) : mapped,
        )

        const failedPlatforms = response.warning?.failedPlatforms ?? []
        if (failedPlatforms.length > 0) {
          setPlatformWarning(
            `Some sources are unavailable right now (${failedPlatforms.join(', ')}). Showing available catalog.`,
          )
        } else {
          setPlatformWarning(null)
        }

        setApiPage(response.page)
        setHasMoreFromApi(response.hasMore || response.page < response.totalPages)
        setHasSearched(true)
        setErrorMessage(null)
      } catch (error) {
        if (requestId !== activeSearchRequestIdRef.current) {
          return
        }

        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }

        if (append) {
          addToast('Failed to load more results', 'Check API availability and try again.')
        } else {
          setApiProducts([])
          setHasSearched(true)
          setErrorMessage('Could not load products. Please try again in a few seconds.')
          setPlatformWarning(null)
          addToast('Search failed', 'Backend API is unavailable or returned an error.')
        }
      } finally {
        if (requestId !== activeSearchRequestIdRef.current) {
          return
        }

        if (append) {
          setIsLoadingMore(false)
        } else {
          setIsLoading(false)
        }
      }
    },
    [addToast, mergeByProductId],
  )

  useEffect(() => {
    const trimmed = query.trim()

    if (trimmed.length < 2) {
      activeSearchRequestIdRef.current += 1
      cancelActiveSearch()
      setApiProducts([])
      setErrorMessage(null)
      setPlatformWarning(null)
      setHasSearched(false)
      setIsLoading(false)
      setIsLoadingMore(false)
      setHasMoreFromApi(false)
      setApiPage(0)
      setUiPage(1)
      return
    }

    const timeoutId = window.setTimeout(() => {
      const requestId = activeSearchRequestIdRef.current + 1
      const controller = new AbortController()

      activeSearchRequestIdRef.current = requestId
      cancelActiveSearch()
      activeSearchAbortRef.current = controller

      setApiProducts([])
      setHasMoreFromApi(false)
      setApiPage(0)
      setUiPage(1)
      setPlatformWarning(null)

      void loadSearchPage({
        searchTerm: trimmed,
        page: 1,
        append: false,
        requestId,
        signal: controller.signal,
        mode: 'fast',
      })
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [cancelActiveSearch, loadSearchPage, query, retrySeed])

  useEffect(() => {
    return () => {
      cancelActiveSearch()
    }
  }, [cancelActiveSearch])

  const platforms = useMemo(() => {
    const values = apiProducts.flatMap((product) =>
      product.offers.map((offer) => offer.platform),
    )
    return [...new Set(values)].sort((a, b) => a.localeCompare(b))
  }, [apiProducts])

  useEffect(() => {
    setSelectedPlatforms((current) =>
      current.filter((platform) => platforms.includes(platform)),
    )
  }, [platforms])

  const categories = useMemo(() => {
    const dynamicCategories = [...new Set(apiProducts.map((item) => item.category))]
    return ['All', ...dynamicCategories]
  }, [apiProducts])

  const maxPriceUpperBound = useMemo(() => {
    const prices = apiProducts.flatMap((product) => product.offers.map((offer) => offer.price))
    return prices.length > 0 ? Math.max(...prices) : 0
  }, [apiProducts])

  useEffect(() => {
    setMaxPrice((current) => {
      if (maxPriceUpperBound <= 0) {
        return 0
      }

      if (current <= 0 || current > maxPriceUpperBound) {
        return maxPriceUpperBound
      }

      return current
    })
  }, [maxPriceUpperBound])

  const togglePlatform = useCallback((platform: string) => {
    setSelectedPlatforms((current) =>
      current.includes(platform)
        ? current.filter((item) => item !== platform)
        : [...current, platform],
    )
    setUiPage(1)
  }, [])

  const products = useMemo(() => {
    const filtered = apiProducts
      .map((product) => {
        const relevantOffers = product.offers.filter((offer) => {
          const platformMatch =
            selectedPlatforms.length === 0 || selectedPlatforms.includes(offer.platform)
          const stockMatch = !inStockOnly || offer.inStock
          const priceMatch = maxPrice <= 0 || offer.price <= maxPrice
          return platformMatch && stockMatch && priceMatch
        })

        return {
          ...product,
          offers: relevantOffers,
        }
      })
      .filter((product) => {
      const categoryMatch = category === 'All' || product.category === category

      if (product.offers.length === 0) {
        return false
      }

      const topRatedOffer = Math.max(...product.offers.map((offer) => offer.rating))
      const ratingMatch = topRatedOffer >= minRating

      return categoryMatch && ratingMatch
    })

    return filtered.sort((first, second) => {
      const firstBest = getBestOfferFromProduct(first)
      const secondBest = getBestOfferFromProduct(second)

      if (!firstBest || !secondBest) {
        return 0
      }

      if (sortMode === 'lowest-price') {
        return firstBest.price - secondBest.price
      }

      if (sortMode === 'highest-rating') {
        return secondBest.rating - firstBest.rating
      }

      return dealScore(second, secondBest) - dealScore(first, firstBest)
    })
  }, [
    apiProducts,
    category,
    inStockOnly,
    maxPrice,
    minRating,
    selectedPlatforms,
    sortMode,
  ])

  const totalUiPages = Math.max(1, Math.ceil(products.length / UI_PAGE_SIZE))

  useEffect(() => {
    setUiPage((current) => Math.min(current, totalUiPages))
  }, [totalUiPages])

  const pagedProducts = useMemo(() => {
    const start = (uiPage - 1) * UI_PAGE_SIZE
    return products.slice(start, start + UI_PAGE_SIZE)
  }, [products, uiPage])

  const loadNextPage = useCallback(async () => {
    if (isLoading || isLoadingMore || !hasMoreFromApi || query.trim().length < 2) {
      return
    }

    const requestId = activeSearchRequestIdRef.current + 1
    const controller = new AbortController()

    activeSearchRequestIdRef.current = requestId
    cancelActiveSearch()
    activeSearchAbortRef.current = controller

    await loadSearchPage({
      searchTerm: query.trim(),
      page: apiPage + 1,
      append: true,
      requestId,
      signal: controller.signal,
      mode: 'fast',
    })
  }, [
    apiPage,
    cancelActiveSearch,
    hasMoreFromApi,
    isLoading,
    isLoadingMore,
    loadSearchPage,
    query,
  ])

  const sentinelRef = useInfiniteScroll(
    hasMoreFromApi,
    isLoadingMore || isLoading,
    () => {
      void loadNextPage()
    },
  )

  return (
    <main className="app-shell">
      <header className="hero">
        <p className="eyebrow">PricePilot</p>
        <h1>Compare prices like flight aggregators, but for shopping.</h1>
        <p>
          Search once and compare Blinkit, BigBasket BB Now, Flipkart Minutes, Zepto, and Instamart in one professional
          dashboard with real-time style deal insights.
        </p>
      </header>

      <SearchFilters
        query={query}
        category={category}
        minRating={minRating}
        maxPrice={maxPrice}
        maxPriceUpperBound={maxPriceUpperBound}
        platforms={platforms}
        selectedPlatforms={selectedPlatforms}
        inStockOnly={inStockOnly}
        sortMode={sortMode}
        categories={categories}
        resultCount={products.length}
        isLoading={isLoading}
        onQueryChange={setQuery}
        onCategoryChange={setCategory}
        onMinRatingChange={setMinRating}
        onMaxPriceChange={(value) => {
          setMaxPrice(value)
          setUiPage(1)
        }}
        onTogglePlatform={togglePlatform}
        onInStockChange={setInStockOnly}
        onSortModeChange={setSortMode}
      />

      {platformWarning && (
        <div className="partial-warning" role="status" aria-live="polite">
          {platformWarning}
        </div>
      )}

      <section className="cards-grid" aria-label="Product cards">
        {query.trim().length < 2 ? (
          <div className="empty-state">
            <h3>Start typing to search products</h3>
            <p>Use at least 2 characters to fetch live offers from your backend API.</p>
          </div>
        ) : isLoading ? (
          Array.from({ length: UI_PAGE_SIZE }).map((_, index) => (
            <article key={`skeleton-${index}`} className="product-card skeleton-card" aria-hidden="true">
              <div className="product-card-body">
                <div className="skeleton-row skeleton-title" />
                <div className="skeleton-row skeleton-subtitle" />
                <div className="skeleton-grid">
                  <div className="skeleton-row" />
                  <div className="skeleton-row" />
                  <div className="skeleton-row" />
                </div>
              </div>
            </article>
          ))
        ) : errorMessage ? (
          <div className="empty-state error-state">
            <h3>Unable to load results</h3>
            <p>{errorMessage}</p>
            <button
              type="button"
              className="retry-button"
              onClick={() => setRetrySeed((value) => value + 1)}
            >
              Retry search
            </button>
          </div>
        ) : hasSearched && products.length > 0 ? (
          pagedProducts.map((product) => {
            return (
              <ProductCard
                key={product.id}
                product={product}
              />
            )
          })
        ) : (
          <div className="empty-state">
            <h3>No results found</h3>
            <p>Try another product keyword or adjust your filters.</p>
          </div>
        )}

        {hasSearched && products.length > 0 && (
          <div className="pagination-row" aria-label="Pagination controls">
            <button
              type="button"
              onClick={() => setUiPage((current) => Math.max(1, current - 1))}
              disabled={uiPage <= 1}
            >
              Previous
            </button>
            <span>
              Page {uiPage} of {totalUiPages}
            </span>
            <button
              type="button"
              onClick={() => setUiPage((current) => Math.min(totalUiPages, current + 1))}
              disabled={uiPage >= totalUiPages}
            >
              Next
            </button>
          </div>
        )}

        {hasMoreFromApi && hasSearched && (
          <>
            <button
              type="button"
              className="load-more-button"
              disabled={isLoadingMore}
              onClick={() => {
                void loadNextPage()
              }}
            >
              {isLoadingMore ? 'Loading more...' : 'Load more results'}
            </button>
            <div ref={sentinelRef} className="infinite-sentinel" aria-hidden="true" />
          </>
        )}
      </section>

      {products.length > 0 && (
        <ComparisonTable products={products} />
      )}

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </main>
  )
}

export default App
