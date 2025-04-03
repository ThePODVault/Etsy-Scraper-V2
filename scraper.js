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

    if (priceOptions.length === 0) {
      let fallback = $("[data-buy-box-region='price']").text().trim();
      fallback = fallback.replace(/\s+/g, " ").replace(/Loading/i, "").trim();
      if (fallback) priceOptions.push(fallback);
    }

    // JSON-LD metadata for shop name & reviews
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
      } catch {
        // ignore
      }
    });

    // 🟢 Shop Sales (visible in sidebar)
    let shopSales = "N/A";
    const shopSalesText = $("div:contains('Sales')").filter((_, el) => {
      return $(el).text().trim().match(/\d[\d,\.]*\s+Sales/);
    }).first().text().trim();
    const shopSalesMatch = shopSalesText.match(/(\d[\d,\.]*)\s+Sales/i);
    if (shopSalesMatch) {
      shopSales = shopSalesMatch[1].replace(/,/g, "");
    }

    // 🟢 Estimate Revenue
    let estimatedRevenue = "N/A";
    const prices = priceOptions
      .map((p) => {
        const match = p.match(/[\$€£](\d+(?:\.\d+)?)/);
        return match ? parseFloat(match[1]) : null;
      })
      .filter((val) => val !== null);

    if (shopSales !== "N/A" && prices.length > 0) {
      const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
      estimatedRevenue = `$${Math.round(parseInt(shopSales) * avgPrice).toLocaleString()}`;
    }

    return {
      title,
      price: priceOptions.length > 0 ? priceOptions : "N/A",
      shopName,
      rating,
      reviews,
      shopSales,
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
      shopSales: "N/A",
      estimatedRevenue: "N/A",
    };
  }
}
