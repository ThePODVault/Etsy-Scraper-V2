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

    // Shop Name (3 fallback selectors)
    const shopName =
      $("[data-region='shop-name'] a").first().text().trim() ||
      $("a[data-shop-name]").text().trim() ||
      $("div[data-selector='shop-name'] span").text().trim() ||
      "N/A";

    // Rating
    const rating = $("input[name='rating']").attr("value") || "N/A";

    // Review count (cleaned to number only)
    let reviews = $("span[data-review-count]").text().trim() || "N/A";
    reviews = reviews.replace(/[^\d]/g, "") || "N/A";

    // Price (dropdown or static)
    const priceOptions = [];
    $("select#inventory-variation-select-0 option").each((i, el) => {
      const text = $(el).text().trim();
      if (text && /\$\d/.test(text)) {
        priceOptions.push(text);
      }
    });

    // Static fallback price if dropdown isn't available
    if (priceOptions.length === 0) {
      const staticPrice = $("[data-buy-box-region='price']").text().trim();
      if (staticPrice) priceOptions.push(staticPrice);
    }

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
