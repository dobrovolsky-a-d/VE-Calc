export async function parseVE(file) {

  const text = await file.text();

  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  // 🔥 строго TAB
  const table = lines.map(line =>
    line.split("\t").map(v => v.trim())
  );

  if (table.length < 2) {
    throw new Error("VE parse failed: not enough rows");
  }

  // --- HEADER ---
  let header = table[0];

  // убираем "RPM / MAP (psi)"
  if (isNaN(parseFloat(header[0]))) {
    header = header.slice(1);
  }

  const loadAxis = header.map(v => parseFloat(v));

  if (loadAxis.some(v => isNaN(v))) {
    throw new Error("VE parse failed: load axis invalid");
  }

  const rpmAxis = [];
  const values = [];

  for (let i = 1; i < table.length; i++) {

    const row = table[i];

    if (row.length < 2) continue;

    const rpm = parseFloat(row[0]);
    const veRow = row.slice(1).map(v => parseFloat(v));

    if (isNaN(rpm)) continue;

    rpmAxis.push(rpm);
    values.push(veRow);
  }

  if (!values.length || !values[0].length) {
    throw new Error("VE parse failed: values empty");
  }

  console.log("Cols:", values[0].length); // <-- ключевая проверка

  return {
    rows: values.length,
    cols: values[0].length,
    values,
    rpmAxis,
    loadAxis
  };
}
