export async function parseVE(file) {

  const text = await file.text();

  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  // универсальный split (tab / ; / , / пробелы)
  const splitLine = (line) =>
    line
      .split(/[\t;, ]+/)
      .map(v => v.trim())
      .filter(v => v.length > 0);

  const table = lines.map(splitLine);

  if (table.length < 2) {
    throw new Error("VE parse failed: not enough rows");
  }

  // --- первая строка ---
  // RPM / MAP (psi)  5.02  6.96 ...
  let header = table[0];

  // убираем текстовый первый элемент
  if (isNaN(parseFloat(header[0]))) {
    header = header.slice(1);
  }

  const loadAxis = header.map(v => parseFloat(v)).filter(v => !isNaN(v));

  if (loadAxis.length === 0) {
    throw new Error("VE parse failed: load axis empty");
  }

  const rpmAxis = [];
  const values = [];

  for (let i = 1; i < table.length; i++) {

    const row = table[i].map(v => parseFloat(v));

    if (row.length < 2) continue;

    const rpm = row[0];
    const veRow = row.slice(1);

    if (isNaN(rpm)) continue;

    rpmAxis.push(rpm);
    values.push(veRow);
  }

  if (!values.length || !values[0].length) {
    throw new Error("VE parse failed: values empty");
  }

  console.log("RPM axis:", rpmAxis);
  console.log("Load axis:", loadAxis);
  console.log("Cols:", values[0].length);

  return {
    rows: values.length,
    cols: values[0].length,
    values,
    rpmAxis,
    loadAxis
  };
}
