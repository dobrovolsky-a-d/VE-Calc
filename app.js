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

document.getElementById("loadLog").addEventListener("change", async e => {
  try {
    logData = await parseLog(e.target.files[0]);
    setDebug(`Log loaded\nRows: ${logData.length}`);
  } catch (err) {
    setDebug("Log error:\n" + err.message);
  }
});

document.getElementById("loadVE").addEventListener("change", async e => {
  try {
    veOld = await parseVE(e.target.files[0]);
    setDebug(`VE table loaded\nRows: ${veOld.rows}\nCols: ${veOld.cols}\nCells: ${veOld.rows * veOld.cols}`);
  } catch (err) {
    setDebug("VE error:\n" + err.message);
  }
});

document.getElementById("calculate").addEventListener("click", () => {
  if (!logData || !veOld) {
    setDebug("Load log and VE table first");
    return;
  }

  result = calculateVE(logData, veOld);
  renderTable(result.VE_new);
  exportBtn.disabled = false;

  const s = result.stats;
  setDebug(
`VE:
Rows: ${s.veRows}
Cols: ${s.veCols}
Cells: ${s.veCells}

LOG:
Total rows: ${s.logRows}
Valid rows: ${s.validLogRows}
Used VE cells: ${s.usedCells}`
  );
});

exportBtn.addEventListener("click", () => {
  exportRomRaider(result.VE_new);
});

function renderTable(matrix) {
  output.innerHTML = "";
  const table = document.createElement("table");

  matrix.forEach(row => {
    const tr = document.createElement("tr");
    row.forEach(v => {
      const td = document.createElement("td");
      td.textContent = v.toFixed(2);
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });

  output.appendChild(table);
}
