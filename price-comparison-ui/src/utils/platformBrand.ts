function normalizePlatformKey(platform: string) {
  return String(platform || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
}

export function getPlatformBadgeMeta(platform: string) {
  const key = normalizePlatformKey(platform)

  if (key === 'amazon') {
    return { key, label: 'Amazon', short: 'A' }
  }

  if (key === 'flipkart') {
    return { key, label: 'Flipkart', short: 'F' }
  }

  if (key === 'blinkit') {
    return { key, label: 'Blinkit', short: 'B' }
  }

  if (key === 'zepto') {
    return { key, label: 'Zepto', short: 'Z' }
  }

  return {
    key,
    label: platform,
    short: String(platform || '?').trim().charAt(0).toUpperCase() || '?',
  }
}
