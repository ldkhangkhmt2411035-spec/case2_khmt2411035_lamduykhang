import 'package:flutter/material.dart';
import '../models/task.dart';
import '../services/api_service.dart';

// Hop thoai giao cong viec cho 1 hoac nhieu nguoi bang email.
// Tra ve true qua Navigator.pop neu co thay doi can refresh lai man hinh chi tiet.
class AssignDialog extends StatefulWidget {
  final Task task;

  const AssignDialog({super.key, required this.task});

  @override
  State<AssignDialog> createState() => _AssignDialogState();
}

class _AssignDialogState extends State<AssignDialog> {
  final _emailController = TextEditingController();
  final List<String> _pendingEmails = [];
  String? _primaryEmail;
  bool _submitting = false;
  String? _error;
  bool _changed = false;

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  void _addEmail() {
    final email = _emailController.text.trim();
    if (email.isEmpty) return;
    if (!email.contains("@")) {
      setState(() => _error = "Email không hợp lệ");
      return;
    }
    if (!_pendingEmails.contains(email)) {
      setState(() {
        _pendingEmails.add(email);
        _primaryEmail ??= email;
        _error = null;
      });
    }
    _emailController.clear();
  }

  Future<void> _handleSubmit() async {
    if (_pendingEmails.isEmpty) {
      setState(() => _error = "Thêm ít nhất 1 email trước khi giao việc");
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });

    final result = await ApiService.assignTask(
      widget.task.id,
      emails: _pendingEmails,
      primaryEmail: _primaryEmail,
    );

    if (!mounted) return;
    setState(() => _submitting = false);

    if (result["task"] != null) {
      final notFound = (result["notFoundEmails"] as List?)?.cast<String>() ?? [];
      if (notFound.isNotEmpty) {
        setState(() => _error = "Không tìm thấy tài khoản với email: ${notFound.join(', ')}");
        _pendingEmails.removeWhere(notFound.contains);
      } else {
        Navigator.pop(context, true);
        return;
      }
      _changed = true;
    } else {
      setState(() => _error = result["message"]?.toString() ?? "Giao việc thất bại");
    }
  }

  Future<void> _removeExisting(String userId) async {
    final result = await ApiService.removeAssignee(widget.task.id, userId);
    if (!mounted) return;
    if (result["task"] != null) {
      setState(() {
        widget.task.assignees.removeWhere((a) => a.user.id == userId);
        _changed = true;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text("Giao việc"),
      content: SizedBox(
        width: 360,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (widget.task.assignees.isNotEmpty) ...[
              const Text("Đang phụ trách:", style: TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 6),
              ...widget.task.assignees.map(
                (a) => Chip(
                  label: Text(a.isPrimary ? "${a.user.fullName} (chính)" : a.user.fullName),
                  onDeleted: () => _removeExisting(a.user.id),
                ),
              ),
              const SizedBox(height: 12),
            ],
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _emailController,
                    decoration: const InputDecoration(
                      hintText: "Nhập email người nhận",
                      border: OutlineInputBorder(),
                      isDense: true,
                    ),
                    keyboardType: TextInputType.emailAddress,
                    onSubmitted: (_) => _addEmail(),
                  ),
                ),
                IconButton(icon: const Icon(Icons.add_circle), onPressed: _addEmail),
              ],
            ),
            if (_pendingEmails.isNotEmpty) ...[
              const SizedBox(height: 10),
              const Text("Sẽ giao cho (bấm để chọn người phụ trách chính):", style: TextStyle(fontSize: 12, color: Colors.grey)),
              const SizedBox(height: 6),
              Wrap(
                spacing: 6,
                children: _pendingEmails
                    .map(
                      (e) => ChoiceChip(
                        label: Text(e == _primaryEmail ? "$e ★" : e),
                        selected: e == _primaryEmail,
                        onSelected: (_) => setState(() => _primaryEmail = e),
                      ),
                    )
                    .toList(),
              ),
            ],
            if (_error != null) ...[
              const SizedBox(height: 10),
              Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 13)),
            ],
          ],
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context, _changed), child: const Text("Đóng")),
        ElevatedButton(
          onPressed: _submitting ? null : _handleSubmit,
          child: _submitting
              ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2))
              : const Text("Giao việc"),
        ),
      ],
    );
  }
}
