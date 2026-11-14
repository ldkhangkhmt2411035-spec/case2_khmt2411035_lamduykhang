const express = require("express");
// mergeParams: de doc duoc :id tu duong dan cha (/api/tasks/:id/assignees)
const router = express.Router({ mergeParams: true });
const authMiddleware = require("../middleware/authMiddleware");
const { requireTaskAccess } = require("../middleware/permissionMiddleware");
const { validateObjectIdParams } = require("../middleware/validateMiddleware");
const {
  getAssignees,
  addAssignees,
  setPrimaryAssignee,
  removeAssignee,
} = require("../controllers/assignmentController");

router.use(authMiddleware);

// Duoc mount tai /api/tasks/:id/assignees (theo de) va /api/tasks/:id/assign (duong dan cu, van dung duoc)
router.get("/", validateObjectIdParams("id"), requireTaskAccess("view"), getAssignees);
router.post("/", validateObjectIdParams("id"), requireTaskAccess("edit"), addAssignees);
router.patch("/:userId", validateObjectIdParams("id", "userId"), requireTaskAccess("edit"), setPrimaryAssignee);
router.delete("/:userId", validateObjectIdParams("id", "userId"), requireTaskAccess("edit"), removeAssignee);

module.exports = router;
