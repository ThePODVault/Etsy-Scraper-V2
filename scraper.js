import axios from "axios";
import * as cheerio from "cheerio";
import dotenv from "dotenv";

dotenv.config();

export async function scrapeEtsy(url) {
  const apiKey = process.env.SCRAPER_API_KEY;
  if (!apiKey) throw new Error("SCRAPER_API_KEY not set");

  try {
    const proxyUrl = `http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(url)}`;
    const response = await axios.get(proxyUrl);
    const $ = cheerio.load(response.data);

    // Title
    const title =
      $('h1[data-buy-box-listing-title]').text().trim() ||
      $('h1').first().text().trim() ||
      "N/A";

    // Price
    let price = $('[data-buy-box-region="price"] [data-selector="price"]').text().trim();
    if (!price) {
      price = $('[data-buy-box-region="price"]').text().trim();
    }
    if (!price) {
      price = $('[class*="wt-text-title-03"]').first().text().trim();
    }
    if (!price) {
      price = $("p.wt-text-title-03").first().text().trim();
    }
    if (!price) price = "N/A";

    // Shop Name
    let shopName = $('[data-region="shop-name"] a').text().trim();
    if (!shopName) {
      shopName = $('[data-buy-box-region="seller-name"]').text().trim();
    }
    if (!shopName) {
      shopName = $('a[href*="/shop/"]').first().text().trim();
    }
    if (!shopName) shopName = "N/A";

    // Rating
    const rating =
      $('input[name="rating"]').attr("value") ||
      $('span[aria-label*="stars"]').attr("aria-label")?.split(" ")[0] ||
      "N/A";

    // Review count
    let reviews = $('span[data-review-count]').text().trim();
    if (!reviews) {
      reviews = $('[data-review-count]').text().trim();
    }
    if (!reviews) {
      reviews = $('span:contains("reviews")').text().trim();
    }
    if (!reviews) {
      reviews = $('span[class*="wt-badge"]').last().text().trim();
    }
    if (!reviews || reviews.toLowerCase().includes("custom")) {
      reviews = "N/A";
    }

    return { title, price, shopName, rating, reviews };
  } catch (error) {
    console.error("Scraping error:", error.message);
    return {
      title: "N/A",
      price: "N/A",
      shopName: "N/A",
      rating: "N/A",
      reviews: "N/A",
    };
  }
}
