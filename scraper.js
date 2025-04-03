import axios from "axios";
import * as cheerio from "cheerio";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function scrapeEtsy(url) {
  const apiKey = process.env.SCRAPER_API_KEY;
  if (!apiKey) throw new Error("SCRAPER_API_KEY not set");

  const proxy = (url) =>
    `http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(url)}`;

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
        if (json["@type"] === "Product") {
          if (json?.brand?.name) shopName = json.brand.name;
          if (json?.aggregateRating?.reviewCount)
            reviews = json.aggregateRating.reviewCount.toString();
        }
      } catch (err) {}
    });

    // Description
    const rawDesc = $("[data-id='description-text']").text().trim();
    const description = rawDesc || "N/A";

    // Images
    const images = [];
    $("img").each((_, el) => {
      const src = $(el).attr("src") || $(el).attr("data-src");
      if (src && src.includes("etsystatic")) {
        images.push(src.split("?")[0]);
      }
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

    // Estimated Total Revenue
    const estimatedRevenue =
      avgPrice && reviews !== "N/A"
        ? `$${Math.round(parseInt(reviews) * avgPrice).toLocaleString()}`
        : "N/A";

    // Category
    const category =
      $("a[href*='/c/']").last().text().trim() ||
      $("a[href*='/category/']").last().text().trim() ||
      "N/A";

    // Shop Creation Year + Sales
    let shopCreationYear = "N/A";
    let shopSales = "N/A";

    if (shopName !== "N/A") {
      try {
        const aboutUrl = `https://www.etsy.com/shop/${shopName}/about`;
        const aboutRes = await axios.get(proxy(aboutUrl));
        const $$ = cheerio.load(aboutRes.data);
        const bodyText = $$.text();

        // Extract creation year
        const yearMatch =
          bodyText.match(/opened in (\d{4})/i) ||
          bodyText.match(/on etsy since (\d{4})/i);
        if (yearMatch) {
          shopCreationYear = yearMatch[1];
        }

        // Extract total sales
        const salesMatch = bodyText.match(/([\d,]+)\s+sales/i);
        if (salesMatch) {
          shopSales = salesMatch[1].replace(/,/g, "");
        }
      } catch (err) {
        console.error("❌ Failed to scrape about page:", err.message);
      }
    }

    // Estimate monthly sales (based on review count)
    let estimatedMonthlySales = "N/A";
    let estimatedMonthlyRevenue = "N/A";
    if (
      reviews !== "N/A" &&
      shopCreationYear !== "N/A" &&
      avgPrice !== null
    ) {
      const monthsActive =
        new Date().getFullYear() * 12 +
        new Date().getMonth() -
        (parseInt(shopCreationYear) * 12 + 0);
      const estimatedMonthly = Math.round(parseInt(reviews) / monthsActive);
      estimatedMonthlySales = estimatedMonthly.toString();
      estimatedMonthlyRevenue = `$${Math.round(estimatedMonthly * avgPrice).toLocaleString()}`;
    }

    // Inferred Tags using OpenAI
    let inferredTags = [];
    if (process.env.OPENAI_API_KEY) {
      try {
        const prompt = `Extract 13 high-ranking Etsy SEO tags (1–20 characters each) based on the following title and description. Return as a JSON array.

Title: ${title}
Description: ${description}`;

        const completion = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: prompt }],
        });

        const responseText = completion.choices[0].message.content;
        const extracted = JSON.parse(responseText);
        if (Array.isArray(extracted)) {
          inferredTags = extracted.slice(0, 13).map((tag) => tag.trim());
        }
      } catch (err) {
        console.error("❌ Failed to generate inferred tags:", err.message);
      }
    }

    return {
      title,
      price: priceOptions.length > 0 ? priceOptions : "N/A",
      shopName,
      rating,
      listingReviews: reviews,
      estimatedRevenue,
      estimatedMonthlySales,
      estimatedMonthlyRevenue,
      description,
      category,
      images: [...new Set(images)],
      shopCreationYear,
      shopSales,
      inferredTags,
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
      estimatedMonthlySales: "N/A",
      estimatedMonthlyRevenue: "N/A",
      description: "N/A",
      category: "N/A",
      images: [],
      shopCreationYear: "N/A",
      shopSales: "N/A",
      inferredTags: [],
    };
  }
}
