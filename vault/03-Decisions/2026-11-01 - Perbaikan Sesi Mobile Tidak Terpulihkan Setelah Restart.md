---
tags: [decision, mobile, bugfix, auth]
date: 2026-11-01
status: accepted
---

# Perbaikan Sesi Mobile Tidak Terpulihkan Setelah Restart

- **Tanggal:** 2026-11-01
- **Status:** accepted
- **Konteks terkait:** [[2026-11-01 - Redesign Home Mobile, Navigasi Icon-Only Tanpa Bottom Bar]]

## Konteks
Pengguna melaporkan: menekan ikon Profil di mobile langsung "logout", padahal yang diharapkan adalah membuka detail profil dengan tombol Keluar terpisah.

## Investigasi
Layar `apps/mobile/lib/screens/profil_screen.dart` sendiri sudah benar sejak redesign Home — menampilkan detail (avatar, nama, role, wilayah, email) dengan tombol "Keluar" terpisah, bukan logout langsung. Akar masalahnya ada di `apps/mobile/lib/state/auth_provider.dart`: `AuthNotifier._restore()` (dipanggil sekali saat app start) hanya memulihkan `token` dari secure storage, **tidak pernah mengisi ulang `user`**. `AuthState.isAuthenticated` butuh `token != null && user != null`, jadi setelah app di-restart, token sebenarnya masih valid tapi `isAuthenticated` selalu `false`. Ikon Profil di Home (`onTap: () => context.push(auth.isAuthenticated ? '/profil' : '/login')`) jadi selalu melempar ke `/login` — terasa seperti "langsung logout" padahal sesinya sendiri sebenarnya masih ada.

## Keputusan
`_restore()` sekarang memakai token yang tersimpan untuk memanggil `GET /auth/me` (endpoint yang sama yang sudah dipakai `login_screen.dart` dan `verify_otp_screen.dart` setelah login/verifikasi OTP) dan mengisi ulang `user` dari responsnya. Kalau tokennya sudah tidak valid (kedaluwarsa, dicabut, dll — request gagal), baru benar-benar dianggap logout: token dihapus dari secure storage dan state dikosongkan.

## Konsekuensi
- `AuthNotifier` sekarang butuh `Ref` di constructor untuk membaca `dioProvider` — `apps/mobile/lib/core/api_client.dart` dan `apps/mobile/lib/state/auth_provider.dart` jadi saling impor (lazy, lewat `ref.read` di dalam callback/method async, bukan di waktu build provider), yang legal di Dart/Riverpod dan merupakan pola umum di sini (api_client.dart juga sudah membaca `authProvider` di interceptor-nya sebelum perubahan ini).
- Diverifikasi langsung di `flutter run -d web-server`: sesi dari token tersimpan sebelumnya berhasil dipulihkan (nama "Ahmad Fauzi" tampil di Home setelah instance app baru dimulai), dan menekan Profil membuka layar detail lengkap, bukan login. `flutter analyze` bersih.
