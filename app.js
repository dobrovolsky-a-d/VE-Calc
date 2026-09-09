import { parseLog }        from "./parseLog.js";
import { parseVEFromText }  from "./parseVEfromText.js";
import { calculateVE }      from "./veMath.js";
import { exportRomRaider }  from "./exportRomRaider.js";

let logData    = null;
let veOld      = null;
let lastResult = null;

const out = document.getElementById("output");

/* ---------- DEBUG ---------- */
const debug = document.createElement("div");
debug.style.cssText = "margin-bottom:15px;padding:10px;background:#fff3cd;border:1px solid #ffeeba;border-radius:6px;white-space:pre-wrap;";
document.body.insertBefore(debug, out);

function setDebug(t) { debug.innerText = t; }

/* ---------- LOAD LOGS ---------- */
document.getElementById("loadLog").onchange = async (e) => {
  try {
    setDebug("Loading logs...");
    const files  = Array.from(e.target.files);
    let merged   = [];
    let info     = [];

    for (let f of files) {
      const data = await parseLog(f);
      merged.push(...data);
      info.push(`${f.name}: ${data.length} rows`);
    }

    logData = merged;
    setDebug(`Logs loaded:\n${info.join("\n")}\nTotal rows: ${logData.length}`);

  } catch (err) {
    console.error(err);
    setDebug("LOG ERROR:\n" + err.message);
  }
};

/* ---------- LOAD VE ---------- */
document.getElementById("loadManualVE").onclick = () => {
  try {
    veOld = parseVEFromText(
      document.getElementById("rpmAxis").value,
      document.getElementById("mapAxis").value,
      document.getElementById("veTable").value
    );
    setDebug(`VE loaded: ${veOld.rows} x ${veOld.cols}`);
  } catch (e) {
    setDebug("VE ERROR:\n" + e.message);
  }
};

/* ---------- COVERAGE ---------- */
document.getElementById("showCoverage").onclick = () => {
  if (!logData) { setDebug("Load logs first"); return; }

  const rpmAxis  = autoAxis(logData.map(p => p.rpm), 18);
  const loadAxis = autoAxis(logData.map(p => p.map), 18);
  const coverage = buildCoverage(logData, rpmAxis, loadAxis);

  out.innerHTML = "";
  out.appendChild(makeCoverage(coverage, rpmAxis, loadAxis));
  setDebug("Coverage built");
};

/* ---------- CALCULATE ---------- */
document.getElementById("calculate").onclick = () => {
  try {
    if (!logData || !veOld) { setDebug("Load log and VE first"); return; }

    const mode       = document.getElementById("mode").value;
    const minSamples = parseInt(document.getElementById("minSamples").value) || 3;
    const anomalyPct = parseFloat(document.getElementById("anomalyThreshold").value) || 15;
    const showHeat   = document.getElementById("showHeatmap").checked;

    const res  = calculateVE(logData, veOld, mode, minSamples);
    lastResult = res;

    // Аномалии
    const anomalies = findAnomalies(res.VE_old, res.VE_new, res.mask, anomalyPct, veOld.rpmAxis, veOld.loadAxis);

    out.innerHTML = "";

    out.appendChild(makeVETable("VE NEW", res.VE_new, res.VE_old, res.coverage, res.mask, showHeat));
    out.appendChild(makeCorrTable("CORR %", res.Correction));
    out.appendChild(makeCoverage(res.coverage, veOld.rpmAxis, veOld.loadAxis));

    if (anomalies.length > 0) {
      out.appendChild(makeAnomalyReport(anomalies, anomalyPct));
    }

    let msg = `Done. Mode: ${mode}\nAnchors (cells with data): ${countMask(res.mask)}/${veOld.rows * veOld.cols}`;
    if (anomalies.length > 0) msg += `\n⚠️ Anomalies found: ${anomalies.length} cells`;
    setDebug(msg);

  } catch (e) {
    console.error(e);
    setDebug("CALC ERROR:\n" + e.message);
  }
};

