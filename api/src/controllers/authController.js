const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

exports.register = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({ message: "Thieu thong tin bat buoc" });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: "Email da duoc su dung" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      fullName,
      email: email.toLowerCase(),
      passwordHash,
    });

    res.status(201).json({
      message: "Dang ky thanh cong",
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Loi server", error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Thieu email hoac mat khau" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: "Email hoac mat khau khong dung" });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: "Email hoac mat khau khong dung" });
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      message: "Dang nhap thanh cong",
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Loi server", error: err.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-passwordHash");
    if (!user) {
      return res.status(404).json({ message: "Khong tim thay nguoi dung" });
    }
    res.status(200).json({ user });
  } catch (err) {
    res.status(500).json({ message: "Loi server", error: err.message });
  }
};

exports.updateMe = async (req, res) => {
  try {
    const { fullName, avatarUrl } = req.body;

    const updateData = {};
    if (fullName !== undefined) updateData.fullName = fullName;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;

    const user = await User.findByIdAndUpdate(req.userId, updateData, {
      new: true,
    }).select("-passwordHash");

    if (!user) {
      return res.status(404).json({ message: "Khong tim thay nguoi dung" });
    }

    res.status(200).json({ message: "Cap nhat thanh cong", user });
  } catch (err) {
    res.status(500).json({ message: "Loi server", error: err.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: "Thieu mat khau cu hoac moi" });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "Khong tim thay nguoi dung" });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: "Mat khau cu khong dung" });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.status(200).json({ message: "Doi mat khau thanh cong" });
  } catch (err) {
    res.status(500).json({ message: "Loi server", error: err.message });
  }
};