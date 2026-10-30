import 'package:flutter/material.dart';

/// Design 4 — Bento tokens, replicated from apps/web/src/app/globals.css
/// (font Figtree -> Poppins dan aksen primary emerald -> biru, lihat
/// vault/03-Decisions/2026-10-30 - Migrasi Font Poppins dan Preset Multi-Merk CCTV.md)
class AppColors {
  static const ink = Color(0xFF1B2420);
  static const muted = Color(0xFF5B6B63);
  static const canvas = Color(0xFFF5F6F2);
  static const surface = Color(0xFFFFFFFF);
  static const line = Color(0xFFE4E6E0);

  static const primary = Color(0xFF1D5FD1);
  static const primarySoft = Color(0xFFE4ECFB);
  static const primaryInk = Color(0xFF123D94);

  static const coral = Color(0xFFE2503B);
  static const coralSoft = Color(0xFFFBE6E2);

  static const amber = Color(0xFFC6860F);
  static const amberSoft = Color(0xFFFAF0DA);
}

ThemeData buildAppTheme() {
  return ThemeData(
    useMaterial3: true,
    scaffoldBackgroundColor: AppColors.canvas,
    colorScheme: ColorScheme.fromSeed(
      seedColor: AppColors.primary,
      primary: AppColors.primary,
      surface: AppColors.surface,
    ),
    textTheme: Typography.material2021().black.apply(
      fontFamily: 'Poppins',
      bodyColor: AppColors.ink,
      displayColor: AppColors.ink,
    ),
    fontFamily: 'Poppins',
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.surface,
      foregroundColor: AppColors.ink,
      elevation: 0,
      centerTitle: false,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.canvas,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.line),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.line),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.ink,
        padding: const EdgeInsets.symmetric(vertical: 14),
        side: const BorderSide(color: AppColors.line),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    ),
  );
}

/// Shared card style matching `.bento-cell` in tokens.css
class BentoCell extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final Color? color;

  const BentoCell({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: color ?? AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: color == null ? Border.all(color: AppColors.line) : null,
      ),
      child: child,
    );
  }
}
