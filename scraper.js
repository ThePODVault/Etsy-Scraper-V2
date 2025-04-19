import axios from "axios";
import * as cheerio from "cheerio";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;

function calculateDemandScore(revenueStr, reviewStr, favoritesStr) {
  const revenue = parseInt(revenueStr.replace(/[^\d]/g, "")) || 0;
  const reviews = parseInt(reviewStr) || 0;
  const favorites = parseInt(favoritesStr) || 0;

  const revenueScore = Math.min((revenue / 200000) * 40, 40);
  const reviewScore = Math.min((reviews / 1000) * 40, 40);
  const favoriteScore = Math.min((favorites / 500) * 20, 20);

  return Math.round(revenueScore + reviewScore + favoriteScore);
}

function extractPricesFromText(html) {
  const matches = html.match(/[\$€£]\d+(?:\.\d{2})?/g) || [];
  const filtered = [];
  for (const price of matches) {
    const val = parseFloat(price.replace(/[^\d.]/g, ""));
    if (val >= 5 && val <= 1000) {
      filtered.push(price);
    }
  }
  return [...new Set(filtered)];
}

async function scrapeWithRetry(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const result = await scrapeEtsy(url);
    const needsRetry =
      result.price === "N/A" || result.listingReviews === "N/A" || result.favorites === "N/A";

    if (!needsRetry || attempt === retries) return result;
    console.warn(`🔁 Retry ${attempt} — some fields were N/A`);
    await new Promise(res => setTimeout(res, 2000));
  }
}

export async function scrapeEtsy(url) {
  const proxy = (u) =>
    `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(u)}`;

  try {
    const response = await axios.get(proxy(url));
    const $ = cheerio.load(response.data);
    let title = $("h1[data-buy-box-listing-title]").text().trim();
    if (!title) {
      const ogTitle = $('meta[property="og:title"]').attr("content");
      if (ogTitle) title = ogTitle.trim();
    }
    title ||= "N/A";

    const rating = $("input[name='rating']").attr("value") || "N/A";

    // Price extraction
    const priceOptions = [];
    $("select option").each((_, el) => {
      const text = $(el).text().trim();
      if (text && /[\$€£]\d/.test(text)) priceOptions.push(text);
    });

    if (priceOptions.length === 0) {
      const salePrice = $(".wt-text-title-03").first().text().trim();
      const originalPrice = $(".wt-text-strikethrough").first().text().trim();
      if (salePrice) priceOptions.push(salePrice);
      else if (originalPrice) priceOptions.push(originalPrice);
    }

    let prices = [];
    let displayPrices = [];

    priceOptions.forEach((p) => {
      const match = p.match(/[\$€£](\d+(?:\.\d+)?)/);
      if (match) {
        const val = parseFloat(match[1]);
        if (val >= 5) {
          prices.push(val);
          displayPrices.push(`$${val.toFixed(2)}`);
        }
      }
    });

    if (prices.length === 0) {
      const fallbackPrices = extractPricesFromText(response.data);
      fallbackPrices.forEach((price) => {
        const val = parseFloat(price.replace(/[^\d.]/g, ""));
        if (val) {
          prices.push(val);
          displayPrices.push(`$${val.toFixed(2)}`);
        }
      });
    }

    const avgPrice =
      prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : null;

    // Listing reviews
    let listingReviews = "N/A";
    const tab = $('button[role="tab"] span').first().text().trim();
    if (/^\d+$/.test(tab)) listingReviews = tab;

    // Favorites (from meta description)
    const metaDesc = $('meta[name="description"]').attr("content") || "";
    const favMatch = metaDesc.match(/(\d+)\s+favorites/);
    const favorites = favMatch ? favMatch[1] : "N/A";

    let shopName = "N/A";
    $("script[type='application/ld+json']").each((_, el) => {
      try {
        const json = JSON.parse($(el).html());
        if (json["@type"] === "Product" && json?.brand?.name) {
          shopName = json.brand.name;
        }
      } catch {}
    });

    const rawDesc = $("[data-id='description-text']").text().trim();
    const description = rawDesc || "N/A";

    const images = [];
    $("img").each((_, el) => {
      const src = $(el).attr("src") || $(el).attr("data-src");
      if (src && src.includes("etsystatic")) {
        images.push(src.split("?")[0]);
      }
    });

    const estimatedMonthlyRevenue =
      avgPrice && listingReviews !== "N/A"
        ? `$${Math.round((parseInt(listingReviews) * avgPrice) / 12).toLocaleString()}`
        : "N/A";

    const estimatedYearlyRevenue =
      avgPrice && listingReviews !== "N/A"
        ? `$${Math.round(parseInt(listingReviews) * avgPrice).toLocaleString()}`
        : "N/A";

    const demandScore = calculateDemandScore(
      estimatedYearlyRevenue,
      listingReviews,
      favorites
    );

    const category =
      $("a[href*='/c/']").last().text().trim() ||
      $("a[href*='/category/']").last().text().trim() ||
      "N/A";

    return {
      title,
      price: displayPrices.length ? displayPrices : "N/A",
      shopName,
      rating,
      listingReviews,
      estimatedRevenue: estimatedYearlyRevenue,
      estimatedMonthlyRevenue,
      demandScore,
      favorites,
      description,
      category,
      images: [...new Set(images)],
      tags: [],
    };
  } catch (err) {
    console.error("❌ Scraping error:", err.message);
    return {
      title: "N/A",
      price: "N/A",
      shopName: "N/A",
      rating: "N/A",
      listingReviews: "N/A",
      estimatedRevenue: "N/A",
      estimatedMonthlyRevenue: "N/A",
      demandScore: 0,
      favorites: "N/A",
      description: "N/A",
      category: "N/A",
      images: [],
      tags: [],
    };
  }
}
