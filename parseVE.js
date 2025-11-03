export async function parseVE(file) {
  const text = await file.text();
  const linesRaw = text.split(/\r?\n/);
  // remove empty lines and trim
  const lines = linesRaw.map(l => l.trim()).filter(l => l.length > 0);
  // skip lines that contain non-data like "Таблица"
  const filtered = lines.filter(l => !/таблица/i.test(l));
  if (filtered.length === 0) throw new Error('VE table empty or invalid format');

  // detect sep - likely semicolon in your file
  const sep = filtered[0].includes(';') ? ';' : (filtered[0].includes('\t') ? '\t' : ',');

  // first line is MAP axis OR might start with leading empty cell
  const firstCols = filtered[0].split(sep).map(c => c.trim()).filter(c => c !== '');
  // If firstCols starts with a non-number, remove it
  let mapAxis = firstCols.map(v => parseFloat(v)).filter(v => !Number.isNaN(v));
  // If firstCols has leading empty, try next tokenization with preserving empties
  if (mapAxis.length === 0) {
    // try split without filter (preserve leading empty)
    const cols = filtered[0].split(sep).map(c => c.trim());
    // remove first empty cell if exists
    if (cols[0] === '' || /[a-zа-я]/i.test(cols[0])) cols.shift();
    mapAxis = cols.map(v => parseFloat(v)).filter(v => !Number.isNaN(v));
  }

  const values = [];
  for (let i = 1; i < filtered.length; i++) {
    const parts = filtered[i].split(sep).map(p => p.trim());
    // If parts[0] is header label (rpm), convert
    let rpmCandidate = parseFloat(parts[0]);
    if (Number.isNaN(rpmCandidate)) continue;
    const rowVals = parts.slice(1).map(v => parseFloat(v)).filter(v => !Number.isNaN(v));
    values.push([rpmCandidate, ...rowVals]);
  }

  if (values.length === 0) throw new Error('VE table rows not found or numeric parsing failed');
  const rows = values.length;
  const cols = values[0].length - 1;
  // Build numeric matrix: VE.values as rows x cols (without RPM column)
  const matrix = values.map(r => r.slice(1));
  return { values: matrix, rows, cols, rpmAxis: values.map(r=>r[0]), mapAxis };
};
