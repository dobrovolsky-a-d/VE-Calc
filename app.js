import { parseLog } from "./parseLog.js";
import { parseVE } from "./parseVE.js";
import { calculateVE } from "./veMath.js";

let logData = null;
let veOld = null;

const debug = document.getElementById("debug");
const output = document.getElementById("output");

function setDebug(t) {
  debug.textContent = t;
}

/* LOAD LOG */
document.getElementById("loadLog").addEventListener("change", async (e) => {
  try {
    const file = e.target.files[0];
    logData = await parseLog(file);

    setDebug(`Log loaded: ${logData.length} rows`);

  } catch (err) {
    setDebug("Log error:\n" + err.message);
  }
});

/* LOAD VE */
document.getElementById("loadVE").addEventListener("change", async (e) => {
  try {
    veOld = await parseVE(e.target.files[0]);

    setDebug(`VE loaded: ${veOld.rows}x${veOld.cols}`);

  } catch (err) {
    setDebug("VE error:\n" + err.message);
  }
});

/* CALCULATE */
document.getElementById("calculate").addEventListener("click", () => {

  if (!logData || !veOld) {
    setDebug("Load log and VE first");
    return;
  }

  const res = calculateVE(logData, veOld, "hard");

  console.log(res);

  setDebug("Done. Check console.");
});
