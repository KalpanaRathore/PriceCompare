const env = require("../config/env");
const logger = require("../config/logger");

const memoryCache = new Map();
let redisClient;
let redisUnavailable = false;

async function buildRedisClient() {
  if (!env.useRedis || redisUnavailable) {
    return null;
  }

  try {
    const Redis = require("ioredis");
    const client = new Redis(env.redisUrl, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });

    await client.connect();
    logger.info("Redis cache enabled", { redisUrl: env.redisUrl });
    return client;
  } catch (error) {
    redisUnavailable = true;
    logger.warn("Redis unavailable. Falling back to memory cache", {
      error: error.message,
    });
    return null;
  }
}

async function getRedisClient() {
  if (!env.useRedis || redisUnavailable) {
    return null;
  }

  if (!redisClient) {
    redisClient = await buildRedisClient();
  }

  return redisClient;
}

async function get(key) {
  const client = await getRedisClient();
  if (client) {
    try {
      const value = await client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.warn("Redis get failed. Using memory cache", {
        error: error.message,
      });
      redisUnavailable = true;
      redisClient = null;
    }
  }

  const entry = memoryCache.get(key);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }

  return entry.value;
}

async function set(key, value, ttl = env.cacheTtlSeconds) {
  const client = await getRedisClient();
  if (client) {
    try {
      await client.set(key, JSON.stringify(value), "EX", ttl);
      return;
    } catch (error) {
      logger.warn("Redis set failed. Using memory cache", {
        error: error.message,
      });
      redisUnavailable = true;
      redisClient = null;
    }
  }

  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttl * 1000,
  });
}

async function delPattern(pattern) {
  const client = await getRedisClient();
  if (client) {
    try {
      const keys = await client.keys(pattern);
      if (keys.length) {
        await client.del(keys);
      }
      return;
    } catch (error) {
      logger.warn("Redis delPattern failed. Using memory cache", {
        error: error.message,
      });
      redisUnavailable = true;
      redisClient = null;
    }
  }

  const regex = new RegExp(`^${pattern.replace(/\*/g, ".*")}$`);
  for (const key of memoryCache.keys()) {
    if (regex.test(key)) {
      memoryCache.delete(key);
    }
  }
}

module.exports = {
  get,
  set,
  delPattern,
};