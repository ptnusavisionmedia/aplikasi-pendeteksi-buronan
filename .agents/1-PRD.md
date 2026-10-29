# PRD: Aplikasi Pendeteksi Buronan

## Klarifikasi Awal
- **Target pengguna:** Aparat/Kepolisian, Petugas keamanan swasta, Masyarakat umum, Instansi pemerintah/lembaga hukum
- **Pain point utama:** Tidak ada deteksi real-time di lapangan
- **Keunikan:** Terhubung dengan jaringan CCTV dan deteksi berbantuan vector image / tools AI yang lebih kuat

---

## Bagian 1: Visi & Tujuan Produk

### Visi Produk
Aplikasi Pendeteksi Buronan adalah platform deteksi wajah berbasis AI yang menghubungkan jaringan CCTV publik dan swasta dengan basis data buronan (DPO) resmi, sehingga aparat kepolisian, petugas keamanan, instansi hukum, dan masyarakat dapat mengidentifikasi keberadaan buronan secara real-time dan melaporkannya melalui kanal yang cepat, aman, dan terverifikasi — menggantikan proses pencocokan manual yang lambat dengan deteksi otomatis berbasis vector image matching.

### Tujuan Utama
1. **Deteksi real-time** – Sistem dapat mencocokkan wajah dari feed CCTV/kamera dengan database buronan dalam hitungan detik. *Indikator: latensi deteksi < 3 detik per frame.*
2. **Database buronan terpusat** – Mengonsolidasikan data DPO dari Polri/instansi hukum ke satu sumber yang selalu ter-update. *Indikator: 100% data buronan aktif tersinkron, update ≤ 24 jam dari sumber resmi.*
3. **Akurasi deteksi tinggi & rendah false-positive** – Minim kesalahan identifikasi yang bisa merugikan orang tidak bersalah. *Indikator: precision ≥ 95%, false-positive rate < 2%.*
4. **Kanal pelaporan masyarakat yang terverifikasi** – Warga dapat melapor temuan buronan dengan proses verifikasi berlapis. *Indikator: ≥ 80% laporan masyarakat terverifikasi dalam 1 jam.*
5. **Notifikasi & eskalasi cepat ke petugas** – Saat match ditemukan, petugas terdekat/berwenang mendapat notifikasi otomatis. *Indikator: waktu notifikasi ke petugas < 10 detik setelah match terkonfirmasi.*

### Value Proposition
- **Deteksi otomatis, bukan manual** – AI vector-image matching menggantikan pencocokan poster/foto manual yang lambat dan rawan human error.
- **Terintegrasi dengan infrastruktur CCTV yang sudah ada** – Tidak perlu memasang kamera baru; memanfaatkan jaringan CCTV publik/swasta yang sudah terpasang.
- **Multi-stakeholder** – Satu platform melayani kebutuhan kepolisian, keamanan swasta, instansi hukum, dan partisipasi masyarakat dengan level akses berbeda.
- **Verifikasi berlapis** – Kombinasi deteksi AI + konfirmasi petugas berwenang mengurangi risiko salah tangkap/fitnah.

---

## Bagian 2: User Persona

### Persona 1: Bripka Andika (Petugas Kepolisian - Reserse)
- **Usia/Pekerjaan:** 34 tahun, Anggota Reserse Polres
- **Level Teknis:** Menengah
- **Tujuan:** Menemukan dan menangkap buronan DPO secepat mungkin, terutama yang terekam CCTV di wilayah tugasnya
- **Pain Points:** Pencocokan wajah manual dari CCTV dengan poster DPO; data antar polsek/polres tidak sinkron; kehilangan momentum akibat info terlambat
- **Motivasi:** Ingin notifikasi instan saat sistem mendeteksi kemungkinan buronan, lengkap lokasi & waktu, agar bisa langsung bertindak

### Persona 2: Pak Herman (Supervisor Keamanan Swasta - Mall/Stasiun)
- **Usia/Pekerjaan:** 41 tahun, Supervisor Keamanan
- **Level Teknis:** Pemula-menengah
- **Tujuan:** Memastikan area yang diawasi aman dari buronan tanpa harus menghafal wajah DPO
- **Pain Points:** Tidak mungkin menghafal ratusan wajah buronan; CCTV existing hanya untuk rekam, bukan deteksi; laporan manual ke polisi sering diabaikan karena kurang bukti
- **Motivasi:** Ingin peringatan real-time dengan confidence score saat kamera mendeteksi wajah cocok, agar bisa eskalasi dengan bukti kuat

