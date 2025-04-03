import express from "express";
import fetch from "node-fetch";
import * as cheerio from "cheerio";

const app = express();
app.use(express.json());

const SCRAPER_API_KEY = "8b6407774a0552c357c86a458d6b7169"; // Replace with your actual ScraperAPI key

app.post("/scrape", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "No URL provided." });

  const apiUrl = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(
    url
  )}`;

  try {
    const response = await fetch(apiUrl);
    const html = await response.text();
    const $ = cheerio.load(html);

    const title = $('h1[data-buy-box-listing-title]').text().trim() || "N/A";
    const price = $('[data-buy-box-region="price"]').text().trim() || "N/A";
    const shopName = $('div[data-region="shop-name"]').text().trim() || "N/A";
    const rating = $('input[name="rating"]').attr("value") || "N/A";
    const reviews = $('span[class*="wt-text-body-01"]')
      .first()
      .text()
      .trim() || "N/A";

    res.json({
      title,
      price,
      shopName,
      rating,
      reviews,
    });
  } catch (err) {
    console.error("❌ Scraping failed:", err.message);
    res.status(500).json({ error: "Scraping failed", details: err.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
