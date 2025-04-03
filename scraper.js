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

    // JSON-LD metadata (shop name + total reviews)
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
    const reviewSelectors = [
      "span[data-review-count]",
      ".wt-text-body-03.wt-nudge-b-2.wt-text-gray", // another possible location
      "span.wt-text-caption" // generic fallback
    ];
    for (const selector of reviewSelectors) {
      const reviewText = $(selector).text().trim();
      const match = reviewText.match(/\d[\d,]*/);
      if (match) {
        listingReviews = match[0].replace(/,/g, "");
        break;
      }
    }

    // Estimate revenue
    let estimatedRevenue = "N/A";
    if (listingReviews !== "N/A" && priceOptions.length > 0) {
      const prices = priceOptions
        .map(p => {
          const match = p.match(/[\d,]+(\.\d{1,2})?/);
          return match ? parseFloat(match[0].replace(/,/g, "")) : null;
        })
        .filter(p => p !== null);

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
      estimatedRevenue
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
      estimatedRevenue: "N/A"
    };
  }
}
