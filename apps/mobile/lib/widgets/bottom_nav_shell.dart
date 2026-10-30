import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../core/theme.dart';

class BottomNavShell extends StatelessWidget {
  final Widget child;
  final String location;

  const BottomNavShell({super.key, required this.child, required this.location});

  static const _tabs = [
    {'path': '/home', 'icon': Icons.grid_view_rounded, 'label': 'Home'},
    {'path': '/lapor', 'icon': Icons.flag_outlined, 'label': 'Lapor'},
    {'path': '/cctv', 'icon': Icons.videocam_outlined, 'label': 'CCTV'},
    {'path': '/status', 'icon': Icons.checklist_rounded, 'label': 'Status'},
    {'path': '/profil', 'icon': Icons.person_outline_rounded, 'label': 'Profil'},
  ];

  int get _currentIndex {
    final index = _tabs.indexWhere((t) => location.startsWith(t['path'] as String));
    return index == -1 ? 0 : index;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: child,
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: AppColors.surface,
          border: Border(top: BorderSide(color: AppColors.line)),
        ),
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: SafeArea(
          top: false,
          child: Row(
            children: _tabs.asMap().entries.map((entry) {
              final i = entry.key;
              final tab = entry.value;
              final active = i == _currentIndex;
              return Expanded(
                child: InkWell(
                  onTap: () => context.go(tab['path'] as String),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(tab['icon'] as IconData, size: 22, color: active ? AppColors.primary : AppColors.muted),
                      const SizedBox(height: 2),
                      Text(
                        tab['label'] as String,
                        style: TextStyle(
                          fontSize: 10,
                          color: active ? AppColors.primary : AppColors.muted,
                          fontWeight: active ? FontWeight.w600 : FontWeight.normal,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
        ),
      ),
    );
  }
}
