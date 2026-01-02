import { parseLog } from "./parseLog.js";
import { parseVE } from "./parseVE.js";
import { calculateVE } from "./veMath.js";
import { exportRomRaider } from "./exportRomRaider.js";

let logData=null, veOld=null, result=null;
const debug=document.getElementById("debug");
const output=document.getElementById("output");
const exportBtn=document.getElementById("export");

document.getElementById("loadLog").addEventListener("change", async e=>{
  try{
    logData=await parseLog(e.target.files[0]);
    debug.textContent=`Log loaded\nRows: ${logData.length}`;
  }catch(err){debug.textContent=err.message;}
});

document.getElementById("loadVE").addEventListener("change", async e=>{
  try{
    veOld=await parseVE(e.target.files[0]);
    debug.textContent=`VE loaded\nRows:${veOld.rows}\nCols:${veOld.cols}\nCells:${veOld.rows*veOld.cols}`;
  }catch(err){debug.textContent=err.message;}
});

document.getElementById("calculate").addEventListener("click",()=>{
  if(!logData||!veOld){debug.textContent="Load files first";return;}
  result=calculateVE(logData,veOld);
  render(result);
  exportBtn.disabled=false;
  const s=result.stats;
  debug.textContent=
`VE:
Rows:${s.veRows} Cols:${s.veCols} Cells:${s.veCells}
LOG:
Rows:${s.logRows}
Valid:${s.validLogRows}
Used cells:${s.usedCells}`;
});

exportBtn.addEventListener("click",()=>exportRomRaider(result.VE_new));

function render(r){
  output.innerHTML="";
  add("Original VE",r.VE_old);
  add("Correction %",r.Correction);
  add("New VE",r.VE_new);
}

function add(title,m){
  const h=document.createElement("h3");h.textContent=title;output.appendChild(h);
  const t=document.createElement("table");
  m.forEach(row=>{
    const tr=document.createElement("tr");
    row.forEach(v=>{
      const td=document.createElement("td");
      td.textContent=Number(v).toFixed(2);
      tr.appendChild(td);
    });
    t.appendChild(tr);
  });
  output.appe
