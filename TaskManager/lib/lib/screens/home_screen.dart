import 'package:flutter/material.dart';
import '../models/task.dart';
import '../services/api_service.dart';
import 'login_screen.dart';
import 'task_detail_screen.dart';
import 'task_form_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  Map<String, dynamic>? _user;

  // Du lieu + trang thai danh sach cong viec
  List<Task> _tasks = [];
  bool _loadingTasks = true;
  String? _taskError;

  // Bo loc / tim kiem / sap xep hien tai
  String _scope = "all"; // all | mine | assigned | shared
  String? _status; // null = tat ca
  String? _priority; // null = tat ca
  String _sortBy = "createdAt";
  String _order = "desc";
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadUser();
    _loadTasks();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadUser() async {
    final result = await ApiService.getMe();
    if (!mounted) return;
    setState(() => _user = result["user"]);
  }

  Future<void> _loadTasks() async {
    setState(() {
      _loadingTasks = true;
      _taskError = null;
    });

    final result = await ApiService.getTasks(
      scope: _scope,
      status: _status,
      priority: _priority,
      search: _searchController.text.trim(),
      sortBy: _sortBy,
      order: _order,
    );

    if (!mounted) return;

    if (result["tasks"] != null) {
      final list = (result["tasks"] as List)
          .map((e) => Task.fromJson(e as Map<String, dynamic>))
          .toList();
      setState(() {
        _tasks = list;
        _loadingTasks = false;
      });
    } else {
      setState(() {
        _taskError = result["message"]?.toString() ?? "Khong tai duoc danh sach cong viec";
        _loadingTasks = false;
      });
    }
  }

  Future<void> _handleLogout() async {
    await ApiService.logout();
    if (!mounted) return;
    Navigator.pushReplacement(
      context,
      MaterialPageRoute(builder: (_) => const LoginScreen()),
    );
  }

  Future<void> _openCreateTask() async {
    final created = await Navigator.push<bool>(
      context,
      MaterialPageRoute(builder: (_) => const TaskFormScreen()),
    );
    if (created == true) _loadTasks();
  }

  Future<void> _openTaskDetail(Task task) async {
    final changed = await Navigator.push<bool>(
      context,
      MaterialPageRoute(builder: (_) => TaskDetailScreen(taskId: task.id)),
    );
    if (changed == true) _loadTasks();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("Công việc của tôi"),
        actions: [
          IconButton(
            tooltip: "Đăng xuất",
            icon: const Icon(Icons.logout),
            onPressed: _handleLogout,
          ),
        ],
      ),
      drawer: _buildDrawer(),
      body: Column(
        children: [
          _buildSearchAndFilterBar(),
          Expanded(child: _buildTaskListBody()),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openCreateTask,
        icon: const Icon(Icons.add),
        label: const Text("Thêm công việc"),
      ),
    );
  }

  Widget _buildDrawer() {
    return Drawer(
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const CircleAvatar(radius: 28, child: Icon(Icons.person, size: 28)),
                  const SizedBox(height: 12),
                  Text(
                    _user?["fullName"] ?? "",
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  Text(
                    _user?["email"] ?? "",
                    style: const TextStyle(color: Colors.grey),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            ListTile(
              leading: const Icon(Icons.logout),
              title: const Text("Đăng xuất"),
              onTap: _handleLogout,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSearchAndFilterBar() {
    return Container(
      color: Theme.of(context).primaryColor.withValues(alpha: 0.04),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      child: Column(
        children: [
          TextField(
            controller: _searchController,
            decoration: InputDecoration(
              hintText: "Tìm kiếm công việc theo tên...",
              prefixIcon: const Icon(Icons.search),
              filled: true,
              fillColor: Colors.white,
              contentPadding: const EdgeInsets.symmetric(vertical: 0),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none,
              ),
            ),
            onSubmitted: (_) => _loadTasks(),
            textInputAction: TextInputAction.search,
          ),
          const SizedBox(height: 10),
          SizedBox(
            height: 36,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                _scopeChip("all", "Tất cả"),
                _scopeChip("mine", "Của tôi"),
                _scopeChip("assigned", "Được giao"),
                _scopeChip("shared", "Được chia sẻ"),
                const SizedBox(width: 8),
                _filterMenuButton(),
                const SizedBox(width: 8),
                _sortMenuButton(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _scopeChip(String value, String label) {
    final selected = _scope == value;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        label: Text(label),
        selected: selected,
        onSelected: (_) {
          setState(() => _scope = value);
          _loadTasks();
        },
      ),
    );
  }

  Widget _filterMenuButton() {
    final hasFilter = _status != null || _priority != null;
    return PopupMenuButton<String>(
      tooltip: "Lọc",
      onSelected: (value) {
        setState(() {
          if (value == "clear") {
            _status = null;
            _priority = null;
          } else if (value.startsWith("status:")) {
            final v = value.substring(7);
            _status = v == "none" ? null : v;
          } else if (value.startsWith("priority:")) {
            final v = value.substring(9);
            _priority = v == "none" ? null : v;
          }
        });
        _loadTasks();
      },
      itemBuilder: (context) => [
        const PopupMenuItem(enabled: false, child: Text("Trạng thái", style: TextStyle(fontWeight: FontWeight.bold))),
        const PopupMenuItem(value: "status:none", child: Text("Tất cả trạng thái")),
        const PopupMenuItem(value: "status:todo", child: Text("Chưa thực hiện")),
        const PopupMenuItem(value: "status:in_progress", child: Text("Đang thực hiện")),
        const PopupMenuItem(value: "status:done", child: Text("Đã hoàn thành")),
        const PopupMenuDivider(),
        const PopupMenuItem(enabled: false, child: Text("Mức ưu tiên", style: TextStyle(fontWeight: FontWeight.bold))),
        const PopupMenuItem(value: "priority:none", child: Text("Tất cả mức ưu tiên")),
        const PopupMenuItem(value: "priority:low", child: Text("Thấp")),
        const PopupMenuItem(value: "priority:medium", child: Text("Trung bình")),
        const PopupMenuItem(value: "priority:high", child: Text("Cao")),
        const PopupMenuDivider(),
        const PopupMenuItem(value: "clear", child: Text("Xóa bộ lọc")),
      ],
      child: Chip(
        avatar: Icon(Icons.filter_list, size: 18, color: hasFilter ? Colors.white : null),
        label: const Text("Lọc"),
        backgroundColor: hasFilter ? Theme.of(context).primaryColor : null,
        labelStyle: hasFilter ? const TextStyle(color: Colors.white) : null,
      ),
    );
  }

  Widget _sortMenuButton() {
    return PopupMenuButton<String>(
      tooltip: "Sắp xếp",
      onSelected: (value) {
        setState(() {
          if (value == "due_asc") {
            _sortBy = "dueDate";
            _order = "asc";
          } else if (value == "priority_desc") {
            _sortBy = "priority";
            _order = "desc";
          } else {
            _sortBy = "createdAt";
            _order = "desc";
          }
        });
        _loadTasks();
      },
      itemBuilder: (context) => const [
        PopupMenuItem(value: "created_desc", child: Text("Mới tạo trước")),
        PopupMenuItem(value: "due_asc", child: Text("Hạn hoàn thành gần nhất")),
        PopupMenuItem(value: "priority_desc", child: Text("Mức ưu tiên")),
      ],
      child: const Chip(
        avatar: Icon(Icons.sort, size: 18),
        label: Text("Sắp xếp"),
      ),
    );
  }

  Widget _buildTaskListBody() {
    if (_loadingTasks) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_taskError != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(_taskError!, textAlign: TextAlign.center, style: const TextStyle(color: Colors.red)),
              const SizedBox(height: 12),
              OutlinedButton(onPressed: _loadTasks, child: const Text("Thử lại")),
            ],
          ),
        ),
      );
    }
    if (_tasks.isEmpty) {
      return RefreshIndicator(
        onRefresh: _loadTasks,
        child: ListView(
          children: const [
            SizedBox(height: 120),
            Center(
              child: Text(
                "Chưa có công việc nào.\nBấm \"Thêm công việc\" để bắt đầu.",
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey),
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadTasks,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
        itemCount: _tasks.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (context, index) {
          final task = _tasks[index];
          return TaskCard(task: task, onTap: () => _openTaskDetail(task));
        },
      ),
    );
  }
}

class TaskCard extends StatelessWidget {
  final Task task;
  final VoidCallback onTap;

  const TaskCard({super.key, required this.task, required this.onTap});

  Color _statusColor() {
    switch (task.status) {
      case TaskStatus.todo:
        return Colors.grey;
      case TaskStatus.inProgress:
        return Colors.orange;
      case TaskStatus.done:
        return Colors.green;
    }
  }

  Color _priorityColor() {
    switch (task.priority) {
      case TaskPriority.low:
        return Colors.blueGrey;
      case TaskPriority.medium:
        return Colors.indigo;
      case TaskPriority.high:
        return Colors.red;
    }
  }

  String _formatDate(DateTime d) => "${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}";

  @override
  Widget build(BuildContext context) {
    final overdue = task.dueDate != null &&
        task.status != TaskStatus.done &&
        task.dueDate!.isBefore(DateTime.now());

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(14),
      elevation: 0.5,
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      task.title,
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: _priorityColor().withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      priorityLabel(task.priority),
                      style: TextStyle(color: _priorityColor(), fontSize: 11, fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
              if (task.description.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  task.description,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: Colors.grey, fontSize: 13),
                ),
              ],
              const SizedBox(height: 10),
              Row(
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(color: _statusColor(), shape: BoxShape.circle),
                  ),
                  const SizedBox(width: 6),
                  Text(statusLabel(task.status), style: TextStyle(color: _statusColor(), fontSize: 12.5, fontWeight: FontWeight.w500)),
                  const Spacer(),
                  if (task.dueDate != null) ...[
                    Icon(Icons.event, size: 14, color: overdue ? Colors.red : Colors.grey),
                    const SizedBox(width: 4),
                    Text(
                      _formatDate(task.dueDate!),
                      style: TextStyle(
                        fontSize: 12,
                        color: overdue ? Colors.red : Colors.grey,
                        fontWeight: overdue ? FontWeight.bold : FontWeight.normal,
                      ),
                    ),
                  ],
                  if (task.assignees.isNotEmpty) ...[
                    const SizedBox(width: 10),
                    const Icon(Icons.people_alt_outlined, size: 14, color: Colors.grey),
                    const SizedBox(width: 3),
                    Text("${task.assignees.length}", style: const TextStyle(fontSize: 12, color: Colors.grey)),
                  ],
                  if (task.myRole == "viewer") ...[
                    const SizedBox(width: 10),
                    const Icon(Icons.visibility_outlined, size: 14, color: Colors.grey),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