---

## Bagian 3: User Stories

### Modul 1: Autentikasi & Manajemen Akun
- Sebagai pengguna (petugas/admin instansi), saya ingin mendaftar dengan akun instansi yang diverifikasi, agar hanya pihak berwenang yang bisa mengakses data sensitif.
- Sebagai pengguna, saya ingin login dengan email & password (plus 2FA untuk akun aparat/instansi), agar akun tetap aman.
- Sebagai admin, saya ingin mengatur role pengguna (Aparat, Keamanan Swasta, Instansi Hukum, Masyarakat), agar hak akses sesuai kewenangan masing-masing.
- Sebagai pengguna, saya ingin reset password, agar bisa mengakses akun jika lupa.

### Modul 2: Database Buronan (DPO)
- Sebagai admin/instansi hukum, saya ingin menambah/mengimpor data buronan (foto, identitas, status kasus) ke sistem, agar database selalu ter-update.
- Sebagai admin, saya ingin memperbarui status buronan (tertangkap/DPO/dicabut), agar sistem tidak mendeteksi buronan yang sudah tidak berstatus DPO.
- Sebagai petugas, saya ingin mencari data buronan berdasarkan nama/wilayah/kasus, agar bisa memverifikasi info dengan cepat.

### Modul 3: Deteksi Wajah Real-Time (CCTV & Media)
- Sebagai petugas keamanan, saya ingin menghubungkan feed CCTV ke sistem deteksi, agar wajah yang lewat otomatis dicocokkan dengan database buronan.
- Sebagai petugas, saya ingin mengunggah foto/video untuk dicek kecocokannya dengan database buronan, agar bisa memverifikasi kecurigaan secara manual.
- Sebagai petugas, saya ingin melihat tingkat keyakinan (confidence score) dari setiap hasil deteksi, agar bisa menilai keandalan match sebelum bertindak.
- Sebagai petugas, saya ingin sistem menyimpan cuplikan/snapshot saat match ditemukan, agar ada bukti visual untuk proses hukum lanjutan.

### Modul 4: Notifikasi & Eskalasi
- Sebagai petugas kepolisian, saya ingin menerima notifikasi real-time saat ada match di wilayah tugas saya, agar bisa segera bertindak.
- Sebagai petugas keamanan swasta, saya ingin meneskalasi hasil deteksi ke kepolisian setempat langsung dari aplikasi, agar proses penanganan lebih cepat.
- Sebagai admin instansi, saya ingin melihat dashboard riwayat deteksi & eskalasi, agar bisa memantau efektivitas sistem di wilayahnya.

### Modul 5: Pelaporan Masyarakat
- Sebagai masyarakat umum, saya ingin melaporkan dugaan penemuan buronan (foto + lokasi), agar informasi bisa segera diverifikasi pihak berwenang.
- Sebagai petugas, saya ingin memverifikasi laporan masyarakat sebelum ditindaklanjuti, agar tidak terjadi kesalahan identifikasi/fitnah.
- Sebagai masyarakat, saya ingin melihat status laporan yang saya kirim, agar tahu apakah laporan saya sudah ditindaklanjuti.

*(Total 15 user stories, tersebar di 5 modul)*

---

## Bagian 4: Functional Requirements

### Modul 1: Autentikasi & Manajemen Akun

**FR-01: Registrasi Pengguna Instansi**
- **Input:** Email instansi, password, nama, jenis instansi (Polri/Keamanan Swasta/Lembaga Hukum), dokumen verifikasi (opsional)
- **Proses:** Validasi email unik & domain instansi (jika ada), hash password, status akun "pending verifikasi" untuk role non-masyarakat
- **Output:** Akun terdaftar, email verifikasi terkirim, notifikasi ke admin untuk approval role aparat/instansi
- **Aturan:** Password minimal 8 karakter; akun Aparat/Instansi Hukum wajib approval admin sebelum aktif; akun Masyarakat aktif langsung setelah verifikasi email

**FR-02: Login & Autentikasi**
- **Input:** Email, password, kode OTP (untuk role Aparat/Instansi)
- **Proses:** Verifikasi kredensial, 2FA untuk role sensitif, generate JWT token
- **Output:** Token akses, redirect ke dashboard sesuai role
- **Aturan:** 5x gagal login = blokir 15 menit; token expired 24 jam

