export async function parseVE(file) {

  const text = await file.text();

  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const table = lines.map(line =>
    line.split(/\t+/).map(v => v.trim())
  );

  // первая строка: ["RPM / MAP (psi)", "5.02", "6.96", ...]
  const loadAxis = table[0]
    .slice(1)
    .map(v => parseFloat(v));

  // первая колонка: rpm
  const rpmAxis = table
    .slice(1)
    .map(row => parseFloat(row[0]));

  // значения VE
  const values = table
    .slice(1)
    .map(row =>
      row.slice(1).map(v => parseFloat(v))
    );

  if (!values.length || !values[0].length) {
    throw new Error("VE parse failed");
  }

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
