import express from "express";
import dotenv from "dotenv";
import { scrapeEtsy } from "./scraper.js";

dotenv.config();
const app = express();
app.use(express.json());

app.post("/scrape", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "Missing URL" });

  try {
    const data = await scrapeEtsy(url);
    res.json(data);
  } catch (err) {
    console.error("Scraping error:", err.message);
    res.status(500).json({ error: "Scraping failed", details: err.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
