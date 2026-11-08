"use strict";

/* =========================================================================
   KONFIGURASI — ubah bagian ini saja untuk menyesuaikan video
   ========================================================================= */

const CONFIG = {
  // Resolusi render internal (jangan diubah kecuali ingin kualitas lain)
  width: 1920,
  height: 1080,

  // Warna utama tema terminal
  colors: {
    background: "#050b14",
    grid: "rgba(90, 240, 255, 0.04)",
    green: "#39ff6a",
    cyan: "#5af0ff",
    white: "#eaf6ff",
    dim: "rgba(234, 246, 255, 0.35)",
    warning: "#ff5a5a",
    warningGlow: "#ffb347",
  },

  // Judul & teks — ganti kalimat di sini untuk mengubah isi video
  text: {
    boot: ["> INITIALIZING SYSTEM...", "> ECOSENSE STATION", "> Monitoring Air & Lingkungan"],
    question: "Bagaimana kondisi air reservoir hari ini?",
    questionFollowUp: ["Ketinggian air, pH, dan kekeruhan", "perlu dipantau secara berkala."],
    sensorTitle: "> SENSOR MEMBACA KONDISI RESERVOIR & LINGKUNGAN",
    sensors: [
      { id: "JSN-SR04T", desc: "Jarak permukaan air" },
      { id: "PH-4502C", desc: "pH air" },
      { id: "SEN0189", desc: "Sinyal kekeruhan" },
      { id: "YF-S201", desc: "Aliran air" },
      { id: "DHT22", desc: "Suhu & kelembapan udara" },
    ],
    processTitle: "Data sensor dibaca dan diproses oleh ESP32.",
    simulationLabel: "[ DATA SIMULASI ]",
    lcdNormal: ["+----------------+", "| TINGGI AIR: 75%|", "| STATUS: NORMAL |", "+----------------+"],
    lcdWarning: ["+----------------+", "| PERINGATAN!    |", "| AIR RENDAH     |", "+----------------+"],
    alertNote: "LED dan buzzer dapat aktif saat kondisi melewati ambang tertentu.\n(Nilai di atas hanya ilustrasi, bukan ambang terkalibrasi.)",
    closingTitle: "ECOSENSE STATION",
    closingSubtitle: ["Pantau kondisi air dan lingkungan", "dengan lebih mudah."],
  },

  // Durasi tiap adegan (detik) — ubah angka ini untuk mengatur pacing video.
  // Total durasi video otomatis dihitung dari jumlah semua durasi di bawah.
  sceneDurations: {
    opening: 8,
    problem: 8,
    sensors: 11,
    processing: 8,
    display: 12,
    closing: 6,
  },

  fps: 30,
  showTimecode: true,
};

/* =========================================================================
   SETUP TIMELINE — dihitung otomatis dari CONFIG.sceneDurations
   ========================================================================= */

const SCENE_ORDER = ["opening", "problem", "sensors", "processing", "display", "closing"];

function buildTimeline() {
  let cursor = 0;
  const timeline = {};
  for (const key of SCENE_ORDER) {
    const duration = CONFIG.sceneDurations[key];
    timeline[key] = { start: cursor, end: cursor + duration, duration };
    cursor += duration;
  }
  return { timeline, total: cursor };
}

const { timeline: T, total: TOTAL_DURATION } = buildTimeline();

/* =========================================================================
   CANVAS SETUP
   ========================================================================= */

const canvas = document.getElementById("stage");
const ctx = canvas.getContext("2d");
canvas.width = CONFIG.width;
canvas.height = CONFIG.height;

const btnReplay = document.getElementById("btnReplay");
const timeDisplay = document.getElementById("timeDisplay");
const progressFill = document.getElementById("progressFill");

let startTime = null;
let rafId = null;
let ended = false;

/* =========================================================================
   HELPER — EFEK VISUAL
   ========================================================================= */

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function lerp(a, b, t) {
  return a + (b - a) * clamp(t, 0, 1);
}

