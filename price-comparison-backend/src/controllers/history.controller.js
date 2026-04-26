const asyncHandler = require("../utils/asyncHandler");
const historyService = require("../services/history.service");

exports.getProductHistory = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { platform, days = 30 } = req.query;

  const result = await historyService.getHistory({
    productId,
    platform,
    days: Number(days),
  });

  res.status(200).json(result);
});