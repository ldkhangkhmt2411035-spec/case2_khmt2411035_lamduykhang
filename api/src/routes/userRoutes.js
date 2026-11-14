const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { validateObjectIdParams } = require("../middleware/validateMiddleware");
const { searchUsers, getUserById } = require("../controllers/userController");

router.use(authMiddleware);

// "/search" phai khai bao TRUOC "/:id" de khong bi nham voi tham so :id
router.get("/search", searchUsers);
router.get("/:id", validateObjectIdParams("id"), getUserById);

module.exports = router;
