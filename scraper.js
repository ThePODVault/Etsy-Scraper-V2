    // Listing-specific reviews
    let listingReviews = "N/A";
    const reviewCountEl = $("[data-review-id]").length;
    if (reviewCountEl > 0) {
      listingReviews = reviewCountEl.toString();
    }

    // Estimate average price
    let avgPrice = null;
    const prices = priceOptions
      .map((p) => {
        const match = p.match(/[\$€£](\d+(?:\.\d+)?)/);
        return match ? parseFloat(match[1]) : null;
      })
      .filter((val) => val !== null);

    if (prices.length) {
      avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    }

    // Estimated revenue
    let estimatedRevenue = "N/A";
    if (avgPrice && listingReviews !== "N/A") {
      estimatedRevenue = `$${Math.round(parseInt(listingReviews) * avgPrice).toLocaleString()}`;
    }

    // Creation date
    let creationDate = "N/A";
    $("script[type='application/ld+json']").each((_, el) => {
      try {
        const json = JSON.parse($(el).html());
        if (json?.dateCreated) {
          creationDate = json.dateCreated.split("T")[0];
        }
      } catch (e) {}
    });

    // Favorites
    let favorites = "N/A";
    const favText = $("span:contains('favorites')").text();
    const favMatch = favText.match(/(\d[\d,]*)/);
    if (favMatch) {
      favorites = favMatch[1].replace(/,/g, "");
    }

    // Estimated views per month
    let viewsPerMonth = "N/A";
    if (favorites !== "N/A") {
      viewsPerMonth = `${parseInt(favorites) * 3}`;
    }

    return {
      title,
      price: priceOptions.length > 0 ? priceOptions : "N/A",
      shopName,
      rating,
      reviews,
      listingReviews,
      estimatedRevenue,
      creationDate,
      favorites,
      viewsPerMonth
    };
