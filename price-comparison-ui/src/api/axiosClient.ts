import axios from 'axios'

function resolveApiBaseUrl(rawValue: unknown) {
  const fallback = 'http://localhost:4000/api'
  const value = String(rawValue ?? '').trim()

  if (!value) {
    return fallback
  }

  // Accept shorthand values like ":4000/api" and coerce to localhost.
  if (value.startsWith(':')) {
    return `http://localhost${value}`
  }

  // Convert protocol-relative URLs to an explicit protocol.
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
const AUTH_TOKEN_STORAGE_KEY =
  import.meta.env.VITE_AUTH_TOKEN_STORAGE_KEY ?? 'pricepilot_auth_token'

export const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    Accept: 'application/json',
  },
})

axiosClient.interceptors.request.use((config) => {
  const token = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'))
    }

    return Promise.reject(error)
  },
)
