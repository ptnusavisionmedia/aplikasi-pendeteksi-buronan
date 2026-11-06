# EcoSense Station — Wokwi Simulation

Versi simulasi dari proyek EcoSense Station (reservoir water & air quality
monitoring) untuk dijalankan di [Wokwi](https://wokwi.com/). Wokwi tidak
memiliki part JSN-SR04T, PH-4502C, SEN0189, maupun YF-S201, jadi diagram ini
memakai pengganti dengan pin dan rangkaian setara (sesuai praktik yang sama
dipakai di proyek Cirkit Designer aslinya).

## Cara pakai

1. Buka [wokwi.com/projects/new/esp32](https://wokwi.com/projects/new/esp32),
   atau pakai [Wokwi for VS Code](https://marketplace.visualstudio.com/items?itemName=wokwi.wokwi-vscode)
   di folder ini.
2. Install library Arduino yang ada di `libraries.txt` (DHT sensor library,
   Adafruit Unified Sensor, LiquidCrystal_I2C).
3. Replace isi `diagram.json` dan `sketch.ino` project Wokwi dengan file di
   folder ini (atau buka langsung lewat Wokwi for VS Code).
4. Compile `sketch.ino` untuk board ESP32 Dev Module / `esp32:esp32:esp32`,
   lalu jalankan simulasi.

## Pemetaan pin (sama dengan sketch asli)

| Fungsi | GPIO | Keterangan di simulasi |
| --- | --- | --- |
| TRIG ultrasonic | GPIO5 | `us1` (HC-SR04, pengganti JSN-SR04T) |
| ECHO ultrasonic | GPIO18 | lewat pembagi 10k/10k (`r_echo_series`, `r_echo_gnd`) |
| PH PO | GPIO34 | `pot_ph` (potentiometer, pengganti PH-4502C) lewat pembagi 10k/10k |
| Turbidity OUT | GPIO35 | `pot_turb` (potentiometer, pengganti SEN0189) lewat pembagi 10k/10k |
| Flow signal | GPIO27 | `btn_flow` (pushbutton, tiap klik = 1 pulsa flow), pull-up 10k ke 3,3V |
| DHT22 DATA | GPIO4 | `dht1`, pull-up 10k ke 3,3V |
| LCD SDA/SCL | GPIO21/22 | `lcd1` (LCD1602 I2C, alamat 0x27) |
| Buzzer | GPIO19 | `buzzer1`, digerakkan langsung dari GPIO (lihat catatan buzzer di bawah) |
| LED peringatan | GPIO23 | `r_led` (220Ω) + `led1` |

## Perbedaan dengan rancangan fisik

- **Sensor pengganti bukan model perilaku yang tervalidasi.** HC-SR04 di Wokwi
  hanya mensimulasikan protokol TRIG/ECHO yang identik dengan JSN-SR04T, bukan
  karakteristik akustik modul aslinya. Potentiometer hanya menghasilkan
  tegangan analog yang bisa diputar manual untuk menguji logika pembacaan
  pH/turbidity — bukan simulasi reaksi kimia/optik sensor sungguhan.
- **Flow sensor disimulasikan lewat pushbutton**: setiap klik tombol dihitung
  sebagai satu pulsa (interrupt `FALLING` di GPIO27), sama seperti pulsa
  YF-S201 asli. Untuk menguji kalkulasi debit/volume, klik tombol berulang
  kali dan amati Serial Monitor.
- **I2C LCD** dihubungkan langsung ke GPIO21/22 tanpa level shifter, karena
  part LCD1602 I2C di Wokwi sudah beroperasi pada level logika simulasi tanpa
  perlu pemodelan shifter terpisah. Pada rancangan fisik, level shifter LV/HV
  tetap wajib dipakai sesuai dokumentasi aslinya.
- **Buzzer digerakkan langsung dari GPIO19**, tanpa driver transistor NPN.
  Katalog part gratis Wokwi tidak menyediakan part transistor/MOSFET apa pun
  (sudah dicek lewat pencarian part "transistor", "npn", "mosfet" — tidak ada
  hasil), sehingga rangkaian driver NPN + resistor basis 1kΩ + pull-down 10kΩ
  pada rancangan fisik **tidak direproduksi** di simulasi ini. Pada hardware
  nyata, buzzer (terutama tipe elektromagnetik berarus besar) tetap wajib
  memakai driver transistor seperti didokumentasikan di rancangan aslinya —
  jangan menghubungkan buzzer fisik langsung ke GPIO ESP32.
- Semua pembagi tegangan 10kΩ/10kΩ dan pull-up DHT22 dipertahankan identik
  dengan rancangan fisik agar logika firmware untuk sensor analog/digital
  tidak perlu diubah saat pindah ke hardware asli.

## Kalibrasi & ambang (belum final)

Konstanta di awal `sketch.ino` masih placeholder dan **harus diganti** dengan
hasil pengukuran nyata sebelum dipakai sebagai acuan:

- `PH_CAL_V_AT_HIGH`, `PH_CAL_V_AT_LOW` — tegangan PO modul pH (sebelum
  pembagi) pada buffer pH 7.00 dan 4.00. Set `PH_CALIBRATED = true` setelah
  diisi.
- `TURB_CAL_V_CLEAR`, `TURB_CAL_V_MAX_NTU` — tegangan referensi turbidity. Set
  `TURB_CALIBRATED = true` setelah diisi.
- `FLOW_PULSES_PER_LITER` — hasil kalibrasi aliran (pulsa ÷ liter terukur).
- `RESERVOIR_HEIGHT_CM`, `LOW_WATER_THRESHOLD_CM` — tinggi reservoir dan
  ambang alarm air rendah.

Alarm pH dan turbidity sengaja dibiarkan nonaktif di kode (`phAlarm`,
`turbAlarm` di `updateAlarms()`) sampai ambang ditetapkan berdasarkan
kalibrasi nyata — sama seperti catatan di rancangan aslinya.

## Catatan validasi

`diagram.json` dan `sketch.ino` sudah **dicoba langsung di wokwi.com**
(bukan cuma ditulis), lewat project anonim di `wokwi.com/projects/new/esp32`.
Tiga temuan dari uji coba ini, semua sudah diperbaiki di file-file folder ini:

1. **Tipe board salah.** `wokwi-esp32-devkit-c-v4` tidak terdaftar sebagai
   custom element di Wokwi — tipe yang benar adalah **`board-esp32-devkit-c-v4`**.
   Setelah diganti, board ESP32, DHT22, HC-SR04, kedua potentiometer,
   pushbutton, LCD1602 I2C, LED, dan buzzer semuanya ter-render dengan benar
   dan semua kabel tersambung tanpa indikator putus.
2. **Tidak ada part transistor di katalog gratis Wokwi** (dicek lewat
   pencarian "transistor", "npn", "mosfet" di dialog "Add a new part" — nol
   hasil untuk ketiganya). Driver buzzer NPN pada rancangan fisik karena itu
   disederhanakan menjadi GPIO19 → buzzer → GND langsung (lihat catatan
   buzzer di atas) khusus untuk simulasi ini.
3. **Compile penuh (dengan `#include <DHT.h>`, `<LiquidCrystal_I2C.h>`) gagal
   di sesi uji coba**, bukan karena kode salah, tapi karena tombol "Add a new
   library" di Library Manager Wokwi tidak merespons sama sekali pada sesi
   anonim (butuh sign-in; bukan keterbatasan `libraries.txt`-nya, filenya
   sendiri tidak bisa diuji karena UI pemasangnya terkunci). Untuk memastikan
   sisa logika sketch tetap benar, tiga `#include` tersebut distub sementara
   (class dummy, hanya untuk tes, tidak disimpan ke file ini) dan di-compile
   ulang — hasilnya **berhasil tanpa error**: "Sketch uses 307148 bytes (23%)
   of program storage space... Global variables use 24156 bytes (7%)", stderr
   kosong. Artinya struktur pin, tipe data, dan alur logika sketch sudah
   benar; yang belum terverifikasi end-to-end hanyalah pemasangan tiga
   library aslinya, yang di luar kendali proyek ini (perlu akun Wokwi).

**Yang perlu dilakukan user saat memakai project ini:** sign in ke Wokwi
(gratis), lalu pasang tiga library di `libraries.txt` lewat Library Manager
sebelum compile — atau pakai [Wokwi for VS Code](https://marketplace.visualstudio.com/items?itemName=wokwi.wokwi-vscode)
yang biasanya bisa resolve library otomatis dari `libraries.txt` tanpa perlu
sign-in di browser.

## Batas simulasi

Tidak ada klaim bahwa simulasi ini membuktikan sensor/kalibrasi fisik bekerja.
Perilaku ultrasonic, pH, turbidity, flow, dan alarm pada hardware nyata tetap
harus diverifikasi langsung di perangkat, sesuai catatan "Batas simulasi" pada
rancangan Cirkit Designer aslinya.
