export async function parseVE(file) {
  const text = await file.text();
  const linesRaw = text.split(/\r?\n/);
  
  // remove empty lines and trim
  const lines = linesRaw.map(l => l.trim()).filter(l => l.length > 0);
  
  if (lines.length === 0) throw new Error('VE table empty or invalid format');

  // detect separator
  const sep = detectSeparator(lines[0]);
  console.log('Detected separator:', sep, 'First line:', lines[0]);

  // Parse first line as MAP axis
  const firstLineParts = lines[0].split(sep).map(c => c.trim()).filter(c => c !== '');
  let mapAxis = parseNumberArray(firstLineParts);
  
  // If first line doesn't contain numbers, try second line as header
  if (mapAxis.length === 0 && lines.length > 1) {
    const secondLineParts = lines[1].split(sep).map(c => c.trim()).filter(c => c !== '');
    mapAxis = parseNumberArray(secondLineParts);
  }

  console.log('MAP axis:', mapAxis);

  // Parse data rows
  const values = [];
  let startRow = 0;
  
  // Find first numeric row
  for (let i = 0; i < lines.length; i++) {
    const parts = lines[i].split(sep).map(p => p.trim());
    const firstCell = parseFloat(parts[0]);
    if (!isNaN(firstCell)) {
      startRow = i;
      break;
    }
  }

  for (let i = startRow; i < lines.length; i++) {
    const parts = lines[i].split(sep).map(p => p.trim());
    if (parts.length < 2) continue;
    
    const rpmCandidate = parseFloat(parts[0]);
    if (isNaN(rpmCandidate)) continue;
    
    const rowVals = parts.slice(1).map(v => parseFloat(v)).filter(v => !isNaN(v));
    if (rowVals.length > 0) {
      values.push([rpmCandidate, ...rowVals]);
    }
  }

  if (values.length === 0) throw new Error('No numeric data found in VE table');

  const rows = values.length;
  const cols = values[0].length - 1;
  
  // If mapAxis is still empty, generate default based on columns
  if (mapAxis.length === 0) {
    mapAxis = Array.from({length: cols}, (_, i) => i * 10 + 20); // 20, 30, 40...
    console.log('Generated default MAP axis:', mapAxis);
  }

  // Build numeric matrix
  const matrix = values.map(r => r.slice(1));
  const rpmAxis = values.map(r => r[0]);

  console.log('Parsed VE table:', rows + 'x' + cols, 'RPM:', rpmAxis, 'MAP:', mapAxis);

  return { 
    values: matrix, 
    rows, 
    cols, 
    rpmAxis, 
    mapAxis 
  };
}

// Helper functions
function detectSeparator(line) {
  if (line.includes(';')) return ';';
  if (line.includes('\t')) return '\t';
  return ',';
}

function parseNumberArray(arr) {
  const result = [];
  for (const item of arr) {
    const num = parseFloat(item);
    if (!isNaN(num)) {
      result.push(num);
    }
  }
  return result;
}
