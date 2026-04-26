const mongoose = require("mongoose");
const env = require("./env");
const logger = require("./logger");

let isConnected = false;

async function connectDb() {
  if (isConnected) {
    return mongoose.connection;
  }

  mongoose.set("strictQuery", true);
  await mongoose.connect(env.mongoDbUri, {
    serverSelectionTimeoutMS: 10000,
  });

  isConnected = true;
  logger.info("MongoDB connected", { uri: env.mongoDbUri });

  return mongoose.connection;
}

module.exports = connectDb;