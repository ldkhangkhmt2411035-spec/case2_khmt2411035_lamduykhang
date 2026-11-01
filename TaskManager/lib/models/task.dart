import 'user_ref.dart';

enum TaskStatus { todo, inProgress, done }

enum TaskPriority { low, medium, high }

TaskStatus statusFromString(String? s) {
  switch (s) {
    case "in_progress":
      return TaskStatus.inProgress;
    case "done":
      return TaskStatus.done;
    default:
      return TaskStatus.todo;
  }
}

String statusToString(TaskStatus s) {
  switch (s) {
    case TaskStatus.inProgress:
      return "in_progress";
    case TaskStatus.done:
      return "done";
    case TaskStatus.todo:
      return "todo";
  }
}

String statusLabel(TaskStatus s) {
  switch (s) {
    case TaskStatus.todo:
      return "Chưa thực hiện";
    case TaskStatus.inProgress:
      return "Đang thực hiện";
    case TaskStatus.done:
      return "Đã hoàn thành";
  }
}

TaskPriority priorityFromString(String? s) {
  switch (s) {
    case "low":
      return TaskPriority.low;
    case "high":
      return TaskPriority.high;
    default:
      return TaskPriority.medium;
  }
}

String priorityToString(TaskPriority p) {
  switch (p) {
    case TaskPriority.low:
      return "low";
    case TaskPriority.high:
      return "high";
    case TaskPriority.medium:
      return "medium";
  }
}

String priorityLabel(TaskPriority p) {
  switch (p) {
    case TaskPriority.low:
      return "Thấp";
    case TaskPriority.medium:
      return "Trung bình";
    case TaskPriority.high:
      return "Cao";
  }
}

class Task {
  final String id;
  final String title;
  final String description;
  final TaskStatus status;
  final TaskPriority priority;
  final DateTime? startDate;
  final DateTime? dueDate;
  final UserRef? createdBy;
  final List<Assignee> assignees;
  final List<SharedEntry> sharedWith;
  final String? myRole; // "owner" | "editor" | "viewer"
  final DateTime? createdAt;
  final DateTime? updatedAt;

  Task({
    required this.id,
    required this.title,
    required this.description,
    required this.status,
    required this.priority,
    this.startDate,
    this.dueDate,
    this.createdBy,
    this.assignees = const [],
    this.sharedWith = const [],
    this.myRole,
    this.createdAt,
    this.updatedAt,
  });

  bool get canEdit => myRole == "owner" || myRole == "editor";
  bool get isOwner => myRole == "owner";

  factory Task.fromJson(Map<String, dynamic> json) {
    return Task(
      id: json["_id"]?.toString() ?? "",
      title: json["title"]?.toString() ?? "",
      description: json["description"]?.toString() ?? "",
      status: statusFromString(json["status"]?.toString()),
      priority: priorityFromString(json["priority"]?.toString()),
      startDate: json["startDate"] != null ? DateTime.tryParse(json["startDate"]) : null,
      dueDate: json["dueDate"] != null ? DateTime.tryParse(json["dueDate"]) : null,
      createdBy: json["createdBy"] is Map<String, dynamic>
          ? UserRef.fromJson(json["createdBy"] as Map<String, dynamic>)
          : null,
      assignees: (json["assignees"] as List<dynamic>? ?? [])
          .map((e) => Assignee.fromJson(e as Map<String, dynamic>))
          .toList(),
      sharedWith: (json["sharedWith"] as List<dynamic>? ?? [])
          .map((e) => SharedEntry.fromJson(e as Map<String, dynamic>))
          .toList(),
      myRole: json["myRole"]?.toString(),
      createdAt: json["createdAt"] != null ? DateTime.tryParse(json["createdAt"]) : null,
      updatedAt: json["updatedAt"] != null ? DateTime.tryParse(json["updatedAt"]) : null,
    );
  }
}
