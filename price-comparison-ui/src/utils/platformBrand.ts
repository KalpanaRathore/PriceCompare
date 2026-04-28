function normalizePlatformKey(platform: string) {
  return String(platform || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
}

export function getPlatformBadgeMeta(platform: string) {
  const key = normalizePlatformKey(platform)

  if (key === 'blinkit') {
    return { key, label: 'Blinkit', short: 'B' }
  }

  if (key === 'bbnow' || key === 'bigbasketbbnow' || key === 'bigbasketnow') {
    return { key: 'bbnow', label: 'BigBasket BB Now', short: 'BB' }
  }

  if (key === 'flipkartminutes') {
    return { key, label: 'Flipkart Minutes', short: 'FM' }
  }

  if (key === 'zepto') {
    return { key, label: 'Zepto', short: 'Z' }
  }

  if (key === 'instamart' || key === 'swiggyinstamart') {
    return { key: 'instamart', label: 'Swiggy Instamart', short: 'SI' }
  }

  return {
    key,
    label: platform,
    short: String(platform || '?').trim().charAt(0).toUpperCase() || '?',
  }
}
