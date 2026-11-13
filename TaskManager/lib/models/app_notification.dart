// Thong bao trong ung dung (khong dat ten Notification de tranh trung voi lop co san cua Flutter)
class AppNotification {
  final String id;
  final String? taskId;
  final String type;
  final String title;
  final String message;
  final bool isRead;
  final DateTime createdAt;

  AppNotification({
    required this.id,
    required this.taskId,
    required this.type,
    required this.title,
    required this.message,
    required this.isRead,
    required this.createdAt,
  });

  factory AppNotification.fromJson(Map<String, dynamic> json) {
    return AppNotification(
      id: json["_id"].toString(),
      taskId: json["taskId"]?.toString(),
      type: json["type"]?.toString() ?? "",
      title: json["title"]?.toString() ?? "",
      message: json["message"]?.toString() ?? "",
      isRead: json["isRead"] == true,
      createdAt: DateTime.tryParse(json["createdAt"]?.toString() ?? "")?.toLocal() ?? DateTime.now(),
    );
  }

  AppNotification copyWith({bool? isRead}) {
    return AppNotification(
      id: id,
      taskId: taskId,
      type: type,
      title: title,
      message: message,
      isRead: isRead ?? this.isRead,
      createdAt: createdAt,
    );
  }
}
