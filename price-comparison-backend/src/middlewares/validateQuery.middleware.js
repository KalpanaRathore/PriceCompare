module.exports = (req, res, next) => {
  const { q, page = 1, pageSize = 20, platforms, mode = "full" } = req.query;

  if (!q || String(q).trim().length < 2) {
    return res.status(400).json({
      message: "Query parameter 'q' is required and must be at least 2 characters",
      code: "INVALID_QUERY",
      details: null,
    });
  }

  const pageNumber = Number(page);
  const pageSizeNumber = Number(pageSize);

  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    return res.status(400).json({
      message: "'page' must be a positive integer",
      code: "INVALID_PAGE",
      details: null,
    });
  }

  if (
    !Number.isInteger(pageSizeNumber) ||
    pageSizeNumber < 1 ||
    pageSizeNumber > 50
  ) {
    return res.status(400).json({
      message: "'pageSize' must be an integer between 1 and 50",
      code: "INVALID_PAGE_SIZE",
      details: null,
    });
  }

  const allowedPlatforms = ["amazon", "flipkart", "blinkit", "zepto"];

  if (platforms) {
    const selectedPlatforms = String(platforms)
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);

    const invalidPlatforms = selectedPlatforms.filter(
      (platform) => !allowedPlatforms.includes(platform)
    );

    if (!selectedPlatforms.length || invalidPlatforms.length) {
      return res.status(400).json({
        message:
          "'platforms' must be a comma-separated list containing any of: amazon, flipkart, blinkit, zepto",
        code: "INVALID_PLATFORMS",
        details: {
          invalidPlatforms,
        },
      });
    }

    req.searchPlatforms = Array.from(new Set(selectedPlatforms));
  } else {
    req.searchPlatforms = allowedPlatforms;
  }

  const normalizedMode = String(mode || "full").trim().toLowerCase();
  if (!["fast", "full"].includes(normalizedMode)) {
    return res.status(400).json({
      message: "'mode' must be either 'fast' or 'full'",
      code: "INVALID_MODE",
      details: null,
    });
  }

  req.searchMode = normalizedMode;

  next();
};