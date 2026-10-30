---
tags: [decision, security, auth, mobile, web]
date: 2026-10-30
status: accepted
---

# Registrasi Publik Masyarakat-Only, Akun Petugas Lewat Provisioning Operator

- **Tanggal:** 2026-10-30
- **Status:** accepted
- **Konteks terkait:** `vault/01-Product/PRD.md` FR-01 (sebelumnya "Registrasi Pengguna Instansi"), [[03-Decisions/2026-10-30 - Monitoring CCTV Read-Only di Mobile|Monitoring CCTV Read-Only di Mobile]], `apps/mobile/lib/screens/auth/register_screen.dart`, `apps/web/src/app/(auth)/register/page.tsx` (dihapus), `apps/api/src/routes/auth.ts`

## Konteks
PRD awal (FR-01) mendesain registrasi mandiri yang membiarkan pengguna memilih role saat daftar
(Masyarakat, Aparat, Keamanan Swasta, Instansi Hukum), dengan role non-Masyarakat berstatus
"pending verifikasi" sampai admin approve lewat `PATCH /admin/users/:id/role`. Form ini ada identik
di `apps/web` (dashboard) dan `apps/mobile`.

Setelah fitur monitoring CCTV read-only di mobile ditambahkan (lihat decision terkait), pengguna
menegaskan niat produk yang lebih tegas: **aplikasi mobile murni read-only/monitoring untuk
masyarakat umum**, dan **akun berwenang (petugas) hanya dibuat lewat dashboard oleh pihak yang
benar-benar berwenang** — bukan lewat formulir publik yang menunggu approval. Alur "self-register
lalu tunggu admin" dianggap celah: siapa pun bisa mengirim `role: "APARAT"` ke API publik dan
mendapat akun berstatus pending (dan cukup server trust client-sent role sebelum approval), tidak
sesuai niat bahwa akun petugas harus benar-benar diverifikasi identitasnya di luar sistem sebelum
dibuat.

## Opsi yang Dipertimbangkan
1. **Pertahankan alur self-register + approval admin** (seperti PRD awal) — ditolak pengguna; dashboard
   web seharusnya khusus petugas, bukan form publik siapa saja bisa mengisi lalu menunggu admin.
2. **Tambah fitur admin "Tambah Pengguna" di dashboard + hapus registrasi publik role privileged** —
   paling "lengkap" tapi menambah scope baru (UI admin, endpoint create-user) yang belum diminta;
   seed script yang sudah ada (`apps/api/prisma/seed.ts`, didokumentasikan di `ACCOUNT.md`) sudah
   memenuhi kebutuhan provisioning operator.
3. **Registrasi publik Masyarakat-only; akun petugas lewat seed script/insert DB langsung oleh
   operator** (dipilih) — sesuai jawaban eksplisit pengguna: mobile cukup hapus dropdown role (selalu
   Masyarakat), web cukup "hard regis" lewat script, tidak perlu UI admin baru.

## Keputusan
- **Mobile (`apps/mobile/lib/screens/auth/register_screen.dart`):** dropdown "Peran" dan field
  "Wilayah tugas" dihapus. Form registrasi sekarang hanya nama, email, password — selalu mendaftar
  sebagai `MASYARAKAT`.
- **Web (`apps/web/src/app/(auth)/register/page.tsx`):** halaman dihapus total. Dashboard web adalah
  alat kerja petugas (role-restricted di banyak endpoint), bukan permukaan pendaftaran publik. Link
  "Belum punya akun? Daftar" di halaman login diganti pesan bahwa akun dibuat operator.
- **Backend (`apps/api/src/routes/auth.ts`, `apps/api/src/services/auth.ts`):** `POST /auth/register`
  sekarang hanya menerima `{ email, password, nama }` — field `role` dari body **diabaikan sepenuhnya**
  dan `registerUser()` selalu membuat akun `MASYARAKAT` dengan `isVerified: true` langsung (tidak ada
  lagi status pending untuk siapa pun lewat endpoint ini). Ini bukan sekadar perubahan UI — endpoint
  publik sekarang menolak privilege-escalation lewat body request apa pun, diverifikasi lewat
  `curl -d '{"role":"ADMIN",...}'` yang tetap menghasilkan akun `MASYARAKAT`.
- **Akun petugas (Aparat/Keamanan Swasta/Instansi Hukum/Admin):** tidak ada endpoint publik untuk
  membuatnya. Provisioning tetap lewat `apps/api/prisma/seed.ts` (idempotent, `upsert` by email) yang
  sudah didokumentasikan di `ACCOUNT.md` — operator menjalankan skrip ini (atau insert manual ke
  database) untuk setiap akun petugas baru, menetapkan role/wilayah/instansi langsung.
- `PATCH /admin/users/:id/role` (admin-only) tetap ada untuk mengubah role/scope akun yang sudah ada
  (mis. memindahkan wilayah tugas), tapi bukan lagi bagian dari alur "approve pendaftaran" karena
  tidak ada lagi pendaftaran role privileged yang menunggu approval.

## Konsekuensi
- PRD FR-01 direvisi (lihat `vault/01-Product/PRD.md`): dipecah jadi FR-01 (registrasi publik,
  Masyarakat-only) dan FR-01b (provisioning akun petugas oleh operator, di luar alur registrasi).
- `ROLES_REQUIRING_2FA`/OTP di `apps/api/src/services/auth.ts` tidak berubah — 2FA untuk Aparat/Instansi
  Hukum tetap berlaku saat login, hanya jalur pembuatan akunnya yang berubah.
- Tidak ada lagi cara bagi masyarakat umum untuk "naik level" jadi Aparat/Keamanan Swasta/Instansi
  Hukum lewat aplikasi — ini disengaja. Jika ke depan dibutuhkan alur permohonan resmi (mis. instansi
  mengajukan akses lewat form terverifikasi dokumen), itu scope baru yang perlu decision record sendiri,
  bukan mengembalikan dropdown role ke form publik.
- Versi dinaikkan: `apps/api` & root (perubahan endpoint publik, perilaku keamanan),
  `apps/mobile` build number, `apps/web` (halaman dihapus) — lihat `CHANGELOG.md` `[Unreleased]`.
