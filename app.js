import { parseLog } from "./utils/parseLog.js";
import { parseVE } from "./utils/parseVE.js";
import { calculateVE } from "./utils/veMath.js";
import { exportRomRaider } from "./utils/exportRomRaider.js";

let logData = null;
let veOld = null;
let result = null;

function showMessage(id, msg, color = "#ccc") {
  const el = document.getElementById(id);
  if (el) {
    el.innerHTML = msg;
    el.style.color = color;
  }
}

function showDebug(info) {
  const el = document.getElementById("statusDebug");
  el.innerText = info;
}

// ---------- File loaders ----------
document.getElementById("loadLog").addEventListener("change", async (e) => {
  try {
    logData = await parseLog(e.target.files[0]);
    showMessage("statusLog", `✅ Log loaded (${logData.length} valid lines)`, "#0f0");

    const sample = logData[0];
    if (sample) showDebug("Detected log columns: " + Object.keys(sample).join(", "));
  } catch (err) {
    showMessage("statusLog", "❌ Error loading log: " + err.message, "#f66");
  }
});

document.getElementById("loadVE").addEventListener("change", async (e) => {
  try {
    veOld = await parseVE(e.target.files[0]);
    showMessage("statusVE", `✅ VE table loaded (${veOld.rows}x${veOld.cols})`, "#0f0");
  } catch (err) {
    showMessage("statusVE", "❌ Error loading VE: " + err.message, "#f66");
  }
});

// ---------- Calculate ----------
document.getElementById("calculate").addEventListener("click", () => {
  if (!logData || !veOld) {
    showMessage("statusCalc", "⚠️ Please load both log and VE table.", "#ff0");
    return;
  }
  try {
    result = calculateVE(logData, veOld);
    showTables(result);
    showMessage("statusCalc", "✅ Calculation complete.", "#0f0");
  } catch (err) {
    showMessage("statusCalc", "❌ Error during calculation: " + err.message, "#f66");
  }
});

// ---------- Export ----------
document.getElementById("export").addEventListener("click", () => {
  if (result?.VE_new) {
    exportRomRaider(result.VE_new);
    showMessage("statusCalc", "✅ Exported new VE to CSV", "#0f0");
  } else {
    showMessage("statusCalc", "⚠️ No calculated data to export", "#ff0");
  }
});

// ---------- Show tables ----------
function showTables(data) {
  const out = document.getElementById("output");
  out.innerHTML = "";

  const tables = [
    { title: "Original VE", matrix: data.VE_old },
    { title: "Correction (%)", matrix: data.Correction },
    { title: "Smoothed VE", matrix: data.VE_new },
  ];

  tables.forEach((t) => {
    const h = document.createElement("h3");
    h.textContent = t.title;
    out.appendChild(h);

    const table = document.createElement("table");
    table.className = "ve-table";

    t.matrix.forEach((row) => {
      const tr = document.createElement("tr");
      row.forEach((v) => {
        const td = document.createElement("td");
        td.textContent = v.toFixed ? v.toFixed(2) : v;
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });
    out.appendChild(table);
  });
}
