const mongoose = require("mongoose");

const OfferSchema = new mongoose.Schema(
  {
    platform: String,
    price: Number,
    originalPrice: Number,
    rating: Number,
    inStock: Boolean,
    delivery: String,
    productUrl: String,
  },
  { _id: false }
);

const ProductSchema = new mongoose.Schema(
  {
    id: String,
    name: String,
    brand: String,
    category: String,
    image: String,
    qualityScore: Number,
    offers: [OfferSchema],
  },
  { _id: false }
);

const ProductSnapshotSchema = new mongoose.Schema(
  {
    snapshotDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    query: {
      type: String,
      index: true,
    },
    products: [ProductSchema],
  },
  { versionKey: false }
);

module.exports = mongoose.model("ProductSnapshot", ProductSnapshotSchema);