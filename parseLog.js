export async function parseLog(file, tpsCutoff = 4) {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map(h => h.trim());

  const idxRPM = headers.findIndex(h => h.includes("Engine Speed (rpm)"));
  const idxMAP = headers.findIndex(h => h.includes("Manifold Absolute Pressure (bar)"));
  const idxAFR = headers.findIndex(h => h.includes("AEM UEGO Wideband [9600 baud] (AFR Gasoline)"));
  const idxTarget = headers.findIndex(h => h.includes("Primary Open Loop Map Enrichment* (estimated AFR)"));
  const idxTPS = headers.findIndex(h => h.includes("Throttle Opening Angle (%)"));
  const idxFuel = headers.findIndex(h => h.includes("CL/OL Fueling"));

  if ([idxRPM, idxMAP, idxAFR, idxTarget, idxTPS, idxFuel].some(i => i < 0)) {
    throw new Error("Missing required columns");
  }

  const out = [];

  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(sep);

    const rpm = parseFloat(c[idxRPM]);
    const mapBar = parseFloat(c[idxMAP]);
    const afr = parseFloat(c[idxAFR]);
    const afrTarget = parseFloat(c[idxTarget]);
    const tps = parseFloat(c[idxTPS]);
    const fuelStatus = parseInt(c[idxFuel], 10);

    if ([rpm, mapBar, afr, afrTarget, tps, fuelStatus].some(Number.isNaN)) continue;
    if (fuelStatus !== 10) continue;
    if (tps < tpsCutoff) continue;

    out.push({
      rpm,
      map: mapBar * 14.5038,
      afr,
      afrTarget
    });
  }

  if (!out.length) throw new Error("No valid rows after filtering");
  return out;
}
