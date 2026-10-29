# Akun Testing — Aplikasi Pendeteksi Buronan

Akun-akun ini dibuat untuk kebutuhan development/testing lokal lewat `apps/api/prisma/seed.ts`.
Semua akun sudah `isVerified: true` (langsung bisa login, tidak perlu approval admin).

Password sama untuk semua akun: **`TestPassword123!`**

| Email | Role | Nama | Wilayah/Instansi | 2FA |
|---|---|---|---|---|
| admin1@example.com | ADMIN | Admin Utama | - | Tidak |
| aparat1@example.com | APARAT | (akun lama, sudah ada sebelumnya) | - | Ya |
| aparat2@example.com | APARAT | Bripka Dwi | Jakarta Selatan / Polres Demo | Ya |
| keamanan1@example.com | KEAMANAN_SWASTA | Satpam Rian | Jakarta Selatan | Tidak |
| instansi1@example.com | INSTANSI_HUKUM | Kompol Sari | Jakarta Selatan / Polres Demo | Ya |
| masyarakat1@example.com | MASYARAKAT | Budi Santoso | - | Tidak |

## Catatan 2FA (role APARAT & INSTANSI_HUKUM)

Role `APARAT` dan `INSTANSI_HUKUM` wajib OTP (TOTP) saat login (lihat `apps/api/src/services/auth.ts`).
Secret TOTP untuk akun seed di atas:

| Email | TOTP Secret (base32) |
|---|---|
| aparat2@example.com | `GM6UAM2ZJFOAOUSH` |
| instansi1@example.com | `EYSAEA3QPNZTQDKJ` |

Cara pakai:
- **Lewat aplikasi authenticator** (Google Authenticator / Authy / dsb): tambah akun manual, masukkan secret di atas (tipe "Time based").
- **Atau generate kode OTP langsung dari terminal** (tanpa app authenticator), jalankan dari `apps/api`:
  ```bash
  npx tsx -e "import { authenticator } from 'otplib'; console.log(authenticator.generate('GM6UAM2ZJFOAOUSH'))"
  ```
  Ganti secret sesuai akun yang ingin dipakai. Kode berlaku ~30 detik.

Role `ADMIN`, `KEAMANAN_SWASTA`, dan `MASYARAKAT` tidak perlu OTP — langsung dapat token setelah `/auth/login`.

## Membuat ulang / menambah akun

Seed bersifat idempotent (pakai `upsert` by email), jadi aman dijalankan ulang:

```bash
cd apps/api
npx tsx prisma/seed.ts
```

Untuk menambah akun baru, edit array `users` di `apps/api/prisma/seed.ts`, lalu jalankan lagi perintah di atas.

## Keamanan

File ini berisi kredensial **testing/dev saja**, bukan akun produksi. Jangan pakai password/secret di atas untuk lingkungan production.
