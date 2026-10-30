---
tags: [decision, design, cctv]
date: 2026-10-30
status: accepted
---

# Migrasi Font Poppins & Preset Multi-Merk CCTV

- **Tanggal:** 2026-10-30
- **Status:** accepted
- **Konteks terkait:** [[03-Decisions/2026-10-29 - Pemilihan Arah Desain UI Bento|Design 4 — Bento]], `apps/web/src/app/(dashboard)/cctv/page.tsx`

## Konteks
Dua permintaan pengguna:
1. Pengguna memakai kamera **TP-Link Tapo C200** dan ingin dashboard mendukung "lebih banyak opsi CCTV", bukan hanya RTSP generik tanpa panduan.
2. Tampilan web dashboard dirasa perlu diperbagus lagi, dengan font diganti ke **Poppins** (atau alternatif lain).

Sebelum sesi ini dimulai, sebagian perubahan sudah berjalan tapi belum ter-commit: font di `apps/web` sudah diganti dari Figtree → Poppins, dan sidebar/header dashboard sudah memakai aksen glassmorphism (`.glass`, `.glass-strong`, `.glass-primary` di `globals.css`). Keputusan Design 4 — Bento sebelumnya menetapkan Figtree sebagai font resmi, jadi perubahan font ini perlu dicatat sebagai revisi, bukan diam-diam menyimpang.

## Opsi yang Dipertimbangkan
1. **Integrasi RTSP/ONVIF per-vendor di backend** (deteksi otomatis tipe kamera, auth khusus) — paling "lengkap" tapi backend (`services/detection-engine`) sudah generik lewat OpenCV `VideoCapture` yang menerima URL RTSP apa pun; menambah logika per-vendor di backend tidak diperlukan dan menambah kompleksitas tanpa manfaat nyata.
2. **Preset merk kamera di form UI** (dipilih) — dropdown "Merk/tipe kamera" yang mengisi template URL RTSP + catatan cara mengaktifkan RTSP (mis. Tapo perlu "Camera Account" terpisah di Advanced Settings). Zero backend change, langsung menolong use case Tapo C200 pengguna dan merk lain yang umum di Indonesia (Hikvision, Dahua, Ezviz, Imou, Xiaomi, generik ONVIF).
3. **Pertahankan Figtree** vs **ganti ke Poppins** — Poppins dipilih sesuai permintaan eksplisit pengguna; secara visual tetap satu famili geometric sans sehingga tidak mengubah nada desain Bento yang sudah ditetapkan, hanya tipografinya.

## Keputusan
- **CCTV:** Tambah daftar preset merk kamera (`CAMERA_PRESETS`) di halaman "Tambah Feed" (`apps/web/src/app/(dashboard)/cctv/page.tsx`), termasuk **Tapo C200** sebagai entri pertama/default, ditambah Tapo seri lain, Hikvision, Dahua, Ezviz, Imou, Xiaomi/Mi Home, generik ONVIF/RTSP, dan opsi isi manual. Memilih preset mengisi template `urlStream` otomatis (termasuk saat halaman pertama dibuka — preset default langsung mengisi field, tidak menunggu pengguna ganti pilihan) dan menampilkan catatan singkat cara mengaktifkan RTSP untuk merk tersebut. Tidak ada perubahan skema database atau backend — `CCTVFeed.urlStream` tetap satu field string RTSP/HTTP generik.
- **Font & visual:** Font resmi web dashboard diganti dari **Figtree → Poppins** (mengoreksi keputusan Bento 2026-10-29 di bagian font saja; pola `bento-cell` tetap). Ditambahkan efek glassmorphism pada chrome (sidebar `.glass`, header `.glass-strong`, nav item aktif `.glass-primary`) dan `bento-cell` kini punya `box-shadow` + hover-lift, plus `.icon-badge` bertinta pada kartu statistik agar lebih hidup tanpa mengubah struktur grid bento asimetris yang sudah ada.
- **Aksen warna:** palet `--color-primary*` diganti dari emerald (`#0c6b4f`) ke biru (`#1d5fd1`) atas permintaan eksplisit pengguna ("lebih enak dilihat"), termasuk blob gradien latar `body` dan `.glass-primary`. Warna coral (error/eskalasi) dan amber (peringatan) tidak diubah — tetap dua warna aksen sekunder yang sama seperti keputusan Bento 2026-10-29.
- **Layout Overview:** `/dashboard` ditata ulang jadi tiga lapis vertikal: (1) kartu "Total Deteksi Tercatat" sebagai banner hero penuh-lebar di atas, (2) baris 4 kartu statistik ringkas, (3) panel detail (Deteksi Terbaru + Eskalasi/Status Anda). Sebelumnya kartu hero itu adalah kotak 2×2 yang "menyisipkan diri" di tengah grid 4 kolom, membuat alur baca kurang jelas.
- **Mobile (Flutter) disinkronkan:** `apps/mobile/lib/core/theme.dart` diikutkan ke font Poppins dan aksen biru yang sama (`AppColors.primary = #1D5FD1`). File font `assets/fonts/Figtree-*.ttf` diganti dengan `Poppins-*.ttf` (bobot 400–800 sama), diunduh dari repo resmi `google/fonts` (lisensi OFL, sama seperti yang dipakai web lewat `next/font/google`).

