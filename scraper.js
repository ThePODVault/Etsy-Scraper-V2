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
      if (text && /[\$€£]\d/.test(text)) priceOptions.push(text);
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
          if (json?.brand?.name) shopName = json.brand.name;
          if (json?.aggregateRating?.reviewCount)
            reviews = json.aggregateRating.reviewCount.toString();
        }
      } catch (_) {}
    });

    // Full Product Description (not meta)
    let description =
      $("[data-id='description-text']").text().trim() ||
      $("div[data-selector='description'] p").text().trim() ||
      "N/A";

    // Category (breadcrumb)
    const category =
      $("ul[aria-label='Breadcrumb'] li:last-child a").text().trim() || "N/A";

    // Images
    const images = [];
    $("img").each((_, el) => {
      const src = $(el).attr("src");
      if (src && src.includes("il_")) images.push(src);
    });

    // Estimate average price
    const prices = priceOptions
      .map((p) => {
        const match = p.match(/[\$€£](\d+(?:\.\d+)?)/);
        return match ? parseFloat(match[1]) : null;
      })
      .filter((val) => val !== null);

    const avgPrice =
      prices.length > 0
        ? prices.reduce((sum, p) => sum + p, 0) / prices.length
        : null;

    // Estimated revenue
    let estimatedRevenue = "N/A";
    if (avgPrice && reviews !== "N/A") {
      estimatedRevenue = `$${Math.round(parseInt(reviews) * avgPrice).toLocaleString()}`;
    }

    // Shop Creation Year from /about page
    let shopCreationYear = "N/A";
    if (shopName !== "N/A") {
      const aboutUrl = `https://www.etsy.com/shop/${shopName}/about`;
      const aboutRes = await axios.get(proxy(aboutUrl));
      const $$ = cheerio.load(aboutRes.data);

      $$("h4").each((_, el) => {
        const heading = $$(el).text().trim();
        if (heading.toLowerCase().includes("on etsy since")) {
          const yearText = $$(el).next().text().trim();
          const match = yearText.match(/\d{4}/);
          if (match) shopCreationYear = match[0];
        }
      });
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
      images: [...new Set(images)],
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
