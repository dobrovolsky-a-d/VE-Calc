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

function setDebug(text) {
  debug.textContent = text;
}

document.getElementById("loadLog").addEventListener("change", async (e) => {
  try {
    const tpsCutoff = parseFloat(document.getElementById("tpsCutoff").value);
    logData = await parseLog(e.target.files[0], tpsCutoff);
    setDebug(`Log loaded\nRows after filtering: ${logData.length}`);
  } catch (err) {
    setDebug("Log error:\n" + err.message);
    logData = null;
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
    setDebug("VE error:\n" + err.message);
    veOld = null;
  }
});

document.getElementById("calculate").addEventListener("click", () => {
  if (!logData || !veOld) {
    setDebug("Load log and VE table first");
    return;
  }

  result = calculateVE(logData, veOld);
  renderResult(result);
  exportBtn.disabled = false;

  const s = result.stats;
  setDebug(
`VE TABLE:
Rows: ${s.veRows}
Cols: ${s.veCols}
Cells: ${s.veCells}

LOG:
Rows used: ${s.validLogRows}
Used VE cells: ${s.usedCells}`
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
