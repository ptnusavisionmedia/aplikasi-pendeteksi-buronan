---
tags: [template, decision]
date: 2026-10-30
status: accepted
---

# Lingkup PRD v2: Anti-Salah-Identifikasi + Mode Simulasi Webcam untuk Dev

- **Tanggal:** 2026-10-30
- **Status:** accepted
- **Konteks terkait:** [[../01-Product/PRD-v2|PRD v2]], [[../01-Product/PRD|PRD v1]] FR-09, FR-14

## Konteks
PRD v1 sudah final & terimplementasi penuh. Permintaan pengembangan lanjutan: (1) perkuat akurasi deteksi agar tidak salah mengidentifikasi orang (konsekuensi serius: salah tangkap/fitnah), dan (2) sediakan cara pakai webcam laptop/USB biasa untuk uji coba development, karena tim dev belum punya akses CCTV/RTSP fisik.

## Opsi yang Dipertimbangkan
1. **Revisi langsung PRD v1** — lebih cepat, tapi menghapus jejak "v1 final & terimplementasi" dan mencampur requirement yang sudah dibangun dengan yang belum.
2. **PRD v2 sebagai dokumen baru, PRD v1 tetap arsip** — menjaga riwayat, requirement baru jelas terpisah sebagai lanjutan. *(dipilih)*
3. **Webcam sebagai sumber produksi resmi (bukan cuma dev)** — ditolak untuk saat ini karena menambah lingkup besar (perlu kebijakan privasi device pribadi, dsb.) di luar kebutuhan yang diminta.
4. **Webcam sebagai simulasi feed CCTV khusus dev/staging, terisolasi dari notifikasi/eskalasi produksi** — *(dipilih)*, karena yang dibutuhkan adalah alat uji pipeline deteksi, bukan fitur produksi baru.

## Keputusan
- Dibuat **PRD v2** (`vault/01-Product/PRD-v2.md`) sebagai dokumen terpisah dari PRD v1, berisi 2 modul baru:
  1. **Verifikasi Berlapis & Anti-Salah-Identifikasi** (FR-19–FR-23): status "menunggu konfirmasi" wajib sebelum eskalasi, liveness/anti-spoofing, quality gate multi-angle wajib saat enrollment, metrik akurasi per kamera, kanal sanggahan.
  2. **Mode Simulasi Kamera untuk Dev** (FR-24–FR-25): webcam laptop/USB didaftarkan sebagai feed simulasi hanya di environment dev/staging, hasil deteksinya **tidak pernah** memicu notifikasi/eskalasi produksi nyata, ditandai badge "DEV/TEST" di UI.
- Prinsip permanen: **human-in-the-loop wajib** untuk setiap tindakan berdampak ke orang (eskalasi ke kepolisian), tidak peduli seberapa tinggi confidence score-nya.

## Konsekuensi
- Target false-positive rate diperketat dari < 2% (v1) ke < 1% (v2), diukur per kamera, bukan agregat — ini perlu kerja tambahan di sisi monitoring/dashboard (FR-22) yang belum ada di v1.
- Eskalasi otomatis (FR-14 di v1) berubah menjadi dua tahap: notifikasi internal tetap cepat (< 10 detik), tapi eskalasi ke kepolisian wajib menunggu konfirmasi petugas (FR-19) — ini mengubah asumsi "match tinggi = langsung eskalasi" di v1, perlu penyesuaian di backend (constraint di level API, bukan cuma UI).
- Flag isolasi dev/produksi (FR-24/FR-25) menambah kebutuhan konfigurasi environment yang eksplisit di infrastruktur deploy — perlu dipastikan sebelum implementasi dimulai.
- Pekerjaan lanjutan: Tech Spec v2 (arsitektur untuk liveness check, quality gate, dan endpoint simulasi kamera) belum dibuat — ditunda sampai PRD v2 direview/disetujui lebih lanjut.
