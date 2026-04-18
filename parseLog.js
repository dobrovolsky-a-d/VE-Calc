export async function parseLog(file) {

  const text = await file.text();
  const lines = text.split(/\r?\n/);

  const header = lines[0].split(",");

  const rpmIndex = header.indexOf("Engine Speed (rpm)");
  const mapIndex = header.indexOf("Manifold Absolute Pressure (bar)");
  const targetIndex = header.indexOf("Primary Open Loop Map Enrichment* (estimated AFR)");
  const afrIndex = header.findIndex(h => h.includes("AEM UEGO"));

  if (rpmIndex === -1 || mapIndex === -1 || afrIndex === -1 || targetIndex === -1) {
    throw new Error("Missing required columns");
  }

  const result = [];

  for (let i = 1; i < lines.length; i++) {

    const row = lines[i].split(",");

    const rpm = parseFloat(row[rpmIndex]);
    const mapBar = parseFloat(row[mapIndex]); // абсолютное давление
    const afr = parseFloat(row[afrIndex]);
    const afrTarget = parseFloat(row[targetIndex]);

    if (isNaN(rpm) || isNaN(mapBar) || isNaN(afr) || isNaN(afrTarget)) continue;

    result.push({
      rpm,
      map: mapBar,   // остаётся absolute BAR
      afr,
      afrTarget
    });
  }

  return result;
}
