require("dotenv").config();
const app = require("./app");
const connectDB = require("./config/database");

const PORT = process.env.PORT || 3000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server dang chay tai http://localhost:${PORT}`);
  });
});