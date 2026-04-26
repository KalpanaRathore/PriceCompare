const asyncHandler = require("../utils/asyncHandler");
const searchService = require("../services/search.service");

exports.searchProducts = asyncHandler(async (req, res) => {
  const { q, page = 1, pageSize = 20 } = req.query;
  const platforms = Array.isArray(req.searchPlatforms)
    ? req.searchPlatforms
    : ["amazon", "flipkart", "blinkit", "zepto"];
  const mode = req.searchMode || "full";

  const result = await searchService.search({
    q,
    page: Number(page),
    pageSize: Number(pageSize),
    platforms,
    mode,
  });

  res.status(200).json(result);
});