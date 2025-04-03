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

  const priceOptions = [];
  $("[data-selector='listing-page-variations'] select option").each((_, el) => {
    const optionText = $(el).text().trim();
    if (optionText && !optionText.toLowerCase().includes("select")) {
      priceOptions.push(optionText);
    }
  });

  const price = priceOptions.length ? priceOptions : [$("[data-buy-box-region=price]").first().text().trim() || "N/A"];

  const shopName =
    $("[data-buy-box-region='seller-name'] a").first().text().trim() ||
    $("div.wt-text-body-01.wt-line-height-tight.wt-break-word").first().text().trim() ||
    "N/A";

  const rating = $("input[name=rating]").attr("value") || "N/A";

  let reviews = "N/A";
  const reviewsText = $("span[data-review-count]").first().text().trim();
  const reviewsMatch = reviewsText.match(/\d[\d,\.]*/);
  if (reviewsMatch) {
    reviews = reviewsMatch[0].replace(",", "");
  }

  const image = $("img[data-index='0']").attr("src") || $("img").first().attr("src") || "N/A";

  let categories = [];
  $("ul[aria-label='Breadcrumb'] li a").each((_, el) => {
    const category = $(el).text().trim();
    if (category && !category.includes("Home") && !category.includes("Etsy")) {
      categories.push(category);
    }
  });

  let tags = [];
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
