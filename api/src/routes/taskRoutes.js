const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { requireTaskAccess } = require("../middleware/permissionMiddleware");
const { validate, validateObjectIdParams } = require("../middleware/validateMiddleware");
const { validateCreateTask, validateStatusBody } = require("../validators/taskValidator");
const {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
  updateStatus,
} = require("../controllers/taskController");
const { getTaskEmailLogs } = require("../controllers/emailLogController");
const { getTaskActivities } = require("../controllers/activityController");

router.use(authMiddleware);

const checkId = validateObjectIdParams("id");

router.post("/", validate((req) => validateCreateTask(req.body)), createTask);
router.get("/", getTasks);
router.get("/:id", checkId, requireTaskAccess("view"), getTaskById);
router.put("/:id", checkId, requireTaskAccess("edit"), updateTask);
router.delete("/:id", checkId, requireTaskAccess("owner"), deleteTask);
router.patch(
  "/:id/status",
  checkId,
  validate((req) => validateStatusBody(req.body)),
  requireTaskAccess("edit"),
  updateStatus
);
router.get("/:id/email-logs", checkId, requireTaskAccess("owner"), getTaskEmailLogs);
router.get("/:id/activities", checkId, getTaskActivities);

module.exports = router;
