export async function parseLog(file) {
  const text = await file.text();
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) throw new Error('Лог пустой или слишком короткий');

  const sep = detectSeparator(lines[0]);
  const headers = lines[0].split(sep).map(h => h.trim().toLowerCase());

  // Расширенный поиск колонок
  const columnMap = {
    rpm: findColumn(headers, ['rpm', 'engine speed', 'enginespeed', 'speed']),
    map: findColumn(headers, ['map', 'manifold pressure', 'manifold absolute pressure', 'boost', 'pressure']),
    afr: findColumn(headers, ['afr', 'wideband', 'aem', 'lambda', 'uo2', 'oxygen']),
    afrTarget: findColumn(headers, ['afr target', 'target afr', 'commanded afr', 'fuel final', 'afr commanded', 'target'])
  };

  // Проверка обязательных колонок
  if (columnMap.rpm === -1) throw new Error('Не найдена колонка RPM');
  if (columnMap.map === -1) throw new Error('Не найдена колонка MAP');
  if (columnMap.afr === -1) throw new Error('Не найдена колонка AFR');

  const out = [];
  let skipped = 0;
  
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(sep).map(p => p.trim());
    if (parts.length < headers.length) {
      skipped++;
      continue;
    }

    const rpm = parseFloat(parts[columnMap.rpm]);
    let mapVal = parseFloat(parts[columnMap.map]);
    const afr = parseFloat(parts[columnMap.afr]);
    
    // Автоопределение единиц MAP
    if (mapVal < 5) mapVal *= 100; // convert bar to kPa
    else if (mapVal > 200) mapVal /= 10; // convert hPa to kPa

    // Валидация данных
    if (!isValidRange(rpm, 300, 8000) || !isValidRange(mapVal, 10, 300) || 
        !isValidRange(afr, 8, 22)) {
      skipped++;
      continue;
    }

    // AFR target (опциональный)
    let afrTarget = afr; // fallback
    if (columnMap.afrTarget !== -1) {
      afrTarget = parseFloat(parts[columnMap.afrTarget]);
      if (!isValidRange(afrTarget, 8, 22)) afrTarget = 14.7; // default stoich
    }

    // Фильтр стабильных условий (исключаем переходные процессы)
    out.push({ 
      rpm: Math.round(rpm), 
      map: Math.round(mapVal * 10) / 10, 
      afr: Math.round(afr * 100) / 100, 
      afrTarget: Math.round(afrTarget * 100) / 100 
    });
  }

  if (out.length === 0) throw new Error('Нет валидных данных после фильтрации');
  
  console.log(`Загружено: ${out.length} строк, пропущено: ${skipped} некорректных`);
  return out;
}

function detectSeparator(line) {
  if (line.includes(';')) return ';';
  if (line.includes('\t')) return '\t';
  return ',';
}

function findColumn(headers, patterns) {
  for (const pattern of patterns) {
    const idx = headers.findIndex(h => h.includes(pattern.toLowerCase()));
    if (idx !== -1) return idx;
  }
  return -1;
}

function isValidRange(value, min, max) {
  return !isNaN(value) && value >= min && value <= max;
}
