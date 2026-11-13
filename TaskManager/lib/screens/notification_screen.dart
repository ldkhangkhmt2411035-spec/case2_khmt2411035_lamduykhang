import 'package:flutter/material.dart';
import '../models/app_notification.dart';
import '../services/api_service.dart';
import 'task_detail_screen.dart';

// Man hinh danh sach thong bao trong ung dung.
class NotificationScreen extends StatefulWidget {
  const NotificationScreen({super.key});

  @override
  State<NotificationScreen> createState() => _NotificationScreenState();
}

class _NotificationScreenState extends State<NotificationScreen> {
  List<AppNotification> _items = [];
  bool _loading = true;
  String? _error;
  bool _unreadOnly = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await ApiService.getNotifications(unreadOnly: _unreadOnly);
      if (!mounted) return;
      if (result["notifications"] != null) {
        setState(() {
          _items = (result["notifications"] as List)
              .map((e) => AppNotification.fromJson(e as Map<String, dynamic>))
              .toList();
          _loading = false;
        });
      } else {
        setState(() {
          _error = result["message"]?.toString() ?? "Không tải được thông báo";
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

  Future<void> _markAllRead() async {
    final ok = await ApiService.markAllNotificationsRead();
    if (!mounted) return;
    if (ok) {
      setState(() => _items = _items.map((n) => n.copyWith(isRead: true)).toList());
      if (_unreadOnly) _load();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Không thể đánh dấu đã đọc, thử lại sau")),
      );
    }
  }

  Future<void> _open(AppNotification n) async {
    // Danh dau da doc (cap nhat giao dien ngay, goi API sau)
    if (!n.isRead) {
      setState(() {
        _items = _items.map((e) => e.id == n.id ? e.copyWith(isRead: true) : e).toList();
      });
      ApiService.markNotificationRead(n.id);
    }
    if (n.taskId == null) return;
    await Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => TaskDetailScreen(taskId: n.taskId!)),
    );
  }

  IconData _iconFor(String type) {
    switch (type) {
      case "task_assigned":
        return Icons.assignment_ind_outlined;
      case "task_shared":
      case "task_share_updated":
        return Icons.share_outlined;
      case "task_share_revoked":
        return Icons.link_off;
      case "due_date_changed":
        return Icons.event_repeat;
      case "task_completed":
        return Icons.check_circle_outline;
      case "task_reminder":
        return Icons.alarm;
      default:
        return Icons.notifications_none;
    }
  }

  String _timeAgo(DateTime time) {
    final diff = DateTime.now().difference(time);
    if (diff.inMinutes < 1) return "Vừa xong";
    if (diff.inMinutes < 60) return "${diff.inMinutes} phút trước";
    if (diff.inHours < 24) return "${diff.inHours} giờ trước";
    if (diff.inDays < 7) return "${diff.inDays} ngày trước";
    return "${time.day.toString().padLeft(2, '0')}/${time.month.toString().padLeft(2, '0')}/${time.year}";
  }

  @override
  Widget build(BuildContext context) {
    final hasUnread = _items.any((n) => !n.isRead);
    return Scaffold(
      appBar: AppBar(
        title: const Text("Thông báo"),
        actions: [
          IconButton(
            tooltip: _unreadOnly ? "Hiện tất cả" : "Chỉ hiện chưa đọc",
            icon: Icon(_unreadOnly ? Icons.filter_alt : Icons.filter_alt_outlined),
            onPressed: () {
              setState(() => _unreadOnly = !_unreadOnly);
              _load();
            },
          ),
          IconButton(
            tooltip: "Đánh dấu tất cả đã đọc",
            icon: const Icon(Icons.done_all),
            onPressed: hasUnread ? _markAllRead : null,
          ),
        ],
      ),
      body: _buildBody(),
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
              Text(_error!, textAlign: TextAlign.center, style: const TextStyle(color: Colors.red)),
              const SizedBox(height: 12),
              OutlinedButton(onPressed: _load, child: const Text("Thử lại")),
            ],
          ),
        ),
      );
    }
    if (_items.isEmpty) {
      return RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          children: [
            const SizedBox(height: 120),
            Center(
              child: Text(
                _unreadOnly ? "Không có thông báo chưa đọc" : "Chưa có thông báo nào",
                style: const TextStyle(color: Colors.grey),
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        itemCount: _items.length,
        separatorBuilder: (_, __) => const Divider(height: 1),
        itemBuilder: (context, index) {
          final n = _items[index];
          return ListTile(
            tileColor: n.isRead ? null : Theme.of(context).primaryColor.withValues(alpha: 0.06),
            leading: CircleAvatar(child: Icon(_iconFor(n.type), size: 20)),
            title: Text(
              n.title,
              style: TextStyle(fontWeight: n.isRead ? FontWeight.normal : FontWeight.bold),
            ),
            subtitle: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(n.message),
                const SizedBox(height: 2),
                Text(_timeAgo(n.createdAt), style: const TextStyle(fontSize: 12, color: Colors.grey)),
              ],
            ),
            isThreeLine: true,
            trailing: n.isRead ? null : const Icon(Icons.circle, size: 10, color: Colors.blue),
            onTap: () => _open(n),
          );
        },
      ),
    );
  }
}
