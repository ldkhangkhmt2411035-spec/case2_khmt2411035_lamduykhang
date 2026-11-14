import 'package:flutter/material.dart';
import '../models/task.dart';
import '../models/user_ref.dart';
import '../services/api_service.dart';
import 'user_selector.dart';

// Hop thoai giao cong viec cho 1 hoac nhieu nguoi: tim theo ten/email, chon nguoi phu trach chinh.
// Tra ve true qua Navigator.pop neu co thay doi can refresh lai man hinh chi tiet.
class AssignDialog extends StatefulWidget {
  final Task task;

  const AssignDialog({super.key, required this.task});

  @override
  State<AssignDialog> createState() => _AssignDialogState();
}

class _AssignDialogState extends State<AssignDialog> {
  List<UserRef> _selected = [];
  String? _primaryId; // nguoi phu trach chinh trong so nguoi sap duoc giao
  bool _submitting = false;
  String? _error;
  bool _changed = false;

  bool get _taskHasPrimary => widget.task.assignees.any((a) => a.isPrimary);

  void _onSelectedChanged(List<UserRef> list) {
    setState(() {
      _selected = list;
      if (_primaryId != null && !list.any((u) => u.id == _primaryId)) _primaryId = null;
      // Neu cong viec chua co nguoi phu trach chinh thi mac dinh chon nguoi dau tien
      if (_primaryId == null && !_taskHasPrimary && list.isNotEmpty) _primaryId = list.first.id;
      _error = null;
    });
  }

  void _applyTask(Map<String, dynamic> json) {
    final updated = Task.fromJson(json);
    widget.task.assignees
      ..clear()
      ..addAll(updated.assignees);
    _changed = true;
  }

  Future<void> _handleSubmit() async {
    if (_selected.isEmpty) {
      setState(() => _error = "Chọn ít nhất 1 người trước khi giao việc");
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      final result = await ApiService.assignTask(
        widget.task.id,
        userIds: _selected.map((u) => u.id).toList(),
        primaryUserId: _primaryId,
      );
      if (!mounted) return;
      setState(() => _submitting = false);

      if (result["task"] != null) {
        _applyTask(result["task"] as Map<String, dynamic>);
        final notFound = (result["notFound"] as List?)?.map((e) => e.toString()).toList() ?? [];
        if (notFound.isNotEmpty) {
          setState(() => _error = "Không tìm thấy một số người dùng: ${notFound.join(', ')}");
        } else {
          Navigator.pop(context, true);
        }
      } else {
        setState(() => _error = result["message"]?.toString() ?? "Giao việc thất bại");
      }
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = "Không kết nối được máy chủ";
      });
    }
  }

  Future<void> _removeExisting(String userId) async {
    try {
      final result = await ApiService.removeAssignee(widget.task.id, userId);
      if (!mounted) return;
      if (result["task"] != null) {
        setState(() => _applyTask(result["task"] as Map<String, dynamic>));
      } else {
        setState(() => _error = result["message"]?.toString() ?? "Không gỡ được người phụ trách");
      }
    } catch (_) {
      if (mounted) setState(() => _error = "Không kết nối được máy chủ");
    }
  }

  Future<void> _makePrimary(String userId) async {
    try {
      final result = await ApiService.setPrimaryAssignee(widget.task.id, userId);
      if (!mounted) return;
      if (result["task"] != null) {
        setState(() => _applyTask(result["task"] as Map<String, dynamic>));
      } else {
        setState(() => _error = result["message"]?.toString() ?? "Không đổi được người phụ trách chính");
      }
    } catch (_) {
      if (mounted) setState(() => _error = "Không kết nối được máy chủ");
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text("Giao việc"),
      content: SizedBox(
        width: 360,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (widget.task.assignees.isNotEmpty) ...[
                const Text("Đang phụ trách (bấm để đặt làm người chính):",
                    style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  children: widget.task.assignees
                      .map(
                        (a) => InputChip(
                          label: Text(a.isPrimary ? "${a.user.fullName} (chính)" : a.user.fullName),
                          onPressed: a.isPrimary ? null : () => _makePrimary(a.user.id),
                          onDeleted: () => _removeExisting(a.user.id),
                        ),
                      )
                      .toList(),
                ),
                const SizedBox(height: 14),
              ],
              UserSelector(
                selected: _selected,
                onChanged: _onSelectedChanged,
                excludeIds: widget.task.assignees.map((a) => a.user.id).toSet(),
                hintText: "Tìm người nhận theo tên hoặc email",
              ),
              if (_selected.length > 1 || (_selected.isNotEmpty && _taskHasPrimary)) ...[
                const SizedBox(height: 10),
                const Text("Bấm để chọn người phụ trách chính:", style: TextStyle(fontSize: 12, color: Colors.grey)),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 6,
                  children: _selected
                      .map(
                        (u) => ChoiceChip(
                          label: Text(u.id == _primaryId ? "${u.fullName} ★" : u.fullName),
                          selected: u.id == _primaryId,
                          onSelected: (_) => setState(() => _primaryId = u.id),
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
