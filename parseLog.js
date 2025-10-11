export async function parseLog(file) {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);

  const header = lines[0].split(/[,	;]/).map(h => h.trim().toLowerCase());
  const data = [];

  lines.slice(1).forEach(line => {
    const parts = line.split(/[,	;]/);
    const entry = {};

    header.forEach((h, i) => {
      const val = parseFloat(parts[i]);
      entry[h] = isNaN(val) ? parts[i] : val;
    });

    const rpm = entry['rpm'] ?? entry['engine speed (rpm)'] ?? entry['engine speed'];
    const map = entry['manifold pressure'] ?? entry['map (kpa)'] ?? entry['map'];
    const afrActual = entry['afr actual'] ?? entry['wideband afr'] ?? entry['afr'];
    const afrTarget = entry['afr target'] ?? entry['commanded afr'] ?? entry['target afr'];

    if (rpm && map && afrActual && afrTarget) {
      data.push({
        rpm: Number(rpm),
        map: Number(map),
        afrActual: Number(afrActual),
        afrTarget: Number(afrTarget)
      });
    }
  });

  return data;
}
