---
tags: [index, decisions]
---

# Decision Log — Index

> [[Home|⬅ Kembali ke Home]]

Setiap keputusan produk/arsitektur yang signifikan (dan alasannya) dicatat di sini sebagai satu note terpisah, pakai template [[../Templates/Decision Record|Decision Record]]. Beri nama file: `YYYY-MM-DD - Judul Keputusan.md`.

Tujuannya: supaya keputusan yang sudah diambil (dan alasannya) tidak hilang atau diulang-ulang didiskusikan tanpa konteks baru — termasuk saat Claude membantu di sesi lain.

## Daftar Keputusan
- [[2026-10-29 - Pemilihan Arah Desain UI Bento|2026-10-29 — Pemilihan Arah Desain UI: Bento (Design 4)]] — arah visual resmi untuk implementasi Next.js web + Flutter mobile.
- [[2026-10-30 - Lingkup PRD v2 Akurasi dan Webcam Dev|2026-10-30 — Lingkup PRD v2: Anti-Salah-Identifikasi + Mode Simulasi Webcam untuk Dev]] — PRD v2 dibuat sebagai dokumen terpisah dari v1; webcam hanya sebagai simulasi feed CCTV di dev/staging, terisolasi dari eskalasi produksi.
- [[2026-10-30 - Migrasi Font Poppins dan Preset Multi-Merk CCTV|2026-10-30 — Migrasi Font Poppins & Preset Multi-Merk CCTV]] — font web dashboard Figtree → Poppins + aksen glassmorphism; preset merk kamera (Tapo C200, Hikvision, Dahua, dll) di form Tambah Feed CCTV, tanpa perubahan backend.
- [[2026-10-30 - Monitoring CCTV Read-Only di Mobile|2026-10-30 — Monitoring CCTV Read-Only di Mobile]] — tab CCTV baru di mobile (list status kamera), sengaja tanpa kontrol tambah/edit/hapus untuk role manapun; kelola feed tetap eksklusif dashboard web.
- [[2026-10-30 - Registrasi Publik Masyarakat-Only, Akun Petugas Lewat Provisioning Operator|2026-10-30 — Registrasi Publik Masyarakat-Only, Akun Petugas Lewat Provisioning Operator]] — form daftar publik (web dihapus, mobile disederhanakan) selalu membuat akun Masyarakat; akun petugas (Aparat/Keamanan Swasta/Instansi Hukum/Admin) hanya lewat seed script/provisioning operator, backend menolak role privileged dari endpoint publik.
