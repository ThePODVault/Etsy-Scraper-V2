import axios from "axios";
import * as cheerio from "cheerio";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function calculateDemandScore(revenue, reviews) {
  const rev = parseInt(revenue.replace(/[^\d]/g, "")) || 0;
  const revScore = Math.min((rev / 200000) * 50, 50);
  const reviewScore = Math.min((parseInt(reviews || 0) / 1000) * 50, 50);
  return Math.round(revScore + reviewScore);
}

export async function scrapeEtsy(url) {
  const apiKey = process.env.SCRAPER_API_KEY;
  const proxy = u => `http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(u)}`;

  try {
    const res = await axios.get(proxy(url));
    const $ = cheerio.load(res.data);

    const title = $("h1[data-buy-box-listing-title]").text().trim() || "N/A";
    const rating = $("input[name='rating']").attr("value") || "N/A";

    const priceOptions = [];
    $("select option").each((_, el) => {
      const txt = $(el).text().trim();
      if (/[\$€£]\d/.test(txt)) priceOptions.push(txt);
    });

    if (priceOptions.length === 0) {
      const textElements = $("body").text().split("\n").map(t => t.trim());
      const currencyRegex = /^[$€£]\d+(\.\d{2})?$/;

      const found = textElements.find(line => currencyRegex.test(line));
      if (found) priceOptions.push(found);
    }

    const prices = priceOptions
      .map(p => {
        const match = p.match(/[\$€£](\d+(?:\.\d+)?)/);
        return match ? parseFloat(match[1]) : null;
      })
      .filter(n => n !== null);

    const avgPrice = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null;

    let reviews = "N/A";
    $('button[role="tab"]').each((_, el) => {
      const txt = $(el).text();
      if (txt.includes("This item")) {
        const val = $(el).find("span").first().text().replace(/,/g, "").trim();
        if (val && /^\d+$/.test(val)) reviews = val;
      }
    });

    const estRevenue = avgPrice && reviews !== "N/A"
      ? `$${Math.round(parseInt(reviews) * avgPrice).toLocaleString()}`
      : "N/A";

    const estMonthly = avgPrice && reviews !== "N/A"
      ? `$${Math.round((parseInt(reviews) * avgPrice) / 12).toLocaleString()}`
      : "N/A";

    const demandScore = estRevenue !== "N/A" ? calculateDemandScore(estRevenue, reviews) : "N/A";

    let shopName = "N/A";
    $("script[type='application/ld+json']").each((_, el) => {
      try {
        const json = JSON.parse($(el).html());
        if (json["@type"] === "Product" && json?.brand?.name) {
          shopName = json.brand.name;
        }
      } catch {}
    });

    const desc = $("[data-id='description-text']").text().trim() || "N/A";
    const images = $("img").map((_, el) => {
      const src = $(el).attr("src") || $(el).attr("data-src");
      return src?.includes("etsystatic") ? src.split("?")[0] : null;
    }).get().filter(Boolean);

    const category = $("a[href*='/c/']").last().text().trim()
      || $("a[href*='/category/']").last().text().trim() || "N/A";

    let shopCreationYear = "N/A";
    let shopSales = "N/A";

    if (shopName !== "N/A") {
      try {
        const aboutRes = await axios.get(proxy(`https://www.etsy.com/shop/${shopName}/about`));
        const $$ = cheerio.load(aboutRes.data);
        const txt = $$.text();

        const yearMatch = txt.match(/opened in (\d{4})/i) || txt.match(/on etsy since (\d{4})/i);
        if (yearMatch) shopCreationYear = yearMatch[1];

        const salesMatch = txt.match(/([\d,]+)\s+sales/i);
        if (salesMatch) shopSales = salesMatch[1].replace(/,/g, "");
      } catch (err) {
        console.error("⚠️ Failed to scrape shop page:", err.message);
      }
    }

    let tags = [];
    try {
      const prompt = `Extract 13 high-converting Etsy tags from this listing title and description. Each tag must be 1–20 characters. Return them as a JSON array only:\n\nTitle: ${title}\n\nDescription: ${desc}`;
      const aiRes = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      });

      const rawTags = JSON.parse(aiRes.choices[0].message.content);
      tags = rawTags.filter(tag => typeof tag === "string" && tag.length <= 20);
    } catch (err) {
      console.error("❌ Tag AI error:", err.message);
    }

    return {
      title,
      price: priceOptions.length ? priceOptions : "N/A",
      shopName,
      rating,
      listingReviews: reviews,
      estimatedRevenue: estRevenue,
      estimatedMonthlyRevenue: estMonthly,
      demandScore,
      description: desc,
      category,
      images: [...new Set(images)],
      shopCreationYear,
      shopSales,
      tags,
    };
  } catch (err) {
    console.error("❌ Total scrape error:", err.message);
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
