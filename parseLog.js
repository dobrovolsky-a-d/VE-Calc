export async function parseVE(file) {

  const text = await file.text();

  const lines = text.trim().split(/\r?\n/);

  const table = lines.map(l =>
    l.trim().split(/[\t,;\s]+/).map(Number)
  );

  if (table.length < 2) {
    throw new Error("Invalid VE table");
  }

  const rpmAxis = table[0].slice(1);
  const loadAxis = table.slice(1).map(r => r[0]);
  const values = table.slice(1).map(r => r.slice(1));

  return {
    rows: values.length,
    cols: values[0].length,
    values,
    rpmAxis,
    loadAxis
  };
}