**FR-03: Manajemen Role & Hak Akses**
- **Input:** User ID, role target, scope wilayah/instansi
- **Proses:** Admin menetapkan/mengubah role dan scope akses data (mis. petugas hanya lihat wilayah tugasnya)
- **Output:** Hak akses pengguna diperbarui
- **Aturan:** Hanya admin instansi/superadmin yang bisa mengubah role; semua perubahan role tercatat di audit log

**FR-04: Reset Password**
- **Input:** Email terdaftar
- **Proses:** Kirim link/token reset yang berlaku sementara
- **Output:** Password berhasil diganti
- **Aturan:** Link reset berlaku 15 menit, sekali pakai

### Modul 2: Database Buronan (DPO)

**FR-05: Tambah/Impor Data Buronan**
- **Input:** Foto wajah (≥1, idealnya multi-angle), identitas (nama, NIK jika ada), nomor kasus, tingkat ancaman, instansi penerbit
- **Proses:** Ekstraksi vector embedding wajah dari foto, validasi kelengkapan data, simpan ke database buronan
- **Output:** Data buronan tersimpan dan siap dipakai untuk pencocokan
- **Aturan:** Hanya role Instansi Hukum/Admin yang bisa menambah; wajib minimal 1 foto wajah dengan kualitas memadai (resolusi minimum, wajah frontal)

**FR-06: Update Status Buronan**
- **Input:** ID buronan, status baru (DPO aktif/tertangkap/DPO dicabut)
- **Proses:** Update status, nonaktifkan dari indeks pencocokan jika bukan DPO aktif
- **Output:** Status buronan terbarui di seluruh sistem
- **Aturan:** Perubahan status wajib disertai alasan & tercatat di audit log

**FR-07: Pencarian Data Buronan**
- **Input:** Kata kunci (nama/wilayah/nomor kasus) atau foto untuk pencarian visual
- **Proses:** Query database berdasarkan metadata atau vector similarity search jika input foto
- **Output:** Daftar data buronan yang relevan, diurutkan berdasarkan kecocokan
- **Aturan:** Hasil pencarian dibatasi sesuai scope akses pengguna

### Modul 3: Deteksi Wajah Real-Time (CCTV & Media)

**FR-08: Integrasi Feed CCTV**
- **Input:** URL/stream RTSP kamera, kredensial akses, lokasi kamera
- **Proses:** Koneksi ke stream, ekstraksi frame secara periodik untuk diproses deteksi wajah
- **Output:** Feed CCTV terdaftar dan aktif dipantau sistem
- **Aturan:** Hanya kamera yang sudah terdaftar & diverifikasi pemiliknya yang bisa diintegrasikan; data stream tidak disimpan permanen kecuali saat match ditemukan (lihat FR-12)

**FR-09: Deteksi & Pencocokan Wajah (Core Engine)**
- **Input:** Frame gambar dari CCTV/upload, database vector embedding buronan
- **Proses:** Deteksi wajah pada frame, ekstraksi vector embedding, hitung similarity terhadap database buronan menggunakan vector search (mis. cosine similarity/ANN index)
- **Output:** Daftar kandidat match dengan confidence score
- **Aturan:** Hanya match dengan confidence ≥ threshold (default 85%, dapat dikonfigurasi admin) yang memicu notifikasi; di bawah threshold disimpan sebagai low-confidence log saja

**FR-10: Pemeriksaan Manual via Upload**
- **Input:** Foto/video yang diunggah petugas
- **Proses:** Jalankan proses deteksi & pencocokan yang sama seperti FR-09 terhadap file yang diunggah
- **Output:** Hasil kecocokan beserta confidence score
- **Aturan:** Ukuran file maksimum sesuai kuota (mis. 50MB per file); hanya format gambar/video umum yang didukung

**FR-11: Tampilan Confidence Score & Detail Match**
- **Input:** Hasil deteksi dari FR-09/FR-10
- **Proses:** Render hasil match dengan skor kepercayaan, foto pembanding, dan metadata buronan
- **Output:** Tampilan detail match untuk ditinjau petugas
- **Aturan:** Skor ditampilkan dalam persentase dengan indikator warna (tinggi/sedang/rendah)

