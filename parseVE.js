export async function parseVE(file) {

  const text = await file.text();

  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lines.length < 2) {
    throw new Error("VE parse failed: not enough rows");
  }

  // 🔥 авто-детект разделителя
  function detectDelimiter(line) {
    if (line.includes("\t")) return "\t";
    if (line.includes(";")) return ";";
    if (line.includes(",")) return ",";
    return " ";
  }

  const delimiter = detectDelimiter(lines[0]);

  const table = lines.map(line =>
    line
      .split(delimiter)
      .map(v => v.trim())
      .filter(v => v.length > 0)
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
    console.error("Header:", header);
    throw new Error("VE parse failed: load axis empty");
  }

  const rpmAxis = [];
  const values = [];

  for (let i = 1; i < table.length; i++) {

    const row = table[i];

    if (row.length < 2) continue;

    const rpm = parseFloat(row[0]);
    if (isNaN(rpm)) continue;

    const veRow = row
      .slice(1)
      .map(v => parseFloat(v))
      .filter(v => !isNaN(v));

    if (veRow.length !== loadAxis.length) {
      console.warn("Skipped row:", row);
      continue;
    }

    rpmAxis.push(rpm);
    values.push(veRow);
  }

  if (!values.length) {
    console.error("Parsed table:", table);
    throw new Error("VE parse failed: values empty");
  }

  console.log("Parsed VE:", {
    rows: values.length,
    cols: values[0].length
  });

  return {
    rows: values.length,
    cols: values[0].length,
    values,
    rpmAxis,
    loadAxis
  };
}
