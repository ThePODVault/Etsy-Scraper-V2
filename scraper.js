import axios from "axios";
import * as cheerio from "cheerio";
import dotenv from "dotenv";

dotenv.config();

export async function scrapeEtsy(url) {
  const apiKey = process.env.SCRAPER_API_KEY;
  if (!apiKey) throw new Error("SCRAPER_API_KEY not set");

  const proxy = (targetUrl) =>
    `http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(targetUrl)}`;

  try {
    // Fetch listing page
    const response = await axios.get(proxy(url));
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

    // JSON-LD Metadata
    let shopName = "N/A";
    let reviews = "N/A";
    $("script[type='application/ld+json']").each((_, el) => {
      try {
        const json = JSON.parse($(el).html());
        if (json && json["@type"] === "Product") {
          if (json?.brand?.name) shopName = json.brand.name;
          if (json?.aggregateRating?.reviewCount) {
            reviews = json.aggregateRating.reviewCount.toString();
          }
        }
      } catch {}
    });

    // Description
    let description = "N/A";
    const descSelector = $("div[data-id='description-text'] p").text().trim();
    if (descSelector) description = descSelector;

    // Category (breadcrumb)
    const category =
      $("ul[aria-label='Breadcrumb'] li")
        .last()
        .find("a")
        .text()
        .trim() || "N/A";

    // All image URLs
    const images = [];
    $("img").each((_, el) => {
      const src = $(el).attr("src");
      if (src && src.includes("etsystatic")) images.push(src);
    });

    // Extract shop link to scrape creation year
    const shopUrl =
      $("a[data-region='shop-name']").attr("href") ||
      $("a[href*='/shop/']").attr("href");

    // Shop creation year
    let shopCreationYear = "N/A";
    if (shopUrl) {
      try {
        const shopResponse = await axios.get(proxy(`https://www.etsy.com${shopUrl}`));
        const $$ = cheerio.load(shopResponse.data);
        const yearText = $$("div.wt-text-caption").text();
        const match = yearText.match(/(\d{4})/);
        if (match) shopCreationYear = match[1];
      } catch {}
    }

    // Estimated Revenue
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

    let estimatedRevenue = "N/A";
    if (avgPrice && reviews !== "N/A") {
      estimatedRevenue = `$${Math.round(parseInt(reviews) * avgPrice).toLocaleString()}`;
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
