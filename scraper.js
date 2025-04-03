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

    // Shop sales (try to get from UI)
    let shopSales = "N/A";
    const shopSalesText = $("div:contains('Sales')").text();
    const shopSalesMatch = shopSalesText.match(/([\d,]+)\s+Sales/i);
    if (shopSalesMatch) {
      shopSales = shopSalesMatch[1].replace(/,/g, "");
    }

    // Estimated revenue
    let estimatedRevenue = "N/A";
    if (avgPrice && shopSales !== "N/A") {
      estimatedRevenue = `$${Math.round(parseInt(shopSales) * avgPrice).toLocaleString()}`;
    }

    // Description
    let description = "N/A";
    const descriptionMeta = $("meta[name='description']").attr("content");
    if (descriptionMeta) description = descriptionMeta.trim();

    // Category (breadcrumb)
    let category = "N/A";
    const breadcrumb = $("ul[aria-label='Breadcrumb'] li").last().text().trim();
    if (breadcrumb) category = breadcrumb;

    // All product images
    const images = [];
    $("img").each((_, el) => {
      const src = $(el).attr("src");
      if (src && src.includes("etsystatic")) {
        images.push(src);
      }
    });

    // Shop creation year (attempt from footer or About section)
    let shopCreationYear = "N/A";
    const footerText = $("footer").text();
    const yearMatch = footerText.match(/©\s?(\d{4})\sEtsy/);
    if (yearMatch) {
      shopCreationYear = yearMatch[1];
    } else {
      const aboutText = $("div:contains('has been on Etsy since')").text();
      const altYearMatch = aboutText.match(/since\s(\d{4})/i);
      if (altYearMatch) {
        shopCreationYear = altYearMatch[1];
      }
    }

    return {
      title,
      price: priceOptions.length > 0 ? priceOptions : "N/A",
      shopName,
      rating,
      reviews,
      shopSales,
      estimatedRevenue,
      description,
      category,
      images,
      shopCreationYear
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
      description: "N/A",
      category: "N/A",
      images: [],
      shopCreationYear: "N/A"
    };
  }
}
