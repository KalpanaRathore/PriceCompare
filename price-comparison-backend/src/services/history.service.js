const mongoose = require("mongoose");
const PriceHistory = require("../models/PriceHistory.model");
const ProductSnapshot = require("../models/ProductSnapshot.model");
const { isSameDay } = require("../utils/time");

function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

async function saveSnapshot(products = [], query = "") {
  if (!isDbConnected()) {
    return;
  }

  const now = new Date();

  for (const product of products) {
    for (const offer of product.offers) {
      const latest = await PriceHistory.findOne({
        productId: product.id,
        platform: offer.platform,
      }).sort({ timestamp: -1 });

      if (
        latest &&
        isSameDay(latest.timestamp, now) &&
        Number(latest.price) === Number(offer.price)
      ) {
        continue;
      }

      await PriceHistory.create({
        productId: product.id,
        platform: offer.platform,
        price: offer.price,
        timestamp: now,
        metadata: {
          rating: offer.rating,
          inStock: offer.inStock,
          originalPrice: offer.originalPrice,
        },
      });
    }
  }

  await ProductSnapshot.create({
    snapshotDate: now,
    query,
    products,
  });
}

async function getHistory({ productId, platform, days = 30 }) {
  if (!isDbConnected()) {
    const error = new Error("History service is unavailable while database is disconnected");
    error.statusCode = 503;
    error.code = "DB_UNAVAILABLE";
    throw error;
  }

  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);

  const filter = {
    productId,
    timestamp: { $gte: fromDate },
  };

  if (platform) {
    filter.platform = platform;
  }

  const records = await PriceHistory.find(filter)
    .sort({ timestamp: 1 })
    .lean();

  const points = records.map((record) => ({
    timestamp: record.timestamp.toISOString().slice(0, 10),
    price: record.price,
    platform: record.platform,
  }));

  return {
    productId,
    platform: platform || null,
    days,
    points,
  };
}

module.exports = {
  saveSnapshot,
  getHistory,
};