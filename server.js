import express from "express";
import { scrapeEtsy } from "./scraper.js";

const app = express();
const PORT = process.env.PORT || 8080;

app.get("/analyze", async (req, res) => {
  const { url } = req.query;

  if (!url || !url.includes("etsy.com/listing")) {
    return res.status(400).json({ error: "Invalid or missing Etsy listing URL" });
  }

  try {
    const result = await scrapeEtsy(url);
    res.json(result);
  } catch (err) {
    console.error("❌ Scraping error:", err.message);
    res.status(500).json({ error: "Scraping failed", details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});