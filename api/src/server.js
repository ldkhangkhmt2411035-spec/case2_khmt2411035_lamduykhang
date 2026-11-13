require("dotenv").config();
const app = require("./app");
const connectDB = require("./config/database");
const { startReminderJob } = require("./jobs/reminderJob");

const PORT = process.env.PORT || 3000;

connectDB().then(() => {
  startReminderJob();
  app.listen(PORT, () => {
    console.log(`Server dang chay tai http://localhost:${PORT}`);
  });
});