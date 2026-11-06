/*
  EcoSense Station — Wokwi simulation build
  Reservoir water & air quality monitoring (ESP32)

  Wokwi tidak punya part JSN-SR04T / PH-4502C / SEN0189 / YF-S201, jadi
  diagram.json memakai pengganti dengan pin setara:
    - HC-SR04        -> pengganti JSN-SR04T   (TRIG/ECHO sama)
    - Potentiometer   -> pengganti PH-4502C PO  (putar knob utk ubah tegangan)
    - Potentiometer   -> pengganti SEN0189 OUT  (putar knob utk ubah tegangan)
    - Pushbutton      -> pengganti pulsa YF-S201 (tiap klik = 1 pulsa flow)
  Semua pembagi tegangan 10k/10k pada ECHO/PO/OUT tetap dipertahankan sesuai
  rancangan fisik, begitu juga pull-up DHT22 dan driver buzzer NPN.

  Library Arduino: DHT sensor library (Adafruit), Adafruit Unified Sensor,
  LiquidCrystal_I2C.
*/

#include <DHT.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

// ---------- Pin map (samakan dengan diagram.json) ----------
#define PIN_TRIG      5
#define PIN_ECHO      18
#define PIN_PH_PO     34
#define PIN_TURB_OUT  35
#define PIN_FLOW      27
#define PIN_DHT       4
#define PIN_BUZZER    19
#define PIN_LED       23

#define DHT_TYPE      DHT22
#define LCD_ADDR      0x27
#define LCD_COLS      16
#define LCD_ROWS      2

// ---------- Kalibrasi & ambang: GANTI sebelum dipakai nyata ----------
// Tinggi reservoir & ambang air rendah (cm)
float RESERVOIR_HEIGHT_CM = 100.0;
float LOW_WATER_THRESHOLD_CM = 15.0;

// Rasio pembagi tegangan 10k/10k = 1:1 pada ECHO/PO/OUT
const float DIVIDER_RATIO = 0.5;
const float ADC_VREF = 3.3;
const int   ADC_MAX  = 4095;

// Kalibrasi pH dua titik — PLACEHOLDER, isi dengan hasil pengukuran nyata
// (tegangan PO modul SEBELUM pembagi, pada buffer pH 7.00 dan pH 4.00)
float PH_CAL_V_AT_HIGH = 2.50; // pH 7.00
float PH_CAL_V_AT_LOW  = 3.00; // pH 4.00
const float PH_HIGH = 7.00;
const float PH_LOW  = 4.00;
bool PH_CALIBRATED = false; // set true setelah mengisi nilai kalibrasi asli

// Turbidity — PLACEHOLDER skala linear, belum dikalibrasi
float TURB_CAL_V_CLEAR = 2.80; // tegangan PO sebelum pembagi saat air bersih
float TURB_CAL_V_MAX_NTU = 1.00; // tegangan saat kekeruhan maksimum acuan
bool TURB_CALIBRATED = false;

// Flow sensor
volatile uint32_t flowPulseCount = 0;
float FLOW_PULSES_PER_LITER = 450.0; // GANTI dengan hasil kalibrasi aliran
unsigned long flowWindowStart = 0;
float flowRateLpm = 0.0;
float flowVolumeLiters = 0.0;

// ---------- Objek sensor/periferal ----------
DHT dht(PIN_DHT, DHT_TYPE);
LiquidCrystal_I2C lcd(LCD_ADDR, LCD_COLS, LCD_ROWS);

float dhtTemperature = NAN;
float dhtHumidity = NAN;
unsigned long lastDhtRead = 0;
const unsigned long DHT_INTERVAL_MS = 2500;

int lcdPage = 0;
unsigned long lastPageSwitch = 0;
const unsigned long PAGE_INTERVAL_MS = 3000;

bool lowWaterAlarm = false;

void IRAM_ATTR onFlowPulse() {
  flowPulseCount++;
}

