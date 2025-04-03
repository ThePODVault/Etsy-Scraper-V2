import axios from "axios";
import * as cheerio from "cheerio";
import dotenv from "dotenv";

dotenv.config();

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

    const priceOptions = [];
    $("select option").each((_, el) => {
      const text = $(el).text().trim();
      if (text && /[\$€£]\d/.test(text)) priceOptions.push(text);
    });

    if (priceOptions.length === 0) {
      let fallback = $("[data-buy-box-region='price']").text().trim();
      fallback = fallback.replace(/\s+/g, " ").replace(/Loading/i, "").trim();
      if (fallback) priceOptions.push(fallback);
    }

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

    const rawDesc = $("[data-id='description-text']").text().trim();
    const description = rawDesc || "N/A";

    const images = [];
    $("img").each((_, el) => {
      const src = $(el).attr("src") || $(el).attr("data-src");
      if (src && src.includes("etsystatic")) {
        images.push(src.split("?")[0]);
      }
    });

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

    const estimatedRevenue =
      avgPrice && reviews !== "N/A"
        ? `$${Math.round(parseInt(reviews) * avgPrice).toLocaleString()}`
        : "N/A";

    const category =
      $("a[href*='/c/']").last().text().trim() ||
      $("a[href*='/category/']").last().text().trim() ||
      "N/A";

    // 🆕 Shop About Info
    let shopCreationYear = "N/A";
    let shopSales = "N/A";

    if (shopName !== "N/A") {
      try {
        const aboutUrl = `https://www.etsy.com/shop/${shopName}/about`;
        const aboutRes = await axios.get(proxy(aboutUrl));
        const $$ = cheerio.load(aboutRes.data);

        $$(".wt-text-center.wt-text-caption").each((_, el) => {
          const label = $$(el).text().trim().toLowerCase();
          const statValue = $$(el).prev().text().trim();

          if (label.includes("on etsy since") && /\d{4}/.test(statValue)) {
            shopCreationYear = statValue.match(/\d{4}/)[0];
          }

          if (label === "sales" && /^\d/.test(statValue)) {
            shopSales = statValue.replace(/,/g, "");
          }
        });
      } catch (err) {
        console.error("❌ About page error:", err.message);
      }
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
      shopSales,
    };
  } catch (err) {
    console.error("❌ Scraping error:", err.message);
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
      shopSales: "N/A",
    };
  }
}
