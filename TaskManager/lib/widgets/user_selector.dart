import 'dart:async';
import 'package:flutter/material.dart';
import '../models/user_ref.dart';
import '../services/api_service.dart';

// O tim nguoi dung theo ten hoac email, cho phep chon 1 hoac nhieu nguoi.
// Dung chung cho hop thoai Giao viec va Chia se.
class UserSelector extends StatefulWidget {
  final List<UserRef> selected;
  final ValueChanged<List<UserRef>> onChanged;
  final Set<String> excludeIds; // nhung nguoi khong can hien trong ket qua (da duoc giao/chia se...)
  final String hintText;

  const UserSelector({
    super.key,
    required this.selected,
    required this.onChanged,
    this.excludeIds = const {},
    this.hintText = "Tìm theo tên hoặc email",
  });

  @override
  State<UserSelector> createState() => _UserSelectorState();
}

class _UserSelectorState extends State<UserSelector> {
  final _controller = TextEditingController();
  Timer? _debounce;
  int _requestSeq = 0; // bo qua ket qua cua yeu cau cu khi nguoi dung da go tiep
  List<UserRef> _results = [];
  bool _loading = false;
  String? _error;
  String _searchedQuery = ""; // tu khoa da tim xong, de biet khi nao hien "khong tim thay"

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onTextChanged(String text) {
    _debounce?.cancel();
    final q = text.trim();
    if (q.length < 2) {
      _requestSeq++;
      setState(() {
        _results = [];
        _error = null;
        _loading = false;
        _searchedQuery = "";
      });
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 400), () => _search(q));
  }

  Future<void> _search(String q) async {
    final seq = ++_requestSeq;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await ApiService.searchUsers(q);
      if (!mounted || seq != _requestSeq) return;
      if (result["users"] != null) {
        setState(() {
          _results = (result["users"] as List)
              .map((e) => UserRef.fromJson(e as Map<String, dynamic>))
              .toList();
          _searchedQuery = q;
          _loading = false;
        });
      } else {
        setState(() {
          _error = result["message"]?.toString() ?? "Không tìm được người dùng";
          _loading = false;
        });
      }
    } catch (_) {
      if (!mounted || seq != _requestSeq) return;
      setState(() {
        _error = "Không kết nối được máy chủ";
        _loading = false;
      });
    }
  }

  void _select(UserRef user) {
    if (!widget.selected.any((u) => u.id == user.id)) {
      widget.onChanged([...widget.selected, user]);
    }
    _controller.clear();
    setState(() {
      _results = [];
      _searchedQuery = "";
    });
  }

  void _remove(UserRef user) {
    widget.onChanged(widget.selected.where((u) => u.id != user.id).toList());
  }

  @override
  Widget build(BuildContext context) {
    final visible = _results
        .where((u) => !widget.excludeIds.contains(u.id) && !widget.selected.any((s) => s.id == u.id))
        .toList();
    final queryText = _controller.text.trim();
    final showEmpty = !_loading &&
        _error == null &&
        _searchedQuery.isNotEmpty &&
        _searchedQuery == queryText &&
        visible.isEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        TextField(
          controller: _controller,
          onChanged: _onTextChanged,
          decoration: InputDecoration(
            hintText: widget.hintText,
            border: const OutlineInputBorder(),
            isDense: true,
            prefixIcon: const Icon(Icons.search),
            suffixIcon: _loading
                ? const Padding(
                    padding: EdgeInsets.all(10),
                    child: SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2)),
                  )
                : null,
          ),
        ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 12)),
          ),
        if (showEmpty)
          const Padding(
            padding: EdgeInsets.only(top: 6),
            child: Text("Không tìm thấy người dùng phù hợp", style: TextStyle(color: Colors.grey, fontSize: 12)),
          ),
        if (visible.isNotEmpty)
          ConstrainedBox(
            constraints: const BoxConstraints(maxHeight: 180),
            child: ListView(
              shrinkWrap: true,
              children: visible
                  .map(
                    (u) => ListTile(
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      leading: const CircleAvatar(radius: 14, child: Icon(Icons.person, size: 16)),
                      title: Text(u.fullName.isNotEmpty ? u.fullName : u.email),
                      subtitle: Text(u.email),
                      onTap: () => _select(u),
                    ),
                  )
                  .toList(),
            ),
          ),
        if (widget.selected.isNotEmpty) ...[
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 4,
            children: widget.selected
                .map(
                  (u) => InputChip(
                    label: Text(u.fullName.isNotEmpty ? u.fullName : u.email),
                    onDeleted: () => _remove(u),
                  ),
                )
                .toList(),
          ),
        ],
      ],
    );
  }
}
