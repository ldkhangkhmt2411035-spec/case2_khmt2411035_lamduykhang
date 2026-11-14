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
| **C. Giao việc, chia sẻ** | Tìm người theo tên hoặc email; giao cho nhiều người, chọn và đổi người phụ trách chính; chia sẻ cho nhiều người cùng lúc với quyền `viewer` hoặc `editor`; đổi hoặc thu hồi quyền; phân quyền kiểm tra ở backend. |
| **D. Thông báo, email** | Thông báo trong app (badge chưa đọc, đánh dấu đã đọc); email khi giao việc, chia sẻ, đổi quyền, đổi hạn, hoàn thành; nhắc việc trước hạn 24 giờ; nhật ký email (`email_logs`), tự thử gửi lại tối đa 3 lần và nút **Gửi lại** cho email thất bại. |
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
npm run dev              # tự khởi động lại khi sửa code (hoặc: npm start)
npm test                 # chạy bộ kiểm thử (không cần MongoDB)
```

Biến môi trường (`api/.env`, **không commit file này**):

| Biến | Ý nghĩa |
|---|---|
| `PORT` | Cổng chạy server (mặc định 3000) |
| `MONGODB_URI` | Chuỗi kết nối MongoDB |
| `JWT_SECRET` | Chuỗi bí mật ký JWT |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Cấu hình gửi email. Với Gmail: bật xác minh 2 bước rồi tạo **Mật khẩu ứng dụng** để dùng làm `SMTP_PASS`. |
| `ENABLE_REMINDERS` | Đặt `false` để tắt job nhắc việc (mặc định bật) |

Nếu chưa cấu hình SMTP, API vẫn chạy bình thường; email được ghi vào nhật ký với trạng thái `failed` và có thể gửi lại sau khi cấu hình.

Khi khởi động, server tự chuyển dữ liệu cũ cho khớp cấu trúc mới (trạng thái `done` thành `completed`, bổ sung `shareId` cho các mục chia sẻ cũ). Việc này an toàn khi chạy lại.

### 2. Ứng dụng Flutter

```bash
cd TaskManager
flutter pub get
flutter run
```

`baseUrl` nằm ở `lib/services/api_service.dart` (mặc định `http://10.0.2.2:3000/api` cho máy ảo Android; dùng IP máy tính nếu chạy máy thật).

## API

Tất cả route (trừ đăng ký, đăng nhập) cần header `Authorization: Bearer <token>`.

| Nhóm | Method, đường dẫn | Mô tả |
|---|---|---|
| Tài khoản | `POST /api/auth/register`, `POST /api/auth/login` | Đăng ký, đăng nhập |
| | `GET`, `PUT /api/auth/me` | Xem, sửa hồ sơ |
| | `PUT /api/auth/change-password` | Đổi mật khẩu |
| Người dùng | `GET /api/users/search?q=` | Tìm người theo tên hoặc email (từ 2 ký tự) |
| | `GET /api/users/:id` | Thông tin công khai của một người |
| Công việc | `GET /api/tasks` | Danh sách. Query: `scope` (`all`, `created`, `assigned`, `shared`), `status`, `priority`, `assigneeId`, `q`, `sortBy`, `order` |
| | `POST /api/tasks` | Tạo công việc |
| | `GET`, `PUT`, `DELETE /api/tasks/:id` | Chi tiết, sửa, xóa (xóa: chỉ người tạo) |
| | `PATCH /api/tasks/:id/status` | Đổi trạng thái |
| Giao việc | `GET`, `POST /api/tasks/:id/assignees` | Danh sách, giao cho nhiều người (`userIds` hoặc `emails`, kèm `primaryUserId`) |
| | `PATCH`, `DELETE /api/tasks/:id/assignees/:userId` | Đặt người phụ trách chính, gỡ người được giao |
| Chia sẻ | `GET`, `POST /api/tasks/:id/shares` | Danh sách, chia sẻ cho một hoặc nhiều người (`shares: [{userId, permission}]`) |
| | `PATCH`, `DELETE /api/tasks/:id/shares/:shareId` | Đổi quyền, thu hồi (chỉ người tạo) |
| Thông báo | `GET /api/notifications`, `GET /api/notifications/unread-count` | Danh sách, số chưa đọc |
| | `PATCH /api/notifications/read-all`, `PATCH /api/notifications/:id/read` | Đánh dấu đã đọc |
| Email | `GET /api/tasks/:id/email-logs` | Nhật ký email của công việc (chỉ người tạo) |
| | `POST /api/email-logs/:id/retry` | Gửi lại email thất bại (chỉ người tạo, tối đa 6 lần thử tổng cộng) |
| Thống kê | `GET /api/statistics/tasks`, `/assignments`, `/deadlines` | Thống kê |
| Lịch sử | `GET /api/tasks/:id/activities` | Lịch sử hoạt động của công việc |

Các đường dẫn cũ `/api/tasks/:id/assign` và `/api/tasks/:id/share` vẫn dùng được (cùng xử lý với `/assignees` và `/shares`).

## Cấu trúc backend

```
api/src/
├── config/        database.js, email.js (SMTP), migrate.js
├── controllers/   auth, user, task, assignment, taskShare, notification, emailLog, activity, statistics
├── jobs/          reminderJob.js (nhắc việc trước hạn 24 giờ, node-cron)
├── middleware/    authMiddleware, permissionMiddleware, validateMiddleware, errorMiddleware
├── models/        User, Task, Notification, EmailLog, TaskActivity
├── routes/        auth, user, task, assignment, taskShare, notification, emailLog, statistics
├── services/      taskService, emailService, notificationService, activityService
├── utils/         taskAccess (vai trò, quyền), emailTemplates, httpError
├── validators/    authValidator, taskValidator
└── tests/         (api/tests) bộ kiểm thử với model giả lập
```

### Ghi chú thiết kế

- Người được giao (`assignees`) và người được chia sẻ (`sharedWith`) được lưu **nhúng trong document `tasks`** thay vì tách thành collection `task_shares` riêng. API trả về vẫn theo đúng cấu trúc của đề: `assigneeIds`, `primaryAssigneeId`, và mỗi mục chia sẻ có `shareId`, `userId`, `permission`, `sharedBy`, `createdAt`. Một người không thể được chia sẻ hai lần cho cùng một công việc.
- Mọi kiểm tra quyền nằm ở backend (`permissionMiddleware`), không dựa vào việc ẩn nút trên Flutter.
- Lỗi bất ngờ được `errorMiddleware` xử lý tập trung và chỉ trả thông báo chung, không lộ chi tiết nội bộ.

## Quy trình Git

Mỗi nhóm chức năng làm trên một nhánh riêng: `Buoi-1`, `buoi-2`, `buoi-3`, `buoi-4`, ...
