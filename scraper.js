import axios from "axios";
import * as cheerio from "cheerio";

export async function scrapeEtsy(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      },
    });

    const $ = cheerio.load(response.data);

    const title = $("h1[data-buy-box-listing-title]").text().trim();

    const priceRaw = $("[data-buy-box-region=price]").text().trim();
    const price = priceRaw.split("\n").find((line) => line.includes("$")) || "N/A";

    const rating = $("input[name=rating]").attr("value") || "N/A";

    const reviewsText = $("span[data-buy-box-region=review-count]").text().trim();
    const reviewsMatch = reviewsText.match(/(\d+(,\d{3})*|\d+)/);
    const reviews = reviewsMatch ? reviewsMatch[0].replace(/,/g, "") : "N/A";

    const shopName = $("div[data-region=shop-name-and-title] a").first().text().trim() || "N/A";

    return {
      title: title || "N/A",
      price: price || "N/A",
      shopName: shopName || "N/A",
      rating,
      reviews,
    };
  } catch (error) {
    console.error("❌ Scraping error:", error.message);
    return {
      error: "Scraping failed",
      details: error.message,
    };
  }
}
