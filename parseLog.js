export async function parseLog(file) {

  const text = await file.text();
  const lines = text.split(/\r?\n/);

  const delim = lines[0].includes("\t") ? "\t" : ",";

  const header = lines[0].split(delim);

  const rpmIndex = header.indexOf("Engine Speed (rpm)");
  const mapIndex = header.indexOf("Manifold Absolute Pressure (bar)");
  const tpsIndex = header.indexOf("Throttle Opening Angle (%)");
  const targetIndex = header.indexOf("Primary Open Loop Map Enrichment* (estimated AFR)");
  const afrIndex = header.findIndex(h => h.includes("AEM"));

  const result = [];

  for (let i = 1; i < lines.length; i++) {

    const row = lines[i].split(delim);

    const rpm = +row[rpmIndex];
    const map = +row[mapIndex];
    const afr = +row[afrIndex];
    const afrTarget = +row[targetIndex];
    const tps = +row[tpsIndex];

    if (!rpm || !map || !afr || !afrTarget) continue;

    if (tps <= 0) continue; // 🔥 фильтр

    result.push({ rpm, map, afr, afrTarget });
  }

  return result;
}