/* ---------- EXPORT ---------- */
document.getElementById("exportBtn").onclick = () => {
  if (!lastResult) { setDebug("Calculate first"); return; }
  exportRomRaider(lastResult.VE_new);
};

/* ---------- COPY ---------- */
document.getElementById("copyBtn").onclick = () => {
  if (!lastResult) { setDebug("Calculate first"); return; }

  const text = lastResult.VE_new
    .map(row => row.map(v => v.toFixed(2)).join("\t"))
    .join("\n");

  navigator.clipboard.writeText(text).then(() => {
    setDebug("VE table copied to clipboard — paste into RomRaider/EcuFlash");
  });
};

/* ---------- HELPERS ---------- */

function autoAxis(values, bins) {
  const min  = Math.min(...values);
  const max  = Math.max(...values);
  const step = (max - min) / (bins - 1);
  return Array.from({ length: bins }, (_, i) => min + step * i);
}

function buildCoverage(log, rpmAxis, loadAxis) {
  const cov = Array.from({ length: rpmAxis.length }, () =>
    Array(loadAxis.length).fill(0)
  );
  for (let p of log) {
    const r = findClosest(rpmAxis,  p.rpm);
    const c = findClosest(loadAxis, p.map);
    cov[r][c]++;
  }
  return cov;
}

function findClosest(axis, val) {
  let best = 0;
  let min  = Math.abs(axis[0] - val);
  for (let i = 1; i < axis.length; i++) {
    const d = Math.abs(axis[i] - val);
    if (d < min) { min = d; best = i; }
  }
  return best;
}

function countMask(mask) {
  return mask.flat().filter(Boolean).length;
}

function findAnomalies(oldVE, newVE, mask, threshold, rpmAxis, loadAxis) {
  const result = [];
  for (let i = 0; i < oldVE.length; i++) {
    for (let j = 0; j < oldVE[0].length; j++) {
      if (!mask[i][j]) continue;
      const delta = ((newVE[i][j] - oldVE[i][j]) / oldVE[i][j]) * 100;
      if (Math.abs(delta) > threshold) {
        result.push({
          i, j,
          rpm: rpmAxis ? Math.round(rpmAxis[i]) : i,
          map: loadAxis ? loadAxis[j].toFixed(1) : j,
          oldVal: oldVE[i][j].toFixed(1),
          newVal: newVE[i][j].toFixed(1),
          delta: delta.toFixed(1)
        });
      }
    }
  }
  return result;
}

/* ---------- RENDER ---------- */

// VE таблица с heatmap покрытия и подсветкой якорей
function makeVETable(title, data, base, coverage, mask, showHeat) {

  const maxCov = Math.max(...coverage.flat().filter(v => v > 0), 1);

  const div = document.createElement("div");
  div.innerHTML = `<h3>${title} <span style="font-size:12px;color:#888;">(жёлтый = якорь с данными | серый = достроено моделью)</span></h3>`;

  const t = document.createElement("table");

  data.forEach((r, i) => {
    const tr = document.createElement("tr");

    r.forEach((v, j) => {
      const td = document.createElement("td");
      const cov = coverage[i][j];

      td.textContent = isNaN(v) ? "-" : v.toFixed(1);

      if (mask[i][j]) {
        // Якорная ячейка — подсвечиваем по покрытию
        if (showHeat) {
          const intensity = Math.min(cov / maxCov, 1);
          const r = Math.round(255 * (1 - intensity * 0.3));
          const g = Math.round(200 * intensity + 80 * (1 - intensity));
          const b = 50;
          td.style.background = `rgb(${r},${g},${b})`;
          td.style.color = intensity > 0.5 ? "white" : "#333";
        } else {
          td.classList.add("changed");
        }
        td.title = `Coverage: ${cov} points`;
      } else {
        // Достроено моделью — серый
        td.style.background = "#e8e8e8";
        td.style.color = "#888";
        td.title = "Model-filled (no data)";
      }

      tr.appendChild(td);
    });

    t.appendChild(tr);
  });

  div.appendChild(t);

  // Легенда
  if (showHeat) {
    const legend = document.createElement("div");
    legend.style.cssText = "margin:5px 0 10px;font-size:11px;display:flex;gap:10px;align-items:center;";
    legend.innerHTML = `
      <span style="background:#e8e8e8;color:#888;padding:2px 6px;border-radius:3px;">серый = модель</span>
      <span style="background:#c8a000;color:white;padding:2px 6px;border-radius:3px;">мало данных</span>
      <span style="background:#2d8a00;color:white;padding:2px 6px;border-radius:3px;">много данных</span>
    `;
    div.appendChild(legend);
  }

  return div;
}