// ---------- Ultrasonic dengan timeout ----------
// Mengembalikan jarak cm, atau NAN bila timeout/invalid (BUKAN reservoir kosong)
float readUltrasonicDistanceCm() {
  digitalWrite(PIN_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(PIN_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_TRIG, LOW);

  // timeout ~25ms -> batas jarak ~430cm, cukup untuk simulasi
  unsigned long duration = pulseIn(PIN_ECHO, HIGH, 25000UL);
  if (duration == 0) {
    return NAN; // timeout: pembacaan tidak valid, ditandai error
  }
  float distanceCm = (duration / 2.0) * 0.0343;
  return distanceCm;
}

float computeWaterHeightCm(float distanceCm) {
  if (isnan(distanceCm)) return NAN;
  float height = RESERVOIR_HEIGHT_CM - distanceCm;
  if (height < 0) height = 0;
  if (height > RESERVOIR_HEIGHT_CM) height = RESERVOIR_HEIGHT_CM;
  return height;
}

// ---------- Analog sampling ----------
float readAveragedVoltageAtPin(int pin, int samples = 16) {
  long sum = 0;
  for (int i = 0; i < samples; i++) {
    sum += analogRead(pin);
    delay(2);
  }
  float avgAdc = (float)sum / samples;
  return (avgAdc / ADC_MAX) * ADC_VREF; // tegangan di titik GPIO (setelah pembagi)
}

// Tegangan asli PO/OUT sebelum pembagi, dihitung balik dari titik GPIO
float voltageBeforeDivider(float voltageAtGpio) {
  return voltageAtGpio / DIVIDER_RATIO;
}

float readPhValue() {
  float vAtGpio = readAveragedVoltageAtPin(PIN_PH_PO);
  float vPo = voltageBeforeDivider(vAtGpio);
  if (!PH_CALIBRATED) return NAN; // jangan percaya hasil sebelum kalibrasi nyata

  // interpolasi linear dua titik: (V_high, pH_high) - (V_low, pH_low)
  float slope = (PH_LOW - PH_HIGH) / (PH_CAL_V_AT_LOW - PH_CAL_V_AT_HIGH);
  float ph = PH_HIGH + slope * (vPo - PH_CAL_V_AT_HIGH);
  return ph;
}

float readTurbidityNtu() {
  float vAtGpio = readAveragedVoltageAtPin(PIN_TURB_OUT);
  float vPo = voltageBeforeDivider(vAtGpio);
  if (!TURB_CALIBRATED) return NAN;

  float ntu = (TURB_CAL_V_CLEAR - vPo) / (TURB_CAL_V_CLEAR - TURB_CAL_V_MAX_NTU) * 100.0;
  if (ntu < 0) ntu = 0;
  return ntu;
}

// ---------- Flow / volume ----------
void updateFlowCalculation() {
  unsigned long now = millis();
  unsigned long elapsed = now - flowWindowStart;
  if (elapsed >= 1000) {
    noInterrupts();
    uint32_t pulses = flowPulseCount;
    flowPulseCount = 0;
    interrupts();

    float litersThisWindow = pulses / FLOW_PULSES_PER_LITER;
    flowVolumeLiters += litersThisWindow;
    flowRateLpm = (litersThisWindow) * (60000.0 / elapsed);

    flowWindowStart = now;
  }
}

// ---------- Alarm ----------
void updateAlarms(float waterHeightCm, float ph, float turbidityNtu) {
  lowWaterAlarm = (!isnan(waterHeightCm) && waterHeightCm <= LOW_WATER_THRESHOLD_CM);

  // Alarm pH & turbidity tersedia tapi nonaktif sampai ambang ditetapkan
  bool phAlarm = false;   // TODO: aktifkan setelah PH_CALIBRATED && ambang ditentukan
  bool turbAlarm = false; // TODO: aktifkan setelah TURB_CALIBRATED && ambang ditentukan

  bool anyAlarm = lowWaterAlarm || phAlarm || turbAlarm;
  digitalWrite(PIN_LED, anyAlarm ? HIGH : LOW);
  digitalWrite(PIN_BUZZER, anyAlarm ? HIGH : LOW);
}

// ---------- LCD paging ----------
void renderLcdPage(float waterHeightCm, float distanceCm, float ph, float turbidityNtu) {
  lcd.clear();
  switch (lcdPage) {
    case 0:
      lcd.setCursor(0, 0);
      lcd.print("Air (cm):");
      lcd.setCursor(0, 1);
      if (isnan(waterHeightCm)) {
        lcd.print("ERR SENSOR");
      } else {
        lcd.print(waterHeightCm, 1);
        if (lowWaterAlarm) lcd.print(" !LOW");
      }
      break;
    case 1:
      lcd.setCursor(0, 0);
      lcd.print("pH / Turb:");
      lcd.setCursor(0, 1);
      lcd.print(isnan(ph) ? "cal?" : String(ph, 2));
      lcd.print(" ");
      lcd.print(isnan(turbidityNtu) ? "cal?" : String(turbidityNtu, 0) + "NTU");
      break;
    case 2:
      lcd.setCursor(0, 0);
      lcd.print("Flow/Vol:");
      lcd.setCursor(0, 1);
      lcd.print(flowRateLpm, 2);
      lcd.print("L/m ");
      lcd.print(flowVolumeLiters, 1);
      lcd.print("L");
      break;
    case 3:
      lcd.setCursor(0, 0);
      lcd.print("Suhu/RH:");
      lcd.setCursor(0, 1);
      if (isnan(dhtTemperature) || isnan(dhtHumidity)) {
        lcd.print("ERR DHT22");
      } else {
        lcd.print(dhtTemperature, 1);
        lcd.print("C ");
        lcd.print(dhtHumidity, 0);
        lcd.print("%");
      }
      break;
  }
}

void setup() {
  Serial.begin(115200);

  pinMode(PIN_TRIG, OUTPUT);
  pinMode(PIN_ECHO, INPUT);
  pinMode(PIN_LED, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_FLOW, INPUT_PULLUP);
  analogReadResolution(12);

  digitalWrite(PIN_LED, LOW);
  digitalWrite(PIN_BUZZER, LOW);

  attachInterrupt(digitalPinToInterrupt(PIN_FLOW), onFlowPulse, FALLING);
  flowWindowStart = millis();

  dht.begin();

  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("EcoSense Station");
  lcd.setCursor(0, 1);
  lcd.print("Booting...");
  delay(1200);

  Serial.println("EcoSense Station - Wokwi build ready");
}

void loop() {
  unsigned long now = millis();

  float distanceCm = readUltrasonicDistanceCm();
  float waterHeightCm = computeWaterHeightCm(distanceCm);
  float ph = readPhValue();
  float turbidityNtu = readTurbidityNtu();

  updateFlowCalculation();

  if (now - lastDhtRead >= DHT_INTERVAL_MS) {
    lastDhtRead = now;
    float t = dht.readTemperature();
    float h = dht.readHumidity();
    if (!isnan(t) && !isnan(h)) {
      dhtTemperature = t;
      dhtHumidity = h;
    } else {
      dhtTemperature = NAN;
      dhtHumidity = NAN;
    }
  }

  updateAlarms(waterHeightCm, ph, turbidityNtu);

  if (now - lastPageSwitch >= PAGE_INTERVAL_MS) {
    lastPageSwitch = now;
    lcdPage = (lcdPage + 1) % 4;
  }
  renderLcdPage(waterHeightCm, distanceCm, ph, turbidityNtu);

  Serial.print("dist_cm=");
  Serial.print(isnan(distanceCm) ? -1 : distanceCm);
  Serial.print(" water_cm=");
  Serial.print(isnan(waterHeightCm) ? -1 : waterHeightCm);
  Serial.print(" ph=");
  Serial.print(isnan(ph) ? -1 : ph);
  Serial.print(" turb_ntu=");
  Serial.print(isnan(turbidityNtu) ? -1 : turbidityNtu);
  Serial.print(" flow_lpm=");
  Serial.print(flowRateLpm);
  Serial.print(" vol_l=");
  Serial.print(flowVolumeLiters);
  Serial.print(" temp_c=");
  Serial.print(isnan(dhtTemperature) ? -1 : dhtTemperature);
  Serial.print(" rh=");
  Serial.print(isnan(dhtHumidity) ? -1 : dhtHumidity);
  Serial.print(" low_water_alarm=");
  Serial.println(lowWaterAlarm ? 1 : 0);

  delay(500);
}
