export async function parseVE(file) {

  const text = await file.text();

  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lines.length < 2) {
    throw new Error("VE parse failed: not enough rows");
  }

  // 🔥 строго TAB, без фильтрации
  const table = lines.map(line =>
    line.split("\t").map(v => v.trim())
  );

  // --- HEADER ---
  let header = table[0];

  if (isNaN(parseFloat(header[0]))) {
    header = header.slice(1);
  }

  const loadAxis = header.map(v => parseFloat(v));

  const rpmAxis = [];
  const values = [];

  for (let i = 1; i < table.length; i++) {

    const row = table[i];

    if (row.length < 2) continue;

    const rpm = parseFloat(row[0]);
    if (isNaN(rpm)) continue;

    // 🔥 НЕ фильтруем, просто парсим
    const veRow = row.slice(1).map(v => parseFloat(v));

    // защита: если строка короче — скипаем
    if (veRow.length !== loadAxis.length) {
      console.warn("Skip row (length mismatch):", row.length, loadAxis.length);
      continue;
    }

    rpmAxis.push(rpm);
    values.push(veRow);
  }

  if (!values.length) {
    throw new Error("VE parse failed: no valid rows");
  }

  console.log("VE OK:", values.length, "x", values[0].length);

  return {
    rows: values.length,
    cols: values[0].length,
    values,
    rpmAxis,
    loadAxis
  };
}
