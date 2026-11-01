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

  // ===================== CONG VIEC (TASKS) =====================

  // Lay danh sach cong viec. scope: all | mine | assigned | shared
  static Future<Map<String, dynamic>> getTasks({
    String scope = "all",
    String? status,
    String? priority,
    String? search,
    String? sortBy,
    String order = "desc",
  }) async {
    final headers = await _authHeaders();
    final params = <String, String>{
      "scope": scope,
      if (status != null && status.isNotEmpty) "status": status,
      if (priority != null && priority.isNotEmpty) "priority": priority,
      if (search != null && search.isNotEmpty) "search": search,
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

  static Future<Map<String, dynamic>> deleteTask(String id) async {
    final headers = await _authHeaders();
    final response = await http.delete(Uri.parse("$baseUrl/tasks/$id"), headers: headers);
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    data["success"] = response.statusCode == 200;
    return data;
  }

  // Giao viec cho 1 hoac nhieu nguoi bang email; primaryEmail la nguoi phu trach chinh
  static Future<Map<String, dynamic>> assignTask(
    String id, {
    required List<String> emails,
    String? primaryEmail,
  }) async {
    final headers = await _authHeaders();
    final response = await http.post(
      Uri.parse("$baseUrl/tasks/$id/assign"),
      headers: headers,
      body: jsonEncode({
        "emails": emails,
        if (primaryEmail != null) "primaryEmail": primaryEmail,
      }),
    );
    return jsonDecode(response.body);
  }

  static Future<Map<String, dynamic>> removeAssignee(String id, String userId) async {
    final headers = await _authHeaders();
    final response = await http.delete(
      Uri.parse("$baseUrl/tasks/$id/assign/$userId"),
      headers: headers,
    );
    return jsonDecode(response.body);
  }

  // Chia se cong viec cho 1 nguoi voi quyen viewer hoac editor
  static Future<Map<String, dynamic>> shareTask(
    String id, {
    required String email,
    required String role,
  }) async {
    final headers = await _authHeaders();
    final response = await http.post(
      Uri.parse("$baseUrl/tasks/$id/share"),
      headers: headers,
      body: jsonEncode({"email": email, "role": role}),
    );
    return jsonDecode(response.body);
  }

  static Future<Map<String, dynamic>> updateShareRole(
    String id,
    String userId,
    String role,
  ) async {
    final headers = await _authHeaders();
    final response = await http.put(
      Uri.parse("$baseUrl/tasks/$id/share/$userId"),
      headers: headers,
      body: jsonEncode({"role": role}),
    );
    return jsonDecode(response.body);
  }

  static Future<Map<String, dynamic>> revokeShare(String id, String userId) async {
    final headers = await _authHeaders();
    final response = await http.delete(
      Uri.parse("$baseUrl/tasks/$id/share/$userId"),
      headers: headers,
    );
    return jsonDecode(response.body);
  }
}