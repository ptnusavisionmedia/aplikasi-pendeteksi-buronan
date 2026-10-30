---
tags: [decision]
date: 2026-10-30
status: accepted
---

# Cek Koneksi CCTV dan Live Streaming via MediaMTX

- **Tanggal:** 2026-10-30
- **Status:** accepted
- **Konteks terkait:** [[../01-Product/PRD.md|PRD]], [[2026-10-30 - Migrasi Font Poppins dan Preset Multi-Merk CCTV]]

## Konteks
Dashboard web punya daftar feed CCTV, tapi operator tidak punya cara memverifikasi bahwa URL
RTSP yang diinput benar-benar terhubung sebelum mengandalkannya untuk deteksi — kesalahan baru
ketahuan saat capture loop gagal berulang di log backend. Operator juga tidak bisa melihat video
kamera secara langsung dari dashboard untuk verifikasi visual cepat saat ada laporan buronan.

## Opsi yang Dipertimbangkan
1. **Snapshot polling** — endpoint men-generate 1 frame JPEG setiap beberapa detik, di-poll dari
   browser. Lebih ringan, tidak butuh infrastruktur baru, tapi bukan video sungguhan (delay terasa,
   tidak cocok untuk memantau pergerakan).
2. **Live video streaming penuh via MediaMTX** — relay RTSP→HLS yang baru, browser memutar HLS
   lewat hls.js. Pengalaman mendekati CCTV sungguhan, tapi menambah satu service baru yang perlu
   dioperasikan dan di-secure.

## Keputusan
Live video streaming penuh (opsi 2), dipilih eksplisit oleh pengguna saat ditanya. Implementasi:
- `services/detection-engine` dapat endpoint `POST /internal/cctv-feeds/check` — buka stream sekali,
  baca 1 frame, balikin resolusi/fps/snapshot base64, lalu lepas koneksi. Dibatasi timeout (12s)
  supaya URL yang salah/tidak ada tidak menggantung permintaan operator.
- OpenCV di-paksa pakai RTSP over TCP (`OPENCV_FFMPEG_CAPTURE_OPTIONS=rtsp_transport;tcp`) karena
  default UDP tidak reliable lewat NAT/port-mapping di lingkungan dev ini.
- `apps/api` dapat `mediamtx-client.ts` yang mendaftarkan path `sourceOnDemand` ke MediaMTX
  (hanya menarik RTSP kamera saat ada yang benar-benar menonton, hemat bandwidth kamera) dan
  endpoint `POST /cctv-feeds/:id/live` yang mengembalikan URL HLS-nya.
- `apps/web` dapat halaman `/cctv/live/[id]` ("Mode Fokus") yang memutar HLS via hls.js, dan tombol
  "Cek Koneksi" di kartu feed yang menampilkan hasil check di atas.
- Endpoint check/live memakai `requireAuth` saja (tanpa pembatasan role) — sama dengan `GET /cctv-feeds`,
  karena semua role yang login sudah boleh melihat daftar feed.

## Konsekuensi
- Infrastruktur baru: service `mediamtx` di `infra/docker-compose.yml` + `infra/mediamtx.yml` (perlu
  `authInternalUsers` eksplisit karena default-nya menolak API call dari luar `127.0.0.1` sungguhan,
  yang rusak lewat Docker NAT).
- Latensi nyata "Cek Koneksi" ke kamera fisik ~13-16 detik (buka stream + baca frame + overhead
  jaringan) — UI menampilkan status "Mengecek..." selama itu, bukan instan.
- Live streaming hanya seefektif konektivitas jaringan ke kamera — kalau kamera tidak reachable di
  LAN (AP isolation, subnet beda, kamera offline), baik "Cek Koneksi" maupun "Mode Fokus" akan gagal
  dengan pesan error, bukan bug di fitur ini sendiri.
- Pekerjaan lanjutan yang belum dilakukan: tidak ada rate-limiting di endpoint check (operator bisa
  spam klik), dan path MediaMTX yang didaftarkan tidak pernah dibersihkan (menumpuk seiring waktu,
  meski `sourceOnDemand` membuatnya tidak menarik bandwidth saat idle).
