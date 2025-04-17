import axios from "axios";
import * as cheerio from "cheerio";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function calculateDemandScore(estimatedRevenue, reviews) {
  const revenue = parseInt(estimatedRevenue.replace(/[^\d]/g, "")) || 0;
  const reviewCount = parseInt(reviews) || 0;
  const revenueScore = Math.min((revenue / 200000) * 50, 50);
  const reviewScore = Math.min((reviewCount / 1000) * 50, 50);
  return Math.round(revenueScore + reviewScore);
}

function extractFallbackPricesFromText(text) {
  const matches = text.match(/[\$€£]\d+(?:\.\d{2})?/g) || [];
  const filtered = [];
  for (const price of matches) {
    const val = parseFloat(price.replace(/[^\d.]/g, ""));
    if (val >= 5 && val <= 1000) {
      filtered.push(price);
    }
  }
  return [...new Set(filtered)];
}

export async function scrapeEtsy(url) {
  const apiKey = process.env.SCRAPER_API_KEY;
  if (!apiKey) throw new Error("SCRAPER_API_KEY not set");

  const proxy = (url) =>
    `http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(url)}`;

  try {
    const response = await axios.get(proxy(url));
    const html = response.data;
    const $ = cheerio.load(html);

    let title = $("h1[data-buy-box-listing-title]").text().trim();
    if (!title) {
      const ogTitle = $('meta[property="og:title"]').attr("content");
      if (ogTitle) title = ogTitle.trim();
    }
    if (!title) title = "N/A";

    const rating = $("input[name='rating']").attr("value") || "N/A";

    let prices = [];
    let displayPrices = [];

    try {
      const priceOptions = [];
      $("select option").each((_, el) => {
        const text = $(el).text().trim();
        if (text && /[\$€£]\d/.test(text)) priceOptions.push(text);
      });

      if (priceOptions.length === 0) {
        const salePrice = $(".wt-text-title-03").first().text().trim();
        const originalPrice = $(".wt-text-strikethrough").first().text().trim();
        const fallback = salePrice || originalPrice || "";
        if (fallback) priceOptions.push(fallback);
      }

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
        const rawFallbackPrices = extractFallbackPricesFromText(html);
        rawFallbackPrices.forEach((price) => {
          const val = parseFloat(price.replace(/[^\d.]/g, ""));
          if (val) {
            prices.push(val);
            displayPrices.push(`$${val.toFixed(2)}`);
          }
        });
      }
    } catch (err) {
      console.log("❌ Price extraction error:", err.message);
    }

    let shopName = "N/A";
    $("script[type='application/ld+json']").each((_, el) => {
      try {
        const json = JSON.parse($(el).html());
        if (json["@type"] === "Product" && json?.brand?.name) {
          shopName = json.brand.name;
        }
      } catch {}
    });

    let listingReviewsFromPage = "N/A";
    try {
      $('button[role="tab"]').each((_, el) => {
        const tabText = $(el).text().trim();
        if (tabText.includes("This item")) {
          const rawNum = $(el).find("span").first().text().replace(/,/g, "").trim();
          if (rawNum && /^\d+$/.test(rawNum)) {
            listingReviewsFromPage = rawNum;
          }
        }
      });

      if (listingReviewsFromPage === "N/A") {
        const alt = $('[data-review-count]').text().replace(/,/g, "").trim();
        if (alt && /^\d+$/.test(alt)) {
          listingReviewsFromPage = alt;
        }
      }

      if (listingReviewsFromPage === "N/A") {
        const match = html.match(/"reviewCount":\s*(\d+)/);
        if (match) {
          listingReviewsFromPage = match[1];
        }
      }
    } catch (e) {
      console.log("❌ Failed to extract reviews:", e.message);
    }

    const rawDesc = $("[data-id='description-text']").text().trim();
    const description = rawDesc || "N/A";

    const images = [];
    $("img").each((_, el) => {
      const src = $(el).attr("src") || $(el).attr("data-src");
      if (src && src.includes("etsystatic")) {
        images.push(src.split("?")[0]);
      }
    });

    const avgPrice = prices.length > 0
      ? prices.reduce((sum, p) => sum + p, 0) / prices.length
      : null;

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

    const [aboutData, tagData] = await Promise.allSettled([
      (async () => {
        let shopCreationYear = "N/A";
        let shopSales = "N/A";

        if (shopName && shopName !== "N/A") {
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

        return { shopCreationYear, shopSales };
      })(),
      (async () => {
        try {
          const prompt = `Extract 13 high-converting Etsy tags from this listing title and description. Each tag must be 1–20 characters. Return them as a JSON array only:\n\nTitle: ${title}\n\nDescription: ${description}`;
          const aiRes = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
          });

          const rawTags = JSON.parse(aiRes.choices[0].message.content);
          return rawTags.filter((t) => typeof t === "string" && t.length <= 20);
        } catch (err) {
          console.error("❌ Failed to generate tags:", err.message);
          return [];
        }
      })(),
    ]);

    const shopCreationYear =
      aboutData.status === "fulfilled" ? aboutData.value.shopCreationYear : "N/A";
    const shopSales =
      aboutData.status === "fulfilled" ? aboutData.value.shopSales : "N/A";

    const tags = tagData.status === "fulfilled" ? tagData.value : [];

    return {
      title,
      price: displayPrices.length ? displayPrices : "N/A",
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
      demandScore: 0,
      description: "N/A",
      category: "N/A",
      images: [],
      shopCreationYear: "N/A",
      shopSales: "N/A",
      tags: [],
    };
  }
}
