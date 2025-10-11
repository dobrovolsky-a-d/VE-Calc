// parseLog.js — адаптировано под Log_ve_vadim.csv

export async function parseLog(file) {
  const text = await file.text();
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  // Определяем разделитель ("," ";" или таб)
  const sep = lines[0].includes(";") ? ";" :
              lines[0].includes("\t") ? "\t" : ",";

  // Заголовки
  const headers = lines[0].split(sep).map(h => h.trim().toLowerCase());

  // Индексы нужных колонок
  const idxRPM = headers.findIndex(h => h.includes("engine speed"));
  const idxMAP = headers.findIndex(h => h.includes("manifold absolute pressure"));
  const idxAFR = headers.findIndex(h => h.includes("wideband"));
  const idxTarget = headers.findIndex(h => h.includes("fueling final base"));

  if (idxRPM < 0 || idxMAP < 0 || idxAFR < 0 || idxTarget < 0) {
    throw new Error("❌ Не найдены нужные колонки (RPM, MAP, AFR, AFR Target)");
  }

  const data = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(sep).map(p => p.trim());
    if (parts.length <= Math.max(idxRPM, idxMAP, idxAFR, idxTarget)) continue;

    const rpm = parseFloat(parts[idxRPM]);
    const mapBar = parseFloat(parts[idxMAP]);
    const afr = parseFloat(parts[idxAFR]);
    const afrTarget = parseFloat(parts[idxTarget]);

    if (isNaN(rpm) || isNaN(mapBar) || isNaN(afr) || isNaN(afrTarget)) continue;

    // Перевод MAP из бар в kPa
    const mapKpa = mapBar < 5 ? mapBar * 100 : mapBar;

    data.push({
      rpm,
      map: mapKpa,
      afr,
      afrTarget
    });
  }

  console.log(`✅ Parsed ${data.length} valid lines`);
  return data;
}
