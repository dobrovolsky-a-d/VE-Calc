export async function parseLog(file) {

  const text = await file.text();
  const lines = text.split(/\r?\n/);

  if (lines.length < 2) {
    throw new Error("Empty log");
  }

  // 🔥 авто-детект разделителя
  function detectDelimiter(line) {
    if (line.includes("\t")) return "\t";
    if (line.includes(";")) return ";";
    if (line.includes(",")) return ",";
    return ",";
  }

  const delimiter = detectDelimiter(lines[0]);

  const clean = s =>
    s.replace(/["']/g, "").trim().toLowerCase();

  const headerRaw = lines[0].split(delimiter);
  const header = headerRaw.map(clean);

  function findExact(name) {
    const target = clean(name);
    return header.findIndex(h => h === target);
  }

  const rpmIndex = findExact("Engine Speed (rpm)");
  const mapIndex = findExact("Manifold Absolute Pressure (bar)");
  const targetIndex = findExact("Primary Open Loop Map Enrichment* (estimated AFR)");

  const afrIndex = header.findIndex(h =>
    h.includes("uego") || h.includes("aem")
  );

  console.log("DELIMITER:", delimiter);
  console.log("HEADER:", headerRaw);
  console.log("INDEXES:", { rpmIndex, mapIndex, targetIndex, afrIndex });

  if (rpmIndex === -1 || mapIndex === -1 || afrIndex === -1 || targetIndex === -1) {
    throw new Error("Missing required columns — смотри console");
  }

  const result = [];

  for (let i = 1; i < lines.length; i++) {

    const row = lines[i].split(delimiter);

    const rpm = parseFloat(row[rpmIndex]);
    const mapBar = parseFloat(row[mapIndex]);
    const afr = parseFloat(row[afrIndex]);
    const afrTarget = parseFloat(row[targetIndex]);

    if (isNaN(rpm) || isNaN(mapBar) || isNaN(afr) || isNaN(afrTarget)) continue;

    result.push({
      rpm,
      map: mapBar,
      afr,
      afrTarget
    });
  }

  return result;
}
