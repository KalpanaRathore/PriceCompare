const mongoose = require("mongoose");

const PriceHistorySchema = new mongoose.Schema(
  {
    productId: {
      type: String,
      required: true,
      index: true,
    },
    platform: {
      type: String,
      required: true,
      index: true,
    },
    price: {
      type: Number,
      required: true,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    metadata: {
      rating: Number,
      inStock: Boolean,
      originalPrice: Number,
    },
  },
  { versionKey: false }
);

PriceHistorySchema.index({ productId: 1, platform: 1, timestamp: -1 });

module.exports = mongoose.model("PriceHistory", PriceHistorySchema);