require("dotenv").config();

const app = require("./app");
const connectDb = require("./config/db");
const logger = require("./config/logger");

const PORT = Number(process.env.PORT) || 4000;

app.listen(PORT, () => {
  logger.info(`Backend running on port ${PORT}`);
});

connectDb().catch((error) => {
  logger.warn("MongoDB unavailable, continuing without persistence", {
    error: error.message,
  });
});