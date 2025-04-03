import axios from "axios";
import * as cheerio from "cheerio";
import dotenv from "dotenv";

dotenv.config();

export async function scrapeEtsy(url) {
  const apiKey = process.env.SCRAPER_API_KEY;
  if (!apiKey) throw new Error("SCRAPER_API_KEY not set");

  const proxyUrl = `http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(url)}`;

  try {
    const response = await axios.get(proxyUrl);
    const $ = cheerio.load(response.data);

    // Title
    const title = $("h1[data-buy-box-listing-title]").text().trim() || "N/A";

    // Shop Name: multiple fallbacks
    const shopName =
      $("div[data-region='shop-name'] a").text().trim() ||
      $("p.wt-text-body-01 span.wt-text-link-no-underline").text().trim() ||
      $("div.shop-name-and-title-container span.text-body-larger").first().text().trim() ||
      "N/A";

    // Rating
    const rating = $("input[name='rating']").attr("value") || "N/A";

    // Reviews: get the numeric count
    let reviews =
      $("span[data-review-count]").text().trim() ||
      $("a[href*='reviews']").text().trim() ||
      $("span:contains('reviews')").first().text().trim() ||
      "N/A";

    const numericReviewMatch = reviews.replace(/[^\d]/g, "");
    reviews = numericReviewMatch || "N/A";

    // Prices from dropdown
    const priceOptions = [];
    $("select#inventory-variation-select-0 option").each((i, el) => {
      const text = $(el).text().trim();
      if (text && /\$\d/.test(text)) {
        priceOptions.push(text);
      }
    });

    return {
      title,
      price: priceOptions.length > 0 ? priceOptions : "N/A",
      shopName,
      rating,
      reviews,
    };
  } catch (error) {
    console.error("❌ Scraping error:", error.message);
    return {
      title: "N/A",
      price: "N/A",
      shopName: "N/A",
      rating: "N/A",
      reviews: "N/A",
    };
  }
}
