const env = require("../config/env");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function randomDelay(minMs = env.scrapeDelayMinMs, maxMs = env.scrapeDelayMaxMs) {
  const safeMin = Number.isFinite(minMs) ? minMs : env.scrapeDelayMinMs;
  const safeMax = Number.isFinite(maxMs) ? maxMs : env.scrapeDelayMaxMs;
  const normalizedMin = Math.max(0, Math.min(safeMin, safeMax));
  const normalizedMax = Math.max(normalizedMin, safeMax);
  const duration = randomInt(normalizedMin, normalizedMax);
  await sleep(duration);
}

async function withRetry(fn, options = {}) {
  const retries = options.retries ?? 2;
  const baseDelayMs = options.baseDelayMs ?? 300;
  const platform = options.platform || "Unknown";

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === retries) {
        error.platform = platform;
        throw error;
      }

      const backoff = baseDelayMs * 2 ** attempt;
      await sleep(backoff + randomInt(50, 200));
    }
  }

  throw new Error("Unexpected retry flow");
}

module.exports = {
  sleep,
  randomDelay,
  withRetry,
};