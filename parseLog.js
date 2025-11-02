export async function parseLog(file) {
  console.log('🟢 FORCE PARSING LOG...');
  const text = await file.text();
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  
  if (lines.length < 2) throw new Error('Log file is empty or too short');

  const sep = ';';
  const headers = lines[0].split(sep).map(h => h.trim().toLowerCase());
  
  console.log('HEADERS FOUND:', headers);

  // Принудительно определяем колонки по индексам (ваш лог имеет фиксированный порядок)
  const columnMap = {
    rpm: 1,        // "Engine Speed (rpm)"
    map: 3,        // "Manifold Absolute Pressure (kPa)" 
    afr: 7,        // "AEM UEGO Wideband [9600 baud] (AFR Gasoline)"
    afrTarget: 8   // "Fueling Final Base* (estimated AFR)"
  };

  console.log('Using forced column indices:', columnMap);

  const out = [];
  
  // Берем только первые 50 строк для теста
  for (let i = 1; i < Math.min(lines.length, 50); i++) {
    const parts = lines[i].split(sep).map(p => p.trim());
    if (parts.length < 9) continue; // Должно быть至少 9 колонок

    try {
      const rpm = parseFloat(parts[1].replace(',', '.'));
      const mapValKPA = parseFloat(parts[3].replace(',', '.'));
      const afr = parseFloat(parts[7].replace(',', '.'));
      const afrTarget = parseFloat(parts[8].replace(',', '.'));

      // Конвертируем kPa в PSI
      const mapValPSI = mapValKPA * 0.145038;

      out.push({ 
        rpm: Math.round(rpm), 
        map: Math.round(mapValPSI * 100) / 100,
        afr: Math.round(afr * 100) / 100, 
        afrTarget: Math.round(afrTarget * 100) / 100 
      });
    } catch (err) {
      console.log('Error parsing line', i, err);
    }
  }

  console.log(`Parsed ${out.length} points from first 50 lines`);
  console.log('Sample:', out.slice(0, 3));
  
  if (out.length === 0) throw new Error('Force parsing failed - no data extracted');
  
  return out;
}
