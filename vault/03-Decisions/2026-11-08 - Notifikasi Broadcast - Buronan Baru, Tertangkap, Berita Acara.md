---
tags: [decision, notifications, backend, mobile, web]
date: 2026-11-08
status: accepted
---

# Notifikasi Broadcast — Buronan Baru, Tertangkap, Berita Acara

- **Tanggal:** 2026-11-08
- **Status:** accepted
- **Konteks terkait:** tidak ada decision record sebelumnya soal notifikasi (lihat audit di awal sesi ini) — `Notification` sebelumnya hanya dibuat oleh `jobs/notification-worker.ts` untuk satu kasus: kecocokan deteksi wajah live (`DetectionEvent`).

## Konteks
Pengguna minta notifikasi "difungsikan" untuk kejadian lain di luar deteksi wajah: admin menambah berita acara, buronan baru terdaftar, buronan tertangkap. Audit sebelum implementasi menemukan dua hal:
1. Model `Notification` di Prisma schema terikat wajib (`detectionEventId String`, bukan nullable) ke `DetectionEvent` — tidak mungkin dipakai untuk notifikasi generik tanpa migrasi skema.
2. **Bug laten** di mobile: `notifikasi_screen.dart` mem-parse `response.data as List`, padahal `GET /notifications` sudah lama mengembalikan bentuk `{items, total, page, limit, totalPages}` (lihat `lib/pagination.ts`) — artinya layar Notifikasi mobile selalu gagal (`Gagal memuat notifikasi`) sebelum perubahan ini, tidak diketahui sebelumnya karena belum pernah diuji end-to-end.

## Opsi yang Dipertimbangkan
1. **Perluas model `Notification` yang ada (field nullable baru + enum `type`), broadcast sinkron langsung dari route handler** (dipilih) — tidak perlu infrastruktur baru, konsisten dengan pola `writeAuditLog` yang sudah ada (service kecil dipanggil dari beberapa route).
2. **Model `Notification` terpisah per jenis (BuronanNotification, BeritaAcaraNotification, dst)** — ditolak: memecah query "semua notifikasi milik user" jadi harus UNION beberapa tabel, padahal GET /notifications (mobile+web) butuh satu daftar tunggal terurut waktu.
3. **Pakai BullMQ queue (seperti notification-worker.ts) untuk broadcast juga** — ditolak untuk versi ini: broadcast cuma insert DB + log, tidak ada pengiriman eksternal nyata (push provider belum terintegrasi, masih TODO di notification-worker.ts), jadi tidak ada alasan menambah latensi/kompleksitas retry queue. Kalau nanti FCM diintegrasikan sungguhan, broadcastNotification bisa dipindah ke queue yang sama.

## Keputusan
**Schema** (`apps/api/prisma/schema.prisma`, migrasi `20261108101823_add_notification_types`):
- Enum baru `NotificationType`: `DETECTION_MATCH | BURONAN_BARU | BURONAN_TERTANGKAP | BERITA_ACARA_BARU`.
- `Notification.detectionEventId` jadi nullable; tambah `type` (default `DETECTION_MATCH`, aman untuk baris lama), `title`/`body` nullable, `buronanId`/`beritaAcaraId` nullable (relasi opsional, `onDelete: SetNull` otomatis dari Prisma karena field-nya optional — jadi hapus Buronan/BeritaAcara tidak pernah gagal karena FK notifikasi, histori notifikasi tetap ada lewat title/body yang sudah disalin saat dibuat), `isRead` (default false).
- Relasi balik `notifications Notification[]` ditambahkan ke `Buronan` dan `BeritaAcara`.

**Backend**:
- `apps/api/src/services/notifications.ts` (baru): `broadcastNotification({type, title, body, buronanId?, beritaAcaraId?})` — insert `createMany` ke SEMUA user terdaftar (tidak difilter `wilayahScope`, beda dengan `notification-worker.ts` yang fan-out per wilayah CCTV feed; buronan baru/tertangkap/berita acara sifatnya nasional, bukan spesifik satu wilayah pengawasan kamera).
- Dipanggil dari: `buronan.ts` `POST /` (buronan baru), `buronan.ts` `PATCH /:id/status` (hanya saat transisi *ke* `TERTANGKAP`, dicegah kirim ulang kalau PATCH diulang dengan status yang sama), `berita-acara.ts` `POST /` dan `PATCH /:id` (hanya saat status *menjadi* `TERBIT`, bukan setiap create/update).
- `notification-worker.ts` (deteksi wajah) ikut diisi `type: "DETECTION_MATCH"` + `title`/`body` supaya konsisten dengan 3 tipe lain — klien tidak perlu tahu field mana yang "sumber kebenaran" per tipe.
- `notifications.ts` route: `GET /` kini include `buronan`/`beritaAcara` selain `detectionEvent`; tambah `GET /unread-count` (ringan, buat badge), `PATCH /:id/read`, `PATCH /read-all`. Sebelumnya tidak ada mekanisme "dibaca" sama sekali.

**Mobile**: `notifikasi_screen.dart` dirender per `type` (ikon+warna beda tiap tipe, badge titik merah kalau belum dibaca, tap langsung `PATCH .../read` lalu navigasi — ke `/buronan/:id`, `/berita-acara/:id`, atau `/detection/:id` sesuai tipe). Bel di Home (`home_screen.dart`) sekarang pakai `_NotificationBellButton` yang watch `unreadNotificationCountProvider` dan menampilkan titik merah kalau count > 0. **Juga memperbaiki bug parsing `response.data as List` di atas** (sekarang `(response.data as Map)['items']`).

**Web**: `notifikasi/page.tsx` dan `lib/types.ts` diperbarui untuk merender title/body per tipe juga, supaya tidak pecah (baris broadcast tadinya akan tampil kosong karena halaman cuma baca field-field `detectionEvent`). Link `BERITA_ACARA_BARU` diarahkan ke `/berita-acara` (list), bukan `/berita-acara/:id`, karena dashboard web tidak punya rute detail per-item (CMS-nya modal di halaman list itu sendiri).

Diuji end-to-end lewat curl (buronan baru → unread-count naik → mark-read → unread-count 0) dan di HP sungguhan (kartu notifikasi baru muncul lewat pull-to-refresh, tap mengarah ke Detail Buronan, badge merah di bel hilang setelah dibaca).

## Konsekuensi
- `broadcastNotification` mengirim ke **semua** user tanpa filter wilayah — untuk jumlah user kecil (dev/staging) ini aman, tapi kalau basis pengguna bertambah banyak, insert massal per kejadian (buronan baru/tertangkap/berita terbit) bisa jadi mahal; belum ada throttling/batching selain `createMany` satu kali jalan. Layak dipantau kalau jumlah user bertambah signifikan.
- Belum ada integrasi push provider sungguhan (FCM) di kedua jalur (deteksi maupun broadcast) — notifikasi baru benar-benar "berfungsi" sebagai daftar in-app (dengan badge unread), belum sebagai push notification yang membangunkan HP pengguna di latar belakang. Itu scope terpisah (perlu `firebase_messaging` di mobile + kredensial FCM di backend), belum ditambahkan di sini.
- `title`/`body` disalin (disalin, bukan di-generate ulang saat dibaca) saat notifikasi dibuat — kalau nama buronan/judul berita diedit setelahnya, notifikasi lama tetap menampilkan teks versi lama. Ini konsisten dengan prinsip "histori notifikasi adalah arsip, bukan live view", sama seperti audit log.
