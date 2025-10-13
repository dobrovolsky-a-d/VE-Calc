export async function parseVE(file) {
  const text = await file.text();
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const values = lines.map(line => line.split(/[;\t,]/).map(v => parseFloat(v)).filter(v => !Number.isNaN(v)));
  if (!values.length) throw new Error('VE table пустая или неверный формат');
  return { values, rows: values.length, cols: values[0].length };
}
