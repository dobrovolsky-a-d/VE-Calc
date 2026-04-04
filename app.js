import { parseLog } from "./parseLog.js";
import { parseVE } from "./parseVE.js";
import { calculateVE } from "./veMath.js";
import { exportRomRaider } from "./exportRomRaider.js";

let logData = null;
let veOld = null;
let result = null;

const debug = document.getElementById("debug");
const output = document.getElementById("output");
const exportBtn = document.getElementById("export");

function setDebug(t) {
  debug.textContent = t;
}

document.getElementById("loadLog").addEventListener("change", async (e) => {
  try {
    const files = Array.from(e.target.files);
    const tpsCutoff = parseFloat(document.getElementById("tpsCutoff").value);

    let merged = [];
    let info = [];

    for (const f of files) {
      const parsed = await parseLog(f, tpsCutoff);
      merged.push(...parsed);
      info.push(`${f.name}: ${parsed.length}`);
    }

    logData = merged;

    setDebug(
`Logs loaded: ${files.length}
${info.join("\n")}
Total merged rows: ${logData.length}`
    );
  } catch (err) {
    logData = null;
    setDebug("Log error:\n" + err.message);
  }
});

document.getElementById("loadVE").addEventListener("change", async (e) => {
  try {
    veOld = await parseVE(e.target.files[0]);
    setDebug(
`VE loaded
Rows: ${veOld.rows}
Cols: ${veOld.cols}
Cells: ${veOld.rows * veOld.cols}`
    );
  } catch (err) {
    veOld = null;
    setDebug("VE error:\n" + err.message);
  }
});

document.getElementById("calculate").addEventListener("click", () => {
  if (!logData || !veOld) {
    setDebug("Load logs and VE table first");
    return;
  }

  const interpMode = document.getElementById("interpMode").value;

  result = calculateVE(logData, veOld, interpMode);
  renderResult(result);
  exportBtn.disabled = false;

  setDebug(
`Calculation done
Used VE cells: ${result.stats.usedCells}
Interpolation: ${interpMode}`
  );
});

exportBtn.addEventListener("click", () => {
  if (result) exportRomRaider(result.VE_new);
});

function renderResult(res) {

  output.innerHTML = "";

  renderTable("Original VE", res.VE_old);

  renderTable("Correction %", res.Correction);

  renderTable("New VE", res.VE_new, res.VE_old);

  renderCoverage("Log Coverage", res.coverage);

}

function renderTable(title, matrix, ref = null) {

  const h = document.createElement("h3");
  h.textContent = title;
  output.appendChild(h);

  const table = document.createElement("table");

  matrix.forEach((row, r) => {

    const tr = document.createElement("tr");

    row.forEach((v, c) => {

      const td = document.createElement("td");

      td.textContent = Number(v).toFixed(2);

      if (ref) {

        const diff = ((v - ref[r][c]) / ref[r][c]) * 100;

        if (diff > 3) td.style.background = "#ff6b6b";
        else if (diff > 1) td.style.background = "#ffd0d0";
        else if (diff < -3) td.style.background = "#6b8cff";
        else if (diff < -1) td.style.background = "#d0dcff";

      }

      tr.appendChild(td);

    });

    table.appendChild(tr);

  });

  output.appendChild(table);
}

function renderCoverage(title, matrix) {

  const h = document.createElement("h3");
  h.textContent = title;
  output.appendChild(h);

  const table = document.createElement("table");

  matrix.forEach(row => {

    const tr = document.createElement("tr");

    row.forEach(v => {

      const td = document.createElement("td");
      td.textContent = v;

      if (v === 0) td.style.background = "#2b2b2b";
      else if (v < 3) td.style.background = "#3a6ea5";
      else if (v < 10) td.style.background = "#e6c229";
      else td.style.background = "#d62828";

      tr.appendChild(td);

    });

    table.appendChild(tr);

  });

  output.appendChild(table);
}
