---
tags: [decision]
date: 2026-11-01
status: accepted
---

# Redesign Home Mobile, Navigasi Icon-Only Tanpa Bottom Bar

- **Tanggal:** 2026-11-01
- **Status:** accepted
- **Konteks terkait:** Permintaan fitur baru dari pengguna lewat 2 screenshot wireframe beranotasi — bagian kedua dari tiga permintaan besar (lihat [[2026-11-01 - CMS Berita Acara di Web, Publik Lewat Status Terbit|CMS Berita Acara]], sudah dikerjakan lebih dulu). Fitur ketiga (CCTV live-streaming di mobile) masih tertunda.

## Konteks
Pengguna minta Home screen mobile dirombak: hapus bottom navigation bar sepenuhnya, ganti dengan navigasi berbasis ikon di dalam Home sendiri; ganti konten blok "Notifikasi Deteksi" dengan feed Berita Acara; tambah ikon notifikasi & profil di header; tambah grid navigasi (CCTV, Berita, Daftar Buronan, Lapor, Bantuan); tambah CTA "Lapor" & "Lihat Laporan".

## Opsi yang Dipertimbangkan
1. Hapus `BottomNavShell`/`ShellRoute`, jadikan tiap layar non-Home sebagai `GoRoute` biasa dengan `Scaffold`+`AppBar` sendiri (tombol kembali otomatis) — dipilih. Konsisten dengan pola yang sudah dipakai `manual_check_screen.dart` & `detection_detail_screen.dart` (layar yang memang sudah di-push di luar shell sebelumnya).
2. Pertahankan `ShellRoute` tapi sembunyikan bottom bar secara visual — ditolak, permintaan eksplisit pengguna adalah navigasi "hanya lewat ikon di layar pertama", bukan sekadar menyembunyikan UI.

## Keputusan
- `apps/mobile/lib/core/router.dart`: `ShellRoute`+`BottomNavShell` dihapus total (file `widgets/bottom_nav_shell.dart` dihapus). Semua route (`/lapor`, `/cctv`, `/status`, `/profil`, dan layar baru) jadi `GoRoute` top-level, masing-masing bawa `Scaffold`+`AppBar` sendiri. `initialLocation` pindah dari `/lapor` ke `/home` karena Home sekarang jadi hub navigasi utama.
- Layar baru: `/notifikasi` (diekstrak dari inline list lama di Home), `/buronan` (daftar DPO aktif, read-only — pola sama dengan `cctv_screen.dart`, kelola tetap di web), `/berita-acara` + `/berita-acara/:id` (konsumsi `GET /berita-acara?status=TERBIT` dari CMS), `/bantuan` (FAQ statis, tanpa API).
- Home baru: header (sapaan + ikon lonceng→`/notifikasi` + avatar→`/profil`), grid 5 ikon nav, CTA "Lapor Temuan"/"Lihat Laporan", lalu feed Berita Acara terbaru (8 item) dengan tautan "Lihat semua" ke `/berita-acara`.
- `/cctv` tetap read-only (lihat [[2026-10-30 - Monitoring CCTV Read-Only di Mobile]]) — live-streaming CCTV di mobile belum dikerjakan, itu permintaan ketiga yang masih tertunda.

## Konsekuensi
- `context.go('/status')` di `lapor_screen.dart` setelah laporan terkirim tetap pakai `.go` (replace), bukan `.push` — perilaku lama dari sebelum redesign, tidak diubah karena di luar scope.
- Verifikasi otomatis di Flutter-web (DWDS debug) sempat menunjukkan feed Berita Acara kosong meski data ada di DB — ternyata bukan bug, melainkan `FutureProvider.autoDispose` Riverpod yang mempertahankan hasil fetch lama sebentar saat widget di-dispose lalu langsung di-mount ulang cepat (navigasi balik via tombol back). Reload penuh (hot restart/refresh asli) menampilkan data dengan benar — perilaku ini hanya relevan untuk testing otomatis, bukan untuk pengguna sungguhan (pull-to-refresh & buka-ulang app tetap berfungsi).
