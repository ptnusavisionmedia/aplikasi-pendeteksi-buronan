---
tags: [prd, product, v2]
status: partially-implemented
bagian-selesai: 6/6
supersedes: "[[PRD]] (v1, final — tetap berlaku, v2 ini tambahan/penyempurnaan, bukan pengganti)"
---

# PRD v2: Penyempurnaan Akurasi & Anti-Salah-Identifikasi + Mode Dev Webcam

> [[../Home|⬅ Kembali ke Home]] · Status: **Backend (apps/api) terimplementasi, v0.2.1.** Web & mobile belum mengikuti. Lihat [[../../CHANGELOG|CHANGELOG]] untuk detail per-FR dan follow-up yang tersisa.

## Latar Belakang
V1 sudah berjalan end-to-end (backend, web, mobile) dengan target precision ≥ 95% / false-positive rate < 2% (lihat [[PRD#Bagian 1 Visi & Tujuan Produk|PRD v1 §1]]). Dua kebutuhan baru mendorong PRD v2 ini:

1. **Risiko salah identifikasi punya konsekuensi serius** (salah tangkap, fitnah terhadap orang yang wajahnya mirip buronan). V1 sudah punya threshold confidence (FR-09) dan verifikasi petugas untuk laporan masyarakat (FR-17), tapi **belum ada lapis verifikasi wajib untuk match dari CCTV/upload sebelum eskalasi ke kepolisian**, belum ada mekanisme anti-spoofing, dan belum ada kanal sanggahan bagi orang yang salah terdeteksi.
2. **Kebutuhan development/testing tanpa akses CCTV fisik** — tim dev perlu cara memvalidasi pipeline deteksi menggunakan webcam laptop biasa, sebagai simulasi feed CCTV, tanpa menyentuh data/alur produksi (sesuai keputusan: webcam = alat simulasi dev, bukan sumber produksi — lihat [[../03-Decisions/2026-10-30 - Lingkup PRD v2 Akurasi dan Webcam Dev|Decision Record]]).

Tidak ada keputusan v1 yang dibantah di sini — ini murni penambahan lapis keamanan akurasi dan tooling dev.

---

## Bagian 1: Tujuan & Prinsip Tambahan

### Tujuan Utama v2
1. **Zero unverified action** – Tidak ada eskalasi ke kepolisian/tindakan lapangan yang terjadi tanpa konfirmasi manusia, berapa pun confidence score-nya. *Indikator: 100% eskalasi punya log konfirmasi petugas sebelum terkirim ke instansi.*
2. **Turunkan risiko salah orang** – Tambah lapis anti-spoofing, kualitas enrollment, dan pelacakan akurasi per sumber kamera. *Indikator: false-positive rate < 1% (naik dari target v1 < 2%), 0 insiden eskalasi tanpa foto evidence yang valid.*
3. **Ada jalur koreksi** – Orang yang salah terdeteksi/dilaporkan punya cara mengajukan sanggahan dan datanya dibersihkan dari sistem. *Indikator: SLA respon sanggahan ≤ 48 jam.*
4. **Dev bisa test tanpa CCTV asli** – Engineer bisa memverifikasi pipeline deteksi end-to-end pakai webcam laptop/USB biasa, terisolasi penuh dari data & notifikasi produksi. *Indikator: deteksi via webcam dev berjalan, 0 notifikasi/eskalasi nyata terkirim ke instansi dari sumber dev.*

### Prinsip Desain
- **Human-in-the-loop wajib** untuk setiap tindakan yang berdampak ke orang (eskalasi, notifikasi ke kepolisian) — AI hanya mengusulkan, manusia yang memutuskan.
- **Dev/test terisolasi dari produksi** — tidak ada jalur di mana data simulasi webcam bisa memicu notifikasi/eskalasi nyata ke instansi.
- **Akurasi diukur terus-menerus, bukan sekali saat launch** — setiap sumber kamera & setiap batch deteksi punya metrik akurasi yang dipantau.

---

## Bagian 2: User Stories Tambahan

### Modul 6: Verifikasi Berlapis & Anti-Salah-Identifikasi
- Sebagai petugas, saya ingin setiap match dari CCTV/upload masuk status "menunggu konfirmasi" dulu sebelum eskalasi terkirim, agar tidak ada laporan ke kepolisian berdasarkan match yang belum ditinjau manusia.
- Sebagai petugas, saya ingin sistem menolak otomatis frame yang terindikasi foto-dari-foto/video palsu (anti-spoofing), agar deteksi tidak mudah dipicu dengan menyodorkan foto ke kamera.
- Sebagai admin instansi hukum, saya ingin sistem menolak pendaftaran buronan baru jika foto tidak memenuhi syarat kualitas/multi-angle minimum, agar basis pencocokan tidak lemah dari awal.
- Sebagai admin, saya ingin melihat tingkat akurasi (match benar vs ditolak petugas) per kamera/sumber, agar bisa menonaktifkan kamera yang sering menghasilkan false-positive.
- Sebagai orang yang merasa salah terdeteksi/dilaporkan, saya ingin mengajukan sanggahan dengan bukti identitas, agar data saya ditinjau dan dibersihkan dari sistem jika memang salah.

### Modul 7: Mode Simulasi Kamera untuk Development
- Sebagai developer, saya ingin mendaftarkan webcam laptop/USB sebagai "kamera simulasi" di environment dev/staging, agar bisa menguji pipeline deteksi tanpa akses ke CCTV/RTSP asli.
- Sebagai developer, saya ingin kamera simulasi ditandai jelas (badge "DEV/TEST") di seluruh UI dan tidak pernah memicu notifikasi/eskalasi nyata ke instansi, agar tidak ada risiko data uji coba bocor ke alur produksi.
- Sebagai developer, saya ingin melihat hasil deteksi (bounding box, confidence score) secara langsung dari feed webcam di browser, agar iterasi development cepat tanpa perlu infra CCTV.

*(Total 8 user stories tambahan, 2 modul baru)*

---

## Bagian 3: Functional Requirements Tambahan

### Modul 6: Verifikasi Berlapis & Anti-Salah-Identifikasi

**FR-19: Status "Menunggu Konfirmasi" untuk Semua Match CCTV/Upload**
- **Input:** Hasil match dari FR-09/FR-10 (confidence ≥ threshold)
- **Proses:** Match tidak langsung memicu FR-14 (Eskalasi); masuk dulu ke antrean "menunggu konfirmasi petugas" dengan evidence (FR-12) terlampir. Petugas meninjau dan memilih: konfirmasi (lanjut ke eskalasi) / tolak (false-positive, dicatat) / butuh info tambahan.
- **Output:** Match berstatus confirmed/rejected/pending; hanya status confirmed yang bisa memicu FR-14.
- **Aturan:** Notifikasi ke petugas (FR-13) tetap terkirim < 10 detik agar petugas bisa segera menilai — yang berubah hanya **eskalasi ke kepolisian wajib menunggu konfirmasi**, bukan notifikasi internal. Match confidence sangat tinggi (≥ threshold kedua yang lebih ketat, mis. 97%) tetap masuk antrean ini, tidak ada jalur bypass otomatis.

**FR-20: Deteksi Anti-Spoofing (Liveness Check)**
- **Input:** Frame/video dari CCTV, upload, atau kamera simulasi
- **Proses:** Jalankan pemeriksaan liveness (tekstur, kedalaman/depth cue bila tersedia, deteksi pola foto cetak/layar) sebelum frame diteruskan ke FR-09
- **Output:** Flag `is_live: true/false` pada setiap frame; frame dengan `is_live: false` tidak diproses ke pencocokan, dicatat sebagai percobaan spoofing untuk audit
- **Aturan:** Berlaku untuk semua sumber input (CCTV, upload, webcam dev) kecuali upload foto dokumen resmi yang memang berupa foto statis (mis. foto KTP buronan saat enrollment FR-05, bukan upload FR-10)

**FR-21: Quality Gate & Multi-Angle Wajib saat Enrollment Buronan**
- **Input:** Foto wajah yang diunggah saat FR-05
- **Proses:** Validasi otomatis: resolusi minimum, wajah frontal terdeteksi jelas, minimal 2 foto dari angle berbeda (frontal + 3/4), skor blur/kecerahan dalam ambang layak
- **Output:** Foto yang tidak lolos quality gate ditolak dengan pesan spesifik (mis. "wajah tidak frontal", "resolusi kurang"); hanya foto lolos yang dipakai untuk vector embedding
- **Aturan:** Minimal 2 foto berbeda angle wajib (bukan opsional seperti v1); embedding dihitung dari rata-rata/centroid multi-foto untuk mengurangi false-match akibat variasi pose tunggal

**FR-22: Metrik Akurasi per Sumber Kamera**
- **Input:** Riwayat keputusan konfirmasi/tolak dari FR-19 per kamera/sumber
- **Proses:** Hitung precision/false-positive rate berjalan per kamera (rolling window, mis. 30 hari), bandingkan dengan threshold minimum
- **Output:** Dashboard akurasi per kamera; kamera yang persistently di bawah threshold ditandai untuk ditinjau/dinonaktifkan sementara dari pencocokan otomatis
- **Aturan:** Admin menerima alert jika satu kamera melewati batas false-positive rate (mis. > 10% dalam 30 hari)

**FR-23: Kanal Sanggahan (Appeal) bagi Pihak yang Salah Terdeteksi**
- **Input:** Nomor tiket match/laporan terkait, bukti identitas pihak yang mengajukan sanggahan, deskripsi
- **Proses:** Petugas/admin berwenang meninjau sanggahan secara manual, menandai match/laporan terkait sebagai "dibatalkan - identitas salah" jika valid, menjaga jejak audit
- **Output:** Status sanggahan (diterima/ditolak/dalam proses); jika diterima, evidence terkait ditandai tidak valid (tidak dihapus, agar jejak audit tetap ada) dan tidak dapat dipakai lagi sebagai dasar tindakan
- **Aturan:** SLA respon awal ≤ 48 jam; sanggahan yang diterima wajib dicatat di audit log immutable dan memicu peninjauan ulang akurasi kamera terkait (lihat FR-22)

### Modul 7: Mode Simulasi Kamera (Dev/Testing)

**FR-24: Registrasi Kamera Simulasi (Webcam Laptop/USB)**
- **Input:** Pilihan device kamera lokal (via `getUserMedia` di browser, atau util lokal untuk testing non-browser), label kamera, environment target (hanya dev/staging)
- **Proses:** Browser/aplikasi dev meminta izin akses webcam, mendaftarkan sesi sebagai "feed simulasi" di sisi backend dengan flag `source_type: "dev_simulation"`, mengirim frame secara periodik ke endpoint deteksi yang sama dengan FR-09
- **Output:** Feed simulasi aktif, bounding box & confidence score hasil deteksi ditampilkan langsung di UI dev
- **Aturan:** **Hanya aktif jika environment = dev/staging** (dicek di backend, bukan hanya di UI); di environment production, endpoint registrasi feed simulasi dinonaktifkan total

**FR-25: Isolasi Penuh Feed Simulasi dari Notifikasi & Eskalasi Produksi**
- **Input:** Hasil deteksi dari feed berlabel `source_type: "dev_simulation"`
- **Proses:** Hasil match dari sumber ini tidak pernah memicu FR-13 (notifikasi ke petugas sungguhan) maupun FR-14 (eskalasi ke kepolisian); hanya ditampilkan di UI dev dan disimpan di tabel/skema terpisah dari evidence produksi
- **Output:** Match dari feed simulasi tidak muncul di dashboard produksi (FR-15), tidak dihitung dalam metrik akurasi produksi (FR-22)
- **Aturan:** Setiap tampilan UI yang menunjukkan hasil dari feed simulasi wajib menampilkan badge "DEV/TEST" yang jelas; percobaan menghapus/menyamarkan badge ini dianggap bug kritis

*(Total 7 FR tambahan, 2 modul baru — FR-19 s.d. FR-25)*

---

## Bagian 4: Non-Functional Requirements Tambahan

### Akurasi & Keamanan Identifikasi
- False-positive rate target diperketat: < 1% (dari < 2% di v1), diukur per kamera (FR-22) bukan cuma agregat sistem
- Tidak ada jalur teknis yang memungkinkan eskalasi (FR-14) terkirim tanpa status `confirmed` dari FR-19 — ini harus dijamin di level API (bukan cuma UI), supaya tidak bisa dilewati lewat panggilan API langsung
- Liveness check (FR-20) wajib lolos sebelum frame apa pun (CCTV/upload/dev) masuk ke engine pencocokan FR-09
- Audit trail sanggahan (FR-23) immutable, dapat diaudit eksternal (mis. untuk kebutuhan hukum jika ada gugatan salah tangkap)

### Isolasi Dev/Test
- Flag `source_type: "dev_simulation"` diset di backend berdasarkan environment config, tidak bisa dipalsukan dari client
- Endpoint registrasi feed simulasi (FR-24) mengembalikan error eksplisit jika dipanggil di environment production
- Data dari feed simulasi punya retensi pendek (mis. dihapus otomatis setelah 7 hari) karena hanya untuk keperluan dev, tidak untuk bukti hukum

### Usability
- Dashboard akurasi per kamera (FR-22) menampilkan tren dalam grafik sederhana, bukan tabel angka mentah, agar admin non-teknis (persona Pak Herman) bisa memahami kamera mana yang perlu ditinjau
- UI dev webcam (FR-24) minim setup — cukup buka halaman dev, izinkan akses kamera di browser, langsung lihat hasil deteksi real-time, tanpa perlu konfigurasi RTSP

---

## Bagian 5: Out of Scope v2 & Dependensi Tambahan

### Out of Scope (Tetap Ditunda)
- Semua item out-of-scope v1 tetap berlaku (deteksi wajah tertutup, case management penuh, integrasi Interpol, analitik prediktif, mobile native lanjutan, rollout CCTV nasional) — lihat [[PRD#Bagian 6 Out of Scope dan Dependensi|PRD v1 §6]].
- **Otomatisasi penuh tanpa manusia** — prinsip human-in-the-loop di PRD v2 ini bersifat permanen, bukan batasan sementara; tidak direncanakan dihilangkan di versi mana pun.
- **Liveness/anti-spoofing berbasis hardware khusus** (kamera depth/infrared) — v2 hanya pakai liveness berbasis software/RGB biasa, agar tetap kompatibel dengan CCTV & webcam standar yang sudah terpasang.

### Dependensi Tambahan
- **Library/model anti-spoofing** (mis. berbasis texture analysis atau model liveness open-source) untuk FR-20.
- **Browser `getUserMedia` API** untuk mode simulasi kamera (FR-24) — hanya didukung di browser modern dengan HTTPS (atau localhost untuk dev).
- **Konfigurasi environment yang jelas** (dev/staging/production) di infrastruktur deploy, agar flag isolasi FR-24/FR-25 bisa diandalkan.

---
*Lihat [[../Home|Home]] untuk peta konten proyek lainnya. Lihat [[PRD|PRD v1]] untuk requirement dasar yang sudah terimplementasi.*
