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

    // Extract all variant prices from dropdown
    let priceOptions = [];
    $('select[id^="variation-selector"] option').each((_, el) => {
      const text = $(el).text().trim();
      if (text && /\$\d/.test(text)) {
        priceOptions.push(text);
      }
    });

    // If no dropdown prices, fallback to regular price block
    if (priceOptions.length === 0) {
      const fallbackPrice = $('[data-buy-box-region="price"]').text().trim();
      if (fallbackPrice) priceOptions.push(fallbackPrice);
    }

    const price = priceOptions.length > 0 ? priceOptions : ["N/A"];

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

    // Number of Reviews (Shop or Listing level)
    let reviews =
      $('span[data-review-count]').text().trim() ||
      $('span:contains(" reviews")').first().text().trim() ||
      $('a[href*="#reviews"]').text().trim();

    if (!reviews || reviews.toLowerCase().includes("custom")) {
      reviews = "N/A";
    }

    return { title, price, shopName, rating, reviews };
  } catch (error) {
    console.error("Scraping error:", error.message);
    return {
      title: "N/A",
      price: ["N/A"],
      shopName: "N/A",
      rating: "N/A",
      reviews: "N/A",
    };
  }
}
