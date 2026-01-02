export async function parseLog(file){
  const text=await file.text();
  const lines=text.split(/\r?\n/).filter(l=>l.trim());
  const sep=lines[0].includes(";")?";":",";
  const h=lines[0].toLowerCase().split(sep);

  const r=h.findIndex(v=>v.includes("rpm"));
  const m=h.findIndex(v=>v.includes("psi"));
  const a=h.findIndex(v=>v.includes("afr")&&!v.includes("target"));
  const t=h.findIndex(v=>v.includes("target"));

  if(r<0||m<0||a<0||t<0) throw Error("Missing required columns");

  const out=[];
  for(let i=1;i<lines.length;i++){
    const c=lines[i].split(sep);
    const rpm=+c[r], map=+c[m], afr=+c[a], afrTarget=+c[t];
    if([rpm,map,afr,afrTarget].some(isNaN)) continue;
    out.push({rpm,map,afr,afrTarget});
  }
  return out;
}
