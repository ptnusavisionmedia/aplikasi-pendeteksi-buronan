---
tags: [guide, flutter, mobile]
---

# Panduan Install Flutter SDK (Windows)

Flutter **tidak tersedia via `winget`** secara resmi, jadi harus di-download manual dari Google. Panduan ini untuk setup SDK saja (menulis & analisa kode Dart) — build APK/jalankan emulator butuh langkah tambahan di bagian 5.

## 1. Cek rilis stabil terbaru

Google mempublikasikan manifest JSON berisi rilis terbaru per channel:

```bash
curl -s https://storage.googleapis.com/flutter_infra_release/releases/releases_windows.json -o flutter_releases.json
node -e "
const data = require('./flutter_releases.json');
const stableHash = data.current_release.stable;
const release = data.releases.find(r => r.hash === stableHash);
console.log(release.archive, release.version);
"
```

Ini akan mencetak path archive, misalnya `stable/windows/flutter_windows_3.47.8-stable.zip`.

## 2. Download & extract

```bash
curl -L "https://storage.googleapis.com/flutter_infra_release/releases/<archive-path-dari-langkah-1>" -o flutter_sdk.zip

# Extract ke lokasi tanpa spasi di path, HINDARI "Program Files" (butuh admin & bisa bermasalah dengan permission)
# contoh: C:\flutter
unzip flutter_sdk.zip -d /c/
# hasil akhir: C:\flutter\bin\flutter.bat
```

## 3. Tambahkan ke PATH

Di PowerShell (sebagai user, bukan admin — cukup PATH user-level):
```powershell
[Environment]::SetEnvironmentVariable(
  "Path",
  $env:Path + ";C:\flutter\bin",
  "User"
)
```
Lalu **buka terminal baru** agar PATH ter-reload.

## 4. Verifikasi

```bash
flutter --version
flutter doctor
```

`flutter doctor` akan menampilkan checklist — untuk sekadar menulis & `flutter analyze` kode Dart, baris "Flutter" cukup ✅. Baris Android toolchain/Chrome/Visual Studio boleh ❌ dulu (lihat bagian 5 kalau mau build sungguhan).

## 5. (Opsional) Toolchain untuk build & run APK/emulator

Menulis kode Dart dan `flutter analyze` **tidak** butuh ini. Tapi untuk benar-benar build APK atau jalankan emulator Android, tambahan ini diperlukan dan cukup berat (beberapa GB):

1. Install **Android Studio** (atau cukup **Android SDK Command-line Tools**).
2. Set `ANDROID_HOME` / `ANDROID_SDK_ROOT` ke folder SDK.
3. Jalankan `flutter doctor --android-licenses` dan terima semua lisensi.
4. Untuk run di device fisik: aktifkan USB debugging di HP, sambungkan via USB, cek `flutter devices`.
5. Untuk emulator: buat AVD lewat Android Studio (Device Manager), minimal API 33.
6. iOS hanya bisa di-build di macOS (butuh Xcode) — di luar scope Windows.

## 6. Setup project mobile di repo ini

```bash
cd apps/mobile
flutter pub get
flutter analyze
flutter run        # butuh device/emulator terhubung (lihat bagian 5)
```

Struktur & dependency (Riverpod, Dio, go_router, flutter_secure_storage) sudah didefinisikan di `apps/mobile/pubspec.yaml` — lihat [[Cara Kerja Aplikasi]] untuk peta screen & provider.
