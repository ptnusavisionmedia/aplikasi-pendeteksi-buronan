---
tags: [template, decision]
date: 2026-10-31
status: accepted
---

# Koreksi Mirror Kamera dan Live Thumbnail CCTV

- **Tanggal:** 2026-10-31
- **Status:** accepted
- **Konteks terkait:** [[2026-10-31 - Perbaikan CCTV Multi-Wajah, Low-Light, dan UX Dashboard]], [[../04-Research/2026-10-31 - Rencana Perbaikan Latensi Mode Fokus (Belum Dikerjakan)]]

## Konteks
Revisi lanjutan dari user, sore hari di hari yang sama dengan [[2026-10-31 - Perbaikan CCTV Multi-Wajah, Low-Light, dan UX Dashboard]]:
1. "Untuk kamera jangan mirror ya" — video Tapo C200 user tampil terbalik secara horizontal.
2. "Saat saya koneksi terhubung ... tolong untuk videonya tetap diputar tidak hanya berhenti agar kita bisa memonitoring tanpa mode fokus juga" — kartu kamera di `/cctv` hanya menampilkan satu snapshot statis (dari endpoint `check`), bukan video yang terus berjalan, jadi operator harus masuk Mode Fokus untuk memonitor live.
3. Keluhan terpisah soal "gagal memuat gambar" yang masih sering terjadi meski sudah di-refresh — lihat bagian Konsekuensi; ini **bukan bug kode baru**, melainkan data uji lama yang sudah tidak valid (lihat investigasi di bawah).
4. Permintaan rencana perbaikan latensi Mode Fokus — **sengaja tidak dieksekusi**, hanya didokumentasikan sebagai rencana di [[../04-Research/2026-10-31 - Rencana Perbaikan Latensi Mode Fokus (Belum Dikerjakan)]].

## Opsi yang Dipertimbangkan

### Item 1 — Kamera mirror
Investigasi awal: tidak ditemukan kode mirroring apa pun di web (CSS transform/scaleX) maupun di pipeline video (MediaMTX config, detection-engine). Artinya gambar yang terbalik berasal dari kamera itu sendiri (orientasi fisik/firmware), bukan dari aplikasi ini — konsisten dengan temuan sebelumnya bahwa kontrol kamera di proyek ini sengaja generik ONVIF, bukan API proprietary per merk (lihat [[2026-10-31 - Kontrol PTZ via ONVIF dan Deteksi Multi-Worker]]), dan ONVIF tidak punya perintah "unmirror" standar yang didukung luas lintas merk.

1. **Kirim perintah mirror lewat ONVIF Imaging service** — tidak dipilih: mirroring bukan bagian standar ONVIF Imaging yang diimplementasikan luas, risiko tinggi `ActionNotSupported` di banyak merk (pola error yang sama seperti PTZ pada kamera non-PTZ).
2. **Koreksi software di sisi dashboard (CSS mirror pada elemen video), dikontrol per-kamera** — dipilih: tidak bergantung pada dukungan firmware kamera, konsisten dengan prinsip generik lintas merk, dan operator bisa langsung mengaktifkan/menonaktifkan dari Edit Feed tanpa harus masuk ke app resmi kamera.

### Item 2 — Live monitoring tanpa Mode Fokus
1. **Perbesar interval snapshot otomatis saja** — tidak menjawab permintaan user ("tetap diputar", bukan "snapshot lebih baru").
2. **Putar video live (relay MediaMTX HLS yang sama dengan Mode Fokus) langsung di kartu CCTV** — dipilih: memakai ulang jalur HLS yang sudah ada dan teruji (lihat [[2026-10-30 - Cek Koneksi CCTV dan Live Streaming via MediaMTX]]), operator bisa memantau semua kamera dari satu halaman tanpa membuka Mode Fokus per kamera.

## Keputusan
- **Item 1:** Tambah kolom `CCTVFeed.mirror` (boolean, default `false`) + toggle di form Tambah/Edit Feed ("Video kamera ini terbalik (mirror)"). Saat aktif, **video DAN overlay bbox deteksi** di-mirror bersama dalam satu wrapper (`transform: scaleX(-1)`) di Mode Fokus maupun kartu CCTV, supaya kotak deteksi tetap presisi menempel ke wajah meski gambarnya dibalik — teks label confidence di-counter-mirror sendiri supaya tetap terbaca normal. Kontrol kamera nyata milik user (Tapo C200 - Rumah) sudah diaktifkan (`mirror: true`) dan diverifikasi langsung di browser: timestamp overlay kamera & logo "tapo" tampil terbalik seperti seharusnya (bukti koreksi aktif), bbox tetap presisi menempel wajah.
- **Item 2:** Komponen baru `<LiveFeedVideo>` (`apps/web/src/components/live-feed-video.tsx`) memutar relay HLS yang sama dengan Mode Fokus, ukuran kartu, autoplay+muted+loop, dengan state connecting/live/error. Dipasang di kartu `/cctv` untuk feed berstatus `ACTIVE` (feed `INACTIVE` tetap pakai snapshot lama dari "Cek Koneksi", karena tidak ada alasan membuka relay MediaMTX untuk kamera yang sengaja dinonaktifkan). Diverifikasi lewat network trace: request segmen HLS (`_HLS_msn`/`_HLS_part`) terus bertambah selama kartu terbuka, membuktikan video benar-benar berjalan terus-menerus, bukan satu frame statis.

