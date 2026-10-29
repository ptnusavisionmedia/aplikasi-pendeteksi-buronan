# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Produk final (lihat Tech Spec di `.agents/2-TECH-SPEC.md` / `vault/02-Tech-Spec/Tech Spec.md`): Next.js (web) + Flutter (mobile) + Express/FastAPI (backend), PostgreSQL + Qdrant.

Folder `ui-references/` adalah sandbox eksplorasi visual yang **terpisah** dari build asli di atas — HTML/CSS/JS statis dengan library CDN (Tailwind CSS, Alpine.js, Lucide icons, Google Fonts), dipilih eksplisit oleh user khusus untuk membandingkan arah desain, bukan representasi teknis implementasi akhir.

## Users

- **Aparat Kepolisian/Reserse** (persona: Bripka Andika) — butuh deteksi real-time di lapangan, notifikasi instan dengan lokasi & waktu untuk segera bertindak.
- **Petugas Keamanan Swasta** (persona: Pak Herman, supervisor mall/stasiun) — memantau CCTV area, butuh peringatan otomatis + confidence score tanpa harus menghafal wajah buronan.
- **Instansi Hukum/Pemerintah** — mengelola data buronan (DPO) resmi, memverifikasi laporan masyarakat.
- **Masyarakat umum** — melaporkan dugaan penemuan buronan (boleh anonim), melacak status laporan via nomor tiket tanpa login.

## Product Purpose

Mendeteksi keberadaan buronan (DPO) secara real-time dengan menghubungkan jaringan CCTV ke basis data buronan resmi lewat AI face recognition, serta menyediakan kanal pelaporan masyarakat yang terverifikasi. Sukses = latensi deteksi < 3 detik/frame, notifikasi ke petugas < 10 detik, false-positive rate rendah (< 2%).

## Positioning

Mengganti proses pencocokan wajah manual (poster/foto cetak) yang lambat dan rawan human error dengan deteksi otomatis berbasis vector-image matching yang terhubung langsung ke infrastruktur CCTV yang sudah terpasang — bukan sekadar basis data buronan digital, tapi pipeline deteksi real-time + eskalasi + evidence yang defensible secara hukum (chain of custody tercatat).

## Operating Context

- Petugas memantau dashboard command-center dari kantor/pos jaga, dan menerima notifikasi lewat mobile saat bertugas di lapangan.
- Masyarakat melapor lewat app mobile, kadang langsung di lokasi kejadian dengan koneksi internet terbatas.
- Evidence/snapshot harus bisa diunduh untuk proses hukum lanjutan; semua akses & perubahan data sensitif tercatat di audit log (immutable).
- Multi-role dengan scope wilayah berbeda (RBAC) — petugas hanya melihat data di wilayah tugasnya.

## Capabilities and Constraints

- Tiga jalur deteksi — CCTV real-time, upload manual, dan laporan masyarakat — semua lewat core engine pencocokan wajah yang sama.
- Threshold confidence default 85% (dapat dikonfigurasi admin); hasil di bawah threshold dicatat sebagai log tanpa memicu notifikasi.
- 2FA (TOTP) wajib untuk role Aparat & Instansi Hukum.
- Data sensitif (identitas buronan, tindakan aparat) tidak boleh terekspos lewat endpoint publik — status laporan masyarakat hanya menampilkan status umum.
- Retensi evidence minimal 90 hari, chain of custody tercatat.

## Brand Commitments

Belum ada nama produk/brand resmi, logo, atau palet warna yang dikonfirmasi. Mockup sebelumnya memakai nama kerja sementara ("SIGAP BURONAN", "SIPANDU BURONAN", "Buronan.ai") sebagai placeholder — belum ada yang final, boleh diganti bebas di eksplorasi desain berikutnya.

## Evidence on Hand

- PRD lengkap (`.agents/1-PRD.md`, `vault/01-Product/PRD.md`) dan Tech Spec lengkap (`.agents/2-TECH-SPEC.md`, `vault/02-Tech-Spec/Tech Spec.md`) tersedia sebagai sumber kebenaran fitur, entity, dan alur.
- Tidak ada aset visual nyata (logo resmi, foto buronan asli, rekaman CCTV asli) — semua UI reference memakai data dummy/placeholder non-identifiable.

## Product Principles

1. Kecepatan & keandalan deteksi di atas estetika murni — UI harus scan-able dalam kondisi darurat/lapangan.
2. Privasi & akuntabilitas: data sensitif tersegmentasi per role, setiap aksi tercatat.
3. Kepercayaan publik: antarmuka yang menyentuh masyarakat harus terasa resmi/terpercaya, bukan abu-abu atau mencurigakan.
4. Tetap jelas dipahami pengguna non-teknis (petugas keamanan swasta, masyarakat umum), bukan hanya power-user aparat.

## Accessibility & Inclusion

Belum ada requirement aksesibilitas spesifik yang dikonfirmasi user. Rekomendasi default yang relevan dengan konteks pakai: kontras warna cukup untuk kondisi lapangan/outdoor, target tap mobile cukup besar untuk penggunaan satu tangan saat petugas sedang bertugas.
