const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const taskRoutes = require("./routes/taskRoutes");
const assignmentRoutes = require("./routes/assignmentRoutes");
const taskShareRoutes = require("./routes/taskShareRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const emailLogRoutes = require("./routes/emailLogRoutes");
const statisticsRoutes = require("./routes/statisticsRoutes");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);

// Giao viec va chia se: duong dan theo de (/assignees, /shares) va duong dan cu (/assign, /share)
app.use("/api/tasks/:id/assignees", assignmentRoutes);
app.use("/api/tasks/:id/assign", assignmentRoutes);
app.use("/api/tasks/:id/shares", taskShareRoutes);
app.use("/api/tasks/:id/share", taskShareRoutes);

app.use("/api/tasks", taskRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/email-logs", emailLogRoutes);
app.use("/api/statistics", statisticsRoutes);

app.get("/", (req, res) => {
  res.send("Task Manager API dang chay");
});

// Phai dat SAU cac route: 404 va xu ly loi tap trung (khong lo chi tiet loi noi bo)
app.use(notFound);
app.use(errorHandler);

module.exports = app;
