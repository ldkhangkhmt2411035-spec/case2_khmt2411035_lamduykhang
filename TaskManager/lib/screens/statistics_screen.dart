import 'package:flutter/material.dart';
import '../models/task.dart';
import '../services/api_service.dart';
import 'task_detail_screen.dart';

// Man hinh thong ke: theo trang thai, muc uu tien, giao viec/chia se, han hoan thanh.
class StatisticsScreen extends StatefulWidget {
  const StatisticsScreen({super.key});

  @override
  State<StatisticsScreen> createState() => _StatisticsScreenState();
}

class _StatisticsScreenState extends State<StatisticsScreen> {
  Map<String, dynamic>? _tasks;
  Map<String, dynamic>? _assignments;
  Map<String, dynamic>? _deadlines;
  bool _loading = true;
  String? _error;

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
      final results = await Future.wait([
        ApiService.getTaskStats(),
        ApiService.getAssignmentStats(),
        ApiService.getDeadlineStats(),
      ]);
      if (!mounted) return;
      final failed = results.where((r) => r["success"] != true);
      if (failed.isNotEmpty) {
        setState(() {
          _error = failed.first["message"]?.toString() ?? "Không tải được thống kê";
          _loading = false;
        });
        return;
      }
      setState(() {
        _tasks = results[0];
        _assignments = results[1];
        _deadlines = results[2];
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = "Không kết nối được máy chủ";
        _loading = false;
      });
    }
  }

  int _int(Map<String, dynamic>? m, String key) => (m?[key] as num?)?.toInt() ?? 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Thống kê")),
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

    final byStatus = (_tasks?["byStatus"] as Map<String, dynamic>?) ?? {};
    final byPriority = (_tasks?["byPriority"] as Map<String, dynamic>?) ?? {};
    final total = _int(_tasks, "total");
    final rate = _int(_tasks, "completionRate");

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _card(
            "Tiến độ chung",
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text("$rate% hoàn thành ($total công việc)",
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                ClipRRect(
                  borderRadius: BorderRadius.circular(6),
                  child: LinearProgressIndicator(value: rate / 100, minHeight: 10),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    _statTile("Chưa thực hiện", _int(byStatus, "todo"), Colors.grey),
                    _statTile("Đang thực hiện", _int(byStatus, "in_progress"), Colors.orange),
                    _statTile("Hoàn thành", _int(byStatus, "completed"), Colors.green),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          _card(
            "Theo mức ưu tiên",
            Row(
              children: [
                _statTile("Thấp", _int(byPriority, "low"), Colors.blueGrey),
                _statTile("Trung bình", _int(byPriority, "medium"), Colors.blue),
                _statTile("Cao", _int(byPriority, "high"), Colors.red),
              ],
            ),
          ),
          const SizedBox(height: 12),
          _card(
            "Giao việc và chia sẻ",
            Column(
              children: [
                Row(
                  children: [
                    _statTile("Tôi tạo", _int(_assignments, "createdByMe"), Colors.indigo),
                    _statTile("Được giao cho tôi", _int(_assignments, "assignedToMe"), Colors.teal),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    _statTile("Tôi phụ trách chính", _int(_assignments, "primaryForMe"), Colors.deepPurple),
                    _statTile("Được chia sẻ", _int(_assignments, "sharedWithMe"), Colors.cyan),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    _statTile("Tôi đã giao cho người khác", _int(_assignments, "assignedByMeToOthers"), Colors.brown),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          _deadlineCard(
            title: "Quá hạn (${_int(_deadlines, "overdueCount")})",
            color: Colors.red,
            emptyText: "Không có công việc quá hạn",
            items: (_deadlines?["overdue"] as List?) ?? [],
          ),
          const SizedBox(height: 12),
          _deadlineCard(
            title: "Sắp đến hạn trong ${_int(_deadlines, "upcomingDays")} ngày (${_int(_deadlines, "upcomingCount")})",
            color: Colors.orange,
            emptyText: "Không có công việc sắp đến hạn",
            items: (_deadlines?["upcoming"] as List?) ?? [],
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _card(String title, Widget child) {
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

  Widget _statTile(String label, int value, Color color) {
    return Expanded(
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 4),
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Column(
          children: [
            Text("$value", style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: color)),
            const SizedBox(height: 2),
            Text(label, textAlign: TextAlign.center, style: const TextStyle(fontSize: 12)),
          ],
        ),
      ),
    );
  }

  String _formatDate(String? iso) {
    final d = DateTime.tryParse(iso ?? "")?.toLocal();
    if (d == null) return "";
    return "${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}";
  }

  Widget _deadlineCard({
    required String title,
    required Color color,
    required String emptyText,
    required List items,
  }) {
    return _card(
      title,
      items.isEmpty
          ? Text(emptyText, style: const TextStyle(color: Colors.grey))
          : Column(
              children: items.map((raw) {
                final t = raw as Map<String, dynamic>;
                return ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(Icons.event, color: color),
                  title: Text(t["title"]?.toString() ?? ""),
                  subtitle: Text(
                    "Hạn: ${_formatDate(t["dueDate"]?.toString())} · ${statusLabel(statusFromString(t["status"]?.toString()))}",
                  ),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => TaskDetailScreen(taskId: t["_id"].toString())),
                    );
                  },
                );
              }).toList(),
            ),
    );
  }
}
