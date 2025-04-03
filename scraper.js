import axios from "axios";
import * as cheerio from "cheerio";
import dotenv from "dotenv";

dotenv.config();

export async function scrapeEtsy(url) {
  const apiKey = process.env.SCRAPER_API_KEY;
  if (!apiKey) throw new Error("SCRAPER_API_KEY not set");

  const proxyUrl = `http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(url)}`;

  const response = await axios.get(proxyUrl);
  const $ = cheerio.load(response.data);

  const title = $("h1[data-buy-box-listing-title]").text().trim() || "N/A";
  const price = $("[data-buy-box-region=price]").first().text().trim() || "N/A";
  const shopName = $("[data-buy-box-region=seller-name]").text().trim() || "N/A";
  const rating = $("input[name=rating]").attr("value") || "N/A";
  const reviews = $("span[data-review-count]").text().trim() || "N/A";

  return { title, price, shopName, rating, reviews };
}
