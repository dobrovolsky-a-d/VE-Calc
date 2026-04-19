export async function parseLog(file) {

  const text = await file.text();
  const lines = text.split(/\r?\n/);

  const delim = lines[0].includes("\t") ? "\t"
               : lines[0].includes(";") ? ";"
               : ",";

  const headerRaw = lines[0].split(delim);

  const normalize = s =>
    s.toLowerCase().replace(/["']/g,"").trim();

  const header = headerRaw.map(normalize);

  function find(keys){
    return header.findIndex(h =>
      keys.some(k => h.includes(k))
    );
  }

  const rpmIndex = find(["engine speed","rpm"]);
  const mapIndex = find(["manifold absolute","map"]);
  const tpsIndex = find(["throttle"]);
  const afrIndex = find(["uego","aem","afr"]);
  const targetIndex = find(["enrichment","target"]);

  console.log("INDEXES:", {
    rpmIndex, mapIndex, tpsIndex, afrIndex, targetIndex
  });

  if (rpmIndex===-1 || mapIndex===-1 || afrIndex===-1 || targetIndex===-1){
    throw new Error("Columns not found — смотри console");
  }

  const result=[];

  for (let i=1;i<lines.length;i++){

    const row = lines[i].split(delim);

    const rpm = parseFloat(row[rpmIndex]);
    const map = parseFloat(row[mapIndex]);
    const afr = parseFloat(row[afrIndex]);
    const afrTarget = parseFloat(row[targetIndex]);
    const tps = parseFloat(row[tpsIndex]);

    if (
      isNaN(rpm) ||
      isNaN(map) ||
      isNaN(afr) ||
      isNaN(afrTarget)
    ) continue;

    if (!isNaN(tps) && tps < 1) continue;

    result.push({ rpm, map, afr, afrTarget });
  }

  console.log("ROWS:", result.length);

  return result;
}
