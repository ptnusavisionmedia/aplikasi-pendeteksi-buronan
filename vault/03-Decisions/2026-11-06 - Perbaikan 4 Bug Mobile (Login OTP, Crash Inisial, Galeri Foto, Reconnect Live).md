---
tags: [decision, mobile, bugfix]
date: 2026-11-06
status: accepted
---

# Perbaikan 4 Bug Mobile (Login OTP, Crash Inisial, Galeri Foto, Reconnect Live)

- **Tanggal:** 2026-11-06
- **Status:** accepted
- **Konteks terkait:** [[2026-11-01 - Perbaikan Sesi Mobile Tidak Terpulihkan Setelah Restart]]

## Konteks
Permintaan user: *"untuk mobile kalau ada bug tolong diperbaiki ya"* — tidak ada laporan bug spesifik, jadi dilakukan audit kode manual terhadap seluruh `apps/mobile/lib/screens/*.dart` + `flutter analyze` (bersih, tidak menangkap bug logika runtime seperti di bawah).

## Bug yang ditemukan & diperbaiki

**1. Login APARAT/INSTANSI_HUKUM (2FA) selalu gagal — `verify_otp_screen.dart`**
Setelah `POST /auth/login/verify-otp` sukses dan mendapat token baru, kode langsung memanggil `GET /auth/me` **tanpa menyertakan token itu** (mengandalkan interceptor `dioProvider`, yang baru melampirkan `Authorization` dari `authProvider.state.token` — padahal `setSession()` belum dipanggil di titik ini, jadi token di state masih `null`). Request jadi tidak terautentikasi → backend balas 401 → ditangkap sebagai "Kode OTP salah atau kedaluwarsa", padahal OTP-nya benar. **Setiap user dengan 2FA wajib (APARAT, INSTANSI_HUKUM) tidak pernah bisa login lewat mobile sama sekali** — ini bug paling serius dari keempatnya. Diperbaiki dengan mengirim token secara eksplisit di header (pola yang sama sudah dipakai `login_screen.dart`).

**2. Crash di Home/Profil kalau nama user kosong/spasi — `home_screen.dart`, `profil_screen.dart`**
Kode inisial avatar (`nama.split(RegExp(r'\s+')).map((p) => p[0])...`) memanggil `p[0]` pada kata hasil split — kalau `nama` kosong atau cuma spasi, `trim()` menyisakan string kosong `""`, dan `split` pada string kosong mengembalikan `['']`, lalu `''[0]` melempar `RangeError` (tidak ada karakter ke-0 di string kosong) → Home/Profil screen crash total. Diperbaiki dengan getter `AppUser.initials` baru (filter kata kosong, fallback `'?'`), dipakai di kedua tempat yang sebelumnya duplikat logika yang sama.

**3. Form Lapor tidak bisa unggah dari galeri meski teksnya bilang bisa — `lapor_screen.dart`**
Hint text di kotak foto bilang "Ambil foto / unggah dari galeri", tapi `_pickPhoto()` hanya memanggil `ImagePicker().pickImage(source: ImageSource.camera)` — tidak ada jalur galeri sama sekali, beda dari `manual_check_screen.dart` yang sudah benar (ada tombol terpisah "Pilih dari galeri"). Diperbaiki dengan pola yang sama: tombol galeri terpisah di bawah kotak foto, teks hint disesuaikan jadi akurat ("Ambil foto dari kamera").

**4. UI live stream mobile tidak menunjukkan status saat auto-reconnect — `cctv_live_screen.dart`**
`_reconnect()` (dari perbaikan stall-watchdog sebelumnya, lihat [[2026-11-01 - Auto-Reconnect Live Stream dan Ambang Simpan Deteksi 70 Persen]]) men-null-kan `_controller` tanpa `setState()`, jadi widget tidak rebuild dan layar tetap menampilkan frame video lama (sudah disposed) alih-alih indikator loading selama proses reconnect — bisa disalahartikan sebagai "macet lagi". Diperbaiki dengan `setState(() {})` sesaat setelah controller lama di-null-kan.

## Keputusan
Keempat bug diperbaiki langsung (bukan ditunda sebagai rencana) karena risikonya jelas (bug #1 total blocker untuk sebagian role, #2 crash total) dan perbaikannya kecil/lokal, tidak menyentuh arsitektur.

## Konsekuensi
- `flutter analyze` bersih setelah semua perubahan (sempat ada 1 error compile — lupa import `package:dio/dio.dart` di `verify_otp_screen.dart` untuk `Options` — langsung diperbaiki di iterasi yang sama).
- Bug #1 tidak pernah ketahuan sebelumnya karena testing login mobile selama ini selalu memakai akun `MASYARAKAT` (tidak butuh 2FA) — perlu akun APARAT/INSTANSI_HUKUM asli untuk uji regresi manual di sesi berikutnya (belum diverifikasi end-to-end dengan autentikator sungguhan di sesi ini, hanya lewat audit kode + analisa alur request).
- Tidak ada perubahan API/backend — keempatnya murni bug di `apps/mobile`.
