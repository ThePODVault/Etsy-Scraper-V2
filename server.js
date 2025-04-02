import express from "express";
import fetch from "node-fetch";
import cheerio from "cheerio";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
const SCRAPER_API_KEY = "8b6407774a0552c357c86a458d6b7169"; // Replace with your real key

async function scrapeListing(url) {
  const apiUrl = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(url)}`;

  const response = await fetch(apiUrl);
  const html = await response.text();
  const $ = cheerio.load(html);

  const title = $("h1[data-buy-box-listing-title]").text().trim() || "N/A";
  const price = $("p[data-buy-box-region='price'] span").first().text().trim() || "N/A";
  const shopName = $("div[data-region='shop-name']").text().trim().split("\n")[0] || "N/A";
  const rating = $("input[name='rating']").attr("value") || "N/A";
  const reviews = $("span[class*='wt-text-body-01 wt-nudge-t-1']").first().text().trim() || "N/A";

  return { title, price, shopName, rating, reviews };
}

app.post("/scrape", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "Missing Etsy URL" });

  try {
    const result = await scrapeListing(url);
    res.json(result);
  } catch (err) {
    console.error("❌ Scraping error:", err.message);
    res.status(500).json({ error: "Scraping failed", details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
