import 'package:flutter/material.dart';
import '../models/task.dart';
import '../models/user_ref.dart';
import '../services/api_service.dart';
import 'user_selector.dart';

// Hop thoai chia se cong viec cho 1 hoac nhieu nguoi voi quyen xem (viewer) hoac sua (editor).
// Chi chu so huu (owner) moi mo duoc hop thoai nay (kiem tra o man hinh chi tiet).
class ShareDialog extends StatefulWidget {
  final Task task;

  const ShareDialog({super.key, required this.task});

  @override
  State<ShareDialog> createState() => _ShareDialogState();
}

class _ShareDialogState extends State<ShareDialog> {
  List<UserRef> _selected = [];
  String _permission = "viewer";
  bool _submitting = false;
  String? _error;
  String? _info;
  bool _changed = false;

  void _applyTask(Map<String, dynamic> json) {
    final updated = Task.fromJson(json);
    widget.task.sharedWith
      ..clear()
      ..addAll(updated.sharedWith);
    _changed = true;
  }

  Future<void> _handleShare() async {
    if (_selected.isEmpty) {
      setState(() => _error = "Chọn ít nhất 1 người để chia sẻ");
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
      _info = null;
    });

    try {
      final result = await ApiService.shareTask(
        widget.task.id,
        userIds: _selected.map((u) => u.id).toList(),
        permission: _permission,
      );
      if (!mounted) return;
      setState(() => _submitting = false);

      if (result["task"] != null) {
        final results = result["results"] as Map<String, dynamic>? ?? {};
        final created = (results["created"] as List?)?.length ?? 0;
        final updated = (results["updated"] as List?)?.length ?? 0;
        setState(() {
          _applyTask(result["task"] as Map<String, dynamic>);
          _selected = [];
          _info = "Đã chia sẻ cho $created người" + (updated > 0 ? ", cập nhật quyền $updated người" : "");
        });
      } else {
        setState(() => _error = result["message"]?.toString() ?? "Chia sẻ thất bại");
      }
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = "Không kết nối được máy chủ";
      });
    }
  }

  Future<void> _updateRole(SharedEntry entry, String newRole) async {
    try {
      final result = await ApiService.updateShareRole(widget.task.id, entry.shareId, newRole);
      if (!mounted) return;
      if (result["task"] != null) {
        setState(() => _applyTask(result["task"] as Map<String, dynamic>));
      } else {
        setState(() => _error = result["message"]?.toString() ?? "Không đổi được quyền");
      }
    } catch (_) {
      if (mounted) setState(() => _error = "Không kết nối được máy chủ");
    }
  }

  Future<void> _revoke(SharedEntry entry) async {
    try {
      final result = await ApiService.revokeShare(widget.task.id, entry.shareId);
      if (!mounted) return;
      if (result["task"] != null) {
        setState(() => _applyTask(result["task"] as Map<String, dynamic>));
      } else {
        setState(() => _error = result["message"]?.toString() ?? "Không thu hồi được quyền");
      }
    } catch (_) {
      if (mounted) setState(() => _error = "Không kết nối được máy chủ");
    }
  }

  @override
  Widget build(BuildContext context) {
    final excluded = <String>{
      ...widget.task.sharedWith.map((s) => s.user.id),
      if (widget.task.createdBy != null) widget.task.createdBy!.id,
    };

    return AlertDialog(
      title: const Text("Chia sẻ công việc"),
      content: SizedBox(
        width: 380,
        child: SingleChildScrollView(
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
                            if (v != null && v != s.role) _updateRole(s, v);
                          },
                        ),
                        IconButton(
                          icon: const Icon(Icons.close, size: 18),
                          tooltip: "Thu hồi quyền",
                          onPressed: () => _revoke(s),
                        ),
                      ],
                    ),
                  ),
                ),
                const Divider(),
              ],
              UserSelector(
                selected: _selected,
                onChanged: (list) => setState(() {
                  _selected = list;
                  _error = null;
                  _info = null;
                }),
                excludeIds: excluded,
                hintText: "Tìm người cần chia sẻ theo tên hoặc email",
              ),
              const SizedBox(height: 10),
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: "viewer", label: Text("Chỉ xem")),
                  ButtonSegment(value: "editor", label: Text("Chỉnh sửa")),
                ],
                selected: {_permission},
                onSelectionChanged: (s) => setState(() => _permission = s.first),
              ),
              if (_info != null) ...[
                const SizedBox(height: 10),
                Text(_info!, style: const TextStyle(color: Colors.green, fontSize: 13)),
              ],
              if (_error != null) ...[
                const SizedBox(height: 10),
                Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 13)),
              ],
            ],
          ),
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
