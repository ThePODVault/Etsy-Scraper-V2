import express from "express";
import { scrapeEtsyData } from "./scraper.js";

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

app.get("/", (req, res) => {
  res.send("✅ Etsy Scraper is running.");
});

app.post("/scrape", async (req, res) => {
  const { url } = req.body;

  if (!url || !url.includes("etsy.com/listing/")) {
    return res.status(400).json({ error: "Invalid or missing Etsy listing URL." });
  }

  try {
    const data = await scrapeEtsyData(url);
    res.json(data);
  } catch (err) {
    console.error("❌ Scraping error:", err.message || err);
    res.status(500).json({ error: "Scraping failed", details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
