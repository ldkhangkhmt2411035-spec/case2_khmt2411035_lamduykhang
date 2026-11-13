import 'package:flutter/material.dart';
import '../services/api_service.dart';
import 'login_screen.dart';
import 'statistics_screen.dart';

// Man hinh Ca nhan: xem/cap nhat ho so, doi mat khau, dang xuat.
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _profileFormKey = GlobalKey<FormState>();
  final _passwordFormKey = GlobalKey<FormState>();

  final _nameController = TextEditingController();
  final _oldPasswordController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  String _email = "";
  bool _loading = true;
  String? _loadError;
  bool _savingProfile = false;
  bool _savingPassword = false;
  bool _hideOld = true;
  bool _hideNew = true;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _oldPasswordController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  void _snack(String message, {bool error = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: error ? Colors.red : null),
    );
  }

  Future<void> _loadProfile() async {
    setState(() {
      _loading = true;
      _loadError = null;
    });
    try {
      final result = await ApiService.getMe();
      if (!mounted) return;
      final user = result["user"] as Map<String, dynamic>?;
      if (user == null) {
        setState(() {
          _loadError = result["message"]?.toString() ?? "Không tải được thông tin cá nhân";
          _loading = false;
        });
        return;
      }
      setState(() {
        _nameController.text = user["fullName"]?.toString() ?? "";
        _email = user["email"]?.toString() ?? "";
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loadError = "Không kết nối được máy chủ";
        _loading = false;
      });
    }
  }

  Future<void> _saveProfile() async {
    if (!_profileFormKey.currentState!.validate()) return;
    setState(() => _savingProfile = true);
    try {
      final result = await ApiService.updateMe(fullName: _nameController.text.trim());
      if (!mounted) return;
      if (result["success"] == true) {
        _snack("Cập nhật thông tin thành công");
      } else {
        _snack(result["message"]?.toString() ?? "Cập nhật thất bại", error: true);
      }
    } catch (_) {
      if (mounted) _snack("Không kết nối được máy chủ", error: true);
    } finally {
      if (mounted) setState(() => _savingProfile = false);
    }
  }

  Future<void> _changePassword() async {
    if (!_passwordFormKey.currentState!.validate()) return;
    setState(() => _savingPassword = true);
    try {
      final result = await ApiService.changePassword(
        oldPassword: _oldPasswordController.text,
        newPassword: _newPasswordController.text,
      );
      if (!mounted) return;
      if (result["success"] == true) {
        _oldPasswordController.clear();
        _newPasswordController.clear();
        _confirmPasswordController.clear();
        _snack("Đổi mật khẩu thành công");
      } else {
        _snack(result["message"]?.toString() ?? "Đổi mật khẩu thất bại", error: true);
      }
    } catch (_) {
      if (mounted) _snack("Không kết nối được máy chủ", error: true);
    } finally {
      if (mounted) setState(() => _savingPassword = false);
    }
  }

  Future<void> _logout() async {
    await ApiService.logout();
    if (!mounted) return;
    Navigator.pushAndRemoveUntil(
      context,
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (_) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Cá nhân")),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_loadError != null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(_loadError!, style: const TextStyle(color: Colors.red)),
            const SizedBox(height: 12),
            OutlinedButton(onPressed: _loadProfile, child: const Text("Thử lại")),
          ],
        ),
      );
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _sectionCard(
          title: "Thông tin cá nhân",
          child: Form(
            key: _profileFormKey,
            child: Column(
              children: [
                TextFormField(
                  initialValue: _email,
                  enabled: false,
                  decoration: const InputDecoration(labelText: "Email", border: OutlineInputBorder()),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _nameController,
                  decoration: const InputDecoration(labelText: "Họ tên", border: OutlineInputBorder()),
                  validator: (v) => (v == null || v.trim().isEmpty) ? "Vui lòng nhập họ tên" : null,
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: _savingProfile ? null : _saveProfile,
                    child: _savingProfile
                        ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Text("Lưu thông tin"),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        _sectionCard(
          title: "Đổi mật khẩu",
          child: Form(
            key: _passwordFormKey,
            child: Column(
              children: [
                TextFormField(
                  controller: _oldPasswordController,
                  obscureText: _hideOld,
                  decoration: InputDecoration(
                    labelText: "Mật khẩu hiện tại",
                    border: const OutlineInputBorder(),
                    suffixIcon: IconButton(
                      icon: Icon(_hideOld ? Icons.visibility_off : Icons.visibility),
                      onPressed: () => setState(() => _hideOld = !_hideOld),
                    ),
                  ),
                  validator: (v) => (v == null || v.isEmpty) ? "Vui lòng nhập mật khẩu hiện tại" : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _newPasswordController,
                  obscureText: _hideNew,
                  decoration: InputDecoration(
                    labelText: "Mật khẩu mới",
                    border: const OutlineInputBorder(),
                    suffixIcon: IconButton(
                      icon: Icon(_hideNew ? Icons.visibility_off : Icons.visibility),
                      onPressed: () => setState(() => _hideNew = !_hideNew),
                    ),
                  ),
                  validator: (v) {
                    if (v == null || v.isEmpty) return "Vui lòng nhập mật khẩu mới";
                    if (v.length < 6) return "Mật khẩu cần ít nhất 6 ký tự";
                    if (v == _oldPasswordController.text) return "Mật khẩu mới phải khác mật khẩu cũ";
                    return null;
                  },
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _confirmPasswordController,
                  obscureText: true,
                  decoration: const InputDecoration(
                    labelText: "Nhập lại mật khẩu mới",
                    border: OutlineInputBorder(),
                  ),
                  validator: (v) => v != _newPasswordController.text ? "Mật khẩu xác nhận không khớp" : null,
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.tonal(
                    onPressed: _savingPassword ? null : _changePassword,
                    child: _savingPassword
                        ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Text("Đổi mật khẩu"),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        Card(
          elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          child: ListTile(
            leading: const Icon(Icons.bar_chart),
            title: const Text("Thống kê công việc"),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const StatisticsScreen()),
            ),
          ),
        ),
        const SizedBox(height: 16),
        OutlinedButton.icon(
          onPressed: _logout,
          icon: const Icon(Icons.logout, color: Colors.red),
          label: const Text("Đăng xuất", style: TextStyle(color: Colors.red)),
        ),
        const SizedBox(height: 24),
      ],
    );
  }

  Widget _sectionCard({required String title, required Widget child}) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }
}
