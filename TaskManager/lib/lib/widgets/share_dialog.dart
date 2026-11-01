import 'package:flutter/material.dart';
import '../models/task.dart';
import '../models/user_ref.dart';
import '../services/api_service.dart';

// Hop thoai chia se cong viec cho nguoi khac voi quyen xem (viewer) hoac sua (editor).
// Chi chu so huu (owner) moi mo duoc hop thoai nay (kiem tra o man hinh chi tiet).
class ShareDialog extends StatefulWidget {
  final Task task;

  const ShareDialog({super.key, required this.task});

  @override
  State<ShareDialog> createState() => _ShareDialogState();
}

class _ShareDialogState extends State<ShareDialog> {
  final _emailController = TextEditingController();
  String _role = "viewer";
  bool _submitting = false;
  String? _error;
  bool _changed = false;

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _handleShare() async {
    final email = _emailController.text.trim();
    if (email.isEmpty || !email.contains("@")) {
      setState(() => _error = "Vui lòng nhập email hợp lệ");
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    final result = await ApiService.shareTask(widget.task.id, email: email, role: _role);

    if (!mounted) return;
    setState(() => _submitting = false);

    if (result["task"] != null) {
      final updated = Task.fromJson(result["task"] as Map<String, dynamic>);
      setState(() {
        widget.task.sharedWith
          ..clear()
          ..addAll(updated.sharedWith);
        _emailController.clear();
        _changed = true;
      });
    } else {
      setState(() => _error = result["message"]?.toString() ?? "Chia sẻ thất bại");
    }
  }

  Future<void> _updateRole(String userId, String newRole) async {
    final result = await ApiService.updateShareRole(widget.task.id, userId, newRole);
    if (!mounted) return;
    if (result["task"] != null) {
      setState(() {
        final idx = widget.task.sharedWith.indexWhere((s) => s.user.id == userId);
        if (idx != -1) {
          widget.task.sharedWith[idx] = SharedEntry(user: widget.task.sharedWith[idx].user, role: newRole);
        }
        _changed = true;
      });
    }
  }

  Future<void> _revoke(String userId) async {
    final result = await ApiService.revokeShare(widget.task.id, userId);
    if (!mounted) return;
    if (result["task"] != null) {
      setState(() {
        widget.task.sharedWith.removeWhere((s) => s.user.id == userId);
        _changed = true;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text("Chia sẻ công việc"),
      content: SizedBox(
        width: 380,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (widget.task.sharedWith.isNotEmpty) ...[
              const Text("Đã chia sẻ với:", style: TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 4),
              ...widget.task.sharedWith.map(
                (s) => ListTile(
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                  title: Text(s.user.fullName),
                  subtitle: Text(s.user.email),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      DropdownButton<String>(
                        value: s.role,
                        underline: const SizedBox(),
                        items: const [
                          DropdownMenuItem(value: "viewer", child: Text("Chỉ xem")),
                          DropdownMenuItem(value: "editor", child: Text("Chỉnh sửa")),
                        ],
                        onChanged: (v) {
                          if (v != null) _updateRole(s.user.id, v);
                        },
                      ),
                      IconButton(
                        icon: const Icon(Icons.close, size: 18),
                        tooltip: "Thu hồi quyền",
                        onPressed: () => _revoke(s.user.id),
                      ),
                    ],
                  ),
                ),
              ),
              const Divider(),
            ],
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _emailController,
                    decoration: const InputDecoration(
                      hintText: "Email người được chia sẻ",
                      border: OutlineInputBorder(),
                      isDense: true,
                    ),
                    keyboardType: TextInputType.emailAddress,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: "viewer", label: Text("Chỉ xem")),
                ButtonSegment(value: "editor", label: Text("Chỉnh sửa")),
              ],
              selected: {_role},
              onSelectionChanged: (s) => setState(() => _role = s.first),
            ),
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
          onPressed: _submitting ? null : _handleShare,
          child: _submitting
              ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2))
              : const Text("Chia sẻ"),
        ),
      ],
    );
  }
}
