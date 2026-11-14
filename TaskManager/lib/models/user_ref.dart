// Thong tin rut gon cua 1 nguoi dung, dung o nhung noi chi can hien ten/email
// (nguoi tao, nguoi phu trach, nguoi duoc chia se...)
class UserRef {
  final String id;
  final String fullName;
  final String email;

  UserRef({required this.id, required this.fullName, required this.email});

  factory UserRef.fromJson(Map<String, dynamic> json) {
    return UserRef(
      id: json["_id"]?.toString() ?? "",
      fullName: json["fullName"]?.toString() ?? "",
      email: json["email"]?.toString() ?? "",
    );
  }
}

class Assignee {
  final UserRef user;
  final bool isPrimary;

  Assignee({required this.user, required this.isPrimary});

  factory Assignee.fromJson(Map<String, dynamic> json) {
    return Assignee(
      user: UserRef.fromJson(json["user"] as Map<String, dynamic>),
      isPrimary: json["isPrimary"] == true,
    );
  }
}

class SharedEntry {
  final String shareId; // id cua muc chia se, dung cho PATCH/DELETE /tasks/:id/shares/:shareId
  final UserRef user;
  final String role; // "viewer" | "editor" (permission)

  SharedEntry({this.shareId = "", required this.user, required this.role});

  factory SharedEntry.fromJson(Map<String, dynamic> json) {
    return SharedEntry(
      shareId: json["shareId"]?.toString() ?? json["_id"]?.toString() ?? "",
      user: UserRef.fromJson(json["user"] as Map<String, dynamic>),
      role: json["permission"]?.toString() ?? json["role"]?.toString() ?? "viewer",
    );
  }
}
