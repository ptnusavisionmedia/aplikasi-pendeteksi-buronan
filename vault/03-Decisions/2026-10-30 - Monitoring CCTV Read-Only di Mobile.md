---
tags: [decision, mobile, cctv]
date: 2026-10-30
status: accepted
---

# Monitoring CCTV Read-Only di Mobile

- **Tanggal:** 2026-10-30
- **Status:** accepted
- **Konteks terkait:** [[03-Decisions/2026-10-30 - Migrasi Font Poppins dan Preset Multi-Merk CCTV|Migrasi Font Poppins dan Preset Multi-Merk CCTV]], `apps/mobile/lib/screens/cctv_screen.dart`, `apps/api/src/routes/cctv.ts`

## Konteks
Sampai sesi ini, daftar CCTV (`GET /cctv-feeds`) hanya bisa dilihat lewat dashboard web. Pengguna ingin
mobile juga bisa memantau status kamera, tapi secara eksplisit **tanpa** kemampuan menambah/mengurangi
feed — kelola CCTV (tambah/edit/nonaktifkan) harus tetap eksklusif di dashboard web untuk admin.

## Opsi yang Dipertimbangkan
1. **Replikasi penuh fitur kelola CCTV di mobile** (tambah/edit/nonaktifkan) — ditolak eksplisit oleh
   pengguna; bertentangan dengan niat "mobile read-only".
2. **Layar monitoring read-only di mobile, backend tidak berubah** (dipilih) — `GET /cctv-feeds` di
   `apps/api/src/routes/cctv.ts` sudah memakai `requireAuth` saja tanpa pembatasan role, jadi aman
   dikonsumsi mobile tanpa perubahan backend. Hanya perlu memastikan UI mobile tidak pernah merender
   kontrol tambah/edit/hapus/toggle status, terlepas dari role pengguna yang login.

## Keputusan
- Tab baru "CCTV" (`apps/mobile/lib/core/router.dart` route `/cctv`, `apps/mobile/lib/widgets/bottom_nav_shell.dart`)
  menampilkan `CctvScreen` (`apps/mobile/lib/screens/cctv_screen.dart`): daftar kamera dari
  `cctvFeedsProvider` (Riverpod `FutureProvider.autoDispose`, `GET /cctv-feeds`), menampilkan badge
  status, nama, lokasi, wilayah, tanggal terdaftar. Mengikuti pola lock-prompt "Masuk untuk..." yang
  sama seperti `HomeScreen` untuk pengguna belum login.
- Model baru `apps/mobile/lib/models/cctv_feed.dart` sengaja tidak menyertakan `urlStream` (mobile
  tidak merender video stream, hanya status) atau `ownerId` (metadata kepemilikan tidak relevan untuk
  monitoring read-only).
- Tidak ada tombol tambah, edit, hapus, atau toggle status di layar ini — berlaku untuk semua role,
  termasuk Admin yang login lewat mobile. Mengelola feed CCTV tetap hanya bisa lewat
  `apps/web/src/app/(dashboard)/cctv/page.tsx`.
- Tidak ada perubahan skema database atau endpoint backend.

## Konsekuensi
- Kalau nanti dibutuhkan kontrol tambah/edit CCTV di mobile untuk role tertentu (mis. Aparat lapangan),
  itu perubahan kebijakan baru yang perlu decision record sendiri — bukan asumsi default.
- `apps/mobile` build number dinaikkan `1.0.0+2` → `1.0.0+3` (lihat `CHANGELOG.md` `[Unreleased]`).
- Diverifikasi end-to-end: `flutter analyze` bersih, dan `flutter run -d web-server` dengan login akun
  Admin seed (`admin1@example.com`) menampilkan daftar CCTV read-only tanpa kontrol kelola apa pun.
