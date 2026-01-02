export async function parseLog(file) {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(l => l.trim());

  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].toLowerCase().split(sep);

  const idxRPM = headers.findIndex(h => h.includes("rpm"));
  const idxMAP = headers.findIndex(h => h.includes("psi"));
  const idxAFR = headers.findIndex(h => h.includes("afr"));
  const idxTarget = headers.findIndex(h => h.includes("target"));

  if (idxRPM < 0 || idxMAP < 0 || idxAFR < 0 || idxTarget < 0)
    throw new Error("Missing required columns");

  const data = [];

  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(sep);
    const rpm = parseFloat(c[idxRPM]);
    const map = parseFloat(c[idxMAP]);
    const afr = parseFloat(c[idxAFR]);
    const afrTarget = parseFloat(c[idxTarget]);
    if ([rpm, map, afr, afrTarget].some(isNaN)) continue;
    data.push({ rpm, map, afr, afrTarget });
  }

  return data;
}
