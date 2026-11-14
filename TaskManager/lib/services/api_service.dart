import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  // 10.0.2.2 la dia chi dac biet de may ao Android goi ve localhost cua may that
  static const String baseUrl = "http://10.0.2.2:3000/api";

  // Dang ky tai khoan
  static Future<Map<String, dynamic>> register({
    required String fullName,
    required String email,
    required String password,
  }) async {
    final response = await http.post(
      Uri.parse("$baseUrl/auth/register"),
      headers: {"Content-Type": "application/json"},
      body: jsonEncode({
        "fullName": fullName,
        "email": email,
        "password": password,
      }),
    );
    return jsonDecode(response.body);
  }

  // Dang nhap
  static Future<Map<String, dynamic>> login({
    required String email,
    required String password,
  }) async {
    final response = await http.post(
      Uri.parse("$baseUrl/auth/login"),
      headers: {"Content-Type": "application/json"},
      body: jsonEncode({"email": email, "password": password}),
    );
    final data = jsonDecode(response.body);

    // Neu dang nhap thanh cong, luu token vao may
    if (response.statusCode == 200 && data["token"] != null) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString("token", data["token"]);
    }

    return data;
  }

  // Lay thong tin ca nhan
  static Future<Map<String, dynamic>> getMe() async {
    final token = await _getToken();
    final response = await http.get(
      Uri.parse("$baseUrl/auth/me"),
      headers: {"Authorization": "Bearer $token"},
    );
    return jsonDecode(response.body);
  }

  // Cap nhat ho ten / anh dai dien
  static Future<Map<String, dynamic>> updateMe({String? fullName, String? avatarUrl}) async {
    final headers = await _authHeaders();
    final response = await http.put(
      Uri.parse("$baseUrl/auth/me"),
      headers: headers,
      body: jsonEncode({
        if (fullName != null) "fullName": fullName,
        if (avatarUrl != null) "avatarUrl": avatarUrl,
      }),
    );
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    data["success"] = response.statusCode == 200;
    return data;
  }

  // Doi mat khau
  static Future<Map<String, dynamic>> changePassword({
    required String oldPassword,
    required String newPassword,
  }) async {
    final headers = await _authHeaders();
    final response = await http.put(
      Uri.parse("$baseUrl/auth/change-password"),
      headers: headers,
      body: jsonEncode({"oldPassword": oldPassword, "newPassword": newPassword}),
    );
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    data["success"] = response.statusCode == 200;
    return data;
  }

  // Dang xuat: chi can xoa token da luu tren may
  static Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove("token");
  }

  static Future<String?> _getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString("token");
  }

  static Future<bool> isLoggedIn() async {
    final token = await _getToken();
    return token != null;
  }

  static Future<Map<String, String>> _authHeaders() async {
    final token = await _getToken();
    return {
      "Content-Type": "application/json",
      if (token != null) "Authorization": "Bearer $token",
    };
  }

  // ===================== THONG BAO =====================

  // Lay danh sach thong bao + so thong bao chua doc
  static Future<Map<String, dynamic>> getNotifications({bool unreadOnly = false}) async {
    final headers = await _authHeaders();
    final uri = Uri.parse("$baseUrl/notifications").replace(
      queryParameters: {if (unreadOnly) "unread": "true"},
    );
    final response = await http.get(uri, headers: headers);
    return jsonDecode(response.body);
  }

  static Future<int> getUnreadCount() async {
    final headers = await _authHeaders();
    final response = await http.get(Uri.parse("$baseUrl/notifications/unread-count"), headers: headers);
    if (response.statusCode != 200) return 0;
    final data = jsonDecode(response.body);
    return (data["unreadCount"] as num?)?.toInt() ?? 0;
  }

  static Future<bool> markNotificationRead(String id) async {
    final headers = await _authHeaders();
    final response = await http.patch(Uri.parse("$baseUrl/notifications/$id/read"), headers: headers);
    return response.statusCode == 200;
  }

  static Future<bool> markAllNotificationsRead() async {
    final headers = await _authHeaders();
    final response = await http.patch(Uri.parse("$baseUrl/notifications/read-all"), headers: headers);
    return response.statusCode == 200;
  }

  // Nhat ky gui email cua 1 cong viec (chi nguoi tao xem duoc)
  static Future<Map<String, dynamic>> getEmailLogs(String taskId) async {
    final headers = await _authHeaders();
    final response = await http.get(Uri.parse("$baseUrl/tasks/$taskId/email-logs"), headers: headers);
    return jsonDecode(response.body);
  }

  // ===================== THONG KE & LICH SU =====================

  static Future<Map<String, dynamic>> _getJson(String path) async {
    final headers = await _authHeaders();
    final response = await http.get(Uri.parse("$baseUrl$path"), headers: headers);
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    data["success"] = response.statusCode == 200;
    return data;
  }

  // Thong ke theo trang thai / muc uu tien
  static Future<Map<String, dynamic>> getTaskStats() => _getJson("/statistics/tasks");

  // Thong ke giao viec / chia se
  static Future<Map<String, dynamic>> getAssignmentStats() => _getJson("/statistics/assignments");

  // Cong viec sap den han / qua han
  static Future<Map<String, dynamic>> getDeadlineStats() => _getJson("/statistics/deadlines");

  // Lich su hoat dong cua 1 cong viec
  static Future<Map<String, dynamic>> getActivities(String taskId) => _getJson("/tasks/$taskId/activities");

  // ===================== CONG VIEC (TASKS) =====================

  // Lay danh sach cong viec. scope: all | mine | assigned | shared
  static Future<Map<String, dynamic>> getTasks({
    String scope = "all",
    String? status,
    String? priority,
    String? search,
    String? assigneeId,
    String? sortBy,
    String order = "desc",
  }) async {
    final headers = await _authHeaders();
    final params = <String, String>{
      "scope": scope,
      if (status != null && status.isNotEmpty) "status": status,
      if (priority != null && priority.isNotEmpty) "priority": priority,
      if (search != null && search.isNotEmpty) "search": search,
      if (assigneeId != null && assigneeId.isNotEmpty) "assigneeId": assigneeId,
      if (sortBy != null && sortBy.isNotEmpty) "sortBy": sortBy,
      "order": order,
    };
    final uri = Uri.parse("$baseUrl/tasks").replace(queryParameters: params);
    final response = await http.get(uri, headers: headers);
    return jsonDecode(response.body);
  }

  static Future<Map<String, dynamic>> getTaskById(String id) async {
    final headers = await _authHeaders();
    final response = await http.get(Uri.parse("$baseUrl/tasks/$id"), headers: headers);
    return jsonDecode(response.body);
  }

  static Future<Map<String, dynamic>> createTask({
    required String title,
    String description = "",
    String status = "todo",
    String priority = "medium",
    DateTime? startDate,
    DateTime? dueDate,
  }) async {
    final headers = await _authHeaders();
    final response = await http.post(
      Uri.parse("$baseUrl/tasks"),
      headers: headers,
      body: jsonEncode({
        "title": title,
        "description": description,
        "status": status,
        "priority": priority,
        if (startDate != null) "startDate": startDate.toIso8601String(),
        if (dueDate != null) "dueDate": dueDate.toIso8601String(),
      }),
    );
    return jsonDecode(response.body);
  }

  static Future<Map<String, dynamic>> updateTask(
    String id, {
    String? title,
    String? description,
    String? status,
    String? priority,
    DateTime? startDate,
    DateTime? dueDate,
  }) async {
    final headers = await _authHeaders();
    final response = await http.put(
      Uri.parse("$baseUrl/tasks/$id"),
      headers: headers,
      body: jsonEncode({
        if (title != null) "title": title,
        if (description != null) "description": description,
        if (status != null) "status": status,
        if (priority != null) "priority": priority,
        if (startDate != null) "startDate": startDate.toIso8601String(),
        if (dueDate != null) "dueDate": dueDate.toIso8601String(),
      }),
    );
    return jsonDecode(response.body);
  }

  // Chi cap nhat trang thai (PATCH /tasks/:id/status)
  static Future<Map<String, dynamic>> updateStatus(String id, String status) async {
    final headers = await _authHeaders();
    final response = await http.patch(
      Uri.parse("$baseUrl/tasks/$id/status"),
      headers: headers,
      body: jsonEncode({"status": status}),
    );
    return jsonDecode(response.body);
  }

  static Future<Map<String, dynamic>> deleteTask(String id) async {
    final headers = await _authHeaders();
    final response = await http.delete(Uri.parse("$baseUrl/tasks/$id"), headers: headers);
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    data["success"] = response.statusCode == 200;
    return data;
  }

  // ===================== TIM NGUOI, GIAO VIEC, CHIA SE =====================

  // Tim nguoi dung theo ten hoac email (toi thieu 2 ky tu)
  static Future<Map<String, dynamic>> searchUsers(String q) async {
    final headers = await _authHeaders();
    final uri = Uri.parse("$baseUrl/users/search").replace(queryParameters: {"q": q});
    final response = await http.get(uri, headers: headers);
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  // Giao viec cho 1 hoac nhieu nguoi (theo id); primaryUserId la nguoi phu trach chinh
  static Future<Map<String, dynamic>> assignTask(
    String id, {
    required List<String> userIds,
    String? primaryUserId,
  }) async {
    final headers = await _authHeaders();
    final response = await http.post(
      Uri.parse("$baseUrl/tasks/$id/assignees"),
      headers: headers,
      body: jsonEncode({
        "userIds": userIds,
        if (primaryUserId != null) "primaryUserId": primaryUserId,
      }),
    );
    return jsonDecode(response.body);
  }

  // Dat 1 nguoi da duoc giao lam nguoi phu trach chinh
  static Future<Map<String, dynamic>> setPrimaryAssignee(String id, String userId) async {
    final headers = await _authHeaders();
    final response = await http.patch(
      Uri.parse("$baseUrl/tasks/$id/assignees/$userId"),
      headers: headers,
      body: jsonEncode({"isPrimary": true}),
    );
    return jsonDecode(response.body);
  }

  static Future<Map<String, dynamic>> removeAssignee(String id, String userId) async {
    final headers = await _authHeaders();
    final response = await http.delete(
      Uri.parse("$baseUrl/tasks/$id/assignees/$userId"),
      headers: headers,
    );
    return jsonDecode(response.body);
  }

  // Chia se cong viec cho 1 hoac nhieu nguoi voi cung 1 quyen: "viewer" hoac "editor"
  static Future<Map<String, dynamic>> shareTask(
    String id, {
    required List<String> userIds,
    required String permission,
  }) async {
    final headers = await _authHeaders();
    final response = await http.post(
      Uri.parse("$baseUrl/tasks/$id/shares"),
      headers: headers,
      body: jsonEncode({
        "shares": userIds.map((u) => {"userId": u, "permission": permission}).toList(),
      }),
    );
    return jsonDecode(response.body);
  }

  static Future<Map<String, dynamic>> updateShareRole(
    String id,
    String shareId,
    String permission,
  ) async {
    final headers = await _authHeaders();
    final response = await http.patch(
      Uri.parse("$baseUrl/tasks/$id/shares/$shareId"),
      headers: headers,
      body: jsonEncode({"permission": permission}),
    );
    return jsonDecode(response.body);
  }

  static Future<Map<String, dynamic>> revokeShare(String id, String shareId) async {
    final headers = await _authHeaders();
    final response = await http.delete(
      Uri.parse("$baseUrl/tasks/$id/shares/$shareId"),
      headers: headers,
    );
    return jsonDecode(response.body);
  }

  // Gui lai 1 email da that bai (chi nguoi tao cong viec)
  static Future<Map<String, dynamic>> retryEmailLog(String logId) async {
    final headers = await _authHeaders();
    final response = await http.post(Uri.parse("$baseUrl/email-logs/$logId/retry"), headers: headers);
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    data["success"] = response.statusCode == 200;
    return data;
  }
}
