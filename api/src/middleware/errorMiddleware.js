const HttpError = require("../utils/httpError");

// 404 cho duong dan khong ton tai
exports.notFound = (req, res) => {
  res.status(404).json({ message: "Không tìm thấy đường dẫn" });
};

// Xu ly loi tap trung: luon tra thong bao chung, KHONG lo chi tiet loi noi bo cho client.
// (Express 5 tu dong chuyen loi cua handler async vao day.)
// eslint-disable-next-line no-unused-vars
exports.errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Dữ liệu gửi lên không phải JSON hợp lệ" });
  }
  if (err.name === "CastError") {
    return res.status(400).json({ message: "Mã định danh không hợp lệ" });
  }
  if (err.name === "ValidationError") {
    return res.status(400).json({ message: "Dữ liệu không hợp lệ" });
  }
  if (err.code === 11000) {
    return res.status(409).json({ message: "Dữ liệu đã tồn tại" });
  }

  console.error("Loi chua xu ly:", err);
  res.status(500).json({ message: "Lỗi server" });
};
