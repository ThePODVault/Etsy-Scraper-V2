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

    // JSON-LD metadata for shop name and reviews
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
        // skip JSON parsing errors
      }
    });

    // Description
    let description = "N/A";
    $("script[type='application/ld+json']").each((_, el) => {
      try {
        const json = JSON.parse($(el).html());
        if (json && json.description) {
          description = json.description.trim();
        }
      } catch {
        // ignore
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

    // Estimated revenue
    let estimatedRevenue = "N/A";
    if (avgPrice && reviews !== "N/A") {
      estimatedRevenue = `$${Math.round(parseInt(reviews) * avgPrice).toLocaleString()}`;
    }

    // Images
    const images = [];
    $("img").each((_, el) => {
      const src = $(el).attr("src");
      if (src && src.includes("etsystatic.com") && !images.includes(src)) {
        images.push(src);
      }
    });

    // Shop Creation Year
    let shopCreationYear = "N/A";
    const shopUrlMatch = response.data.match(/"url":"https:\/\/www\.etsy\.com\/shop\/[^"]+/);
    if (shopUrlMatch) {
      const shopUrl = shopUrlMatch[0].replace(/\\u002F/g, "/").split('"url":"')[1];
      const shopResponse = await axios.get(`http://api.scraperapi.com?api_key=${apiKey}&url=${shopUrl}`);
      const $shop = cheerio.load(shopResponse.data);
      const foundedText = $shop("div.shop-home-about-section div.wt-text-caption").text();
      const yearMatch = foundedText.match(/since\s+(\d{4})/i);
      if (yearMatch) {
        shopCreationYear = yearMatch[1];
      }
    }

    // Category (breadcrumb)
    let category = "N/A";
    const breadcrumbs = $("ul[aria-label='Breadcrumb'] li a").map((_, el) => $(el).text().trim()).get();
    if (breadcrumbs.length > 1) {
      category = breadcrumbs[breadcrumbs.length - 1];
    }

    return {
      title,
      price: priceOptions.length > 0 ? priceOptions : "N/A",
      shopName,
      rating,
      reviews,
      estimatedRevenue,
      description,
      category,
      images,
      shopCreationYear,
    };
  } catch (error) {
    console.error("❌ Scraping error:", error.message);
    return {
      title: "N/A",
      price: "N/A",
      shopName: "N/A",
      rating: "N/A",
      reviews: "N/A",
      estimatedRevenue: "N/A",
      description: "N/A",
      category: "N/A",
      images: [],
      shopCreationYear: "N/A",
    };
  }
}
