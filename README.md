# Case Study 2 - Task Manager

**MSSV:** KHMT2411035
**Họ tên:** Lam Duy Khang

Ứng dụng quản lý công việc nhóm: tạo, giao việc, chia sẻ, nhận thông báo (trong app và qua email), theo dõi tiến độ.

- **Backend:** Node.js, Express 5, MongoDB (Mongoose), JWT, nodemailer, node-cron (thư mục `api/`)
- **Mobile:** Flutter (thư mục `TaskManager/`)

## Chức năng

| Nhóm | Nội dung |
|---|---|
| **A. Tài khoản** | Đăng ký, đăng nhập (JWT), xem và sửa hồ sơ, đổi mật khẩu, đăng xuất. Kiểm tra email, mật khẩu ở cả backend và Flutter. |
| **B. Công việc** | CRUD; trạng thái (`todo`, `in_progress`, `completed`); mức ưu tiên; ngày bắt đầu, hạn hoàn thành; tìm kiếm theo tên; lọc theo trạng thái, ưu tiên, người phụ trách; sắp xếp theo ngày tạo, hạn, ưu tiên; đổi nhanh trạng thái. |
| **C. Giao việc, chia sẻ** | Giao cho nhiều người, chọn người phụ trách chính; chia sẻ quyền `viewer` hoặc `editor`; đổi hoặc thu hồi quyền; phân quyền kiểm tra ở backend. |
| **D. Thông báo, email** | Thông báo trong app (có badge chưa đọc, đánh dấu đã đọc); email khi giao việc, chia sẻ, đổi quyền, đổi hạn, hoàn thành; nhắc việc trước hạn 24 giờ; nhật ký email (`EmailLog`, thử gửi lại tối đa 3 lần). |
| **E. Thống kê, tiện ích** | Thống kê theo trạng thái, ưu tiên, giao việc, quá hạn và sắp đến hạn; lịch sử hoạt động của từng công việc; trạng thái loading, lỗi, danh sách trống. |

### Phân quyền

| Vai trò | Xem | Sửa, đổi trạng thái, giao việc | Chia sẻ, đổi quyền | Xóa |
|---|---|---|---|---|
| Chủ sở hữu (người tạo) | ✅ | ✅ | ✅ | ✅ |
| Editor (được chia sẻ `editor` hoặc phụ trách chính) | ✅ | ✅ | ❌ | ❌ |
| Viewer (được chia sẻ `viewer` hoặc được giao không phải chính) | ✅ | ❌ | ❌ | ❌ |

## Cài đặt và chạy

### 1. Backend

```bash
cd api
npm install
cp .env.example .env     # rồi điền giá trị thật vào .env
npm run dev              # hoặc: node src/server.js
```

Biến môi trường (`api/.env`, **không commit file này**):

| Biến | Ý nghĩa |
|---|---|
| `PORT` | Cổng chạy server (mặc định 3000) |
| `MONGODB_URI` | Chuỗi kết nối MongoDB |
| `JWT_SECRET` | Chuỗi bí mật ký JWT |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Cấu hình gửi email. Với Gmail: bật xác minh 2 bước rồi tạo **Mật khẩu ứng dụng** để dùng làm `SMTP_PASS`. |
| `ENABLE_REMINDERS` | Đặt `false` để tắt job nhắc việc (mặc định bật) |

Nếu chưa cấu hình SMTP, API vẫn chạy bình thường; email sẽ được ghi vào nhật ký với trạng thái `failed`.

### 2. Ứng dụng Flutter

```bash
cd TaskManager
flutter pub get
flutter run
```

`baseUrl` nằm ở `lib/services/api_service.dart` (mặc định `http://10.0.2.2:3000/api` cho máy ảo Android; dùng IP máy tính nếu chạy máy thật).

## API chính

Tất cả route (trừ đăng ký, đăng nhập) cần header `Authorization: Bearer <token>`.

| Method | Đường dẫn | Mô tả |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` | Đăng ký, đăng nhập |
| GET, PUT | `/api/auth/me` | Xem, sửa hồ sơ |
| PUT | `/api/auth/change-password` | Đổi mật khẩu |
| GET, POST | `/api/tasks` | Danh sách (query: `scope`, `status`, `priority`, `assigneeId`, `search`, `sortBy`, `order`), tạo mới |
| GET, PUT, DELETE | `/api/tasks/:id` | Chi tiết, sửa, xóa |
| PATCH | `/api/tasks/:id/status` | Đổi trạng thái |
| POST, DELETE | `/api/tasks/:id/assign[/:userId]` | Giao việc, gỡ người phụ trách |
| POST, PUT, DELETE | `/api/tasks/:id/share[/:userId]` | Chia sẻ, đổi quyền, thu hồi |
| GET | `/api/tasks/:id/activities` | Lịch sử hoạt động |
| GET | `/api/tasks/:id/email-logs` | Nhật ký email (chỉ người tạo) |
| GET | `/api/notifications` | Danh sách thông báo, số chưa đọc |
| GET | `/api/notifications/unread-count` | Số thông báo chưa đọc |
| PATCH | `/api/notifications/read-all`, `/api/notifications/:id/read` | Đánh dấu đã đọc |
| GET | `/api/statistics/tasks`, `/assignments`, `/deadlines` | Thống kê |

## Quy trình Git

Mỗi nhóm chức năng làm trên một nhánh riêng rồi merge vào `main`: `feature/A-tai-khoan`, `feature/B-cong-viec`, `feature/D-thong-bao`, `feature/E-thong-ke`, ...
