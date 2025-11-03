export async function parseLog(file) {
  const text = await file.text();
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

  // detect separator: comma, semicolon, tab
  const sep = lines[0].includes(';') ? ';' : (lines[0].includes('\t') ? '\t' : ',');
  const headers = lines[0].split(sep).map(h => h.trim().toLowerCase());

  // try to find common names
  const idxRPM = headers.findIndex(h => h.includes('engine speed') || h.includes('rpm'));
  const idxMAP = headers.findIndex(h => h.includes('manifold') && h.includes('pressure') || h.includes('map'));
  const idxAFR = headers.findIndex(h => h.includes('aem uego') || h.includes('wideband') || h.includes('afr gasoline') || h.includes('afr'));
  const idxTarget = headers.findIndex(h => h.includes('fueling final') || h.includes('estimated afr') || h.includes('fueling final base') || h.includes('target'));

  if (idxRPM < 0 || idxMAP < 0 || idxAFR < 0 || idxTarget < 0) {
    throw new Error('Не найдены колонки RPM/MAP/AFR/AFR Target в заголовке лога');
  }

  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(sep).map(p => p.trim());
    if (parts.length <= Math.max(idxRPM, idxMAP, idxAFR, idxTarget)) continue;
    const rpm = parseFloat(parts[idxRPM]);
    const mapVal = parseFloat(parts[idxMAP]);
    const afr = parseFloat(parts[idxAFR]);
    const afrTarget = parseFloat(parts[idxTarget]);
    if ([rpm, mapVal, afr, afrTarget].some(v => Number.isNaN(v))) continue;
    const mapKpa = mapVal < 5 ? mapVal * 100 : mapVal;
    out.push({ rpm, map: mapKpa, afr, afrTarget });
  }
  return out;
};
