import {
  sampleSearchResponse,
  type BackendSearchResponse,
} from './contracts'
import { axiosClient } from './axiosClient'

function resolveApiBaseUrl(rawValue: unknown) {
  const fallback = 'http://localhost:4000/api'
  const value = String(rawValue ?? '').trim()

  if (!value) {
    return fallback
  }

  if (value.startsWith(':')) {
    return `http://localhost${value}`
  }

  if (value.startsWith('//')) {
    return `http:${value}`
  }

  try {
    const url = new URL(value)
    return url.toString().replace(/\/$/, '')
  } catch {
    return fallback
  }
}

const API_BASE_URL = resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL)
const HTTP_CLIENT = (import.meta.env.VITE_HTTP_CLIENT ?? 'fetch').toLowerCase()
const USE_SAMPLE_FALLBACK =
  String(import.meta.env.VITE_USE_SAMPLE_FALLBACK ?? 'false').toLowerCase() ===
  'true'

interface SearchOptions {
  query: string
  page: number
  pageSize: number
  signal?: AbortSignal
  mode?: 'fast' | 'full'
}

async function searchProductsWithFetch({
  query,
  page,
  pageSize,
  signal,
  mode = 'full',
}: SearchOptions): Promise<BackendSearchResponse> {
  const response = await fetch(
    `${API_BASE_URL}/products/search?q=${encodeURIComponent(query)}&page=${page}&pageSize=${pageSize}&mode=${mode}`,
    {
      method: 'GET',
      signal,
      headers: {
        Accept: 'application/json',
      },
    },
  )

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`)
  }

  return (await response.json()) as BackendSearchResponse
}

async function searchProductsWithAxios({
  query,
  page,
  pageSize,
  signal,
  mode = 'full',
}: SearchOptions): Promise<BackendSearchResponse> {
  const response = await axiosClient.get<BackendSearchResponse>('/products/search', {
    params: {
      q: query,
      page,
      pageSize,
      mode,
    },
    signal,
  })

  return response.data
}

export async function searchProducts(
  options: SearchOptions,
): Promise<BackendSearchResponse> {
  if (USE_SAMPLE_FALLBACK) {
    await new Promise((resolve) => window.setTimeout(resolve, 300))
    return {
      ...sampleSearchResponse,
      query: options.query,
      page: options.page,
      pageSize: options.pageSize,
      totalPages: 1,
      hasMore: false,
    }
  }

  if (HTTP_CLIENT === 'axios') {
    return searchProductsWithAxios(options)
  }

  return searchProductsWithFetch(options)
}
