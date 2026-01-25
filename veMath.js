export function calculateVE(log, veOld) {
  const rows = veOld.rows;
  const cols = veOld.cols;

  const cellCorr = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => [])
  );

  const usedCells = new Set();

  for (let i = 0; i < log.length; i++) {
    const p = log[i];

    let factor = p.afr / p.afrTarget;
    factor = clamp(factor, 0.75, 1.25);

    const r = clamp(Math.floor(mapRange(p.map, 0, 40, 0, rows - 1)), 0, rows - 1);
    const c = clamp(Math.floor(mapRange(p.rpm, 800, 7000, 0, cols - 1)), 0, cols - 1);

    cellCorr[r][c].push(factor);
    usedCells.add(`${r}:${c}`);
  }

  const veNew = makeMatrix(rows, cols, 0);
  const corrPct = makeMatrix(rows, cols, 0);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const samples = cellCorr[r][c];
      if (samples.length < 3) {
        veNew[r][c] = veOld.values[r][c];
        corrPct[r][c] = 0;
        continue;
      }

      const med = median(samples);
      const filtered = samples.filter(v => Math.abs(v - med) <= 0.15);
      if (!filtered.length) {
        veNew[r][c] = veOld.values[r][c];
        corrPct[r][c] = 0;
        continue;
      }

      const avg = filtered.reduce((a, b) => a + b, 0) / filtered.length;
      veNew[r][c] = veOld.values[r][c] * avg;
      corrPct[r][c] = (avg - 1) * 100;
    }
  }

  return {
    VE_old: veOld.values,
    VE_new: smooth(veNew),
    Correction: corrPct,
    stats: {
      usedCells: usedCells.size
    }
  };
}

function makeMatrix(r, c, v) {
  return Array.from({ length: r }, () => Array(c).fill(v));
}
function clamp(v, a, b) {
  return Math.min(Math.max(v, a), b);
}
function mapRange(v, a, b, c, d) {
  return (v - a) * (d - c) / (b - a) + c;
}
function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function smooth(m) {
  const r = m.length, c = m[0].length;
  const o = JSON.parse(JSON.stringify(m));
  for (let i = 1; i < r - 1; i++)
    for (let j = 1; j < c - 1; j++)
      o[i][j] = (m[i][j] + m[i-1][j] + m[i+1][j] + m[i][j-1] + m[i][j+1]) / 5;
  return o;
}
