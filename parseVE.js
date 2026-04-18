export async function parseVE(file) {

  const text = await file.text();

  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lines.length < 2) {
    throw new Error("VE parse failed: not enough rows");
  }

  // --- split строго по TAB ---
  const table = lines.map(line =>
    line.split("\t").map(v => v.trim())
  );

  // --- HEADER ---
  let header = table[0];

  // убираем "RPM / MAP (psi)"
  if (isNaN(parseFloat(header[0]))) {
    header = header.slice(1);
  }

  const loadAxis = header
    .map(v => parseFloat(v))
    .filter(v => !isNaN(v));

  if (loadAxis.length === 0) {
    throw new Error("VE parse failed: load axis empty");
  }

  const rpmAxis = [];
  const values = [];

  for (let i = 1; i < table.length; i++) {

    const row = table[i];

    if (row.length < 2) continue;

    const rpm = parseFloat(row[0]);
    if (isNaN(rpm)) continue;

    let veRow = row.slice(1)
      .map(v => parseFloat(v))
      .filter(v => !isNaN(v));

    // 🔥 ключ: подгоняем длину под ось
    if (veRow.length > loadAxis.length) {
      veRow = veRow.slice(0, loadAxis.length);
    }

    if (veRow.length < loadAxis.length) {
      continue; // реально битая строка
    }

    rpmAxis.push(rpm);
    values.push(veRow);
  }

  if (!values.length) {
    console.error("TABLE RAW:", table);
    throw new Error("VE parse failed: no valid rows");
  }

  console.log("VE parsed:", values.length, "x", values[0].length);

  return {
    rows: values.length,
    cols: values[0].length,
    values,
    rpmAxis,
    loadAxis
  };
}
