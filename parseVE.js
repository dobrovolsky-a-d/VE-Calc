export async function parseVE(file) {

  const text = await file.text();

  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const table = lines.map(line =>
    line
      .split(/\t+/) // <-- ТОЛЬКО TAB (важно!)
      .map(v => parseFloat(v))
  );

  // удаляем строки с NaN
  const clean = table.filter(row =>
    row.every(v => !isNaN(v))
  );

  if (clean.length < 2) {
    throw new Error("VE parse failed: invalid data");
  }

  const rpmAxis = clean[0].slice(1);
  const loadAxis = clean.slice(1).map(r => r[0]);
  const values = clean.slice(1).map(r => r.slice(1));

  console.log("RPM axis:", rpmAxis);
  console.log("Load axis:", loadAxis);

  return {
    rows: values.length,
    cols: values[0].length,
    values,
    rpmAxis,
    loadAxis
  };
}
