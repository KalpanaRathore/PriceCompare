const axios = require("axios");
const cheerio = require("cheerio");
const { getAxiosProxyConfig } = require("./proxy.config");

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
];

function pickUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

async function fetchHtml(url, timeoutMs = 15000, options = {}) {
  const platform = options.platform || "";
  const proxyConfig = getAxiosProxyConfig(platform);

  const response = await axios.get(url, {
    timeout: timeoutMs,
    maxRedirects: 5,
    ...proxyConfig,
    headers: {
      "user-agent": pickUserAgent(),
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "accept-language": "en-IN,en;q=0.9",
      "cache-control": "no-cache",
      pragma: "no-cache",
      referer: "https://www.google.com/",
      dnt: "1",
      "upgrade-insecure-requests": "1",
    },
  });

  return response.data;
}

function text($root, selector) {
  return $root.find(selector).first().text().trim();
}

function attr($root, selector, name) {
  return $root.find(selector).first().attr(name) || "";
}

function parsePrice(value) {
  if (!value) return 0;
  const digits = String(value).replace(/[^0-9.]/g, "");
  if (!digits) return 0;
  return Number(Math.round(parseFloat(digits)));
}

function parseRating(value) {
  if (!value) return 0;
  const match = String(value).match(/[0-9]+(\.[0-9]+)?/);
  return match ? Number(match[0]) : 0;
}

function slugify(textValue = "") {
  return String(textValue)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function makeProductId(name) {
  return slugify(name).split("-").slice(0, 8).join("-");
}

function getBrandFromName(name = "") {
  const first = String(name).split(" ").filter(Boolean)[0] || "Unknown";
  return first;
}

function toCheerio(html) {
  return cheerio.load(html);
}

function getPlatformBaseUrl(platform = "") {
  const key = String(platform || "").trim().toLowerCase();

  if (key === "blinkit") return "https://blinkit.com";
  if (key === "bbnow") return "https://www.bigbasket.com";
  if (key === "flipkartminutes") return "https://www.flipkart.com";
  if (key === "zepto") return "https://www.zeptonow.com";
  if (key === "instamart") return "https://www.swiggy.com";

  return "";
}

function buildPlatformSearchUrl(platform = "", productName = "") {
  const query = encodeURIComponent(String(productName || "").trim());
  const key = String(platform || "").trim().toLowerCase();

  if (key === "blinkit") return `https://blinkit.com/s/?q=${query}`;
  if (key === "bbnow") return `https://www.bigbasket.com/ps/?q=${query}`;
  if (key === "flipkartminutes") return `https://www.flipkart.com/minutes/search?q=${query}`;
  if (key === "zepto") return `https://www.zeptonow.com/search?query=${query}`;
  if (key === "instamart") return `https://www.swiggy.com/instamart/search?query=${query}`;

  return "";
}

function toAbsolutePlatformUrl(platform = "", href = "") {
  const value = String(href || "").trim();
  if (!value) {
    return "";
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  const baseUrl = getPlatformBaseUrl(platform);
  if (!baseUrl) {
    return "";
  }

  const normalizedPath = value.startsWith("/") ? value : `/${value}`;
  return `${baseUrl}${normalizedPath}`;
}

function resolveProductUrl(platform = "", href = "", productName = "") {
  return (
    toAbsolutePlatformUrl(platform, href) ||
    buildPlatformSearchUrl(platform, productName)
  );
}

module.exports = {
  fetchHtml,
  text,
  attr,
  parsePrice,
  parseRating,
  makeProductId,
  getBrandFromName,
  toCheerio,
  toAbsolutePlatformUrl,
  buildPlatformSearchUrl,
  resolveProductUrl,
};