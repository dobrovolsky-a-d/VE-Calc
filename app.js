import { parseLog } from "./parseLog.js";
import { parseVEFromText } from "./parseVEfromText.js";
import { calculateVE } from "./veMath.js";

let logData = null;
let veOld = null;

const out = document.getElementById("output");

// 🔥 debug блок
const debug = document.createElement("div");
debug.style.marginBottom = "15px";
debug.style.padding = "10px";
debug.style.background = "#fff3cd";
debug.style.border = "1px solid #ffeeba";
debug.style.borderRadius = "6px";
document.body.insertBefore(debug, out);

function setDebug(text){
  debug.innerText = text;
}

/* LOAD LOG */
document.getElementById("loadLog").onchange = async (e) => {

  try {

    setDebug("Loading log...");

    logData = await parseLog(e.target.files[0]);

    setDebug("Log loaded: " + logData.length + " rows");

  } catch (err) {

    console.error(err);
    setDebug("LOG ERROR:\n" + err.message);
  }
};

/* LOAD VE */
document.getElementById("loadManualVE").onclick = () => {

  try {

    veOld = parseVEFromText(
      rpmAxis.value,
      mapAxis.value,
      veTable.value
    );

    setDebug("VE loaded: " + veOld.rows + "x" + veOld.cols);

  } catch (e) {
    setDebug("VE ERROR:\n" + e.message);
  }
};

/* CALCULATE */
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

    setDebug("Done");

  } catch (e) {
    console.error(e);
    setDebug("CALC ERROR:\n" + e.message);
  }
};

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
  div.innerHTML="<h3>COVERAGE</h3>";

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
