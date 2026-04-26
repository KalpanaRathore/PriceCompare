import { useEffect, useRef } from 'react'

export function useInfiniteScroll(
  canLoadMore: boolean,
  isLoading: boolean,
  onLoadMore: () => void,
) {
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const node = sentinelRef.current

    if (!node) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && canLoadMore && !isLoading) {
          onLoadMore()
        }
      },
      {
        rootMargin: '200px',
      },
    )

    observer.observe(node)

    return () => observer.disconnect()
  }, [canLoadMore, isLoading, onLoadMore])

  return sentinelRef
}
