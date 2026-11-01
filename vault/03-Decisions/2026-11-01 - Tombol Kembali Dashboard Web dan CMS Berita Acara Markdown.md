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
1. **Mobile — audit dulu sebelum menambah apa pun**: layar mobile sudah flat `GoRoute` (bukan `ShellRoute`) sejak redesign Home, dan tiap layar sudah pakai `Scaffold`+`AppBar` sendiri tanpa `leading`/`automaticallyImplyLeading` custom. Navigasi dari Home selalu lewat `context.push`, sehingga `Navigator.canPop()` true dan Flutter otomatis menampilkan ikon kembali di `AppBar`. Diverifikasi lewat audit kode (bukan tebakan) — tidak ada perubahan mobile yang diperlukan untuk item ini.
2. **Web — per-halaman vs. satu tombol di header bersama**: menambahkan tombol kembali manual di tiap file page.tsx (9+ file) vs. satu tombol "Kembali" di header `(dashboard)/layout.tsx` yang otomatis muncul di semua halaman sidebar kecuali Overview (root). Dipilih opsi kedua — konsisten, satu titik perawatan, otomatis berlaku untuk halaman baru nanti.
3. **CMS markdown — textarea manual vs. WYSIWYG penuh vs. editor markdown+toolbar+pratinjau**: WYSIWYG contenteditable penuh (rich text) butuh library besar (TipTap/Slate) dan serialisasi HTML tambahan di backend/mobile. Dipilih **editor markdown dengan toolbar sisip-sintaks + tab Pratinjau** (`react-markdown`+`remark-gfm`) — lebih ringan, hasil tersimpan sebagai teks markdown biasa yang mudah dirender ulang di web maupun mobile, dan tetap memberi "keleluasaan WordPress-like" (heading, list, kutipan, tautan, gambar sisipan) tanpa kompleksitas WYSIWYG.

## Keputusan
- **Web dashboard**: `apps/web/src/app/(dashboard)/layout.tsx` — tombol "Kembali" (`router.back()`) di header, tampil di semua halaman kecuali `/dashboard` (tidak ada "sebelumnya" yang masuk akal dari Overview).
- **CMS Berita Acara**: field "Isi lengkap" di `apps/web/src/app/(dashboard)/berita-acara/page.tsx` sekarang pakai komponen baru `apps/web/src/components/markdown-editor.tsx` — toolbar (tebal, miring, subjudul, kutipan, daftar, daftar bernomor, kode, tautan, sisip gambar) + tab Tulis/Pratinjau. Endpoint baru `POST /berita-acara/media` (role ADMIN/APARAT/KEAMANAN_SWASTA, reuse `uploadEvidenceFile`) mengunggah gambar lepas untuk disisipkan sebagai `![...](url)` di konten.
- **Render markdown**: mobile (`berita_acara_detail_screen.dart`) memakai `flutter_markdown_plus` (`MarkdownBody`) — `flutter_markdown` resmi sudah discontinued, diganti fork yang masih dirawat, API sama. Web belum punya halaman baca publik terpisah (bacaan publik lewat mobile), jadi hanya pratinjau CMS yang merender markdown di web untuk saat ini.
- **Mobile**: tidak ada perubahan kode — tombol kembali di tiap layar sudah otomatis dari `AppBar` bawaan Flutter sejak redesign Home (lihat Konteks di atas).

## Konsekuensi
- `ringkasan` (ringkasan daftar) tetap teks polos, sengaja tidak markdown — dipakai sebagai potongan singkat di kartu daftar, bukan konten panjang.
- Belum ada halaman baca publik Berita Acara di web (hanya CMS untuk staf) — kalau nanti dibuat, render markdown-nya bisa pakai ulang class CSS `.prose-berita` yang sudah ditambahkan di `globals.css`.
- `flutter analyze` bersih dan `tsc --noEmit` bersih di `apps/api` & `apps/web` setelah seluruh perubahan. Diuji langsung di browser pane: tombol Kembali berfungsi (navigasi `/deteksi` → `/buronan`), editor markdown menulis+pratinjau+simpan berhasil end-to-end (data tersimpan lalu dibersihkan dari test data).
