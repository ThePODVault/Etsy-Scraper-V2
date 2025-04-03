import fetch from "node-fetch";
import * as cheerio from "cheerio";

const SCRAPER_API_KEY = process.env.SCRAPERAPI_KEY;

export async function scrapeEtsy(url) {
  try {
    const apiUrl = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(url)}&render=true`;

    const response = await fetch(apiUrl);
    const html = await response.text();
    const $ = cheerio.load(html);

    const title = $('h1[data-buy-box-listing-title]').text().trim() || "N/A";
    const price = $('[data-buy-box-region="price"] [data-selector="price"]').first().text().trim() || $('p.text-xl').first().text().trim() || "N/A";
    const shopName = $('[data-region="shop-name"]').first().text().trim() || $('[data-buy-box-region="shop-name"]').text().trim() || "N/A";
    const rating = $('[data-region="star-rating"] [data-average-rating]').attr('data-average-rating') || "N/A";
    const reviews = $('[data-region="shop-reviews"]').text().trim() || $('[data-buy-box-region="review-count"]').text().trim() || "N/A";

    return { title, price, shopName, rating, reviews };
  } catch (err) {
    console.error("❌ Scraping error:", err.message);
    return {
      title: "N/A",
      price: "N/A",
      shopName: "N/A",
      rating: "N/A",
      reviews: "N/A"
    };
  }
}
