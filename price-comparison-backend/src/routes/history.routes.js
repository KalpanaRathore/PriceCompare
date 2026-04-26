const router = require("express").Router();
const { getProductHistory } = require("../controllers/history.controller");
const rateLimiter = require("../middlewares/rateLimit.middleware");

router.get("/:productId/history", rateLimiter, getProductHistory);

module.exports = router;