const express = require("express");
const router = express.Router({ mergeParams: true });
const authMiddleware = require("../middleware/authMiddleware");
const { requireTaskAccess } = require("../middleware/permissionMiddleware");
const { validateObjectIdParams } = require("../middleware/validateMiddleware");
const { getShares, addShares, updateShare, revokeShare } = require("../controllers/taskShareController");

router.use(authMiddleware);

// Duoc mount tai /api/tasks/:id/shares (theo de) va /api/tasks/:id/share (duong dan cu, van dung duoc)
// Chia se / doi quyen / thu hoi: chi nguoi tao. Xem danh sach: moi nguoi co quyen xem.
router.get("/", validateObjectIdParams("id"), requireTaskAccess("view"), getShares);
router.post("/", validateObjectIdParams("id"), requireTaskAccess("owner"), addShares);
const updateChain = [validateObjectIdParams("id", "shareId"), requireTaskAccess("owner"), updateShare];
router.patch("/:shareId", ...updateChain);
router.put("/:shareId", ...updateChain); // duong dan cu dung PUT
router.delete("/:shareId", validateObjectIdParams("id", "shareId"), requireTaskAccess("owner"), revokeShare);

module.exports = router;
