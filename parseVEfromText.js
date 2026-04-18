export function parseVEFromText(rpmText, mapText, veText) {

  const rpmAxis = rpmText
    .split(/[\s,]+/)
    .map(Number)
    .filter(v => !isNaN(v));

  const loadAxis = mapText
    .split(/[\s,]+/)
    .map(Number)
    .filter(v => !isNaN(v));

  const rows = veText
    .trim()
    .split("\n")
    .map(line =>
      line.trim().split(/[\s,]+/).map(Number)
    );

  if (rows.length !== rpmAxis.length) {
    throw new Error("Rows != RPM axis");
  }

  for (let r of rows) {
    if (r.length !== loadAxis.length) {
      throw new Error("Cols != MAP axis");
    }
  }

  return {
    rows: rows.length,
    cols: rows[0].length,
    values: rows,
    rpmAxis,
    loadAxis
  };
}
