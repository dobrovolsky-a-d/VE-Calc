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

  console.log(res);

  setDebug("Done. Check console.");
});
