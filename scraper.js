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

    // Estimated Sales and Revenue
    let estimatedSales = "N/A";
    let estimatedRevenue = "N/A";
    if (reviews !== "N/A") {
      const match = priceOptions[0]?.match(/[\d,.]+/);
      const basePrice = match ? parseFloat(match[0].replace(/,/g, "")) : null;
      if (basePrice) {
        estimatedSales = Math.round(parseInt(reviews) * 3);
        estimatedRevenue = `$${(estimatedSales * basePrice).toFixed(2)}`;
      }
    }

    // Inferred Tags
    const description = $("div[data-id='description-text']").text().trim();
    const tagText = (title + " " + description).toLowerCase().replace(/[^a-z0-9\s]/g, "");
    const words = tagText.split(/\s+/);
    const frequency = {};
    words.forEach((word) => {
      if (word.length > 3 && !["with", "this", "that", "your", "have", "from", "just", "make"].includes(word)) {
        frequency[word] = (frequency[word] || 0) + 1;
      }
    });
    const inferredTags = Object.entries(frequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);

    return {
      title,
      price: priceOptions.length > 0 ? priceOptions : "N/A",
      shopName,
      rating,
      reviews,
      estimatedSales,
      estimatedRevenue,
      inferredTags,
    };
  } catch (error) {
    console.error("❌ Scraping error:", error.message);
    return {
      title: "N/A",
      price: "N/A",
      shopName: "N/A",
      rating: "N/A",
      reviews: "N/A",
      estimatedSales: "N/A",
      estimatedRevenue: "N/A",
      inferredTags: [],
    };
  }
}
