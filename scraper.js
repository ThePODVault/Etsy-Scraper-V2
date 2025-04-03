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

    // Prices from dropdown (variation)
    const priceOptions = [];
    $("select#inventory-variation-select-0 option").each((i, el) => {
      const text = $(el).text().trim();
      if (text && /\$\d/.test(text)) {
        priceOptions.push(text);
      }
    });

    // Shop name (robust selectors)
    const shopName =
      $("div[data-region='shop-name'] a").first().text().trim() ||
      $("div.shop-name-and-title-container span.text-body-larger").first().text().trim() ||
      "N/A";

    // Rating
    const rating = $("input[name='rating']").attr("value") || "N/A";

    // Number of reviews (clean digits only)
    let reviews =
      $("span[data-review-count]").text().trim() ||
      $("span:contains('reviews')").first().text().trim() ||
      "N/A";

    const match = reviews.replace(/[^\d]/g, "");
    reviews = match || "N/A";

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

