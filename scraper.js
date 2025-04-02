import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs/promises";

puppeteer.use(StealthPlugin());

async function getProxies() {
  try {
    const content = await fs.readFile("proxies.txt", "utf-8");
    return content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));
  } catch {
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
  const proxyUrl = selectedProxy ? `--proxy-server=http://${selectedProxy.host}:${selectedProxy.port}` : null;

  const launchOptions = {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--window-size=1920,1080",
    ],
  };

  if (proxyUrl) launchOptions.args.push(proxyUrl);

  let browser;
  try {
    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    if (selectedProxy?.username) {
      await page.authenticate({
        username: selectedProxy.username,
        password: selectedProxy.password,
      });
    }

    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36");

    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    // Wait for main title or fallback after 15s
    await page.waitForSelector("h1[data-buy-box-listing-title]", { timeout: 15000 }).catch(() => {});

    // DEBUG: Capture what the bot actually sees
    await page.screenshot({ path: "/tmp/debug.png", fullPage: true });
    const html = await page.content();
    await fs.writeFile("/tmp/debug.html", html); // Save full HTML

    const data = await page.evaluate(() => {
      const getText = (selector) => {
        const el = document.querySelector(selector);
        return el ? el.innerText.trim() : null;
      };

      return {
        title: getText("h1[data-buy-box-listing-title]") || "N/A",
        price: getText("p[data-buy-box-region='price']") || "N/A",
        shopName: getText("div[data-region='shop-name'] a") || "N/A",
        rating: getText("input[name='rating']") || "N/A",
        reviews: getText("span[class*='wt-text-link-no-underline']") || "N/A",
      };
    });

    return data;
  } catch (err) {
    console.error("❌ Scraping error:", err.message);
    return { error: "Scraping failed", details: err.message };
  } finally {
    if (browser) await browser.close();
  }
}
