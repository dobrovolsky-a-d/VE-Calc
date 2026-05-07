import { parseLog }        from "./parseLog.js";
import { parseVEFromText }  from "./parseVEfromText.js";
import { calculateVE }      from "./veMath.js";
import { exportRomRaider }  from "./exportRomRaider.js";

let logData = null;
let veOld   = null;
let lastResult = null;

const out = document.getElementById("output");

/* ---------- DEBUG ---------- */
const debug = document.createElement("div");
debug.style.marginBottom = "15px";
debug.style.padding      = "10px";
debug.style.background   = "#fff3cd";
debug.style.border       = "1px solid #ffeeba";
debug.style.borderRadius = "6px";
document.body.insertBefore(debug, out);

function setDebug(t) {
  debug.innerText = t;
}

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

    setDebug(
`Logs loaded:
${info.join("\n")}
Total rows: ${logData.length}`
    );

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

  if (!logData) {
    setDebug("Load logs first");
    return;
  }

  // FIX: p.map уже PSI — убрано умножение на 14.5
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

    if (!logData || !veOld) {
      setDebug("Load log and VE first");
      return;
    }

    const mode       = document.getElementById("mode").value;
    const minSamples = parseInt(document.getElementById("minSamples").value) || 3;

    const res = calculateVE(logData, veOld, mode, minSamples);
    lastResult = res;

    out.innerHTML = "";

    out.appendChild(makeTable("VE OLD",  res.VE_old));
    out.appendChild(makeTable("VE NEW",  res.VE_new, res.VE_old));
    out.appendChild(makeCorrTable("CORR %", res.Correction)); // FIX: отдельный рендер для null-ячеек
    out.appendChild(makeCoverage(res.coverage, veOld.rpmAxis, veOld.loadAxis));

    setDebug("Done");

  } catch (e) {
    console.error(e);
    setDebug("CALC ERROR:\n" + e.message);
  }
};

/* ---------- EXPORT ---------- */
document.getElementById("exportBtn").onclick = () => {
  if (!lastResult) {
    setDebug("Calculate first");
    return;
  }
  exportRomRaider(lastResult.VE_new);
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
    // FIX: p.map уже PSI — не конвертируем
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

/* ---------- RENDER ---------- */

function makeTable(title, data, base=null) {

  const div = document.createElement("div");
  div.innerHTML = `<h3>${title}</h3>`;

  const t = document.createElement("table");

  data.forEach((r, i) => {
    const tr = document.createElement("tr");

    r.forEach((v, j) => {
      const td = document.createElement("td");
      td.textContent = isNaN(v) ? "-" : v.toFixed(1);

      if (base && Math.abs(v - base[i][j]) > 0.1) {
        td.classList.add("changed");
      }

      tr.appendChild(td);
    });

    t.appendChild(tr);
  });

  div.appendChild(t);
  return div;
}

// FIX: корректный рендер таблицы коррекции — null-ячейки показываем как "-"
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
        if (v > 0)  td.style.background = `rgba(255,100,100,${Math.min(Math.abs(v)/20, 0.6)})`;
        if (v < 0)  td.style.background = `rgba(100,180,255,${Math.min(Math.abs(v)/20, 0.6)})`;
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

    // label RPM
    if (rpmAxis) {
      const th = document.createElement("td");
      th.textContent = Math.round(rpmAxis[i]);
      th.style.fontWeight = "bold";
      th.style.background = "#f0f0f0";
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
