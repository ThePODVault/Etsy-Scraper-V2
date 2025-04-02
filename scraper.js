import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs/promises";

puppeteer.use(StealthPlugin());

async function getProxies() {
  try {
    const content = await fs.readFile("proxies.txt", "utf-8");
    const proxies = content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));
    return proxies;
  } catch (error) {
    console.error("Error loading proxies:", error);
    return [];
  }
}

function getRandomProxy(proxies) {
  const proxy = proxies[Math.floor(Math.random() * proxies.length)];
  if (!proxy) return null;

  const [host, port, username, password] = proxy.split(":");
  return { host, port, username, password };
}

export async function scrapeEtsy(url) {
  const proxies = await getProxies();
  const selectedProxy = getRandomProxy(proxies);
  const proxyUrl = selectedProxy
    ? `--proxy-server=http://${selectedProxy.host}:${selectedProxy.port}`
    : null;

  const launchOptions = {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  };

  if (proxyUrl) {
    launchOptions.args.push(proxyUrl);
    console.log("Using proxy:", proxyUrl);
  }

  let browser;

  try {
    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    if (selectedProxy && selectedProxy.username && selectedProxy.password) {
      await page.authenticate({
        username: selectedProxy.username,
        password: selectedProxy.password,
      });
    }

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
    );

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

    await page.waitForTimeout(4000); // wait for page to settle
    await page.screenshot({ path: "/tmp/etsy_debug_screenshot.png" });

    const data = await page.evaluate(() => {
      const title =
        document.querySelector("h1[data-buy-box-listing-title]")?.innerText ??
        null;

      const price =
        document
          .querySelector('[data-buy-box-region="price"] p')?.textContent?.trim() ?? null;

      const shopName =
        document.querySelector('span[data-shop-name]')?.innerText ??
        document.querySelector('div[data-region="shop-name"] a')?.innerText ??
        null;

      const rating =
        document.querySelector('[data-region="rating"] span[aria-hidden="true"]')
          ?.innerText ?? null;

      const reviews =
        document.querySelector('[data-region="rating"] span.text-body-sm')
          ?.innerText ?? null;

      return {
        title: title || "N/A",
        price: price || "N/A",
        shopName: shopName || "N/A",
        rating: rating || "N/A",
        reviews: reviews || "N/A",
      };
    });

    return data;
  } catch (error) {
    console.error("❌ Scraping error:", error.message);
    return { error: "Scraping failed", details: error.message };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
