export async function parseVE(input) {

  let text;

  // ✅ поддержка File (из input)
  if (input instanceof File) {
    text = await input.text();
  } else {
    text = input; // уже строка
  }

  const lines = text.trim().split("\n");

  const table = lines.map(l =>
    l.trim().split(/[\s,]+/).map(Number)
  );

  const rpmAxis = table[0].slice(1);
  const loadAxis = table.slice(1).map(r => r[0]);
  const values = table.slice(1).map(r => r.slice(1));

  return {
    rows: values.length,
    cols: values[0].length,
    values: values,
    rpmAxis: rpmAxis,
    loadAxis: loadAxis
  };
}
