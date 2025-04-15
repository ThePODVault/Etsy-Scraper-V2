import axios from "axios";
import * as cheerio from "cheerio";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function calculateDemandScore(estimatedRevenue, reviews) {
  const revenue = parseInt(estimatedRevenue.replace(/[^\d]/g, "")) || 0;
  const reviewCount = parseInt(reviews) || 0;

  const revenueScore = Math.min((revenue / 200000) * 50, 50); // 0–50 pts
  const reviewScore = Math.min((reviewCount / 1000) * 50, 50); // 0–50 pts

  return Math.round(revenueScore + reviewScore);
}

export async function scrapeEtsy(url) {
  const apiKey = process.env.SCRAPER_API_KEY;
  if (!apiKey) throw new Error("SCRAPER_API_KEY not set");

  const proxy = (url) =>
    `http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(url)}`;

  try {
    const response = await axios.get(proxy(url));
    const $ = cheerio.load(response.data);

    const title = $("h1[data-buy-box-listing-title]").text().trim() || "N/A";
    const rating = $("input[name='rating']").attr("value") || "N/A";

    // Grab all text nodes with currency symbols
    const bodyText = $("body").text();
    const priceMatches = bodyText.match(/[\$€£]\s?\d{1,3}(?:[.,]\d{2})?/g) || [];

    const filteredPrices = priceMatches
      .map(p => parseFloat(p.replace(/[^0-9.]/g, '')))
      .filter(p => p > 1 && p < 1000);

    // Select the most prominent valid price (highest frequency or fallback to middle)
    let finalPrice = "N/A";
    if (filteredPrices.length > 0) {
      const counts = {};
      filteredPrices.forEach(p => counts[p] = (counts[p] || 0) + 1);
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      finalPrice = `$${parseFloat(sorted[0][0]).toFixed(2)}`;
    }

    let shopName = "N/A";
    $("script[type='application/ld+json']").each((_, el) => {
      try {
        const json = JSON.parse($(el).html());
        if (json["@type"] === "Product") {
          if (json?.brand?.name) shopName = json.brand.name;
        }
      } catch {}
    });

    let listingReviewsFromPage = "N/A";
    $('button[role="tab"]').each((_, el) => {
      const tabText = $(el).text().trim();
      const hasThisItem = tabText.startsWith("This item") || tabText.includes("This item");

      if (hasThisItem) {
        const rawNum = $(el).find("span").first().text().replace(/,/g, "").trim();
        if (rawNum && /^\d+$/.test(rawNum)) {
          listingReviewsFromPage = rawNum;
        }
      }
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

    const avgPrice = finalPrice !== "N/A" ? parseFloat(finalPrice.replace(/[^\d.]/g, "")) : null;

    const estimatedMonthlyRevenue =
      avgPrice && listingReviewsFromPage !== "N/A"
        ? `$${Math.round((parseInt(listingReviewsFromPage) * avgPrice) / 12).toLocaleString()}`
        : "N/A";

    const estimatedYearlyRevenue =
      avgPrice && listingReviewsFromPage !== "N/A"
        ? `$${Math.round(parseInt(listingReviewsFromPage) * avgPrice).toLocaleString()}`
        : "N/A";

    const demandScore = calculateDemandScore(
      estimatedYearlyRevenue,
      listingReviewsFromPage
    );

    const category =
      $("a[href*='/c/']").last().text().trim() ||
      $("a[href*='/category/']").last().text().trim() ||
      "N/A";

    let shopCreationYear = "N/A";
    let shopSales = "N/A";

    if (shopName !== "N/A") {
      try {
        const aboutUrl = `https://www.etsy.com/shop/${shopName}/about`;
        const aboutRes = await axios.get(proxy(aboutUrl));
        const $$ = cheerio.load(aboutRes.data);
        const bodyText = $$.text();

        const yearMatch =
          bodyText.match(/opened in (\d{4})/i) ||
          bodyText.match(/on etsy since (\d{4})/i);
        if (yearMatch) shopCreationYear = yearMatch[1];

        const salesMatch = bodyText.match(/([\d,]+)\s+sales/i);
        if (salesMatch) {
          shopSales = salesMatch[1].replace(/,/g, "");
        }
      } catch (err) {
        console.error("❌ Failed to scrape about page:", err.message);
      }
    }

    let tags = [];
    try {
      const prompt = `Extract 13 high-converting Etsy tags from this listing title and description. Each tag must be 1–20 characters. Return them as a JSON array only:\n\nTitle: ${title}\n\nDescription: ${description}`;
      const aiRes = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      });

      const rawTags = JSON.parse(aiRes.choices[0].message.content);
      tags = rawTags.filter((t) => typeof t === "string" && t.length <= 20);
    } catch (err) {
      console.error("❌ Failed to generate tags:", err.message);
    }

    return {
      title,
      price: finalPrice,
      shopName,
      rating,
      listingReviews: listingReviewsFromPage,
      estimatedRevenue: estimatedYearlyRevenue,
      estimatedMonthlyRevenue,
      demandScore,
      description,
      category,
      images: [...new Set(images)],
      shopCreationYear,
      shopSales,
      tags,
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
      demandScore: "N/A",
      description: "N/A",
      category: "N/A",
      images: [],
      shopCreationYear: "N/A",
      shopSales: "N/A",
      tags: [],
    };
  }
}
