function slugify(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function cleanToken(token = "") {
  return String(token)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeTitle(name = "") {
  return String(name)
    .toLowerCase()
    .replace(/[\[\](){}]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeName(name = "") {
  return normalizeTitle(name)
    .split(/\s+/)
    .map(cleanToken)
    .filter(Boolean)
    .filter((token) => token.length > 1);
}

function isNumericToken(token = "") {
  return /^[0-9]+$/.test(token);
}

function isModelLikeToken(token = "") {
  return /[a-z]/.test(token) && /[0-9]/.test(token);
}

function pickIdentityTokens(tokens = []) {
  const stopWords = new Set([
    "with",
    "and",
    "for",
    "the",
    "from",
    "edition",
    "pack",
    "combo",
    "pcs",
    "piece",
    "new",
    "latest",
    "original",
    "official",
    "inch",
    "cm",
    "mm",
    "gm",
    "kg",
    "ml",
    "ltr",
    "free",
    "delivery",
    "wireless",
    "bluetooth",
    "playtime",
    "hours",
    "hour",
    "charging",
    "fast",
    "latest",
    "version",
    "typec",
    "usb",
    "headphone",
    "headphones",
    "earphone",
    "earphones",
    "headset",
    "over",
    "under",
    "mic",
    "noise",
    "cancellation",
    "premium",
  ]);

  const alphaTokens = tokens.filter(
    (token) => !isNumericToken(token) && !stopWords.has(token)
  );
  const numericOrModelTokens = tokens.filter((token) =>
    /[0-9]/.test(token)
  );

  const selected = [
    ...alphaTokens.slice(0, 4),
    ...numericOrModelTokens.slice(0, 2),
  ];

  return Array.from(new Set(selected));
}

function toTokenSet(values = []) {
  return new Set(values.filter(Boolean));
}

function jaccardSimilarity(first = new Set(), second = new Set()) {
  if (!first.size || !second.size) {
    return 0;
  }

  let intersection = 0;
  for (const token of first) {
    if (second.has(token)) {
      intersection += 1;
    }
  }

  const union = first.size + second.size - intersection;
  return union ? intersection / union : 0;
}

function overlapRatio(first = new Set(), second = new Set()) {
  if (!first.size || !second.size) {
    return 0;
  }

  let intersection = 0;
  for (const token of first) {
    if (second.has(token)) {
      intersection += 1;
    }
  }

  return intersection / Math.max(1, Math.min(first.size, second.size));
}

function toBigrams(value = "") {
  const compact = String(value).replace(/\s+/g, " ").trim();

  if (compact.length < 2) {
    return [];
  }

  const grams = [];
  for (let index = 0; index < compact.length - 1; index += 1) {
    grams.push(compact.slice(index, index + 2));
  }

  return grams;
}

function diceCoefficient(firstText = "", secondText = "") {
  const first = toBigrams(firstText);
  const second = toBigrams(secondText);

  if (!first.length || !second.length) {
    return 0;
  }

  const counts = new Map();
  for (const gram of first) {
    counts.set(gram, (counts.get(gram) || 0) + 1);
  }

  let overlap = 0;
  for (const gram of second) {
    const available = counts.get(gram) || 0;
    if (available > 0) {
      overlap += 1;
      counts.set(gram, available - 1);
    }
  }

  return (2 * overlap) / (first.length + second.length);
}

function safeNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function toComparableKey(name = "", brand = "") {
  const tokens = tokenizeName(`${brand || ""} ${name || ""}`);
  const identity = pickIdentityTokens(tokens);
  return identity.slice(0, 6).join("-");
}

function toProductId(name, brand = "") {
  const comparableKey = toComparableKey(name, brand);
  if (comparableKey) {
    return comparableKey;
  }

  return slugify(name).split("-").slice(0, 6).join("-");
}

function createOfferMatchMeta(raw = {}, query = "") {
  const name = raw.name || raw.title || "Unknown Product";
  const brand = raw.brand || "";
  const normalizedName = normalizeTitle(name);
  const tokens = tokenizeName(`${brand} ${name}`);
  const identityTokens = pickIdentityTokens(tokens);
  const modelTokens = tokens.filter((token) => isModelLikeToken(token));
  const queryTokens = pickIdentityTokens(tokenizeName(query || ""));

  const querySimilarity = queryTokens.length
    ? overlapRatio(toTokenSet(identityTokens), toTokenSet(queryTokens))
    : 0;

  return {
    normalizedName,
    tokenSet: toTokenSet(tokens),
    identitySet: toTokenSet(identityTokens),
    modelSet: toTokenSet(modelTokens),
    brandNorm: cleanToken(brand),
    querySimilarity,
  };
}

function computeMatchScore(firstMeta, secondMeta) {
  const identity = jaccardSimilarity(firstMeta.identitySet, secondMeta.identitySet);
  const tokenOverlap = jaccardSimilarity(firstMeta.tokenSet, secondMeta.tokenSet);
  const modelOverlap = overlapRatio(firstMeta.modelSet, secondMeta.modelSet);
  const textSimilarity = diceCoefficient(
    firstMeta.normalizedName,
    secondMeta.normalizedName
  );
  const brandBonus =
    firstMeta.brandNorm && secondMeta.brandNorm && firstMeta.brandNorm === secondMeta.brandNorm
      ? 0.1
      : 0;

  let score =
    identity * 0.4 + tokenOverlap * 0.2 + modelOverlap * 0.2 + textSimilarity * 0.2 + brandBonus;

  const hasModelTokens = firstMeta.modelSet.size > 0 && secondMeta.modelSet.size > 0;
  const modelMismatch = hasModelTokens && modelOverlap === 0;
  if (modelMismatch) {
    score -= 0.2;
  }

  if (tokenOverlap === 0 && identity === 0 && modelOverlap === 0) {
    score -= 0.15;
  }

  return Number(score.toFixed(4));
}

function shouldReplaceExistingOffer(existingOffer, nextOffer) {
  const relevanceDiff = nextOffer._querySimilarity - existingOffer._querySimilarity;
  if (relevanceDiff > 0.08) {
    return true;
  }

  if (Math.abs(relevanceDiff) <= 0.08 && nextOffer.price < existingOffer.price) {
    return true;
  }

  return nextOffer._rank < existingOffer._rank;
}

function getPlatformsFromOffers(offers = []) {
  return new Set(offers.map((offer) => String(offer.platform || "").toLowerCase()));
}

function intersectCount(first = new Set(), second = new Set()) {
  let count = 0;
  for (const value of first) {
    if (second.has(value)) {
      count += 1;
    }
  }
  return count;
}

function getMinPrice(offers = []) {
  if (!offers.length) {
    return 0;
  }

  return offers.reduce(
    (min, offer) => (offer.price < min ? offer.price : min),
    Number.POSITIVE_INFINITY
  );
}

function computeGroupMergeScore(firstGroup, secondGroup) {
  const nameScore = computeMatchScore(firstGroup._matchMeta, secondGroup._matchMeta);
  const firstPlatforms = getPlatformsFromOffers(firstGroup.offers);
  const secondPlatforms = getPlatformsFromOffers(secondGroup.offers);
  const overlap = intersectCount(firstPlatforms, secondPlatforms);

  const minSize = Math.max(1, Math.min(firstPlatforms.size, secondPlatforms.size));
  const overlapRatioValue = overlap / minSize;
  const hasDistinctPlatform = overlap < minSize;

  const firstMinPrice = getMinPrice(firstGroup.offers);
  const secondMinPrice = getMinPrice(secondGroup.offers);
  const priceRatio =
    firstMinPrice > 0 && secondMinPrice > 0
      ? Math.abs(firstMinPrice - secondMinPrice) / Math.max(firstMinPrice, secondMinPrice)
      : 1;

  const priceBonus =
    priceRatio <= 0.25 ? 0.08 : priceRatio <= 0.5 ? 0.04 : priceRatio <= 0.75 ? 0.02 : 0;

  const platformBonus = hasDistinctPlatform ? 0.06 : 0;
  const heavyOverlapPenalty = overlapRatioValue >= 0.8 ? 0.08 : 0;

  return Number((nameScore + priceBonus + platformBonus - heavyOverlapPenalty).toFixed(4));
}

function absorbGroup(targetGroup, sourceGroup) {
  for (const offer of sourceGroup.offers) {
    const existingPlatformIndex = targetGroup.offers.findIndex(
      (item) => item.platform === offer.platform
    );

    if (existingPlatformIndex >= 0) {
      const existing = targetGroup.offers[existingPlatformIndex];
      if (shouldReplaceExistingOffer(existing, offer)) {
        targetGroup.offers[existingPlatformIndex] = offer;
      }
    } else {
      targetGroup.offers.push(offer);
    }
  }

  if (sourceGroup._nameScore > targetGroup._nameScore) {
    targetGroup.name = sourceGroup.name;
    targetGroup._nameScore = sourceGroup._nameScore;
  }

  if (
    (!targetGroup.brand || targetGroup.brand === "Unknown") &&
    sourceGroup.brand &&
    sourceGroup.brand !== "Unknown"
  ) {
    targetGroup.brand = sourceGroup.brand;
  }

  if (!targetGroup.image && sourceGroup.image) {
    targetGroup.image = sourceGroup.image;
  }

  targetGroup._matchMeta = sourceGroup._nameScore > targetGroup._nameScore
    ? sourceGroup._matchMeta
    : targetGroup._matchMeta;
}

function mergeRelatedGroups(groups = []) {
  const mergeThreshold = 0.46;

  let changed = true;
  while (changed) {
    changed = false;

    outer: for (let index = 0; index < groups.length; index += 1) {
      for (let compareIndex = index + 1; compareIndex < groups.length; compareIndex += 1) {
        const firstGroup = groups[index];
        const secondGroup = groups[compareIndex];

        const score = computeGroupMergeScore(firstGroup, secondGroup);
        if (score < mergeThreshold) {
          continue;
        }

        absorbGroup(firstGroup, secondGroup);
        groups.splice(compareIndex, 1);
        changed = true;
        break outer;
      }
    }
  }

  return groups;
}

function computeQualityScore(offers = []) {
  if (!offers.length) return 0;

  const avgRating =
    offers.reduce((sum, offer) => sum + Number(offer.rating || 0), 0) /
    offers.length;
  const inStockRatio =
    offers.filter((offer) => Boolean(offer.inStock)).length / offers.length;

  const raw = avgRating * 1.6 + inStockRatio * 2.8 + Math.min(offers.length, 3);
  return Number(Math.min(10, raw).toFixed(1));
}

function buildComparison(offers = []) {
  if (!offers.length) {
    return {
      bestOffer: null,
      minPrice: 0,
      maxPrice: 0,
      avgPrice: 0,
      priceSpread: 0,
      offerCount: 0,
      platformCount: 0,
    };
  }

  const sortedByPrice = [...offers].sort((a, b) => a.price - b.price);
  const minPrice = sortedByPrice[0].price;
  const maxPrice = sortedByPrice[sortedByPrice.length - 1].price;
  const avgPrice = Number(
    (
      offers.reduce((sum, offer) => sum + Number(offer.price || 0), 0) /
      offers.length
    ).toFixed(2)
  );
  const platformCount = new Set(offers.map((offer) => offer.platform)).size;

  return {
    bestOffer: {
      platform: sortedByPrice[0].platform,
      price: sortedByPrice[0].price,
      productUrl: sortedByPrice[0].productUrl,
      delivery: sortedByPrice[0].delivery,
      inStock: sortedByPrice[0].inStock,
    },
    minPrice,
    maxPrice,
    avgPrice,
    priceSpread: Number((maxPrice - minPrice).toFixed(2)),
    offerCount: offers.length,
    platformCount,
  };
}

function toUnifiedResults(products = []) {
  return products.map((product) => {
    const platforms = product.offers.map((offer) => ({
      platform: offer.platform,
      price: offer.price,
      productUrl: offer.productUrl,
      inStock: offer.inStock,
    }));

    const sorted = [...platforms].sort((a, b) => a.price - b.price);
    const bestDeal = sorted.length ? sorted[0].platform : null;

    return {
      id: product.id,
      name: product.name,
      bestDeal,
      platforms,
    };
  });
}

function normalizeProducts(
  rawOffers = [],
  { q, requestedPlatforms = [], platformStatus = [] }
) {
  const matchThreshold = 0.55;
  const grouped = [];

  const prepared = rawOffers
    .map((raw, index) => {
      const price = safeNumber(raw.price, 0);
      if (price <= 0) {
        return null;
      }

      const matchMeta = createOfferMatchMeta(raw, q);

      return {
        name: raw.name || raw.title || "Unknown Product",
        brand: raw.brand || "Unknown",
        category: raw.category || "General",
        image: raw.image || "",
        platform: raw.platform,
        price,
        originalPrice: safeNumber(raw.originalPrice, price) || price,
        rating: safeNumber(raw.rating, 0),
        inStock: Boolean(raw.inStock),
        delivery: raw.delivery || "Standard",
        productUrl: raw.productUrl || "",
        priceHistory: Array.isArray(raw.priceHistory) ? raw.priceHistory : [],
        _matchMeta: matchMeta,
        _querySimilarity: matchMeta.querySimilarity,
        _rank: index,
      };
    })
    .filter(Boolean)
    .sort((first, second) => {
      const relevanceDiff = second._querySimilarity - first._querySimilarity;
      if (relevanceDiff !== 0) {
        return relevanceDiff;
      }

      return first._rank - second._rank;
    });

  for (const offer of prepared) {
    let selectedGroup = null;
    let bestScore = 0;

    for (const group of grouped) {
      const score = computeMatchScore(offer._matchMeta, group._matchMeta);
      if (score > bestScore) {
        bestScore = score;
        selectedGroup = group;
      }
    }

    if (!selectedGroup || bestScore < matchThreshold) {
      grouped.push({
        id: toProductId(offer.name, offer.brand),
        name: offer.name,
        brand: offer.brand,
        category: offer.category,
        image: offer.image,
        offers: [offer],
        _matchMeta: offer._matchMeta,
        _nameScore: offer._querySimilarity,
      });
      continue;
    }

    const existingPlatformIndex = selectedGroup.offers.findIndex(
      (item) => item.platform === offer.platform
    );

    if (existingPlatformIndex >= 0) {
      const current = selectedGroup.offers[existingPlatformIndex];
      if (shouldReplaceExistingOffer(current, offer)) {
        selectedGroup.offers[existingPlatformIndex] = offer;
      }
    } else {
      selectedGroup.offers.push(offer);
    }

    if (offer._querySimilarity >= selectedGroup._nameScore) {
      selectedGroup.name = offer.name;
      if (offer.brand && offer.brand !== "Unknown") {
        selectedGroup.brand = offer.brand;
      }
      if (offer.image && !selectedGroup.image) {
        selectedGroup.image = offer.image;
      }
      selectedGroup._nameScore = offer._querySimilarity;
    }
  }

  mergeRelatedGroups(grouped);

  const merged = grouped.map((product) => {
    const offers = product.offers
      .map((offer) => ({
        platform: offer.platform,
        price: offer.price,
        originalPrice: offer.originalPrice,
        rating: offer.rating,
        inStock: offer.inStock,
        delivery: offer.delivery,
        productUrl: offer.productUrl,
        priceHistory: offer.priceHistory,
      }))
      .sort((a, b) => a.price - b.price);

    return {
      id: product.id,
      name: product.name,
      brand: product.brand,
      category: product.category,
      image: product.image,
      offers,
      comparison: buildComparison(offers),
      qualityScore: computeQualityScore(offers),
    };
  });

  const duplicateGuard = new Map();
  for (const product of merged) {
    const baseId = product.id || toProductId(product.name, product.brand);
    const count = (duplicateGuard.get(baseId) || 0) + 1;
    duplicateGuard.set(baseId, count);
    product.id = count === 1 ? baseId : `${baseId}-${count}`;
  }

  merged.sort((a, b) => {
    const matchedPlatformsDiff =
      (b.comparison?.platformCount || 0) - (a.comparison?.platformCount || 0);
    if (matchedPlatformsDiff !== 0) {
      return matchedPlatformsDiff;
    }

    const qualityDiff = b.qualityScore - a.qualityScore;
    if (qualityDiff !== 0) {
      return qualityDiff;
    }

    const offerCountDiff = (b.comparison?.offerCount || 0) - (a.comparison?.offerCount || 0);
    if (offerCountDiff !== 0) {
      return offerCountDiff;
    }

    const aBestPrice = a.comparison?.bestOffer?.price || Number.POSITIVE_INFINITY;
    const bBestPrice = b.comparison?.bestOffer?.price || Number.POSITIVE_INFINITY;
    return aBestPrice - bBestPrice;
  });
  const results = toUnifiedResults(merged);

  return {
    query: q,
    results,
    platforms: {
      requested: requestedPlatforms,
      status: platformStatus,
    },
    total: merged.length,
    page: 1,
    pageSize: merged.length,
    totalPages: 1,
    hasMore: false,
    fetchedAt: new Date().toISOString(),
    products: merged,
  };
}

module.exports = {
  normalizeProducts,
};