const env = require("../../config/env");

function parseProxyUrl(proxyUrl) {
  if (!proxyUrl) {
    return null;
  }

  try {
    const parsed = new URL(proxyUrl);

    if (!parsed.hostname || !parsed.port) {
      return null;
    }

    return {
      protocol: parsed.protocol.replace(":", ""),
      host: parsed.hostname,
      port: Number(parsed.port),
      username: parsed.username ? decodeURIComponent(parsed.username) : "",
      password: parsed.password ? decodeURIComponent(parsed.password) : "",
    };
  } catch (error) {
    return null;
  }
}

function resolveProxyUrl(platform) {
  const normalized = String(platform || "").toLowerCase();

  if (normalized === "amazon" && env.amazonProxyUrl) {
    return env.amazonProxyUrl;
  }

  if (normalized === "flipkart" && env.flipkartProxyUrl) {
    return env.flipkartProxyUrl;
  }

  if (normalized === "blinkit" && env.blinkitProxyUrl) {
    return env.blinkitProxyUrl;
  }

  if (normalized === "zepto" && env.zeptoProxyUrl) {
    return env.zeptoProxyUrl;
  }

  return env.scrapeProxyUrl || "";
}

function getAxiosProxyConfig(platform) {
  const parsed = parseProxyUrl(resolveProxyUrl(platform));

  if (!parsed) {
    return {};
  }

  const proxy = {
    protocol: parsed.protocol,
    host: parsed.host,
    port: parsed.port,
  };

  if (parsed.username || parsed.password) {
    proxy.auth = {
      username: parsed.username,
      password: parsed.password,
    };
  }

  return { proxy };
}

function getPlaywrightProxyConfig(platform) {
  const parsed = parseProxyUrl(resolveProxyUrl(platform));

  if (!parsed) {
    return {};
  }

  const proxy = {
    server: `${parsed.protocol}://${parsed.host}:${parsed.port}`,
  };

  if (parsed.username) {
    proxy.username = parsed.username;
  }

  if (parsed.password) {
    proxy.password = parsed.password;
  }

  return { proxy };
}

module.exports = {
  getAxiosProxyConfig,
  getPlaywrightProxyConfig,
};
