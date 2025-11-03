export async function parseVE(file){
  const text = await file.text();
  const raw = text.split(/\r?\n/).map(l=>l.trim());
  const lines = raw.filter(l=>l.length>0 && !/таблица/i.test(l));
  if(lines.length<2) throw new Error('VE файл не в ожидаемом формате');

  const sep = lines[0].includes(';')?';':(lines[0].includes('\t')?'\t':',');
  // первая строка — ось MAP (может иметь ведущую пустую ячейку)
  const first = lines[0].split(sep).map(s=>s.trim());
  let mapAxis = first.map(v=>parseFloat(v)).filter(v=>!Number.isNaN(v));
  if(mapAxis.length===0){
    // возможно есть ведущая пустая ячейка: удалим первый элемент и повторим
    const alt = lines[0].split(sep).map(s=>s.trim());
    if(alt[0]==='') alt.shift();
    mapAxis = alt.map(v=>parseFloat(v)).filter(v=>!Number.isNaN(v));
  }

  const values = [];
  const rpmAxis = [];
  for(let i=1;i<lines.length;i++){
    const cols = lines[i].split(sep).map(s=>s.trim());
    const rpm = parseFloat(cols[0]);
    if(Number.isNaN(rpm)) continue;
    const row = cols.slice(1).map(v=>parseFloat(v)).filter(v=>!Number.isNaN(v));
    if(row.length===0) continue;
    rpmAxis.push(rpm);
    values.push(row);
  }
  if(values.length===0) throw new Error('Не найдено строк VE');
  return { values, rows: values.length, cols: values[0].length, rpmAxis, mapAxis };
}