// Таблица коррекции с null-ячейками
function makeCorrTable(title, data) {

  const div = document.createElement("div");
  div.innerHTML = `<h3>${title}</h3>`;

  const t = document.createElement("table");

  data.forEach(r => {
    const tr = document.createElement("tr");

    r.forEach(v => {
      const td = document.createElement("td");

      if (v === null || v === undefined) {
        td.textContent = "-";
        td.style.color = "#aaa";
      } else {
        td.textContent = v.toFixed(1);
        const alpha = Math.min(Math.abs(v) / 20, 0.7);
        if (v > 0) td.style.background = `rgba(255,80,80,${alpha})`;
        if (v < 0) td.style.background = `rgba(80,150,255,${alpha})`;
      }

      tr.appendChild(td);
    });

    t.appendChild(tr);
  });

  div.appendChild(t);
  return div;
}

function makeCoverage(data, rpmAxis, loadAxis) {

  const div = document.createElement("div");
  div.innerHTML = "<h3>LOG COVERAGE</h3>";

  const t = document.createElement("table");

  data.forEach((r, i) => {
    const tr = document.createElement("tr");

    if (rpmAxis) {
      const th = document.createElement("td");
      th.textContent = Math.round(rpmAxis[i]);
      th.style.cssText = "font-weight:bold;background:#f0f0f0;";
      tr.appendChild(th);
    }

    r.forEach(v => {
      const td = document.createElement("td");
      td.textContent = v;
      if      (v > 50) td.className = "cover-high";
      else if (v > 10) td.className = "cover-mid";
      else if (v > 0)  td.className = "cover-low";
      tr.appendChild(td);
    });

    t.appendChild(tr);
  });

  div.appendChild(t);
  return div;
}

function makeAnomalyReport(anomalies, threshold) {

  const div = document.createElement("div");
  div.style.cssText = "background:#fff3cd;border:1px solid #ffc107;border-radius:8px;padding:12px;margin-bottom:15px;";
  div.innerHTML = `<h3 style="margin:0 0 8px;color:#856404;">⚠️ Anomalies > ${threshold}% (${anomalies.length} cells)</h3>`;

  const t = document.createElement("table");
  t.style.width = "100%";

  const header = document.createElement("tr");
  ["RPM", "MAP (psi)", "Old VE", "New VE", "Delta %"].forEach(h => {
    const th = document.createElement("td");
    th.textContent = h;
    th.style.fontWeight = "bold";
    header.appendChild(th);
  });
  t.appendChild(header);

  anomalies.forEach(a => {
    const tr = document.createElement("tr");
    [a.rpm, a.map, a.oldVal, a.newVal, (a.delta > 0 ? "+" : "") + a.delta + "%"].forEach(v => {
      const td = document.createElement("td");
      td.textContent = v;
      if (v.includes("%")) {
        td.style.color = parseFloat(a.delta) > 0 ? "#c0392b" : "#2980b9";
        td.style.fontWeight = "bold";
      }
      tr.appendChild(td);
    });
    t.appendChild(tr);
  });

  div.appendChild(t);
  div.innerHTML += `<p style="margin:8px 0 0;font-size:12px;color:#856404;">Проверь эти ячейки вручную — возможно мусор в логе или реальная большая коррекция.</p>`;
  return div;
}