## Bug yang ditemukan & diperbaiki saat verifikasi di browser
Keputusan di atas awalnya tampak tidak berefek sama sekali saat dites langsung — dua bug independen (bukan dari perubahan sesi ini, sudah ada sejak keputusan Bento 2026-10-29) menyebabkan seluruh styling web nyaris tidak tampak:
1. **Font selalu fallback ke serif browser.** `poppins.variable` (membawa custom property `--font-poppins`) dipasang di `<body>`, sementara `globals.css` memakai `var(--font-poppins)` di dalam `--font-sans` yang didefinisikan di `:root`/`<html>`. Custom property anak tidak mengalir ke induknya, jadi di titik `--font-sans` dihitung (pada `<html>`), `--font-poppins` belum ada → seluruh rantai font jadi invalid → font balik ke default browser. Diperbaiki: pindahkan `poppins.variable` ke `<html>` di `apps/web/src/app/layout.tsx`.
2. **Semua utility Tailwind kalah dari kelas kustom (`.bento-cell`, dll).** Kelas kustom di `globals.css` ditulis sebagai CSS polos di luar `@layer`, dan per spesifikasi cascade layers, style di luar layer SELALU menang atas style di dalam layer apa pun — Tailwind v4 membungkus semua utility-nya dalam layer `utilities`. Akibatnya `bg-primary`/`text-white` pada kartu hero dashboard kalah total dari `.bento-cell`, membuat kartu itu tampak putih kosong. Diperbaiki: bungkus seluruh kelas kustom (`globals.css`) dalam `@layer base`/`@layer components`.

Lihat detail teknis & cuplikan diagnosis di [[../../CHANGELOG|CHANGELOG]] `[0.3.0]`.

## Konsekuensi
- Preset kamera murni bantuan pengisian form di sisi klien — jika pengguna memasukkan merk yang tidak ada di daftar, opsi "Isi URL manual" tetap tersedia; tidak ada risiko lock-in vendor.
- Web dan mobile sekarang konsisten (font Poppins + aksen biru) sejak keputusan ini — tidak ada follow-up sinkronisasi lintas platform yang masih pending untuk font/warna.
- `services/detection-engine` tidak tersentuh; klaim "dukungan Tapo C200" bergantung pada kamera mengaktifkan RTSP (Tapo: via "Camera Account" di app resmi) — ini perlu dikomunikasikan ke pengguna, bukan sesuatu yang bisa diotomasi dari sisi aplikasi.
- Kedua bug di atas kemungkinan sudah ada sejak desain Bento pertama kali diimplementasikan (pola yang sama berlaku untuk font Figtree sebelumnya) — sesi berikutnya yang menambah kelas CSS kustom baru di `globals.css` harus menaruhnya di `@layer base`/`@layer components`, bukan sebagai CSS polos, agar tidak mengulang bug #2. Keduanya khusus `apps/web` (CSS/Next.js); tidak relevan untuk `apps/mobile` (Flutter tidak memakai cascade layers CSS).
- Versi dinaikkan: root & `apps/api` `0.2.1` → `0.3.0`, `apps/web` `0.1.0` → `0.2.0`, `apps/mobile` build `1.0.0+1` → `1.0.0+2` (lihat [[../../CHANGELOG|CHANGELOG]]).
