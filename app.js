import { parseLog } from "./parseLog.js";
import { parseVEFromText } from "./parseVEfromText.js";
import { calculateVE } from "./veMath.js";

let logData = null;
let veOld = null;

const debug = document.getElementById("debug");

function setDebug(t) {
  debug.textContent = t;
}

/* LOAD LOG */
document.getElementById("loadLog").addEventListener("change", async (e) => {
  try {
    logData = await parseLog(e.target.files[0]);
    setDebug("Log loaded: " + logData.length);
  } catch (err) {
    setDebug("Log error:\n" + err.message);
  }
});

/* LOAD VE */
document.getElementById("loadManualVE").addEventListener("click", () => {

  try {
    const rpm = document.getElementById("rpmAxis").value;
    const map = document.getElementById("mapAxis").value;
    const ve  = document.getElementById("veTable").value;

    veOld = parseVEFromText(rpm, map, ve);

    setDebug("VE loaded: " + veOld.rows + "x" + veOld.cols);

  } catch (e) {
    setDebug("VE error:\n" + e.message);
  }

});

/* CALCULATE */
document.getElementById("calculate").addEventListener("click", () => {

  if (!logData || !veOld) {
    setDebug("Load log and VE");
    return;
  }

  const mode = document.getElementById("mode").value;
const res = calculateVE(logData, veOld, mode);

renderResult(res);

setDebug("Done.");
});

function renderResult(res) {

  debug.textContent = "";

  const container = document.createElement("div");

  container.appendChild(makeTable("VE OLD", res.VE_old));
  container.appendChild(makeTable("VE NEW", res.VE_new));
  container.appendChild(makeTable("CORR %", res.Correction));
  container.appendChild(makeTable("COVERAGE", res.coverage));

  document.body.appendChild(container);
}

function makeTable(title, data) {

  const wrapper = document.createElement("div");

  const h = document.createElement("h3");
  h.textContent = title;
  wrapper.appendChild(h);

  const table = document.createElement("table");

  data.forEach(row => {
    const tr = document.createElement("tr");

    row.forEach(v => {
      const td = document.createElement("td");
      td.textContent = Number(v).toFixed(1);
      td.style.padding = "4px";
      td.style.border = "1px solid #444";
      tr.appendChild(td);
    });

    table.appendChild(tr);
  });

  wrapper.appendChild(table);
  return wrapper;
}
