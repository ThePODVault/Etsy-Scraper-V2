import axios from "axios";
import * as cheerio from "cheerio";

export async function scrapeEtsy(url) {
  const proxyUrl = `http://api.scraperapi.com?api_key=${process.env.SCRAPERAPI_KEY}&url=${encodeURIComponent(url)}`;

  try {
    const response = await axios.get(proxyUrl);
    const $ = cheerio.load(response.data);

    const title = $('h1[data-buy-box-listing-title]').text().trim() || "N/A";
    const price = $('[data-buy-box-region="price"]').text().trim() || "N/A";
    const shopName = $('div[data-region="shop-name-and-title"] p a').first().text().trim() || "N/A";
    const rating = $('input[name="rating"]').attr("value") || "N/A";
    const reviews = $('[data-region="reviews-count"]').text().trim() || "N/A";

    return { title, price, shopName, rating, reviews };
  } catch (err) {
    throw new Error(err.message);
  }
}
