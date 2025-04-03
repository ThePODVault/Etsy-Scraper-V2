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

  const title = $("h1[data-buy-box-listing-title]").text().trim() || "N/A";
  const shopName = $("[data-buy-box-region='seller-name']").text().trim() || "N/A";
  const rating = $("input[name='rating']").attr("value") || "N/A";
  const reviews = $("span[data-review-count]").text().replace(/\D/g, "") || "N/A";

  const priceOptions = [];
  $("[data-selector='select-option-title-price']").each((_, el) => {
    const text = $(el).text().trim();
    if (text) priceOptions.push(text);
  });

  const image = $("img[data-index='0']").attr("src") || $("img").first().attr("src") || "N/A";

  const categories = [];
  $("nav[aria-label='Breadcrumb'] li a").each((_, el) => {
    const category = $(el).text().trim();
    if (category) categories.push(category);
  });

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
    tags: tags.length > 0 ? tags : "N/A",
  };
}

