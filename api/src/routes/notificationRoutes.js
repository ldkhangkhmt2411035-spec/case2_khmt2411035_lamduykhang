const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
  getNotifications,
  getUnreadCount,
  markAllRead,
  markRead,
} = require("../controllers/notificationController");

router.use(authMiddleware);

router.get("/", getNotifications);
router.get("/unread-count", getUnreadCount);
// "read-all" phai khai bao TRUOC "/:id/read" de khong bi nham voi tham so :id
router.patch("/read-all", markAllRead);
router.patch("/:id/read", markRead);

module.exports = router;
