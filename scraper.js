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

    // 🏷️ Title
    const title = $("h1[data-buy-box-listing-title]").text().trim() || "N/A";

    // 🛍️ Shop Name - Try multiple selectors
    const shopName =
      $("div[data-region='shop-name'] a").first().text().trim() ||
      $("a[data-shop-name]").text().trim() ||
      $("div[data-selector='shop-name'] span").first().text().trim() ||
      "N/A";

    // ⭐ Rating
    const rating = $("input[name='rating']").attr("value") || "N/A";

    // 🧮 Reviews (number only, cleaned)
    let reviews =
      $("span[data-review-count]").text().trim() ||
      $("a[data-review-count-link]").text().trim() ||
      $("span[class*='wt-text-body-03']").filter((_, el) =>
        $(el).text().includes("reviews")
      ).text().trim() || "N/A";

    reviews = reviews.replace(/[^\d]/g, "") || "N/A";

    // 💰 Prices
    const priceOptions = [];
    $("select#inventory-variation-select-0 option").each((_, el) => {
      const text = $(el).text().trim();
      if (text && /\$\d|\£\d/.test(text)) {
        priceOptions.push(text);
      }
    });

    // Fallback static price
    if (priceOptions.length === 0) {
      let fallback = $("[data-buy-box-region='price']").text().trim();
      fallback = fallback.replace(/\s+/g, " ").replace(/Loading/i, "").trim();
      if (fallback) priceOptions.push(fallback);
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
