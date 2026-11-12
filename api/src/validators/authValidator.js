// Cac ham kiem tra du lieu dau vao cho nhom chuc nang tai khoan.
// Moi ham tra ve chuoi thong bao loi, hoac null neu hop le.

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

const isString = (v) => typeof v === "string";

function validateRegister({ fullName, email, password }) {
  if (!isString(fullName) || !fullName.trim()) return "Vui lòng nhập họ tên";
  if (!isString(email) || !email.trim()) return "Vui lòng nhập email";
  if (!EMAIL_REGEX.test(email.trim())) return "Email không hợp lệ";
  if (!isString(password) || !password) return "Vui lòng nhập mật khẩu";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Mật khẩu cần ít nhất ${MIN_PASSWORD_LENGTH} ký tự`;
  }
  return null;
}

function validateLogin({ email, password }) {
  if (!isString(email) || !email.trim() || !isString(password) || !password) {
    return "Thiếu email hoặc mật khẩu";
  }
  return null;
}

function validateUpdateProfile({ fullName, avatarUrl }) {
  if (fullName !== undefined && (!isString(fullName) || !fullName.trim())) {
    return "Họ tên không được để trống";
  }
  if (avatarUrl !== undefined && !isString(avatarUrl)) {
    return "Đường dẫn ảnh đại diện không hợp lệ";
  }
  return null;
}

function validateChangePassword({ oldPassword, newPassword }) {
  if (!isString(oldPassword) || !oldPassword || !isString(newPassword) || !newPassword) {
    return "Thiếu mật khẩu cũ hoặc mới";
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return `Mật khẩu mới cần ít nhất ${MIN_PASSWORD_LENGTH} ký tự`;
  }
  if (oldPassword === newPassword) {
    return "Mật khẩu mới phải khác mật khẩu cũ";
  }
  return null;
}

module.exports = {
  validateRegister,
  validateLogin,
  validateUpdateProfile,
  validateChangePassword,
};