## Konsekuensi
- Setiap kartu CCTV berstatus ACTIVE di halaman `/cctv` sekarang membuka relay MediaMTX-nya sendiri selama halaman itu terbuka (sama seperti Mode Fokus) — untuk satu kamera dampaknya kecil, tapi di skala 10-30 kamera (lihat [[../04-Research/2026-10-31 - Rekomendasi Optimasi Sistem Deteksi Buronan (Belum Dikerjakan)]]) ini berarti puluhan relay HLS aktif bersamaan setiap kali halaman `/cctv` dibuka, bukan hanya satu seperti sebelumnya. Relevan untuk dipertimbangkan bersamaan dengan rencana skalabilitas yang sudah ada.
- Toggle mirror murni kosmetik di sisi dashboard — tidak mengubah apa pun di kamera fisik atau di data mentah yang diproses detection-engine (bbox/embedding tetap dihitung dari frame asli, bukan frame yang sudah di-flip), jadi tidak berdampak ke akurasi deteksi.
- **Investigasi "gagal memuat gambar" yang masih terjadi:** ditelusuri sampai ke data — SEMUA `Report.fotoUrl`, satu `FotoBuronan.urlFoto`, dan satu `Evidence.fileUrl` yang ada di database saat ini menunjuk ke object MinIO yang sudah tidak ada (dibandingkan langsung dengan isi bucket `evidence`). Root cause: baris-baris ini dibuat 2026-10-29, dua hari sebelum perbaikan persistensi MinIO hari ini ([[2026-10-31 - Perbaikan CCTV Multi-Wajah, Low-Light, dan UX Dashboard]]) — filenya sudah hilang lebih dulu akibat restart container sebelum perbaikan itu ada, jadi **bukan bug baru**, dan tidak bisa diperbaiki dengan refresh karena filenya memang sudah tidak ada. Sebagian besar baris ini teridentifikasi sebagai data uji sintetis (laporan "Test 1" s.d. "Test 9" dari sesi testing endpoint sebelumnya). **Sudah dihapus** (11 laporan uji + 1 foto buronan + 1 evidence orphan) dengan persetujuan eksplisit user — diverifikasi 0 baris tersisa yang menunjuk ke file hilang.

## Lanjutan — Penyesuaian Mobile (Flutter)

User juga meminta app mobile diperiksa untuk bug dan disesuaikan dengan perubahan CCTV di atas. Survei (via subagent) menemukan: CCTV di mobile **memang sengaja read-only murni teks** (lihat [[2026-10-30 - Monitoring CCTV Read-Only di Mobile]]) — tidak ada pemutaran video/snapshot sama sekali, jadi toggle `mirror` dan live thumbnail di atas tidak relevan untuk ditambahkan ke mobile (tidak ada video untuk di-mirror). Tidak ada bug pada endpoint yang dipanggil mobile (`GET /cctv-feeds` saja, sudah sesuai). Dua perbaikan kecil diterapkan:
1. `CctvFeed.fromJson` (`apps/mobile/lib/models/cctv_feed.dart`) sebelumnya bisa melempar `TypeError`/`CastError` tak tertangani kalau field dari API null/berubah bentuk, yang muncul ke user sebagai pesan generik "Terjadi kesalahan, coba lagi." tanpa petunjuk. Diperbaiki dengan default aman per field + `FormatException` berpesan jelas, dan `apiErrorMessage()` (`apps/mobile/lib/core/api_client.dart`) sekarang mengenali `FormatException` secara khusus.
2. Komentar dokumentasi model `CctvFeed` sudah usang (tidak menyebut `sourceType`/`ptzSupported`/`onvifPort`/`mirror` yang memang sengaja dikecualikan) — diperbarui supaya jelas pengecualian field itu disengaja, bukan mobile yang tertinggal.
3. Widget baru `<RetryImage>` (`apps/mobile/lib/widgets/retry_image.dart`) — padanan Flutter dari `apps/web/src/components/retry-image.tsx` (retry dengan backoff, fallback jelas alih-alih ikon broken-image default) — dipasang menggantikan `Image.network` polos di `detection_detail_screen.dart` (satu-satunya pemakaian foto evidence jarak jauh di mobile).

`flutter analyze` bersih (0 isu) sebelum maupun sesudah perubahan.
