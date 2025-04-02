import express from 'express';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const app = express();
const PORT = process.env.PORT || 8080;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());

const getProxies = async () => {
  const fileStream = fs.createReadStream(path.join(__dirname, 'proxies.txt'));
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
  const proxies = [];
  for await (const line of rl) {
    const cleaned = line.trim();
    if (cleaned && !cleaned.startsWith('#')) proxies.push(cleaned);
  }
  return proxies;
};

const getRandomProxy = (proxies) => proxies[Math.floor(Math.random() * proxies.length)];

const isBotBlocked = async (page) => {
  const html = await page.content();
  return html.includes('captcha-delivery') || html.includes('datadome');
};

const scrapeListing = async (url, proxy) => {
  const [ip, port, user, pass] = proxy.split(':');

  const browser = await puppeteer.launch({
    args: [
      `--proxy-server=http://${ip}:${port}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
    headless: true,
  });

  const page = await browser.newPage();

  if (user && pass) {
    await page.authenticate({ username: user, password: pass });
  }

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    if (await isBotBlocked(page)) {
      throw new Error('Blocked by bot protection');
    }

    const data = await page.evaluate(() => {
      const title = document.querySelector('h1[data-buy-box-listing-title]')?.innerText || 'N/A';
      const price = document.querySelector('[data-buy-box-region="price"]')?.innerText || 'N/A';
      const shopName = document.querySelector('div[data-region="shop-name"] a')?.innerText || 'N/A';
      const rating = document.querySelector('[data-average-rating]')?.getAttribute('data-average-rating') || 'N/A';
      const reviews = document.querySelector('[data-review-count]')?.getAttribute('data-review-count') || 'N/A';
      return { title, price, shopName, rating, reviews };
    });

    await browser.close();
    return data;
  } catch (err) {
    await browser.close();
    throw err;
  }
};

app.post('/scrape', async (req, res) => {
  const { url } = req.body;
  if (!url || !url.includes('etsy.com/listing')) {
    return res.status(400).json({ error: 'Invalid Etsy listing URL' });
  }

  const proxies = await getProxies();
  let attempts = 0;

  while (attempts < 3) {
    const proxy = getRandomProxy(proxies);
    try {
      console.log(`🧪 Attempt ${attempts + 1} with proxy ${proxy}`);
      const result = await scrapeListing(url, proxy);
      return res.json(result);
    } catch (err) {
      console.warn(`❌ Attempt ${attempts + 1} failed with proxy ${proxy}: ${err.message}`);
      attempts++;
    }
  }

  return res.status(500).json({
    error: 'Scraping failed',
    details: 'All proxy attempts were blocked or failed',
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
