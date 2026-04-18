export async function parseVE(file) {

  const text = await file.text();

  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const table = lines.map(line =>
    line
      .split(/[\t ]+/) // ✅ TAB + пробелы
      .map(v => parseFloat(v))
      .filter(v => !isNaN(v)) // убираем мусор
  );

  if (table.length < 2) {
    throw new Error("VE parse failed: not enough data");
  }

  // первая строка = rpm axis
  const rpmAxis = table[0].slice(1);

  // первый столбец = load axis
  const loadAxis = table.slice(1).map(r => r[0]);

  // сама таблица
  const values = table.slice(1).map(r => r.slice(1));

  if (values[0].length === 0) {
    throw new Error("VE parse failed: columns = 0");
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
