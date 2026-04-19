import { parseLog } from "./parseLog.js";
import { parseVEFromText } from "./parseVEfromText.js";
import { calculateVE } from "./veMath.js";

let logData=null;
let veOld=null;

const out=document.getElementById("output");

document.getElementById("loadLog").onchange=async e=>{
  logData=await parseLog(e.target.files[0]);
};

document.getElementById("loadManualVE").onclick=()=>{
  veOld=parseVEFromText(
    rpmAxis.value,
    mapAxis.value,
    veTable.value
  );
};

document.getElementById("calculate").onclick=()=>{

  const res=calculateVE(logData,veOld);

  out.innerHTML="";

  out.appendChild(makeTable("VE OLD",res.VE_old));
  out.appendChild(makeTable("VE NEW",res.VE_new,res.VE_old));
  out.appendChild(makeTable("CORR %",res.Correction));
  out.appendChild(makeCoverage(res.coverage));
};

function makeTable(title,data,base=null){

  const div=document.createElement("div");
  div.innerHTML=`<h3>${title}</h3>`;

  const t=document.createElement("table");

  data.forEach((r,i)=>{
    const tr=document.createElement("tr");

    r.forEach((v,j)=>{
      const td=document.createElement("td");
      td.textContent=v.toFixed(1);

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
      td.textContent=v;

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
