const router = require("express").Router();
const { searchProducts } = require("../controllers/search.controller");
const validateQuery = require("../middlewares/validateQuery.middleware");
const rateLimiter = require("../middlewares/rateLimit.middleware");

router.get("/search", rateLimiter, validateQuery, searchProducts);

module.exports = router;