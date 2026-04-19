import { parseLog } from "./parseLog.js";
import { parseVEFromText } from "./parseVEfromText.js";
import { calculateVE } from "./veMath.js";

let logData = null;
let veOld = null;

const out = document.getElementById("output");

/* ---------- DEBUG ---------- */
const debug = document.createElement("div");
debug.style.marginBottom = "15px";
debug.style.padding = "10px";
debug.style.background = "#fff3cd";
debug.style.border = "1px solid #ffeeba";
debug.style.borderRadius = "6px";
document.body.insertBefore(debug, out);

function setDebug(t){
  debug.innerText = t;
}

/* ---------- LOAD LOGS ---------- */
document.getElementById("loadLog").onchange = async (e) => {

  try {

    setDebug("Loading logs...");

    const files = Array.from(e.target.files);

    let merged = [];
    let info = [];

    for (let f of files) {

      const data = await parseLog(f);

      merged.push(...data);
      info.push(`${f.name}: ${data.length}`);
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
      rpmAxis.value,
      mapAxis.value,
      veTable.value
    );

    setDebug(`VE loaded: ${veOld.rows} x ${veOld.cols}`);

  } catch (e) {
    setDebug("VE ERROR:\n" + e.message);
  }
};

/* ---------- COVERAGE ONLY ---------- */
document.getElementById("showCoverage").onclick = () => {

  try {

    if (!logData) {
      setDebug("Load logs first");
      return;
    }

    // временная сетка (без VE)
    const rpmAxis = autoAxis(logData.map(p => p.rpm), 18);
    const loadAxis = autoAxis(logData.map(p => p.map * 14.5), 18);

    const coverage = buildCoverage(logData, rpmAxis, loadAxis);

    out.innerHTML = "";
    out.appendChild(makeCoverage(coverage));

    setDebug("Coverage built (auto axes)");

  } catch (e) {
    console.error(e);
    setDebug("COVERAGE ERROR:\n" + e.message);
  }
};

/* ---------- CALCULATE VE ---------- */
document.getElementById("calculate").onclick = () => {

  try {

    if (!logData || !veOld) {
      setDebug("Load log and VE first");
      return;
    }

    const res = calculateVE(logData, veOld);

    out.innerHTML = "";

    out.appendChild(makeTable("VE OLD", res.VE_old));
    out.appendChild(makeTable("VE NEW", res.VE_new, res.VE_old));
    out.appendChild(makeTable("CORR %", res.Correction));
    out.appendChild(makeCoverage(res.coverage));

    setDebug("VE calculated");

  } catch (e) {
    console.error(e);
    setDebug("CALC ERROR:\n" + e.message);
  }
};

/* ---------- AUTO AXIS ---------- */

function autoAxis(values, bins){

  const min = Math.min(...values);
  const max = Math.max(...values);

  const step = (max - min) / (bins - 1);

  const axis = [];

  for (let i = 0; i < bins; i++){
    axis.push(min + step * i);
  }

  return axis;
}

/* ---------- COVERAGE ---------- */

function buildCoverage(log, rpmAxis, loadAxis){

  const rows = rpmAxis.length;
  const cols = loadAxis.length;

  const cov = Array.from({length:rows},()=>Array(cols).fill(0));

  for (let p of log){

    const mapPsi = p.map * 14.5038;

    const r = findClosest(rpmAxis, p.rpm);
    const c = findClosest(loadAxis, mapPsi);

    cov[r][c]++;
  }

  return cov;
}

function findClosest(axis, value){

  let best = 0;
  let min = Math.abs(axis[0] - value);

  for (let i=1;i<axis.length;i++){
    const d = Math.abs(axis[i]-value);
    if (d<min){
      min=d;
      best=i;
    }
  }

  return best;
}

/* ---------- RENDER ---------- */

function makeTable(title, data, base=null){

  const div=document.createElement("div");
  div.innerHTML=`<h3>${title}</h3>`;

  const t=document.createElement("table");

  data.forEach((r,i)=>{
    const tr=document.createElement("tr");

    r.forEach((v,j)=>{
      const td=document.createElement("td");
      td.textContent = isNaN(v) ? "-" : v.toFixed(1);

      if(base && Math.abs(v-base[i][j])>0.1){
        td.classList.add("changed");
      }

      tr.appendChild(td);
    });

    t.appendChild(tr);
  });

  div.appendChild(t);
  return div;
}

function makeCoverage(data){

  const div=document.createElement("div");
  div.innerHTML="<h3>LOG COVERAGE</h3>";

  const t=document.createElement("table");

  data.forEach(r=>{
    const tr=document.createElement("tr");

    r.forEach(v=>{
      const td=document.createElement("td");
      td.textContent = v;

      if(v>50) td.className="cover-high";
      else if(v>10) td.className="cover-mid";
      else if(v>0) td.className="cover-low";

      tr.appendChild(td);
    });

    t.appendChild(tr);
  });

  div.appendChild(t);
  return div;
}
