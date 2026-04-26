const env = require("../config/env");

module.exports = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;

  const response = {
    message: err.message || "Internal server error",
    code: err.code || "INTERNAL_ERROR",
    details: err.details || null,
  };

  if (env.nodeEnv !== "production") {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};