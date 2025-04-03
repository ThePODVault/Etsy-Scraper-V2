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

    // Rating
    const rating = $("input[name='rating']").attr("value") || "N/A";

    // Price Options
    const priceOptions = [];
    $("select option").each((_, el) => {
      const text = $(el).text().trim();
      if (text && /[\$€£]\d/.test(text)) {
        priceOptions.push(text);
      }
    });

    // Fallback price
    if (priceOptions.length === 0) {
      let fallback = $("[data-buy-box-region='price']").text().trim();
      fallback = fallback.replace(/\s+/g, " ").replace(/Loading/i, "").trim();
      if (fallback) priceOptions.push(fallback);
    }

    // JSON-LD metadata for shopName and total reviews
    let shopName = "N/A";
    let reviews = "N/A";
    $("script[type='application/ld+json']").each((_, el) => {
      try {
        const json = JSON.parse($(el).html());
        if (json && json["@type"] === "Product") {
          if (json?.brand?.name) {
            shopName = json.brand.name;
          }
          if (json?.aggregateRating?.reviewCount) {
            reviews = json.aggregateRating.reviewCount.toString();
          }
        }
      } catch (err) {
        // continue
      }
    });

    // Listing-specific reviews
    let listingReviews = "N/A";
    try {
      $("span").each((_, el) => {
        const text = $(el).text().trim().toLowerCase();
        const match = text.match(/^(\d[\d,]*)\s+reviews$/);
        if (match) {
          listingReviews = match[1].replace(/,/g, "");
          return false; // break loop once found
        }
      });
    } catch (err) {
      console.warn("⚠️ Failed to extract listing-specific reviews:", err.message);
    }

    // Estimated Revenue (based on avg price and listingReviews)
    let estimatedRevenue = "N/A";
    if (listingReviews !== "N/A" && Array.isArray(priceOptions) && priceOptions.length > 0) {
      const prices = priceOptions
        .map((text) => {
          const match = text.match(/[\$€£](\d+(\.\d+)?)/);
          return match ? parseFloat(match[1]) : null;
        })
        .filter((num) => num !== null);

      if (prices.length > 0) {
        const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
        estimatedRevenue = (avgPrice * parseInt(listingReviews)).toFixed(2);
      }
    }

    return {
      title,
      price: priceOptions.length > 0 ? priceOptions : "N/A",
      shopName,
      rating,
      reviews,
      listingReviews,
      estimatedRevenue,
    };
  } catch (error) {
    console.error("❌ Scraping error:", error.message);
    return {
      title: "N/A",
      price: "N/A",
      shopName: "N/A",
      rating: "N/A",
      reviews: "N/A",
      listingReviews: "N/A",
      estimatedRevenue: "N/A",
    };
  }
}
