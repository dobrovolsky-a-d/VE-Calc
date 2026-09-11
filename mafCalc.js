/**
 * mafCalc.js
 * MAF Scaling — Open Loop, WOT logs → новая MAF таблица
 * Портировано из отдельного проекта Maf_calc, логика расчёта не менялась
 * Формула: New MAF Flow = Old MAF Flow × (AFR_measured / AFR_target)
 */

const COLUMN_MAP = {
  mafVoltage: [
    "mass airflow sensor voltage (v)"
  ],
  afrMeasured: [
    "aem uego wideband [9600 baud] (afr gasoline)"
  ],
  afrTarget: [
    "primary open loop map enrichment (estimated afr)",
    "primary open loop map enrichment (2-byte)** (estimated afr)"
  ],
  fuelingStatus: [
    "cl/ol fueling* (status)"
  ]
};

let mafRuns = [];
let lastMafResult = null;

function normalize(s) {
  return s.toLowerCase().trim();
}

function mafError(msg) {
  const dbg = document.getElementById("mafDebug");
  dbg.textContent = "ERROR:\n" + msg;
  throw new Error(msg);
}

/* ===== CSV parsing ===== */

function parseCSVWithHeader(text) {
  const lines = text.trim().split("\n");
  if (lines.length < 2) mafError("CSV file has no data rows");

  const headers = lines[0].split(",").map(normalize);
  const dataLines = lines.slice(1);

  return { headers, dataLines };
}

function findColumn(headers, aliases, fileName) {
  const matches = headers
    .map((h, i) => aliases.includes(h) ? i : -1)
    .filter(i => i !== -1);

  if (matches.length === 0) {
    mafError(
      `Required column not found in ${fileName}\n\n` +
      `Expected one of:\n- ${aliases.join("\n- ")}\n\n` +
      `Found columns:\n- ${headers.join("\n- ")}`
    );
  }

  if (matches.length > 1) {
    mafError(`Multiple matching columns in ${fileName}\nPlease keep only one channel`);
  }

  return matches[0];
}

/* ===== Load log files ===== */

export function initMafCalc() {

  document.getElementById("mafLogFiles").addEventListener("change", e => {
    mafRuns = [];
    document.getElementById("mafRunList").innerHTML = "";
    document.getElementById("mafDebug").textContent = "";

    [...e.target.files].forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => loadMafLog(file.name, ev.target.result);
      reader.readAsText(file);
    });
  });

  document.getElementById("calculateMafBtn").onclick = calculateMAF;

  document.getElementById("copyMafBtn").onclick = () => {
    if (!lastMafResult) return;
    const text = lastMafResult.map(r => `${r.v}\t${r.new.toFixed(3)}`).join("\n");
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById("copyMafBtn");
      btn.textContent = "✓ Скопировано!";
      setTimeout(() => btn.textContent = "📋 Copy New MAF", 1500);
    });
  };
}

function loadMafLog(fileName, text) {
  const { headers, dataLines } = parseCSVWithHeader(text);

  const vCol      = findColumn(headers, COLUMN_MAP.mafVoltage, fileName);
  const afrCol    = findColumn(headers, COLUMN_MAP.afrMeasured, fileName);
  const tgtCol    = findColumn(headers, COLUMN_MAP.afrTarget, fileName);
  const statusCol = findColumn(headers, COLUMN_MAP.fuelingStatus, fileName);

  const samples = [];

  dataLines.forEach(line => {
    const p = line.split(",").map(x => parseFloat(x.trim()));
    if (p[statusCol] !== 10) return; // только Open Loop
    if ([p[vCol], p[afrCol], p[tgtCol]].some(isNaN)) return;
    samples.push([p[vCol], p[afrCol], p[tgtCol]]);
  });

  if (!samples.length) {
    mafError(`${fileName} contains no valid Open Loop samples`);
  }

  mafRuns.push(samples);

  const div = document.createElement("div");
  div.className = "run-item";
  div.style.cssText = "padding:4px 0;font-size:13px;color:#555;";
  div.textContent = `${fileName} — ${samples.length} OL samples`;
  document.getElementById("mafRunList").appendChild(div);

  document.getElementById("mafDebug").textContent += `${fileName} loaded successfully\n`;
}

/* ===== Nearest MAF voltage mapping ===== */

function findNearestVoltage(v, axis) {
  let nearest = axis[0];
  let minDiff = Math.abs(v - nearest);

  for (let i = 1; i < axis.length; i++) {
    const diff = Math.abs(v - axis[i]);
    if (diff < minDiff) {
      minDiff  = diff;
      nearest  = axis[i];
    }
  }
  return nearest.toFixed(2);
}

/* ===== Main calculation ===== */

