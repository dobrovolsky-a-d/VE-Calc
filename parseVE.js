export async function parseVE(file) {
  const text = await file.text();
  const linesRaw = text.split(/\r?\n/);
  
  const lines = linesRaw.map(l => l.trim()).filter(l => l.length > 0);
  
  if (lines.length === 0) throw new Error('VE table empty or invalid format');

  const sep = ';';

  // Parse first line as MAP axis (в PSI)
  const firstLineParts = lines[0].split(sep).map(c => c.trim()).filter(c => c !== '');
  
  // Убираем первый элемент "RPM / MAP (psi)" и парсим MAP значения в PSI
  const mapAxis = firstLineParts.slice(1).map(item => {
    const num = parseFloat(item);
    return isNaN(num) ? null : num;
  }).filter(item => item !== null);

  console.log('MAP axis (PSI):', mapAxis);

  // Parse data rows
  const values = [];
  const rpmAxis = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(sep).map(p => p.trim());
    if (parts.length < 2) continue;
    
    const rpmCandidate = parseFloat(parts[0]);
    if (isNaN(rpmCandidate)) continue;
    
    const rowVals = parts.slice(1).map(v => parseFloat(v)).filter(v => !isNaN(v));
    if (rowVals.length > 0) {
      rpmAxis.push(rpmCandidate);
      values.push(rowVals);
    }
  }

  if (values.length === 0) throw new Error('No numeric data found in VE table');

  const rows = values.length;
  const cols = values[0].length;

  console.log('Parsed VE table:', rows + 'x' + cols, 'RPM:', rpmAxis, 'MAP (PSI):', mapAxis);

  return { 
    values: values, 
    rows, 
    cols, 
    rpmAxis, 
    mapAxis 
  };
}
