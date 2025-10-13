export async function parseLog(file) {
  const text = await file.text();
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

  const sep = lines[0].includes(';') ? ';' : (lines[0].includes('\t') ? '\t' : ',');
  const headers = lines[0].split(sep).map(h => h.trim().toLowerCase());

  const idxAFRwide = headers.findIndex(h => h.includes('aem uego') || h.includes('wideband') || h.includes('afr gasoline') || h.includes('afr'));
  const idxRPM = headers.findIndex(h => h.includes('engine speed') || h.includes('rpm'));
  const idxMAP = headers.findIndex(h => (h.includes('manifold') && h.includes('pressure')) || h.includes('map') || h.includes('manifold absolute pressure'));
  const idxFuelBase = headers.findIndex(h => h.includes('fueling final') || h.includes('estimated afr') || h.includes('fueling final base'));

  if (idxRPM < 0 || idxMAP < 0 || idxAFRwide < 0 || idxFuelBase < 0) {
    throw new Error('Не найдены необходимые колонки. Ожидаются: Engine Speed, Manifold Absolute Pressure, AEM UEGO Wideband, Fueling Final Base');
  }

  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(sep).map(p => p.trim());
    if (parts.length <= Math.max(idxRPM, idxMAP, idxAFRwide, idxFuelBase)) continue;
    const rpm = parseFloat(parts[idxRPM]);
    const mapBar = parseFloat(parts[idxMAP]);
    const afr = parseFloat(parts[idxAFRwide]);
    const afrTarget = parseFloat(parts[idxFuelBase]);
    if ([rpm, mapBar, afr, afrTarget].some(v => Number.isNaN(v))) continue;
    const mapKpa = mapBar < 5 ? mapBar * 100 : mapBar;
    out.push({ rpm, map: mapKpa, afr, afrTarget });
  }
  return out;
}
