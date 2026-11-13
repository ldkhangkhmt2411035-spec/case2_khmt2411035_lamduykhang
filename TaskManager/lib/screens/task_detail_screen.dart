import 'package:flutter/material.dart';
import '../models/task.dart';
import '../services/api_service.dart';
import '../widgets/assign_dialog.dart';
import '../widgets/share_dialog.dart';
import 'task_form_screen.dart';

class TaskDetailScreen extends StatefulWidget {
  final String taskId;

  const TaskDetailScreen({super.key, required this.taskId});

  @override
  State<TaskDetailScreen> createState() => _TaskDetailScreenState();
}

class _TaskDetailScreenState extends State<TaskDetailScreen> {
  Task? _task;
  bool _loading = true;
  String? _error;
  bool _changed = false; // bao cho man hinh truoc biet co can refresh khong

  @override
  void initState() {
    super.initState();
    _loadTask();
  }

  Future<void> _loadTask() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final result = await ApiService.getTaskById(widget.taskId);
    if (!mounted) return;
    if (result["task"] != null) {
      setState(() {
        _task = Task.fromJson(result["task"] as Map<String, dynamic>);
        _loading = false;
      });
    } else {
      setState(() {
        _error = result["message"]?.toString() ?? "Không tải được công việc";
        _loading = false;
      });
    }
  }

  Future<void> _openEdit() async {
    final updated = await Navigator.push<bool>(
      context,
      MaterialPageRoute(builder: (_) => TaskFormScreen(task: _task)),
    );
    if (updated == true) {
      _changed = true;
      _loadTask();
    }
  }

  Future<void> _confirmDelete() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("Xóa công việc"),
        content: Text("Bạn có chắc muốn xóa \"${_task!.title}\"? Thao tác này không thể hoàn tác."),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text("Hủy")),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text("Xóa", style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
    if (confirm != true) return;

    final result = await ApiService.deleteTask(_task!.id);
    if (!mounted) return;
    if (result["success"] == true) {
      Navigator.pop(context, true);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(result["message"]?.toString() ?? "Xóa thất bại")),
      );
    }
  }

  Future<void> _openAssign() async {
    final changed = await showDialog<bool>(
      context: context,
      builder: (_) => AssignDialog(task: _task!),
    );
    if (changed == true) {
      _changed = true;
      _loadTask();
    }
  }

  Future<void> _openShare() async {
    final changed = await showDialog<bool>(
      context: context,
      builder: (_) => ShareDialog(task: _task!),
    );
    if (changed == true) {
      _changed = true;
      _loadTask();
    }
  }

  String _formatDate(DateTime d) =>
      "${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}";

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        Navigator.pop(context, _changed);
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text("Chi tiết công việc"),
          actions: [
            if (_task?.canEdit == true)
              IconButton(icon: const Icon(Icons.edit), tooltip: "Sửa", onPressed: _openEdit),
            if (_task?.isOwner == true)
              IconButton(icon: const Icon(Icons.delete_outline), tooltip: "Xóa", onPressed: _confirmDelete),
          ],
        ),
        body: _buildBody(),
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(_error!, style: const TextStyle(color: Colors.red)),
              const SizedBox(height: 12),
              OutlinedButton(onPressed: _loadTask, child: const Text("Thử lại")),
            ],
          ),
        ),
      );
    }

    final task = _task!;
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(task.title, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            Chip(label: Text(statusLabel(task.status))),
            Chip(label: Text("Ưu tiên: ${priorityLabel(task.priority)}")),
            if (task.myRole != null) Chip(label: Text("Vai trò: ${_roleLabel(task.myRole!)}")),
          ],
        ),
        const SizedBox(height: 20),
        if (task.description.isNotEmpty) ...[
          const Text("Mô tả", style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          Text(task.description),
          const SizedBox(height: 20),
        ],
        Row(
          children: [
            Expanded(
              child: _InfoTile(
                icon: Icons.play_circle_outline,
                label: "Ngày bắt đầu",
                value: task.startDate != null ? _formatDate(task.startDate!) : "Chưa đặt",
              ),
            ),
            Expanded(
              child: _InfoTile(
                icon: Icons.event,
                label: "Hạn hoàn thành",
                value: task.dueDate != null ? _formatDate(task.dueDate!) : "Chưa đặt",
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        _InfoTile(
          icon: Icons.person_outline,
          label: "Người tạo",
          value: task.createdBy != null ? "${task.createdBy!.fullName} (${task.createdBy!.email})" : "",
        ),
        const SizedBox(height: 24),

        _SectionHeader(
          title: "Người phụ trách (${task.assignees.length})",
          action: task.canEdit
              ? IconButton(icon: const Icon(Icons.person_add_alt), tooltip: "Giao việc", onPressed: _openAssign)
              : null,
        ),
        if (task.assignees.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 6),
            child: Text("Chưa giao cho ai", style: TextStyle(color: Colors.grey)),
          )
        else
          ...task.assignees.map(
            (a) => ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const CircleAvatar(child: Icon(Icons.person, size: 18)),
              title: Text(a.user.fullName),
              subtitle: Text(a.user.email),
              trailing: a.isPrimary
                  ? const Chip(label: Text("Phụ trách chính", style: TextStyle(fontSize: 11)))
                  : null,
            ),
          ),

        const SizedBox(height: 16),
        _SectionHeader(
          title: "Chia sẻ (${task.sharedWith.length})",
          action: task.isOwner
              ? IconButton(icon: const Icon(Icons.share_outlined), tooltip: "Chia sẻ", onPressed: _openShare)
              : null,
        ),
        if (task.sharedWith.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 6),
            child: Text("Chưa chia sẻ cho ai", style: TextStyle(color: Colors.grey)),
          )
        else
          ...task.sharedWith.map(
            (s) => ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const CircleAvatar(child: Icon(Icons.person_outline, size: 18)),
              title: Text(s.user.fullName),
              subtitle: Text(s.user.email),
              trailing: Chip(
                label: Text(s.role == "editor" ? "Chỉnh sửa" : "Chỉ xem", style: const TextStyle(fontSize: 11)),
              ),
            ),
          ),
        if (task.isOwner) ...[
          const SizedBox(height: 16),
          _EmailLogSection(taskId: task.id),
        ],
        const SizedBox(height: 40),
      ],
    );
  }

  String _roleLabel(String role) {
    switch (role) {
      case "owner":
        return "Chủ sở hữu";
      case "editor":
        return "Được chỉnh sửa";
      default:
        return "Chỉ xem";
    }
  }
}

