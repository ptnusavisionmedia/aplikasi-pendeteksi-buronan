---
tags: [decision, web, mobile, cms]
date: 2026-11-01
status: accepted
---

# Tombol Kembali Dashboard Web dan CMS Berita Acara Markdown

- **Tanggal:** 2026-11-01
- **Status:** accepted
- **Konteks terkait:** [[2026-11-01 - CMS Berita Acara di Web, Publik Lewat Status Terbit]], [[2026-11-01 - Redesign Home Mobile, Navigasi Icon-Only Tanpa Bottom Bar]]

## Konteks
Dua permintaan tambahan dari pengguna: (1) tiap halaman di sidebar dashboard web maupun tiap layar di mobile perlu tombol kembali agar bisa kembali ke tampilan sebelumnya; (2) isi CMS Berita Acara perlu bisa ditulis dengan markdown dan diberi keleluasaan menata konten layaknya CMS WordPress (heading, list, kutipan, tautan, gambar sisipan), bukan sekadar textarea polos.

## Opsi yang Dipertimbangkan
1. **Mobile — andalkan `AppBar` bawaan vs. tombol kembali eksplisit**: layar mobile sudah flat `GoRoute` (bukan `ShellRoute`) sejak redesign Home, navigasi dari Home selalu lewat `context.push`, dan `AppBar` Flutter otomatis menampilkan ikon kembali saat `Navigator.canPop()` true — audit kode awal menyimpulkan tombol sudah "otomatis ada". Setelah pengguna menegaskan ulang permintaannya, diputuskan untuk tetap **menambahkan tombol kembali eksplisit** di `leading` tiap `AppBar`, bukan cuma mengandalkan perilaku implisit — karena `canPop()` bisa `false` kalau layar dibuka langsung lewat URL/deep link (stack cuma berisi satu route, terjadi saat tes lewat `flutter run -d web-server` dengan refresh/URL manual), dan eksplisit lebih terjamin + terlihat jelas di kode ketimbang bergantung ke perilaku default yang kondisional.
2. **Web — per-halaman vs. satu tombol di header bersama**: menambahkan tombol kembali manual di tiap file page.tsx (9+ file) vs. satu tombol "Kembali" di header `(dashboard)/layout.tsx` yang otomatis muncul di semua halaman sidebar kecuali Overview (root). Dipilih opsi kedua — konsisten, satu titik perawatan, otomatis berlaku untuk halaman baru nanti.
3. **CMS markdown — textarea manual vs. WYSIWYG penuh vs. editor markdown+toolbar+pratinjau**: WYSIWYG contenteditable penuh (rich text) butuh library besar (TipTap/Slate) dan serialisasi HTML tambahan di backend/mobile. Dipilih **editor markdown dengan toolbar sisip-sintaks + tab Pratinjau** (`react-markdown`+`remark-gfm`) — lebih ringan, hasil tersimpan sebagai teks markdown biasa yang mudah dirender ulang di web maupun mobile, dan tetap memberi "keleluasaan WordPress-like" (heading, list, kutipan, tautan, gambar sisipan) tanpa kompleksitas WYSIWYG.

## Keputusan
- **Web dashboard**: `apps/web/src/app/(dashboard)/layout.tsx` — tombol "Kembali" (`router.back()`) di header, tampil di semua halaman kecuali `/dashboard` (tidak ada "sebelumnya" yang masuk akal dari Overview).
- **Mobile**: widget baru `apps/mobile/lib/widgets/back_button.dart` (`AppBackButton`) — pop kalau `context.canPop()`, kalau tidak fallback ke route tertentu (default `/home`, disesuaikan ke `/login` untuk layar auth dan `/berita-acara`/`/cctv` untuk layar detail). Dipasang sebagai `leading:` di seluruh `AppBar` non-Home: CCTV, CCTV Live, Status, Profil, Notifikasi, Buronan, Berita Acara (list & detail), Bantuan, Lapor, Periksa Foto Manual, Detail Deteksi, Buat Akun, Verifikasi OTP.
- **CMS Berita Acara**: field "Isi lengkap" di `apps/web/src/app/(dashboard)/berita-acara/page.tsx` sekarang pakai komponen baru `apps/web/src/components/markdown-editor.tsx` — toolbar (tebal, miring, subjudul, kutipan, daftar, daftar bernomor, kode, tautan, sisip gambar) + tab Tulis/Pratinjau. Endpoint baru `POST /berita-acara/media` (role ADMIN/APARAT/KEAMANAN_SWASTA, reuse `uploadEvidenceFile`) mengunggah gambar lepas untuk disisipkan sebagai `![...](url)` di konten.
- **Render markdown**: mobile (`berita_acara_detail_screen.dart`) memakai `flutter_markdown_plus` (`MarkdownBody`) — `flutter_markdown` resmi sudah discontinued, diganti fork yang masih dirawat, API sama. Web belum punya halaman baca publik terpisah (bacaan publik lewat mobile), jadi hanya pratinjau CMS yang merender markdown di web untuk saat ini.

## Konsekuensi
- `ringkasan` (ringkasan daftar) tetap teks polos, sengaja tidak markdown — dipakai sebagai potongan singkat di kartu daftar, bukan konten panjang.
- Belum ada halaman baca publik Berita Acara di web (hanya CMS untuk staf) — kalau nanti dibuat, render markdown-nya bisa pakai ulang class CSS `.prose-berita` yang sudah ditambahkan di `globals.css`.
- `flutter analyze` bersih dan `tsc --noEmit` bersih di `apps/api` & `apps/web` setelah seluruh perubahan. Diuji langsung: web di browser pane (tombol Kembali berfungsi, navigasi `/deteksi` → `/buronan`; editor markdown menulis+pratinjau+simpan berhasil end-to-end, data test dibersihkan); mobile di `flutter run -d web-server` (tombol kembali tampil eksplisit di layar CCTV, tap-nya kembali ke Home dengan benar).
