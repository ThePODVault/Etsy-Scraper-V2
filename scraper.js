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

  // Title
  const title = $("h1[data-buy-box-listing-title]").text().trim() || "N/A";

  // Shop name
  const shopName = $("a[data-buy-box-region='shop-name']").text().trim() ||
                   $("p.wt-text-body-01.wt-line-height-tight.wt-break-word").first().text().trim() ||
                   "N/A";

  // Rating
  const rating = $("input[name='rating']").attr("value") || "N/A";

  // Reviews count
  const reviewsText = $("span[data-review-count]").text().trim();
  const reviews = reviewsText ? reviewsText.replace(/\D/g, "") : "N/A";

  // Price options
  const priceOptions = [];
  $("[data-selector='select-option-title-price']").each((_, el) => {
    const text = $(el).text().trim();
    if (text) priceOptions.push(text);
  });

  // Fallback: just scrape the price summary
  if (priceOptions.length === 0) {
    const fallbackPrice = $("[data-buy-box-region='price']").text().trim();
    if (fallbackPrice) priceOptions.push(`Price: ${fallbackPrice}`);
  }

  // Image
  const image = $("img[data-index='0']").attr("src") ||
                $("img.wt-max-width-full").first().attr("src") ||
                "N/A";

  // Categories (breadcrumb links)
  const categories = [];
  $("nav[aria-label='Breadcrumb'] li a").each((_, el) => {
    const cat = $(el).text().trim();
    if (cat) categories.push(cat);
  });

  // Tags (usually in tag section at bottom)
  const tags = [];
  $("div[data-selector='tags'] a").each((_, el) => {
    const tag = $(el).text().trim();
    if (tag && !tags.includes(tag)) tags.push(tag);
  });

  return {
    title,
    price: priceOptions.length > 0 ? priceOptions : "N/A",
    shopName,
    rating,
    reviews,
    image,
    categories: categories.length > 0 ? categories : "N/A",
    tags: tags.length > 0 ? tags : "N/A"
  };
}
