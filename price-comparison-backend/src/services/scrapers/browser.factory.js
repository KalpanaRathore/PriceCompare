const { chromium } = require("playwright");
const { getPlaywrightProxyConfig } = require("./proxy.config");

async function createBrowser(platform = "") {
  const proxyConfig = getPlaywrightProxyConfig(platform);

  return chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled"],
    ...proxyConfig,
  });
}

module.exports = {
  createBrowser,
};