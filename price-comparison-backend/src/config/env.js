const env = {
  port: Number(process.env.PORT) || 4000,
  nodeEnv: process.env.NODE_ENV || "development",
  mongoDbUri:
    process.env.MONGODB_URI ||
    "mongodb://127.0.0.1:27017/price_comparison",
  redisUrl: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  cacheTtlSeconds: Number(process.env.CACHE_TTL_SECONDS) || 300,
  scrapeTimeoutMs: Number(process.env.SCRAPE_TIMEOUT_MS) || 15000,
  scrapeDelayMinMs: Number(process.env.SCRAPE_DELAY_MIN_MS) || 120,
  scrapeDelayMaxMs: Number(process.env.SCRAPE_DELAY_MAX_MS) || 320,
  platformTimeoutMs: Number(process.env.PLATFORM_TIMEOUT_MS) || 10000,
  searchDeadlineMs: Number(process.env.SEARCH_DEADLINE_MS) || 0,
  partialCacheTtlSeconds: Number(process.env.PARTIAL_CACHE_TTL_SECONDS) || 45,
  scrapeProxyUrl: process.env.SCRAPE_PROXY_URL || "",
  blinkitProxyUrl: process.env.BLINKIT_PROXY_URL || "",
  bbNowProxyUrl: process.env.BB_NOW_PROXY_URL || "",
  flipkartMinutesProxyUrl: process.env.FLIPKART_MINUTES_PROXY_URL || "",
  zeptoProxyUrl: process.env.ZEPTO_PROXY_URL || "",
  instamartProxyUrl: process.env.INSTAMART_PROXY_URL || "",
  jioMartExpressProxyUrl: process.env.JIOMART_EXPRESS_PROXY_URL || "",
  useRedis: String(process.env.USE_REDIS || "false").toLowerCase() === "true",
};

module.exports = env;