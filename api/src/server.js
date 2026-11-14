require("dotenv").config();
const app = require("./app");
const connectDB = require("./config/database");
const migrate = require("./config/migrate");
const { startReminderJob } = require("./jobs/reminderJob");

const PORT = process.env.PORT || 3000;

connectDB().then(async () => {
  try {
    await migrate();
  } catch (err) {
    console.error("Migrate loi (bo qua, server van chay):", err.message);
  }
  startReminderJob();
  app.listen(PORT, () => {
    console.log(`Server dang chay tai http://localhost:${PORT}`);
  });
});
