export async function parseLog(file) {
  console.log('🟢 UNIVERSAL LOG PARSER...');
  const text = await file.text();
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  
  console.log('Total lines:', lines.length);
  console.log('First line:', lines[0]);
  
  if (lines.length < 2) throw new Error('Log file is empty or too short');

  const sep = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(sep).map(h => h.trim().toLowerCase());
  
  console.log('Detected separator:', sep);
  console.log('All headers:', headers);

  // Универсальное определение колонок
  let columnMap = {};
  
  // Перебираем все возможные варианты названий
  headers.forEach((header, index) => {
    if (header.includes('rpm') || header.includes('engine speed')) columnMap.rpm = index;
    if (header.includes('map') || header.includes('manifold') || header.includes('pressure')) columnMap.map = index;
    if (header.includes('afr') || header.includes('wideband') || header.includes('uego') || header.includes('lambda')) columnMap.afr = index;
    if (header.includes('target') || header.includes('commanded') || header.includes('fueling')) columnMap.afrTarget = index;
  });

  console.log('Auto-detected columns:', columnMap);

  // Если автоматика не сработала, используем принудительные индексы
  if (columnMap.rpm === undefined || columnMap.map === undefined || columnMap.afr === undefined) {
    console.log('Auto-detection failed, using fallback indices...');
    
    // Пробуем разные варианты индексов
    if (headers.includes('engine speed (rpm)')) {
      // Ваш формат 1
      columnMap = { rpm: 1, map: 3, afr: 7, afrTarget: 8 };
    } else if (headers.includes('rpm')) {
      // Другой возможный формат
      columnMap = { rpm: 0, map: 1, afr: 2, afrTarget: 3 };
    } else {
      // Последняя попытка - берем первые 4 колонки
      columnMap = { rpm: 0, map: 1, afr: 2, afrTarget: 3 };
    }
  }

  console.log('Final column map:', columnMap);

  const out = [];
  let successCount = 0;
  let errorCount = 0;
  
  // Обрабатываем все строки
  for (let i = 1; i < lines.length; i++) {
    try {
      const parts = lines[i].split(sep).map(p => p.trim());
      
      // Пропускаем строки с недостаточным количеством колонок
      const maxIndex = Math.max(columnMap.rpm, columnMap.map, columnMap.afr);
      if (parts.length <= maxIndex) {
        errorCount++;
        continue;
      }

      // Парсим значения с обработкой ошибок
      const rpmStr = parts[columnMap.rpm]?.replace(',', '.') || '0';
      const mapStr = parts[columnMap.map]?.replace(',', '.') || '0';
      const afrStr = parts[columnMap.afr]?.replace(',', '.') || '0';
      
      const rpm = parseFloat(rpmStr);
      const mapValKPA = parseFloat(mapStr);
      const afr = parseFloat(afrStr);

      // Проверяем на минимальную валидность
      if (isNaN(rpm) || isNaN(mapValKPA) || isNaN(afr)) {
        errorCount++;
        continue;
      }

      // Конвертируем kPa в PSI
      const mapValPSI = mapValKPA * 0.145038;

      // AFR target (опционально)
      let afrTarget = 14.7;
      if (columnMap.afrTarget !== undefined && parts[columnMap.afrTarget]) {
        const targetStr = parts[columnMap.afrTarget].replace(',', '.');
        const targetVal = parseFloat(targetStr);
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
      
      successCount++;
      
    } catch (err) {
      errorCount++;
      // Пропускаем ошибки в отдельных строках
    }
  }

  console.log(`Parsing result: ${successCount} success, ${errorCount} errors, total ${out.length} points`);
  
  if (out.length === 0) {
    throw new Error(`No data parsed. Success: ${successCount}, Errors: ${errorCount}. Check console for headers.`);
  }

  // Статистика
  const stats = {
    rpm: out.length > 0 ? `${Math.min(...out.map(p => p.rpm))}-${Math.max(...out.map(p => p.rpm))} RPM` : 'N/A',
    map: out.length > 0 ? `${Math.min(...out.map(p => p.map))}-${Math.max(...out.map(p => p.map))} PSI` : 'N/A', 
    afr: out.length > 0 ? `${Math.min(...out.map(p => p.afr))}-${Math.max(...out.map(p => p.afr))} AFR` : 'N/A'
  };
  
  console.log('Data statistics:', stats);
  console.log('First 5 points:', out.slice(0, 5));

  return out;
}
