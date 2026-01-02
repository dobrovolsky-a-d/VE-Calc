export async function parseVE(file) {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(l => l.trim());

  const sep = lines[0].includes(";") ? ";" : ",";
  const values = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).slice(1).map(Number);
    values.push(cols);
  }

  return {
    values,
    rows: values.length,
    cols: values[0].length
  };
}
