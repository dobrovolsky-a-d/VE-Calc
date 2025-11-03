export async function parseLog(file){
  const text = await file.text();
  const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(l=>l.length>0);
  const sep = lines[0].includes(';')?';':(lines[0].includes('\t')?'\t':',');
  const headers = lines[0].split(sep).map(h=>h.trim().toLowerCase());

  // ищем стандартные варианты
  const idxRPM = headers.findIndex(h=>h.includes('engine speed')||h.includes('rpm'));
  const idxMAP = headers.findIndex(h=>h.includes('manifold')&&h.includes('pressure') || h.includes('map'));
  const idxAFR = headers.findIndex(h=>h.includes('wideband')||h.includes('aem uego')||h.includes('afr'));
  const idxTarget = headers.findIndex(h=>h.includes('fueling')||h.includes('estimated afr')||h.includes('target'));

  if(idxRPM<0||idxMAP<0||idxAFR<0||idxTarget<0) throw new Error('Не найдены колонки RPM/MAP/AFR/AFR target в заголовке');

  const out = [];
  for(let i=1;i<lines.length;i++){
    const p = lines[i].split(sep).map(s=>s.trim());
    if(p.length<=Math.max(idxRPM,idxMAP,idxAFR,idxTarget)) continue;
    const rpm = parseFloat(p[idxRPM]);
    const map = parseFloat(p[idxMAP]);
    const afr = parseFloat(p[idxAFR]);
    const afrTarget = parseFloat(p[idxTarget]);
    if([rpm,map,afr,afrTarget].some(v=>Number.isNaN(v))) continue;
    const mapKpa = map < 5 ? map*100 : map; // bar->kPa
    out.push({ rpm, map: mapKpa, afr, afrTarget });
  }
  return out;
}
