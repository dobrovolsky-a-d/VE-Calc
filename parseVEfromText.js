export function parseVEFromText(rpmText, mapText, veText) {

  const rpmAxis = rpmText.split(/[\s,]+/).map(Number).filter(v => !isNaN(v));
  const loadAxis = mapText.split(/[\s,]+/).map(Number).filter(v => !isNaN(v));

  const rows = veText.trim().split("\n")
    .map(l => l.trim().split(/[\s,]+/).map(Number));

  return {
    rows: rows.length,
    cols: rows[0].length,
    values: rows,
    rpmAxis,
    loadAxis
  };
}