/** Efek teks muncul satu per satu (typewriter), mendukung multi-baris via "\n". */
function typeText(ctx, text, x, y, opts) {
  const {
    fontSize = 34,
    lineHeight = 48,
    color = CONFIG.colors.green,
    charsPerSec = 26,
    startDelay = 0,
    localT,
    align = "left",
    glow = true,
    cursor = true,
  } = opts;

  const elapsedChars = (localT - startDelay) * charsPerSec;
  const n = Math.max(0, Math.floor(elapsedChars));
  const shown = text.slice(0, n);
  const shownLines = shown.split("\n");
  const doneTyping = n >= text.length;

  ctx.font = `${fontSize}px "Courier New", monospace`;
  ctx.textBaseline = "top";
  ctx.textAlign = align;

  if (glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
  }
  ctx.fillStyle = color;

  shownLines.forEach((line, i) => {
    ctx.fillText(line, x, y + i * lineHeight);
  });
  ctx.shadowBlur = 0;

  if (cursor && elapsedChars >= -0.001 && (!doneTyping || opts.keepCursor)) {
    const blinkOn = Math.floor(localT * 2.5) % 2 === 0;
    if (blinkOn) {
      const lastIdx = shownLines.length - 1;
      const lastLine = shownLines[lastIdx];
      const lw = ctx.measureText(lastLine).width;
      const cx = align === "left" ? x + lw : x;
      ctx.fillStyle = color;
      ctx.fillText("_", cx, y + lastIdx * lineHeight);
    }
  }

  return { done: doneTyping };
}

/** Efek fade-in sederhana untuk teks / ilustrasi. */
function fadeText(ctx, lines, x, y, opts) {
  const {
    fontSize = 30,
    lineHeight = 40,
    color = CONFIG.colors.white,
    startDelay = 0,
    duration = 1,
    localT,
    align = "center",
    glow = false,
  } = opts;

  const alpha = clamp((localT - startDelay) / duration, 0, 1);
  if (alpha <= 0) return;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `${fontSize}px "Courier New", monospace`;
  ctx.textBaseline = "top";
  ctx.textAlign = align;
  if (glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
  }
  ctx.fillStyle = color;
  const arr = Array.isArray(lines) ? lines : [lines];
  arr.forEach((line, i) => ctx.fillText(line, x, y + i * lineHeight));
  ctx.restore();
}

/** Blok ASCII art multi-baris dengan fade-in. */
function drawAsciiArt(art, x, y, opts) {
  const {
    fontSize = 22,
    lineHeight = 26,
    color = CONFIG.colors.cyan,
    startDelay = 0,
    duration = 1.2,
    localT,
    align = "left",
  } = opts;

  const alpha = clamp((localT - startDelay) / duration, 0, 1);
  if (alpha <= 0) return;

  const lines = art.replace(/^\n/, "").split("\n");
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `${fontSize}px "Courier New", monospace`;
  ctx.textBaseline = "top";
  ctx.textAlign = align;
  ctx.fillStyle = color;
  lines.forEach((line, i) => ctx.fillText(line, x, y + i * lineHeight));
  ctx.restore();
}

