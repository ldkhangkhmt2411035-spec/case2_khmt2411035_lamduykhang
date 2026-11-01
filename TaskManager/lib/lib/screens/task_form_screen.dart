import 'package:flutter/material.dart';
import '../models/task.dart';
import '../services/api_service.dart';

// Man hinh dung chung cho ca "Them cong viec" (task == null) va "Sua cong viec" (task != null)
class TaskFormScreen extends StatefulWidget {
  final Task? task;

  const TaskFormScreen({super.key, this.task});

  bool get isEditing => task != null;

  @override
  State<TaskFormScreen> createState() => _TaskFormScreenState();
}

class _TaskFormScreenState extends State<TaskFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _titleController;
  late final TextEditingController _descriptionController;

  TaskStatus _status = TaskStatus.todo;
  TaskPriority _priority = TaskPriority.medium;
  DateTime? _startDate;
  DateTime? _dueDate;

  bool _saving = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    final t = widget.task;
    _titleController = TextEditingController(text: t?.title ?? "");
    _descriptionController = TextEditingController(text: t?.description ?? "");
    _status = t?.status ?? TaskStatus.todo;
    _priority = t?.priority ?? TaskPriority.medium;
    _startDate = t?.startDate;
    _dueDate = t?.dueDate;
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  String _formatDate(DateTime d) =>
      "${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}";

  Future<void> _pickDate({required bool isStart}) async {
    final initial = (isStart ? _startDate : _dueDate) ?? DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
    );
    if (picked == null) return;
    setState(() {
      if (isStart) {
        _startDate = picked;
      } else {
        _dueDate = picked;
      }
    });
  }

  Future<void> _handleSave() async {
    if (!_formKey.currentState!.validate()) return;

    if (_startDate != null && _dueDate != null && _dueDate!.isBefore(_startDate!)) {
      setState(() => _errorMessage = "Hạn hoàn thành phải sau ngày bắt đầu");
      return;
    }

    setState(() {
      _saving = true;
      _errorMessage = null;
    });

    final Map<String, dynamic> result;
    if (widget.isEditing) {
      result = await ApiService.updateTask(
        widget.task!.id,
        title: _titleController.text.trim(),
        description: _descriptionController.text.trim(),
        status: statusToString(_status),
        priority: priorityToString(_priority),
        startDate: _startDate,
        dueDate: _dueDate,
      );
    } else {
      result = await ApiService.createTask(
        title: _titleController.text.trim(),
        description: _descriptionController.text.trim(),
        status: statusToString(_status),
        priority: priorityToString(_priority),
        startDate: _startDate,
        dueDate: _dueDate,
      );
    }

    if (!mounted) return;
    setState(() => _saving = false);

    if (result["task"] != null) {
      Navigator.pop(context, true);
    } else {
      setState(() {
        _errorMessage = result["message"]?.toString() ?? "Lưu công việc thất bại";
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.isEditing ? "Sửa công việc" : "Thêm công việc"),
      ),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              TextFormField(
                controller: _titleController,
                decoration: const InputDecoration(
                  labelText: "Tên công việc *",
                  border: OutlineInputBorder(),
                ),
                validator: (value) =>
                    (value == null || value.trim().isEmpty) ? "Vui lòng nhập tên công việc" : null,
              ),
              const SizedBox(height: 14),
              TextFormField(
                controller: _descriptionController,
                maxLines: 4,
                decoration: const InputDecoration(
                  labelText: "Mô tả",
                  border: OutlineInputBorder(),
                  alignLabelWithHint: true,
                ),
              ),
              const SizedBox(height: 20),
              const Text("Trạng thái", style: TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              SegmentedButton<TaskStatus>(
                segments: const [
                  ButtonSegment(value: TaskStatus.todo, label: Text("Chưa thực hiện")),
                  ButtonSegment(value: TaskStatus.inProgress, label: Text("Đang thực hiện")),
                  ButtonSegment(value: TaskStatus.done, label: Text("Hoàn thành")),
                ],
                selected: {_status},
                onSelectionChanged: (s) => setState(() => _status = s.first),
              ),
              const SizedBox(height: 20),
              const Text("Mức ưu tiên", style: TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              SegmentedButton<TaskPriority>(
                segments: const [
                  ButtonSegment(value: TaskPriority.low, label: Text("Thấp")),
                  ButtonSegment(value: TaskPriority.medium, label: Text("Trung bình")),
                  ButtonSegment(value: TaskPriority.high, label: Text("Cao")),
                ],
                selected: {_priority},
                onSelectionChanged: (s) => setState(() => _priority = s.first),
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: _DatePickerField(
                      label: "Ngày bắt đầu",
                      value: _startDate,
                      formatter: _formatDate,
                      onTap: () => _pickDate(isStart: true),
                      onClear: _startDate == null ? null : () => setState(() => _startDate = null),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _DatePickerField(
                      label: "Hạn hoàn thành",
                      value: _dueDate,
                      formatter: _formatDate,
                      onTap: () => _pickDate(isStart: false),
                      onClear: _dueDate == null ? null : () => setState(() => _dueDate = null),
                    ),
                  ),
                ],
              ),
              if (_errorMessage != null) ...[
                const SizedBox(height: 16),
                Text(_errorMessage!, style: const TextStyle(color: Colors.red)),
              ],
              const SizedBox(height: 28),
              ElevatedButton(
                onPressed: _saving ? null : _handleSave,
                style: ElevatedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 16)),
                child: _saving
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : Text(widget.isEditing ? "Lưu thay đổi" : "Tạo công việc"),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DatePickerField extends StatelessWidget {
  final String label;
  final DateTime? value;
  final String Function(DateTime) formatter;
  final VoidCallback onTap;
  final VoidCallback? onClear;

  const _DatePickerField({
    required this.label,
    required this.value,
    required this.formatter,
    required this.onTap,
    required this.onClear,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: label,
          border: const OutlineInputBorder(),
          suffixIcon: onClear != null
              ? IconButton(icon: const Icon(Icons.clear, size: 18), onPressed: onClear)
              : const Icon(Icons.calendar_today, size: 18),
        ),
        child: Text(value != null ? formatter(value!) : "Chưa chọn"),
      ),
    );
  }
}
