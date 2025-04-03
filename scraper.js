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

    // JSON-LD metadata
    let shopName = "N/A";
    let reviews = "N/A";
    let creationDate = "N/A";

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
          if (json?.dateCreated) {
            creationDate = json.dateCreated.split("T")[0];
          }
        }
      } catch (err) {
        // continue
      }
    });

    // Listing-specific reviews
    let listingReviews = "N/A";
    const listingReviewText = $("[data-review-id]").length;
    if (listingReviewText > 0) {
      listingReviews = listingReviewText.toString();
    }

    // Estimate average price
    let avgPrice = null;
    const prices = priceOptions
      .map((p) => {
        const match = p.match(/[\$€£](\d+(?:\.\d+)?)/);
        return match ? parseFloat(match[1]) : null;
      })
      .filter((val) => val !== null);

    if (prices.length) {
      avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    }

    // Estimated revenue
    let estimatedRevenue = "N/A";
    if (avgPrice && listingReviews !== "N/A") {
      estimatedRevenue = `$${Math.round(parseInt(listingReviews) * avgPrice).toLocaleString()}`;
    }

    // Favorites
    let favorites = "N/A";
    const favText = $("span.wt-text-caption:contains(' favorites')").text().trim();
    const favMatch = favText.match(/(\d[\d,]*)/);
    if (favMatch) favorites = favMatch[1].replace(/,/g, "");

    // Estimated views per month (basic assumption: 3x favorites)
    let viewsPerMonth = "N/A";
    if (favorites !== "N/A") {
      viewsPerMonth = `${parseInt(favorites) * 3}`;
    }

    return {
      title,
      price: priceOptions.length > 0 ? priceOptions : "N/A",
      shopName,
      rating,
      reviews,
      listingReviews,
      estimatedRevenue,
      creationDate,
      favorites,
      viewsPerMonth,
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
      creationDate: "N/A",
      favorites: "N/A",
      viewsPerMonth: "N/A",
    };
  }
}
