const router = require("express").Router();

router.use("/products", require("./search.routes"));
router.use("/products", require("./history.routes"));

module.exports = router;