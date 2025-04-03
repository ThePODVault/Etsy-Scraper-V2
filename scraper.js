import axios from "axios";
import * as cheerio from "cheerio";

export async function scrapeEtsy(url) {
  try {
    const proxyUrl = `http://api.scraperapi.com?api_key=${process.env.SCRAPERAPI_KEY}&url=${encodeURIComponent(url)}`;

    const response = await axios.get(proxyUrl, {
      timeout: 20000,
    });

    const html = response.data;
    const $ = cheerio.load(html);

    const title = $('h1[data-buy-box-listing-title]').text().trim() || "N/A";
    const price = $('[data-buy-box-region="price"]').text().trim() || "N/A";
    const rating = $('[data-review-rating]').first().text().trim() || "N/A";
    const reviews = $('[data-review-count]').first().text().trim() || "N/A";

    const shopName =
      $('[data-component="listing-page-seller-info"] h2').first().text().trim() ||
      $('[data-shop-name]').first().text().trim() ||
      "N/A";

    return {
      title,
      price,
      shopName,
      rating,
      reviews,
    };
  } catch (err) {
    console.error("❌ Scraping failed:", err.message);
    throw err;
  }
}
