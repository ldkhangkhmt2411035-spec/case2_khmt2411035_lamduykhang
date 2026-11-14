const User = require("../models/User");
const { escapeRegex } = require("../services/taskService");

const PUBLIC_FIELDS = "fullName email avatarUrl";

// GET /api/users/search?q=   - tim nguoi dung theo ten hoac email (de giao viec / chia se)
exports.searchUsers = async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (q.length < 2) {
    return res.status(400).json({ message: "Từ khóa tìm kiếm cần ít nhất 2 ký tự" });
  }
  if (q.length > 100) {
    return res.status(400).json({ message: "Từ khóa tìm kiếm quá dài" });
  }

  const pattern = new RegExp(escapeRegex(q), "i");
  const users = await User.find({ $or: [{ fullName: pattern }, { email: pattern }] })
    .select(PUBLIC_FIELDS)
    .sort({ fullName: 1 })
    .limit(10);

  res.status(200).json({ users });
};

// GET /api/users/:id   - thong tin cong khai cua 1 nguoi dung (khong gom mat khau)
exports.getUserById = async (req, res) => {
  const user = await User.findById(req.params.id).select(PUBLIC_FIELDS);
  if (!user) return res.status(404).json({ message: "Không tìm thấy người dùng" });
  res.status(200).json({ user });
};
