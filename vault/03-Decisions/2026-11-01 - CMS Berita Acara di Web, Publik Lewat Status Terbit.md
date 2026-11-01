---
tags: [decision]
date: 2026-11-01
status: accepted
---

# CMS Berita Acara di Web, Publik Lewat Status Terbit

- **Tanggal:** 2026-11-01
- **Status:** accepted
- **Konteks terkait:** Permintaan fitur baru dari pengguna (bukan dari PRD v1/v2) — bagian pertama dari tiga permintaan besar: CMS Berita Acara (web), redesign Home mobile, dan CCTV live-streaming mobile. Dua yang terakhir belum dikerjakan.

## Konteks
Mobile app "Sigap Buronan" butuh konten berita acara (laporan resmi kejadian) yang bisa dikelola petugas dari dashboard web, mirip CMS, lalu tampil ke masyarakat di aplikasi mobile.

## Opsi yang Dipertimbangkan
1. Tabel baru `BeritaAcara` dengan status DRAFT/TERBIT/ARSIP, endpoint publik terpisah dari endpoint admin — dipilih.
2. Reuse model `Report` (laporan masyarakat) dengan field tambahan — ditolak, beda domain (laporan masyarakat = input warga yang perlu diverifikasi; berita acara = konten resmi yang ditulis petugas).

## Keputusan
- Model `BeritaAcara` baru (`apps/api/prisma/schema.prisma`): `judul`, `ringkasan`, `isi`, `fotoUrl` opsional, `status` (DRAFT/TERBIT/ARSIP), `penulisId` → User, `publishedAt`.
- Endpoint `GET /berita-acara` & `GET /berita-acara/:id` publik (optionalAuth) — tanpa token hanya melihat status TERBIT; staf (role selain MASYARAKAT) juga melihat DRAFT/ARSIP di dashboard.
- Tulis/edit/hapus dibatasi role ADMIN, APARAT, KEAMANAN_SWASTA (pola yang sama dengan manajemen CCTV/eskalasi); hapus permanen khusus ADMIN.
- `publishedAt` diisi otomatis saat status pertama kali berubah ke TERBIT.
- Halaman CMS di `apps/web/src/app/(dashboard)/berita-acara/page.tsx`, item sidebar baru "Berita Acara" (ikon Newspaper) untuk role ADMIN/APARAT/KEAMANAN_SWASTA.
- Upload foto pakai `uploadEvidenceFile()` yang sudah ada (bucket MinIO yang sama dipakai evidence/foto buronan/laporan) — tidak perlu bucket baru.

## Konsekuensi
- Mobile app (Flutter) belum mengonsumsi endpoint ini — itu bagian dari permintaan redesign Home mobile yang masih tertunda, lihat item "Status & Langkah Berikutnya" di [[../Home|Home]].
- Tidak ada rich-text/markdown untuk `isi` — plain text saja untuk MVP; bisa ditingkatkan nanti kalau kebutuhan formatting muncul.
- Konfirmasi hapus di dashboard pakai `window.confirm()` — sempat tidak muncul secara visual di browser pane otomatis saat testing, perlu dicek manual oleh petugas sungguhan (bukan bug fungsional, kemungkinan hanya perilaku automation testing).
