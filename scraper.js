import axios from "axios";
import * as cheerio from "cheerio";
import dotenv from "dotenv";

dotenv.config();

export async function scrapeEtsy(url) {
  const apiKey = process.env.SCRAPER_API_KEY;
  if (!apiKey) throw new Error("SCRAPER_API_KEY not set");

  const proxyUrl = `http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(url)}`;
  const response = await axios.get(proxyUrl);
  const $ = cheerio.load(response.data);

  // ✅ Title
  const title = $("h1[data-buy-box-listing-title]").text().trim() || "N/A";

  // ✅ Price Variants
  const priceOptions = [];
  $("[data-selector='listing-page-variations'] select option").each((_, el) => {
    const text = $(el).text().trim();
    if (
      text &&
      !text.toLowerCase().includes("select") &&
      /\$\d|\€\d|\£\d/.test(text)
    ) {
      priceOptions.push(text);
    }
  });

  const price =
    priceOptions.length > 0
      ? priceOptions
      : [$("[data-buy-box-region=price]").first().text().trim() || "N/A"];

  // ✅ Shop Name
  const shopName =
    $("[data-region='shop-name']").first().text().trim() ||
    $("div.wt-text-body-01.wt-line-height-tight.wt-break-word").first().text().trim() ||
    "N/A";

  // ✅ Rating
  const rating = $("input[name='rating']").attr("value") || "N/A";

  // ✅ Reviews (Numeric count only)
  let reviews = "N/A";
  const metaReviewText = $("meta[itemprop='reviewCount']").attr("content");
  if (metaReviewText) {
    reviews = metaReviewText;
  } else {
    const fallbackText = $("span[data-review-count]").text().trim();
    const match = fallbackText.match(/\d[\d,]*/);
    if (match) reviews = match[0].replace(/,/g, "");
  }

  // ✅ Main Image
  const image =
    $("img[data-index='0']").attr("src") ||
    $("img.wt-max-width-full").first().attr("src") ||
    "N/A";

  // ✅ Categories
  const categories = [];
  $("ul[aria-label='Breadcrumb'] li a").each((_, el) => {
    const category = $(el).text().trim();
    if (
      category &&
      !category.toLowerCase().includes("home") &&
      !category.toLowerCase().includes("etsy")
    ) {
      categories.push(category);
    }
  });

  // ✅ Tags
  const tags = [];
  $("a.wt-tag").each((_, el) => {
    const tag = $(el).text().trim();
    if (tag) tags.push(tag);
  });

  return {
    title,
    price,
    shopName,
    rating,
    reviews,
    image,
    categories: categories.length ? categories : "N/A",
    tags: tags.length ? tags : "N/A",
  };
}

