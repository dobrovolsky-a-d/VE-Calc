export async function parseLog(file) {

  const text = await file.text();
  const lines = text.split(/\r?\n/);

  if (lines.length < 2) {
    throw new Error("Empty log");
  }

  // --- delimiter ---
  const delim = lines[0].includes("\t") ? "\t"
               : lines[0].includes(";") ? ";"
               : ",";

  // --- header ---
  const headerRaw = lines[0].split(delim).map(h => h.trim());

  console.log("HEADER:", headerRaw);

  // 🔥 ЖЁСТКОЕ сопоставление под PSI лог
  const rpmIndex = headerRaw.indexOf("Engine Speed (rpm)");

  // 👇 ВАЖНО: ищем именно PSI
  let mapIndex = headerRaw.indexOf("Manifold Absolute Pressure (psi)");
  if (mapIndex === -1) {
    // fallback если чуть иначе названо
    mapIndex = headerRaw.findIndex(h =>
      h.toLowerCase().includes("manifold") &&
      h.toLowerCase().includes("psi")
    );
  }

  const tpsIndex = headerRaw.indexOf("Throttle Opening Angle (%)");

  const targetIndex = headerRaw.indexOf(
    "Primary Open Loop Map Enrichment* (estimated AFR)"
  );

  const afrIndex = headerRaw.findIndex(h =>
    h.includes("AEM") || h.includes("UEGO")
  );

  console.log("INDEXES:", {
    rpmIndex,
    mapIndex,
    tpsIndex,
    afrIndex,
    targetIndex
  });

  if (rpmIndex === -1 || mapIndex === -1 || afrIndex === -1 || targetIndex === -1) {
    throw new Error("Required columns not found (check header in console)");
  }

  const result = [];

  let total = 0;
  let kept = 0;

  for (let i = 1; i < lines.length; i++) {

    const row = lines[i].split(delim);

    total++;

    const rpm = parseFloat(row[rpmIndex]);
    const mapPsi = parseFloat(row[mapIndex]);   // 🔥 уже PSI
    const afr = parseFloat(row[afrIndex]);
    const afrTarget = parseFloat(row[targetIndex]);
    const tps = tpsIndex !== -1 ? parseFloat(row[tpsIndex]) : NaN;

    if (
      isNaN(rpm) ||
      isNaN(mapPsi) ||
      isNaN(afr) ||
      isNaN(afrTarget)
    ) continue;

    // мягкий фильтр
    if (!isNaN(tps) && tps < 1) continue;

    kept++;

    result.push({
      rpm,
      map: mapPsi,   // 🔥 ВАЖНО: уже PSI
      afr,
      afrTarget
    });

    // debug первые строки
    if (i < 5) {
      console.log({
        rpm,
        mapPsi,
        afr,
        afrTarget,
        tps
      });
    }
  }

  console.log("LOG STATS:", { total, kept });

  // диапазоны (ключевая диагностика)
  if (result.length > 0) {
    console.log(
      "MAP PSI range:",
      Math.min(...result.map(p => p.map)),
      Math.max(...result.map(p => p.map))
    );
  }

  return result;
}
