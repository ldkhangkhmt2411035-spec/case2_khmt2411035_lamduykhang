const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
  assignTask,
  removeAssignee,
  shareTask,
  updateShareRole,
  revokeShare,
} = require("../controllers/taskController");

// Tat ca route cong viec deu yeu cau da dang nhap (co token hop le)
router.use(authMiddleware);

router.post("/", createTask);
router.get("/", getTasks);
router.get("/:id", getTaskById);
router.put("/:id", updateTask);
router.delete("/:id", deleteTask);

router.post("/:id/assign", assignTask);
router.delete("/:id/assign/:userId", removeAssignee);

router.post("/:id/share", shareTask);
router.put("/:id/share/:userId", updateShareRole);
router.delete("/:id/share/:userId", revokeShare);

module.exports = router;
