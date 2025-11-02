export async function parseLog(file) {
  const text = await file.text();
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  
  if (lines.length < 2) throw new Error('Log file is empty or too short');

  const sep = ';';
  const headers = lines[0].split(sep).map(h => h.trim().toLowerCase());

  console.log('Log headers:', headers);

  // Определяем индексы колонок
  const columnMap = {
    rpm: headers.findIndex(h => h.includes('engine speed') || h.includes('rpm')),
    map: headers.findIndex(h => h.includes('manifold absolute pressure') || h.includes('map')),
    afr: headers.findIndex(h => h.includes('aem uego') || h.includes('afr gasoline') || h.includes('wideband')),
    afrTarget: headers.findIndex(h => h.includes('fueling final') || h.includes('estimated afr') || h.includes('target'))
  };

  console.log('Column indices:', columnMap);

  if (columnMap.rpm === -1) throw new Error('RPM column not found');
  if (columnMap.map === -1) throw new Error('MAP column not found');
  if (columnMap.afr === -1) throw new Error('AFR column not found');

  const out = [];
  
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(sep).map(p => p.trim());
    if (parts.length <= Math.max(columnMap.rpm, columnMap.map, columnMap.afr)) continue;

    // Парсим значения
    const rpm = parseFloat(parts[columnMap.rpm].replace(',', '.'));
    const mapValKPA = parseFloat(parts[columnMap.map].replace(',', '.'));
    const afr = parseFloat(parts[columnMap.afr].replace(',', '.'));

    // Пропускаем только полностью невалидные данные
    if (isNaN(rpm) || isNaN(mapValKPA) || isNaN(afr)) continue;

    // Конвертируем kPa в PSI
    const mapValPSI = mapValKPA * 0.145038;

    // AFR target
    let afrTarget = 14.7;
    if (columnMap.afrTarget !== -1) {
      const targetVal = parseFloat(parts[columnMap.afrTarget].replace(',', '.'));
      if (!isNaN(targetVal)) {
        afrTarget = targetVal;
      }
    }

    out.push({ 
      rpm: Math.round(rpm), 
      map: Math.round(mapValPSI * 100) / 100,
      afr: Math.round(afr * 100) / 100, 
      afrTarget: Math.round(afrTarget * 100) / 100 
    });
  }

  if (out.length === 0) throw new Error('No numeric data found in log file');

  console.log('Successfully parsed', out.length, 'log entries');
  console.log('Sample data:', out.slice(0, 3));
  
  return out;
}
