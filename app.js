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

  result = calculateVE(logData, veOld);
  renderResult(result);
  exportBtn.disabled = false;

  setDebug(
`Calculation done
Used VE cells: ${result.stats.usedCells}`
  );
});

exportBtn.addEventListener("click", () => {
  if (result) exportRomRaider(result.VE_new);
});

function renderResult(res) {
  output.innerHTML = "";
  renderTable("Original VE", res.VE_old);
  renderTable("Correction %", res.Correction);
  renderTable("New VE", res.VE_new);
}

function renderTable(title, matrix) {
  const h = document.createElement("h3");
  h.textContent = title;
  output.appendChild(h);

  const table = document.createElement("table");
  matrix.forEach(row => {
    const tr = document.createElement("tr");
    row.forEach(v => {
      const td = document.createElement("td");
      td.textContent = Number(v).toFixed(2);
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });
  output.appendChild(table);
}
