const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { validateObjectIdParams } = require("../middleware/validateMiddleware");
const { retryEmailLog } = require("../controllers/emailLogController");

router.use(authMiddleware);

router.post("/:id/retry", validateObjectIdParams("id"), retryEmailLog);

module.exports = router;
