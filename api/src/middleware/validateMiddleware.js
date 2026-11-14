const mongoose = require("mongoose");

// validate(fn): fn(req) tra ve chuoi thong bao loi (hoac null neu hop le) -> 400 neu co loi.
exports.validate = (fn) => (req, res, next) => {
  const message = fn(req);
  if (message) return res.status(400).json({ message });
  next();
};

// Kiem tra cac tham so duong dan (vi du :id, :userId) phai la ObjectId hop le -> 400 neu sai.
exports.validateObjectIdParams =
  (...names) =>
  (req, res, next) => {
    for (const name of names) {
      const value = req.params[name];
      if (value !== undefined && !mongoose.isValidObjectId(value)) {
        return res.status(400).json({ message: "Mã định danh không hợp lệ" });
      }
    }
    next();
  };
