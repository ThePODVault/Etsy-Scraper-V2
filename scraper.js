import axios from "axios";
import * as cheerio from "cheerio";
import dotenv from "dotenv";
import { OpenAI } from "openai";

dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

    // Estimated Revenue
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

        const yearMatch =
          bodyText.match(/opened in (\d{4})/i) ||
          bodyText.match(/on etsy since (\d{4})/i);
        if (yearMatch) {
          shopCreationYear = yearMatch[1];
        }

        const salesMatch = bodyText.match(/([\d,]+)\s+sales/i);
        if (salesMatch) {
          shopSales = salesMatch[1].replace(/,/g, "");
        }
      } catch (err) {
        console.error("❌ Failed to scrape about page:", err.message);
      }
    }

    // AI-generated Tags
    let tags = [];
    try {
      const prompt = `Extract 10 high-performing Etsy SEO tags based on this listing title and description. Only return the tags as a clean JSON array of strings. No extra text.\n\nTitle: ${title}\n\nDescription: ${description}\n\nTags:`;
      const chat = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
      });

      const jsonMatch = chat.choices[0].message.content.match(/\[.*\]/s);
      if (jsonMatch) {
        tags = JSON.parse(jsonMatch[0]);
      }
    } catch (err) {
      console.error("❌ Failed to generate tags with OpenAI:", err.message);
    }

    return {
      title,
      price: priceOptions.length > 0 ? priceOptions : "N/A",
      shopName,
      rating,
      listingReviews: reviews,
      estimatedRevenue,
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
      description: "N/A",
      category: "N/A",
      images: [],
      shopCreationYear: "N/A",
      shopSales: "N/A",
      tags: [],
    };
  }
}
