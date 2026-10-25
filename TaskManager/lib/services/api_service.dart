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
}