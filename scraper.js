import axios from "axios";
import * as cheerio from "cheerio";

const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;

export async function scrapeEtsyData(url) {
  const apiUrl = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(url)}`;

  const { data: html } = await axios.get(apiUrl);
  const $ = cheerio.load(html);

  const title = $('h1[data-buy-box-listing-title]').text().trim() || "N/A";
  const price = $('p.wt-text-title-l').first().text().trim() || "N/A";
  const rating = $('input[name="rating"]').attr("value") || "N/A";
  const reviews = $('span[data-review-count]').text().trim() || "N/A";
  const shopName = $('div[data-region="shop-name"]').text().trim() || "N/A";

  return { title, price, shopName, rating, reviews };
}
