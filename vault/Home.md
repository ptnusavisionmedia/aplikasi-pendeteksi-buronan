---
tags: [moc, home]
---

# 🏠 Aplikasi Pendeteksi Buronan — Vault

Pusat pengetahuan proyek. Semua keputusan, riset, dan spesifikasi disimpan di sini agar konteks proyek tidak hilang antar sesi — baik untuk tim maupun untuk Claude.

## 🎯 Ringkasan Proyek
Platform deteksi wajah berbasis AI yang menghubungkan jaringan CCTV publik/swasta dengan basis data buronan (DPO) resmi, untuk deteksi real-time dan pelaporan terverifikasi oleh aparat, keamanan swasta, instansi hukum, dan masyarakat.

- **Target pengguna:** Aparat/Kepolisian, Petugas keamanan swasta, Masyarakat umum, Instansi pemerintah/lembaga hukum
- **Pain point utama:** Tidak ada deteksi real-time di lapangan
- **Keunikan:** Integrasi jaringan CCTV + deteksi berbasis vector image / AI yang lebih kuat dari pencocokan manual

## 📚 Peta Konten (Map of Content)

### Produk
- [[01-Product/PRD|PRD]] — Product Requirement Document v1 (status: **selesai, 6/6 bagian**, sudah terimplementasi penuh)
- [[01-Product/PRD-v2|PRD v2]] — lanjutan v1 (status: **draft**). Fokus: anti-salah-identifikasi (verifikasi berlapis sebelum eskalasi, anti-spoofing, kanal sanggahan) + mode simulasi webcam untuk development
- [[Persona - Bripka Andika]]
- [[Persona - Pak Herman]]

### Teknis
- [[02-Tech-Spec/Tech Spec|Tech Spec]] — selesai (5/5 bagian). Stack: Next.js + Flutter + Express + FastAPI + PostgreSQL + Qdrant
- [[06-Tasks/Tasks|Task List]] — 50 task, **semua selesai** (31 Backend, 12 Web, 7 Mobile Flutter)
- Desain UI: [[03-Decisions/2026-10-29 - Pemilihan Arah Desain UI Bento|Design 4 — Bento]] dipilih sebagai arah visual resmi

### Keputusan
- `03-Decisions/` — Decision log / ADR. Gunakan template [[Decision Record]] untuk setiap keputusan arsitektur/produk yang signifikan.

### Riset
- `04-Research/` — Catatan riset (regulasi DPO/UU PDP, vendor face-recognition, kompetitor, dll). Gunakan template [[Research Note]].

### Panduan
- [[07-Guides/Panduan Setup Development|Panduan Setup Development]] — cara menjalankan seluruh stack di lokal (infra, env, migrasi, troubleshooting)
- [[07-Guides/Panduan Install Flutter|Panduan Install Flutter]] — cara install Flutter SDK di Windows
- [[07-Guides/Cara Kerja Aplikasi|Cara Kerja Aplikasi]] — alur end-to-end tiap fitur, dipetakan ke file kode asli

### Istilah
- [[Glossary]] — Daftar istilah domain (DPO, confidence score, dll)

## 🔄 Status & Langkah Berikutnya
- [x] PRD selesai (6/6 bagian)
- [x] Tech Spec selesai (5/5 bagian)
- [x] Task List dibuat (50 task: 31 Backend + 19 Frontend)
- [x] Desain UI dipilih: Design 4 — Bento
- [x] Backend selesai & teruji end-to-end (T-01–T-31): monorepo, Express API, FastAPI detection engine, Prisma schema, Qdrant, BullMQ, MinIO — lihat [[06-Tasks/Tasks|Task List]] untuk detail.
- [x] Frontend Web selesai (T-32–T-43): Next.js 15 + Tailwind v4 di `apps/web`, mengikuti sistem desain Bento, terhubung ke backend asli.
- [x] Mobile Flutter selesai (T-44–T-50): `apps/mobile`, Riverpod + Dio + go_router, mengikuti sistem desain Bento, diverifikasi via `flutter run -d chrome` terhubung ke backend asli. APK Android belum di-build (perlu Android SDK, lihat [[07-Guides/Panduan Install Flutter|Panduan Install Flutter]]).
- [x] Testing komprehensif selesai: seluruh endpoint backend (auth/2FA, RBAC, CRUD, notifikasi, eskalasi, laporan, rate limit, lockout) **dan ML pipeline asli** (enroll → embedding → Qdrant → detect, confidence 0.9999 pada test) teruji end-to-end lewat endpoint publik sungguhan. `flutter analyze` & `next build`/`tsc` bersih. Bug `uploadEvidenceFile()` (URL evidence tidak lengkap) ditemukan & diperbaiki.
- [ ] Riset awal: regulasi UU PDP untuk data wajah, opsi engine face-recognition (open-source vs vendor), ketersediaan API data DPO resmi
- [x] **v0.2.1** — [[01-Product/PRD-v2|PRD v2]] diimplementasi di backend (`apps/api`): verifikasi berlapis sebelum eskalasi, anti-spoofing gate, quality gate multi-angle, metrik akurasi per kamera, kanal sanggahan, mode simulasi webcam dev (FR-19–FR-25). Detail per-fitur & bug yang ditemukan+diperbaiki saat testing ada di [[../CHANGELOG|CHANGELOG]]. Web & mobile, serta model liveness asli di `services/detection-engine`, belum mengikuti — lihat "Known follow-ups" di CHANGELOG.
- [x] **2026-10-31** — [[03-Decisions/2026-10-31 - Perbaikan CCTV Multi-Wajah, Low-Light, dan UX Dashboard|Perbaikan CCTV multi-wajah, low-light, dan UX dashboard]]: deteksi hingga 5 wajah/frame, preprocessing low-light, root-cause timeout "CCTV stuck", persistensi MinIO, halaman Pengaturan, search global. Item kecerdasan buatan tambahan (kalibrasi akurasi + deteksi anomali) masih tahap diskusi, lihat [[04-Research/2026-10-31 - Rencana Kecerdasan Buatan Tambahan (Kalibrasi Akurasi + Deteksi Anomali)|riset terkait]].
- [x] **2026-10-31 (lanjutan)** — [[03-Decisions/2026-10-31 - Koreksi Mirror Kamera dan Live Thumbnail CCTV|Koreksi mirror kamera & live thumbnail CCTV]]: toggle mirror per-kamera, kartu `/cctv` memutar live video bukan snapshot statis. Rencana perbaikan latensi Mode Fokus sengaja baru didokumentasikan, belum dieksekusi — lihat [[04-Research/2026-10-31 - Rencana Perbaikan Latensi Mode Fokus (Belum Dikerjakan)|riset terkait]].

## 🧠 Catatan untuk Claude
Saat membantu proyek ini di sesi berikutnya, baca dulu `vault/Home.md` lalu [[PRD]] dan catatan di `03-Decisions/` sebelum mengusulkan sesuatu — supaya keputusan yang sudah diambil tidak diulang/dibantah tanpa alasan baru.
