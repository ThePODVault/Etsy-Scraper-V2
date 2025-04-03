import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { scrapeEtsy } from "./scraper.js";

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("✅ Etsy Scraper is running.");
});

// ✅ This is the key part you're missing:
app.post("/scrape", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "Missing URL" });

    const result = await scrapeEtsy(url);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Scraping failed", message: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