**FR-12: Penyimpanan Bukti (Snapshot/Evidence)**
- **Input:** Frame/snapshot saat match ditemukan, metadata (waktu, lokasi kamera)
- **Proses:** Simpan snapshot beserta metadata sebagai bukti, enkripsi penyimpanan
- **Output:** Evidence record tersimpan dan dapat diunduh untuk proses hukum
- **Aturan:** Evidence disimpan minimal sesuai masa retensi hukum (mis. 90 hari) dan hanya dapat diakses role berwenang; chain of custody tercatat

### Modul 4: Notifikasi & Eskalasi

**FR-13: Notifikasi Real-Time ke Petugas**
- **Input:** Hasil match dari FR-09, data wilayah tugas petugas
- **Proses:** Kirim push notification/SMS/email ke petugas yang scope wilayahnya sesuai lokasi kamera
- **Output:** Notifikasi terkirim dengan detail match & link ke evidence
- **Aturan:** Notifikasi terkirim < 10 detik setelah match terkonfirmasi; retry otomatis jika gagal kirim

**FR-14: Eskalasi ke Kepolisian**
- **Input:** ID match/evidence, catatan petugas pelapor
- **Proses:** Kirim permintaan eskalasi ke instansi kepolisian terdekat berdasarkan lokasi, sertakan evidence
- **Output:** Tiket eskalasi dibuat dan diteruskan ke kepolisian terkait
- **Aturan:** Eskalasi hanya bisa dilakukan oleh role terverifikasi (petugas keamanan/aparat); setiap eskalasi wajib memiliki evidence terlampir

**FR-15: Dashboard Riwayat Deteksi & Eskalasi**
- **Input:** Filter periode, wilayah, status
- **Proses:** Agregasi data deteksi, eskalasi, dan tindak lanjut
- **Output:** Dashboard statistik & daftar riwayat yang dapat difilter/diekspor
- **Aturan:** Data yang ditampilkan dibatasi sesuai scope akses role

### Modul 5: Pelaporan Masyarakat

**FR-16: Submit Laporan Masyarakat**
- **Input:** Foto/screenshot dugaan buronan, lokasi, deskripsi singkat, kontak pelapor
- **Proses:** Jalankan pencocokan otomatis (FR-09) terhadap foto laporan, buat tiket laporan berstatus "menunggu verifikasi"
- **Output:** Laporan tersimpan, nomor tiket diberikan ke pelapor
- **Aturan:** Identitas pelapor dapat dirahasiakan (anonim opsional) kecuali diminta proses hukum; laporan spam/tanpa foto ditolak otomatis

**FR-17: Verifikasi Laporan oleh Petugas**
- **Input:** ID laporan, hasil pencocokan otomatis, penilaian petugas
- **Proses:** Petugas meninjau laporan & hasil match, memutuskan status (valid/tidak valid/butuh investigasi lanjutan)
- **Output:** Status laporan terbarui, notifikasi ke pelapor jika dikonfigurasi
- **Aturan:** Laporan harus diverifikasi dalam SLA tertentu (target ≤ 1 jam untuk match confidence tinggi)

**FR-18: Status Tracking Laporan**
- **Input:** Nomor tiket laporan
- **Proses:** Ambil status terbaru laporan dari sistem
- **Output:** Status laporan ditampilkan ke pelapor (diterima/diverifikasi/ditindaklanjuti/ditutup)
- **Aturan:** Detail sensitif (identitas buronan, tindakan aparat) tidak ditampilkan ke pelapor, hanya status umum

*(Total 18 FR, tersebar di 5 modul)*

---

## Bagian 5: Non-Functional Requirements

### Performa
- Deteksi & pencocokan wajah per frame < 3 detik (end-to-end, dari capture hingga hasil match)
- API response (non-deteksi) < 500ms
- Mendukung minimal 500 feed CCTV aktif secara paralel per instansi/region
- Notifikasi real-time terkirim < 10 detik setelah match terkonfirmasi

### Keamanan
- Password di-hash (bcrypt/argon2); 2FA wajib untuk role Aparat & Instansi Hukum
- HTTPS wajib untuk semua komunikasi; stream CCTV via koneksi terenkripsi (SRTP/TLS)
- JWT token expiry 24 jam, refresh token dengan rotasi
- Role-based access control (RBAC) dengan scope wilayah/instansi
- Audit log untuk semua akses data buronan, perubahan status, dan eskalasi (tidak dapat dihapus/immutable)
- Data wajah & evidence dienkripsi saat disimpan (encryption at rest) dan sesuai regulasi perlindungan data pribadi (UU PDP)
- Rate limiting pada endpoint pencocokan untuk mencegah abuse

