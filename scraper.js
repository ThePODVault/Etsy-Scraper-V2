import axios from "axios";
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

    // Extract title
    const title =
      $('h1[data-buy-box-listing-title]').text().trim() ||
      $('h1').first().text().trim() ||
      "N/A";

    // Extract price
    const price =
      $('[data-buy-box-region="price"] [data-selector="price"]').text().trim() ||
      $('[data-selector="price-primary"]').text().trim() ||
      $('p.wt-text-title-03').first().text().trim() ||
      "N/A";

    // Extract shop name
    const shopName =
      $('[data-region="shop-name"] a').text().trim() ||
      $('[data-buy-box-region="seller-name"]').text().trim() ||
      $("p.wt-text-body-03.wt-mr-xs-1").first().text().trim() ||
      "N/A";

    // Extract rating
    const rating =
      $('input[name="rating"]').attr("value") ||
      $('span[aria-label*="stars"]').attr("aria-label")?.split(" ")[0] ||
      "N/A";

    // Extract review count
    const reviews =
      $('span[data-review-count]').text().trim() ||
      $('span[class*="wt-badge"]').last().text().trim() ||
      $('span[class*="review-count"]').text().trim() ||
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

import dotenv from "dotenv";

dotenv.config();

export async function scrapeEtsy(url) {
  const apiKey = process.env.SCRAPER_API_KEY;
  if (!apiKey) throw new Error("SCRAPER_API_KEY not set");

  try {
    const proxyUrl = `http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(url)}`;
    const response = await axios.get(proxyUrl);
    const $ = cheerio.load(response.data);

    // Extract title
    const title =
      $('h1[data-buy-box-listing-title]').text().trim() ||
      $('h1').first().text().trim() ||
      "N/A";

    // Extract price
    const price =
      $('[data-buy-box-region="price"] [data-selector="price"]').text().trim() ||
      $('[data-selector="price-primary"]').text().trim() ||
      $('p.wt-text-title-03').first().text().trim() ||
      "N/A";

    // Extract shop name
    const shopName =
      $('[data-region="shop-name"] a').text().trim() ||
      $('[data-buy-box-region="seller-name"]').text().trim() ||
      $("p.wt-text-body-03.wt-mr-xs-1").first().text().trim() ||
      "N/A";

    // Extract rating
    const rating =
      $('input[name="rating"]').attr("value") ||
      $('span[aria-label*="stars"]').attr("aria-label")?.split(" ")[0] ||
      "N/A";

    // Extract review count
    const reviews =
      $('span[data-review-count]').text().trim() ||
      $('span[class*="wt-badge"]').last().text().trim() ||
      $('span[class*="review-count"]').text().trim() ||
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
