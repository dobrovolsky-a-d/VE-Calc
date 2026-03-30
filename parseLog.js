export async function parseLog(file, tpsCutoff = 4) {

  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(l => l.trim().length);

  const separator = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(separator).map(h => h.trim());

  const idxRPM = headers.findIndex(h => h.includes("Engine Speed"));
  const idxMAP = headers.findIndex(h => h.includes("Manifold Absolute Pressure"));
  const idxAFR = headers.findIndex(h => h.includes("AEM UEGO"));
  const idxTarget = headers.findIndex(h => h.includes("Primary Open Loop"));
  const idxTPS = headers.findIndex(h => h.includes("Throttle Opening"));

  if ([idxRPM, idxMAP, idxAFR, idxTarget, idxTPS].some(i => i === -1)) {
    throw new Error("Missing required columns");
  }

  const result = [];

  for (let i = 1; i < lines.length; i++) {

    const cols = lines[i].split(separator);

    const rpm = parseFloat(cols[idxRPM]);
    const mapBar = parseFloat(cols[idxMAP]);
    const afr = parseFloat(cols[idxAFR]);
    const afrTarget = parseFloat(cols[idxTarget]);
    const tps = parseFloat(cols[idxTPS]);

    if (
      Number.isNaN(rpm) ||
      Number.isNaN(mapBar) ||
      Number.isNaN(afr) ||
      Number.isNaN(afrTarget) ||
      Number.isNaN(tps)
    ) continue;

    // TPS filter
    if (tps < tpsCutoff) continue;

    result.push({
      rpm: rpm,
      map: mapBar * 14.5038, // bar → psi
      afr: afr,
      afrTarget: afrTarget
    });
  }

  if (result.length === 0) {
    throw new Error("No valid rows after filtering");
  }

  return result;
}