class _InfoTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _InfoTile({required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 18, color: Colors.grey),
        const SizedBox(width: 8),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: const TextStyle(fontSize: 12, color: Colors.grey)),
              Text(value, style: const TextStyle(fontSize: 14)),
            ],
          ),
        ),
      ],
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  final Widget? action;

  const _SectionHeader({required this.title, this.action});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(child: Text(title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15))),
        if (action != null) action!,
      ],
    );
  }
}

// Nhat ky gui email cua cong viec (chi nguoi tao). Chi tai khi nguoi dung mo muc nay.
class _EmailLogSection extends StatefulWidget {
  final String taskId;

  const _EmailLogSection({required this.taskId});

  @override
  State<_EmailLogSection> createState() => _EmailLogSectionState();
}

class _EmailLogSectionState extends State<_EmailLogSection> {
  List<Map<String, dynamic>>? _logs;
  bool _loading = false;
  String? _error;

  static const Map<String, String> _eventLabels = {
    "task_assigned": "Giao việc",
    "task_shared": "Chia sẻ",
    "task_share_updated": "Đổi quyền",
    "task_share_revoked": "Thu hồi quyền",
    "due_date_changed": "Đổi hạn",
    "task_completed": "Hoàn thành",
    "task_reminder": "Nhắc việc",
  };

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await ApiService.getEmailLogs(widget.taskId);
      if (!mounted) return;
      if (result["logs"] != null) {
        setState(() {
          _logs = (result["logs"] as List).map((e) => e as Map<String, dynamic>).toList();
          _loading = false;
        });
      } else {
        setState(() {
          _error = result["message"]?.toString() ?? "Không tải được nhật ký email";
          _loading = false;
        });
      }
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = "Không kết nối được máy chủ";
        _loading = false;
      });
    }
  }

  String _formatTime(String? iso) {
    final d = DateTime.tryParse(iso ?? "")?.toLocal();
    if (d == null) return "";
    String two(int v) => v.toString().padLeft(2, '0');
    return "${two(d.day)}/${two(d.month)}/${d.year} ${two(d.hour)}:${two(d.minute)}";
  }

  @override
  Widget build(BuildContext context) {
    return ExpansionTile(
      tilePadding: EdgeInsets.zero,
      title: const Text("Nhật ký email", style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
      onExpansionChanged: (open) {
        if (open && _logs == null && !_loading) _load();
      },
      children: [
        if (_loading)
          const Padding(padding: EdgeInsets.all(12), child: CircularProgressIndicator())
        else if (_error != null)
          Padding(
            padding: const EdgeInsets.all(8),
            child: Column(
              children: [
                Text(_error!, style: const TextStyle(color: Colors.red)),
                TextButton(onPressed: _load, child: const Text("Thử lại")),
              ],
            ),
          )
        else if (_logs != null && _logs!.isEmpty)
          const Padding(
            padding: EdgeInsets.all(8),
            child: Text("Chưa có email nào được gửi", style: TextStyle(color: Colors.grey)),
          )
        else
          ...(_logs ?? []).map((log) {
            final status = log["status"]?.toString();
            final ok = status == "sent";
            final failed = status == "failed";
            return ListTile(
              dense: true,
              contentPadding: EdgeInsets.zero,
              leading: Icon(
                ok ? Icons.check_circle : (failed ? Icons.error_outline : Icons.schedule),
                color: ok ? Colors.green : (failed ? Colors.red : Colors.grey),
              ),
              title: Text("${_eventLabels[log["eventType"]] ?? log["eventType"]} → ${log["recipientEmail"]}"),
              subtitle: Text(
                failed
                    ? "Thất bại sau ${log["attempts"]} lần thử · ${_formatTime(log["createdAt"]?.toString())}"
                    : "${ok ? "Đã gửi" : "Đang gửi"} · ${_formatTime((log["sentAt"] ?? log["createdAt"])?.toString())}",
              ),
            );
          }),
      ],
    );
  }
}