/** Garis yang tergambar progresif, untuk panah / koneksi antar elemen. */
function drawLineProgress(x1, y1, x2, y2, progress, color, lineWidth = 2) {
  const p = clamp(progress, 0, 1);
  if (p <= 0) return;
  const cx = lerp(x1, x2, p);
  const cy = lerp(y1, y2, p);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(cx, cy);
  ctx.stroke();
  ctx.restore();

  // kepala panah sederhana saat garis selesai
  if (p >= 1) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - 14, y2 - 6);
    ctx.lineTo(x2 - 14, y2 + 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

/** Kotak ASCII (border "+---+") dengan fade-in, dipakai untuk layar LCD. */
function drawLcdBox(lines, x, y, opts) {
  const { fontSize = 40, lineHeight = 52, color = CONFIG.colors.green, startDelay = 0, duration = 0.8, localT, glow = true } = opts;
  const alpha = clamp((localT - startDelay) / duration, 0, 1);
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `${fontSize}px "Courier New", monospace`;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  if (glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
  }
  ctx.fillStyle = color;
  lines.forEach((line, i) => ctx.fillText(line, x, y + i * lineHeight));
  ctx.restore();
}

function drawBackground() {
  ctx.fillStyle = CONFIG.colors.background;
  ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);

  // grid tipis ala terminal/radar, sangat halus agar tidak ramai
  ctx.save();
  ctx.strokeStyle = CONFIG.colors.grid;
  ctx.lineWidth = 1;
  const step = 64;
  for (let x = 0; x <= CONFIG.width; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CONFIG.height);
    ctx.stroke();
  }
  for (let y = 0; y <= CONFIG.height; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CONFIG.width, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTimecode(elapsed) {
  if (!CONFIG.showTimecode) return;
  ctx.save();
  ctx.font = `20px "Courier New", monospace`;
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.fillStyle = "rgba(234, 246, 255, 0.35)";
  ctx.fillText(`${elapsed.toFixed(1)}s / ${TOTAL_DURATION.toFixed(1)}s`, CONFIG.width - 24, CONFIG.height - 20);
  ctx.restore();
}

/* =========================================================================
   ILUSTRASI ASCII
   ========================================================================= */

const ART_TANK = `
      _________
     |         |
     |~ ~ ~ ~ ~|
     |~ ~ ~ ~ ~|
     |~ ~ ~ ~ ~|
     |_________|
`;

const ART_SIGNAL = `
      )
     ) )
    ) ) )
   [ESP32]
`;

const ART_RESERVOIR_Q = `
   ___________________
  /                   \\
 /    ~ ~ ~ ~ ~ ~ ~    \\
/_______________________\\
          RESERVOIR

            ???
`;

const ART_RESERVOIR_SMALL = `
   ________________
  /  ~ ~ ~ ~ ~ ~ ~  \\
 /___________________\\
      RESERVOIR
`;

/* =========================================================================
   ADEGAN 1 — PEMBUKA
   ========================================================================= */

function sceneOpening(localT) {
  typeText(ctx, CONFIG.text.boot[0], 140, 150, {
    fontSize: 32, lineHeight: 44, color: CONFIG.colors.green,
    charsPerSec: 22, startDelay: 0.2, localT, keepCursor: false,
  });
  typeText(ctx, CONFIG.text.boot[1], 140, 230, {
    fontSize: 64, lineHeight: 80, color: CONFIG.colors.cyan,
    charsPerSec: 18, startDelay: 1.6, localT, keepCursor: false,
  });
  typeText(ctx, CONFIG.text.boot[2], 140, 330, {
    fontSize: 32, lineHeight: 44, color: CONFIG.colors.white,
    charsPerSec: 20, startDelay: 3.2, localT, keepCursor: true,
  });

  drawAsciiArt(ART_TANK, 1280, 160, { fontSize: 26, lineHeight: 30, color: CONFIG.colors.cyan, startDelay: 4.0, duration: 1.4, localT });
  drawAsciiArt(ART_SIGNAL, 1320, 460, { fontSize: 26, lineHeight: 30, color: CONFIG.colors.green, startDelay: 5.0, duration: 1.4, localT });
}

/* =========================================================================
   ADEGAN 2 — MASALAH
   ========================================================================= */

function sceneProblem(localT) {
  typeText(ctx, CONFIG.text.question, 140, 160, {
    fontSize: 46, lineHeight: 58, color: CONFIG.colors.white,
    charsPerSec: 22, startDelay: 0.2, localT, keepCursor: true,
  });

  drawAsciiArt(ART_RESERVOIR_Q, 140, 320, { fontSize: 24, lineHeight: 30, color: CONFIG.colors.cyan, startDelay: 1.8, duration: 1.2, localT });

  const followUp = CONFIG.text.questionFollowUp.join("\n");
  typeText(ctx, followUp, 140, 700, {
    fontSize: 36, lineHeight: 48, color: CONFIG.colors.green,
    charsPerSec: 24, startDelay: 4.2, localT, keepCursor: true,
  });
}

/* =========================================================================
   ADEGAN 3 — SENSOR BEKERJA
   ========================================================================= */

function sceneSensors(localT) {
  typeText(ctx, CONFIG.text.sensorTitle, 120, 90, {
    fontSize: 30, lineHeight: 40, color: CONFIG.colors.cyan,
    charsPerSec: 30, startDelay: 0.1, localT, keepCursor: false,
  });

  const rows = CONFIG.text.sensors;
  const rowStartGap = 1.8;
  const rowY0 = 240;
  const rowH = 130;
  const boxX = 150;
  const boxW = 360;
  const lineX2 = 1200;

  rows.forEach((sensor, i) => {
    const delay = 1.0 + i * rowStartGap;
    const y = rowY0 + i * rowH;
    const localRevealT = localT - delay;

    if (localRevealT < 0) return;

    // kotak nama sensor
    ctx.save();
    ctx.globalAlpha = clamp(localRevealT / 0.4, 0, 1);
    ctx.font = `30px "Courier New", monospace`;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.strokeStyle = CONFIG.colors.green;
    ctx.shadowColor = CONFIG.colors.green;
    ctx.shadowBlur = 8;
    ctx.lineWidth = 2;
    ctx.strokeRect(boxX, y, boxW, 60);
    ctx.shadowBlur = 0;
    ctx.fillStyle = CONFIG.colors.green;
    ctx.fillText(sensor.id, boxX + 20, y + 15);
    ctx.restore();

    // garis panah progresif menuju deskripsi
    const lineProgress = clamp((localRevealT - 0.3) / 0.6, 0, 1);
    drawLineProgress(boxX + boxW, y + 30, lineX2, y + 30, lineProgress, CONFIG.colors.cyan, 3);

    // deskripsi sensor (typewriter)
    if (localRevealT > 0.9) {
      typeText(ctx, sensor.desc, lineX2 + 30, y + 15, {
        fontSize: 28, lineHeight: 34, color: CONFIG.colors.white,
        charsPerSec: 40, startDelay: delay + 0.9, localT, keepCursor: false, glow: false,
      });
    }
  });
}

/* =========================================================================
   ADEGAN 4 — DATA DIPROSES ESP32
   ========================================================================= */

function sceneProcessing(localT) {
  const boxY = 180;
  const boxH = 100;
  const sensorX = 160, sensorW = 320;
  const espX = 820, espW = 280;
  const lcdX = 1420, lcdW = 280;

  function flowBox(label, x, w) {
    ctx.save();
    ctx.font = `34px "Courier New", monospace`;
    ctx.textBaseline = "top";
    ctx.textAlign = "center";
    ctx.strokeStyle = CONFIG.colors.cyan;
    ctx.shadowColor = CONFIG.colors.cyan;
    ctx.shadowBlur = 10;
    ctx.lineWidth = 3;
    ctx.strokeRect(x, boxY, w, boxH);
    ctx.shadowBlur = 0;
    ctx.fillStyle = CONFIG.colors.cyan;
    ctx.fillText(label, x + w / 2, boxY + 32);
    ctx.restore();
  }

  flowBox("SENSOR", sensorX, sensorW);
  flowBox("ESP32", espX, espW);
  flowBox("LCD", lcdX, lcdW);

  const arrow1Progress = clamp((localT - 0.6) / 0.8, 0, 1);
  const arrow2Progress = clamp((localT - 1.6) / 0.8, 0, 1);
  drawLineProgress(sensorX + sensorW, boxY + boxH / 2, espX, boxY + boxH / 2, arrow1Progress, CONFIG.colors.green, 3);
  drawLineProgress(espX + espW, boxY + boxH / 2, lcdX, boxY + boxH / 2, arrow2Progress, CONFIG.colors.green, 3);

  typeText(ctx, CONFIG.text.processTitle, 160, 420, {
    fontSize: 38, lineHeight: 50, color: CONFIG.colors.white,
    charsPerSec: 26, startDelay: 2.6, localT, keepCursor: true,
  });

  // angka simulasi yang berubah perlahan
  if (localT > 4.0) {
    const waterLevel = 68 + Math.sin(localT * 0.8) * 4;
    const ph = 6.8 + Math.sin(localT * 0.5 + 1) * 0.3;
    const turbidity = 12 + Math.sin(localT * 0.6 + 2) * 3;

    const simLines = [
      `TINGGI AIR : ${waterLevel.toFixed(1)} %`,
      `pH AIR     : ${ph.toFixed(2)}`,
      `KEKERUHAN  : ${turbidity.toFixed(1)} NTU`,
    ];

    ctx.save();
    ctx.globalAlpha = clamp((localT - 4.0) / 0.6, 0, 1);
    ctx.font = `30px "Courier New", monospace`;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.fillStyle = CONFIG.colors.green;
    simLines.forEach((line, i) => ctx.fillText(line, 160, 560 + i * 44));

    const blinkOn = Math.floor(localT * 1.6) % 2 === 0;
    if (blinkOn) {
      ctx.fillStyle = CONFIG.colors.warningGlow;
      ctx.font = `24px "Courier New", monospace`;
      ctx.fillText(CONFIG.text.simulationLabel, 160, 710);
    }
    ctx.restore();
  }
}

/* =========================================================================
   ADEGAN 5 — TAMPILAN & PERINGATAN
   ========================================================================= */

function sceneDisplay(localT) {
  const normalEnd = CONFIG.sceneDurations.display * 0.5;

  if (localT < normalEnd) {
    drawLcdBox(CONFIG.text.lcdNormal, 500, 220, {
      fontSize: 44, lineHeight: 58, color: CONFIG.colors.green,
      startDelay: 0.3, duration: 1.0, localT,
    });
  }

  if (localT >= normalEnd) {
    const warnLocalT = localT - normalEnd;
    const flashAlpha = clamp(warnLocalT / 0.3, 0, 1);

    ctx.save();
    ctx.globalAlpha = flashAlpha;
    const blinkOn = Math.floor(localT * 3) % 2 === 0;
    const warnColor = blinkOn ? CONFIG.colors.warning : CONFIG.colors.warningGlow;

    ctx.font = `44px "Courier New", monospace`;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.shadowColor = warnColor;
    ctx.shadowBlur = 18;
    ctx.fillStyle = warnColor;
    CONFIG.text.lcdWarning.forEach((line, i) => ctx.fillText(line, 500, 220 + i * 58));
    ctx.restore();

    if (warnLocalT > 0.8) {
      ctx.save();
      ctx.globalAlpha = clamp((warnLocalT - 0.8) / 0.5, 0, 1);
      ctx.font = `30px "Courier New", monospace`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      const ledOn = Math.floor(localT * 4) % 2 === 0;
      ctx.fillStyle = ledOn ? CONFIG.colors.warning : "rgba(255,90,90,0.25)";
      ctx.fillText("[ LED MENYALA ]", 500, 520);
      ctx.fillStyle = ledOn ? CONFIG.colors.warningGlow : "rgba(255,179,71,0.25)";
      ctx.fillText("[ BUZZER AKTIF ]", 820, 520);
      ctx.restore();

      typeText(ctx, CONFIG.text.alertNote, 500, 600, {
        fontSize: 24, lineHeight: 34, color: CONFIG.colors.white,
        charsPerSec: 36, startDelay: normalEnd + 1.1, localT, keepCursor: false, glow: false,
      });
    }
  }
}

/* =========================================================================
   ADEGAN 6 — PENUTUP
   ========================================================================= */

function sceneClosing(localT) {
  drawAsciiArt(ART_RESERVOIR_SMALL, 1540, 70, { fontSize: 20, lineHeight: 24, color: CONFIG.colors.cyan, startDelay: 0.1, duration: 1.0, localT });
  drawAsciiArt(ART_SIGNAL, 1580, 220, { fontSize: 20, lineHeight: 24, color: CONFIG.colors.green, startDelay: 0.5, duration: 1.0, localT });

  fadeText(ctx, [CONFIG.text.closingTitle], CONFIG.width / 2, 380, {
    fontSize: 90, lineHeight: 100, color: CONFIG.colors.white,
    startDelay: 0.6, duration: 1.2, localT, align: "center", glow: true,
  });

  fadeText(ctx, CONFIG.text.closingSubtitle, CONFIG.width / 2, 520, {
    fontSize: 38, lineHeight: 50, color: CONFIG.colors.green,
    startDelay: 1.8, duration: 1.2, localT, align: "center",
  });

  if (localT > 3.2) {
    const blinkOn = Math.floor(localT * 2.5) % 2 === 0;
    if (blinkOn) {
      ctx.save();
      ctx.font = `38px "Courier New", monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = CONFIG.colors.green;
      ctx.fillText("_", CONFIG.width / 2, 620);
      ctx.restore();
    }
  }
}

/* =========================================================================
   LOOP UTAMA
   ========================================================================= */

const SCENE_DRAW = {
  opening: sceneOpening,
  problem: sceneProblem,
  sensors: sceneSensors,
  processing: sceneProcessing,
  display: sceneDisplay,
  closing: sceneClosing,
};

function renderAt(elapsed) {
  drawBackground();

  let activeKey = SCENE_ORDER[SCENE_ORDER.length - 1];
  for (const key of SCENE_ORDER) {
    const s = T[key];
    if (elapsed >= s.start && elapsed < s.end) {
      activeKey = key;
      break;
    }
  }

  const s = T[activeKey];
  const localT = clamp(elapsed - s.start, 0, s.duration);
  SCENE_DRAW[activeKey](localT);

  drawTimecode(elapsed);

  // UI di luar canvas: progress bar & timecode
  const pct = clamp((elapsed / TOTAL_DURATION) * 100, 0, 100);
  progressFill.style.width = `${pct}%`;
  timeDisplay.textContent = `${elapsed.toFixed(1)}s / ${TOTAL_DURATION.toFixed(1)}s`;
}

function loop(now) {
  if (startTime === null) startTime = now;
  const elapsed = (now - startTime) / 1000;

  if (elapsed >= TOTAL_DURATION) {
    renderAt(TOTAL_DURATION);
    ended = true;
    rafId = null;
    return;
  }

  renderAt(elapsed);
  rafId = requestAnimationFrame(loop);
}

function play() {
  if (rafId !== null) cancelAnimationFrame(rafId);
  startTime = null;
  ended = false;
  rafId = requestAnimationFrame(loop);
}

btnReplay.addEventListener("click", play);

// Mulai otomatis saat halaman dibuka
play();

/* =========================================================================
   EXPORT FRAME (opsional) — jalankan manual dari console browser (F12)
   jika ingin mengekspor setiap frame sebagai PNG untuk digabung dengan ffmpeg.
   Contoh pemakaian di console:
     captureFrames()
   File akan terunduh otomatis satu per satu sesuai CONFIG.fps.
   ========================================================================= */

function captureFrames() {
  if (rafId !== null) cancelAnimationFrame(rafId);
  const totalFrames = Math.ceil(TOTAL_DURATION * CONFIG.fps);
  let frame = 0;

  function exportStep() {
    if (frame > totalFrames) return;
    const elapsed = frame / CONFIG.fps;
    renderAt(elapsed);
    canvas.toBlob((blob) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `frame_${String(frame).padStart(4, "0")}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
      frame += 1;
      setTimeout(exportStep, 120);
    }, "image/png");
  }

  exportStep();
}

window.captureFrames = captureFrames;
