export async function parseVE(file) {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  const values = lines.map(line => line.split(/[,	;]/).map(v => parseFloat(v)).filter(v => !isNaN(v)));
  return { values, rows: values.length, cols: values[0]?.length || 0 };
}