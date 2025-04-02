import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const proxyListPath = path.join(__dirname, "proxies.txt");

const rawProxies = fs.readFileSync(proxyListPath, "utf-8")
  .split("\n")
  .map(line => line.trim())
  .filter(Boolean);

function getRandomProxy() {
  const [ip, port, user, pass] = rawProxies[Math.floor(Math.random() * rawProxies.length)].split(":");
  return { ip, port, user, pass };
}

export async function scrapeEtsy(url) {
  const { ip, port, user, pass } = getRandomProxy();
  const proxyServer = `http://${ip}:${port}`;
  console.log(`🌐 Using proxy: ${proxyServer}`);

  const browser = await puppeteer.launch({
    headless: "new",
    args: [`--proxy-server=${proxyServer}`, "--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    const page = await browser.newPage();
    await page.authenticate({ username: user, password: pass });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

    const data = await page.evaluate(() => {
      const title = document.querySelector("h1[data-buy-box-listing-title]")?.innerText;
      const price = document.querySelector("[data-buy-box-region='price']")?.innerText;
      const shopName = document.querySelector("div[data-region='shop-name'] span a")?.innerText;
      const rating = document.querySelector("[data-region='rating'] > span")?.innerText;
      const reviews = document.querySelector("span[data-region='review-count']")?.innerText;

      return {
        title: title || "N/A",
        price: price || "N/A",
        shopName: shopName || "N/A",
        rating: rating || "N/A",
        reviews: reviews || "N/A"
      };
    });

    await browser.close();
    return data;

  } catch (err) {
    await browser.close();
    console.error("❌ Scraping error:", err.message);
    throw new Error(err.message);
  }
}