function calculateMAF() {
  const debug = document.getElementById("mafDebug");
  debug.textContent = "";

  if (mafRuns.length < 2) {
    mafError("At least 2 WOT Open Loop logs are required");
  }

  const vText  = document.getElementById("mafVoltageInput").value.trim();
  const gsText = document.getElementById("mafGsInput").value.trim();

  if (!vText || !gsText) {
    mafError("MAF Voltage or Flow column is empty");
  }

  const vLines  = vText.split("\n");
  const gsLines = gsText.split("\n");

  if (vLines.length !== gsLines.length) {
    mafError(
      "MAF Voltage and g/s column length mismatch\n" +
      `Voltage rows: ${vLines.length}\n` +
      `g/s rows: ${gsLines.length}`
    );
  }

  const mafMap  = {};
  const mafAxis = [];

  for (let i = 0; i < vLines.length; i++) {
    const v  = parseFloat(vLines[i].trim());
    const gs = parseFloat(gsLines[i].trim());
    if (isNaN(v) || isNaN(gs)) continue;

    const key = v.toFixed(2);
    mafMap[key] = gs;
    mafAxis.push(v);
  }

  if (!mafAxis.length) {
    mafError("No valid MAF rows found");
  }

  mafAxis.sort((a, b) => a - b);

  const bins = {};

  mafRuns.flat().forEach(([v, afrMeas, afrTarget]) => {
    const key = findNearestVoltage(v, mafAxis);
    const corrected = mafMap[key] * (afrMeas / afrTarget);
    bins[key] ??= [];
    bins[key].push(corrected);
  });

  const result = [];

  mafAxis.forEach(v => {
    const key   = v.toFixed(2);
    const oldGs = mafMap[key];

    if (bins[key]) {
      const newGs = bins[key].reduce((a, b) => a + b, 0) / bins[key].length;
      result.push({ v: key, old: oldGs, new: newGs, delta: (newGs / oldGs - 1) * 100 });
    } else {
      result.push({ v: key, old: oldGs, new: oldGs, delta: 0 });
    }
  });

  lastMafResult = result;

  renderMafTable(result);
  renderMafChart(result);

  debug.textContent += `MAF rows: ${mafAxis.length}\n`;
  mafRuns.forEach((r, i) => debug.textContent += `Run ${i + 1}: ${r.length} samples\n`);
  debug.textContent += `Bins with data: ${Object.keys(bins).length}\n`;
  debug.textContent += `Calculation completed successfully\n`;
}

/* ===== Table output ===== */

function renderMafTable(data) {
  const body = document.querySelector("#mafOutputTable tbody");
  body.innerHTML = "";

  data.forEach(r => {
    const tr = document.createElement("tr");
    const deltaColor = Math.abs(r.delta) > 10 ? "color:#c0392b;font-weight:bold;" : "";
    tr.innerHTML = `
      <td>${r.v}</td>
      <td>${r.old.toFixed(3)}</td>
      <td>${r.new.toFixed(3)}</td>
      <td style="${deltaColor}">${r.delta.toFixed(1)}</td>
    `;
    body.appendChild(tr);
  });
}

/* ===== 2D Chart (Canvas) — old vs new curve ===== */

function renderMafChart(data) {

  const canvas = document.getElementById("mafChart");
  canvas.style.display = "block";
  const ctx = canvas.getContext("2d");

  const W = canvas.width  = canvas.clientWidth;
  const H = canvas.height = 320;

  ctx.clearRect(0, 0, W, H);

  const padding = { left: 55, right: 20, top: 20, bottom: 40 };
  const plotW = W - padding.left - padding.right;
  const plotH = H - padding.top - padding.bottom;

  const voltages = data.map(r => parseFloat(r.v));
  const allVals  = data.flatMap(r => [r.old, r.new]);

  const vMin = Math.min(...voltages), vMax = Math.max(...voltages);
  const gMin = Math.min(...allVals) * 0.95, gMax = Math.max(...allVals) * 1.05;

  function X(v) { return padding.left + ((v - vMin) / (vMax - vMin || 1)) * plotW; }
  function Y(g) { return padding.top + plotH - ((g - gMin) / (gMax - gMin || 1)) * plotH; }

  // Сетка
  ctx.strokeStyle = "#e8e8e8";
  ctx.lineWidth = 1;
  ctx.font = "11px system-ui";
  ctx.fillStyle = "#888";

  for (let k = 0; k <= 5; k++) {
    const g = gMin + (gMax - gMin) * k / 5;
    const y = Y(g);
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(W - padding.right, y);
    ctx.stroke();
    ctx.fillText(g.toFixed(1), 5, y + 4);
  }

  const vStep = Math.max(1, Math.floor(voltages.length / 8));
  voltages.forEach((v, i) => {
    if (i % vStep !== 0) return;
    const x = X(v);
    ctx.fillText(v.toFixed(2), x - 12, H - padding.bottom + 15);
  });

  // Подписи осей
  ctx.fillStyle = "#555";
  ctx.font = "bold 12px system-ui";
  ctx.fillText("g/s", 5, 12);
  ctx.fillText("MAF Voltage (V) →", W / 2 - 50, H - 8);

  // Линия OLD (серая)
  drawLine(ctx, data.map(r => [parseFloat(r.v), r.old]), X, Y, "#aaa", 2, false);

  // Линия NEW (синяя)
  drawLine(ctx, data.map(r => [parseFloat(r.v), r.new]), X, Y, "#4a7cff", 2.5, false);

  // Точки на новой линии, подсвеченные по величине коррекции
  data.forEach(r => {
    const x = X(parseFloat(r.v));
    const y = Y(r.new);
    const absDelta = Math.abs(r.delta);
    ctx.fillStyle = absDelta > 10 ? "#e74c3c" : (absDelta > 3 ? "#f39c12" : "#27ae60");
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  // Легенда
  ctx.font = "12px system-ui";
  ctx.fillStyle = "#aaa";
  ctx.fillRect(W - 140, 15, 12, 3);
  ctx.fillStyle = "#555";
  ctx.fillText("Old MAF", W - 122, 20);

  ctx.fillStyle = "#4a7cff";
  ctx.fillRect(W - 140, 32, 12, 3);
  ctx.fillStyle = "#555";
  ctx.fillText("New MAF", W - 122, 37);
}

function drawLine(ctx, points, X, Y, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth   = width;
  ctx.beginPath();
  points.forEach(([v, g], i) => {
    const x = X(v), y = Y(g);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}