### Skalabilitas
- Target awal: 100 instansi, 2.000 feed CCTV, 10.000 pengguna aktif
- Arsitektur mendukung scale horizontal untuk engine deteksi (face recognition service) secara independen dari layanan lain
- Vector database/index pencarian wajah siap untuk sharding saat jumlah data buronan bertambah (ratusan ribu entri)
- Message queue/event-driven untuk notifikasi agar tidak membottleneck proses deteksi

### Reliabilitas & Observability
- Uptime target 99.5% untuk layanan inti (deteksi, notifikasi)
- Monitoring kesehatan feed CCTV (alert jika kamera offline/stream terputus)
- Mekanisme fallback/retry jika engine deteksi gagal memproses frame

### Usability
- Responsive (mobile untuk petugas lapangan & masyarakat, desktop/dashboard untuk admin/instansi)
- Bahasa Indonesia sebagai bahasa utama
- Mode low-bandwidth untuk area dengan koneksi internet terbatas (khusus pelaporan masyarakat)
- Antarmuka hasil deteksi mudah dipahami non-teknis (confidence score visual, bukan angka teknis mentah)

---

## Bagian 6: Out of Scope & Dependensi

### Out of Scope (Tidak Dikerjakan di V1)
- **Deteksi wajah tertutup/menyamar** (masker, helm, wajah terhalang) — akurasi engine untuk kasus ini rendah, ditunda ke v2 dengan model khusus.
- **Case management penuh** — v1 hanya menyediakan notifikasi, evidence, dan eskalasi; manajemen kasus investigasi lengkap (penugasan tim, berkas perkara) ditunda ke v2.
- **Integrasi lintas negara/Interpol** — pencocokan dengan basis data buronan internasional ditunda ke v2.
- **Analitik prediktif pola pergerakan buronan** (mis. prediksi lokasi berikutnya berdasarkan riwayat deteksi) — fitur v2.
- **Aplikasi mobile native khusus** — v1 cukup web responsive; aplikasi mobile native (push notification lanjutan, mode offline) ditunda ke v2.
- **Integrasi otomatis seluruh jaringan CCTV nasional** — v1 dimulai dengan pilot di wilayah/instansi terbatas, bukan rollout nasional sekaligus.

### Dependensi
- **Face recognition engine** (mis. InsightFace, AWS Rekognition, atau Azure Face API) — untuk ekstraksi vector embedding & deteksi wajah (FR-09).
- **Vector database** (mis. Milvus, pgvector, atau Pinecone) — untuk similarity search terhadap database buronan.
- **Data DPO resmi** dari Polri/Kejaksaan/instansi hukum (API atau feed data terverifikasi) — dependensi eksternal kritis.
- **Infrastruktur CCTV existing** yang mendukung protokol RTSP/ONVIF di sisi klien (mall, stasiun, instansi).
- **Push notification & SMS gateway** (mis. FCM, Twilio) — untuk notifikasi real-time (FR-13).
- **Object storage terenkripsi** (mis. S3-compatible) — untuk penyimpanan evidence/snapshot (FR-12).
- **Message queue/event streaming** (mis. Kafka, RabbitMQ) — untuk arsitektur event-driven notifikasi agar tidak membottleneck deteksi.
- **Hosting dengan data residency Indonesia** — mengingat sensitivitas data wajah & regulasi UU PDP.

### Asumsi
- Instansi (Polri/Kejaksaan) bersedia menyediakan akses data DPO resmi secara terverifikasi.
- Pemilik CCTV (mall, stasiun, instansi swasta) bersedia mengintegrasikan feed mereka dan menyetujui ketentuan privasi/penggunaan data.
- Lokasi pemasangan kamera memiliki koneksi internet yang stabil untuk streaming real-time.
- Penggunaan pengenalan wajah untuk tujuan keamanan publik ini sejalan dengan regulasi yang berlaku (perlu kajian hukum lebih lanjut).
- Data buronan yang diproses adalah data resmi yang sudah dipublikasikan pihak berwenang, bukan data pribadi yang diperoleh secara tidak sah.
