// parseLog.js
// Парсер RomRaider логов
// Фильтры:
// 1) CL/OL Fueling status (используем только OL = 10)
// 2) TPS >= 4%
// MAP: bar -> psi

export async function parseLog(file) {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) {
    throw new Error("Log file is empty or invalid");
  }

  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map(h => h.trim());

  const idxRPM = headers.findIndex(h => h.includes("Engine Speed"));
  const idxMAP = headers.findIndex(h => h.includes("Manifold Absolute Pressure"));
  const idxAFR = headers.findIndex(h => h.includes("AEM UEGO"));
  const idxTarget = headers.findIndex(h => h.includes("Primary Open Loop"));
  const idxTPS = headers.findIndex(h => h.includes("Throttle Opening"));
  const idxFuelStatus = headers.findIndex(h => h.includes("CL/OL Fueling"));

  if (
    idxRPM < 0 ||
    idxMAP < 0 ||
    idxAFR < 0 ||
    idxTarget < 0 ||
    idxTPS < 0 ||
    idxFuelStatus < 0
  ) {
    throw new Error(
      "Missing required columns.\n" +
      "Required:\n" +
      "- Engine Speed (rpm)\n" +
      "- Manifold Absolute Pressure (bar)\n" +
      "- AEM UEGO Wideband (AFR)\n" +
      "- Primary Open Loop Map Enrichment (AFR)\n" +
      "- Throttle Opening Angle (%)\n" +
      "- CL/OL Fueling* (status)"
    );
  }

  const out = [];

  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(sep);

    const rpm = parseFloat(c[idxRPM]);
    const mapBar = parseFloat(c[idxMAP]);
    const afr = parseFloat(c[idxAFR]);
    const afrTarget = parseFloat(c[idxTarget]);
    const tps = parseFloat(c[idxTPS]);
    const fuelStatus = parseInt(c[idxFuelStatus], 10);

    if ([rpm, mapBar, afr, afrTarget, tps, fuelStatus].some(v => Number.isNaN(v))) {
      continue;
    }

    // ---------- FILTER 1: fuel mode ----------
    if (fuelStatus !== 10) continue;

    // ---------- FILTER 2: TPS ----------
    if (tps < 4) continue;

    out.push({
      rpm,
      map: mapBar * 14.5038, // bar -> psi
      afr,
      afrTarget,
      tps,
      fuelStatus
    });
  }

  if (!out.length) {
    throw new Error("No valid log rows after filtering");
  }

  return out;
}
