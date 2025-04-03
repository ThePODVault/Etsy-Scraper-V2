import axios from "axios";
import * as cheerio from "cheerio";
import dotenv from "dotenv";

dotenv.config();

export async function scrapeEtsy(url) {
  const apiKey = process.env.SCRAPER_API_KEY;
  if (!apiKey) throw new Error("SCRAPER_API_KEY not set");

  try {
    const proxyUrl = `http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(url)}`;
    const response = await axios.get(proxyUrl);

    const $ = cheerio.load(response.data);

    const title =
      $('h1[data-buy-box-listing-title], h1.wt-text-body-03').text().trim() || "N/A";

    const price =
      $('[data-buy-box-region="price"]').first().text().trim() ||
      $('[data-selector="price-primary"]').first().text().trim() ||
      "N/A";

    const shopName =
      $('div[data-region="shop-name"] span').first().text().trim() ||
      $('[data-buy-box-region="seller-name"]').first().text().trim() ||
      $("p.wt-text-body-03.wt-mr-xs-1").text().trim() ||
      "N/A";

    const rating =
      $('input[name="rating"]').attr("value") ||
      $('span[aria-label*="stars"]').attr("aria-label")?.split(" ")[0] ||
      "N/A";

    const reviews =
      $("span[data-review-count]").text().trim() ||
      $('span.wt-text-body-03.wt-nudge-b-1').text().trim() ||
      "N/A";

    return { title, price, shopName, rating, reviews };
  } catch (error) {
    console.error("Scraping error:", error.message);
    return {
      title: "N/A",
      price: "N/A",
      shopName: "N/A",
      rating: "N/A",
      reviews: "N/A",
    };
  }
}

