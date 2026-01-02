export function calculateVE(log, veOld) {
  const rows = veOld.rows;
  const cols = veOld.cols;

  const sum = Array.from({ length: rows }, () => Array(cols).fill(0));
  const cnt = Array.from({ length: rows }, () => Array(cols).fill(0));

  let validLogRows = 0;
  const usedCells = new Set();

  log.forEach(p => {
    const factor = clamp(p.afr / p.afrTarget, 0.85, 1.15);

    const i = clamp(Math.floor(map(p.map, 0, 40, 0, rows - 1)), 0, rows - 1);
    const j = clamp(Math.floor(map(p.rpm, 800, 7000, 0, cols - 1)), 0, cols - 1);

    sum[i][j] += factor;
    cnt[i][j]++;
    validLogRows++;
    usedCells.add(`${i}:${j}`);
  });

  const veNew = Array.from({ length: rows }, () => Array(cols).fill(0));
  const corr = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const avg = cnt[i][j] ? sum[i][j] / cnt[i][j] : 1;
      veNew[i][j] = veOld.values[i][j] * avg;
      corr[i][j] = (avg - 1) * 100;
    }
  }

  const veSmooth = smooth(veNew);

  return {
    VE_new: veSmooth,
    Correction: corr,
    stats: {
      veRows: rows,
      veCols: cols,
      veCells: rows * cols,
      logRows: log.length,
      validLogRows,
      usedCells: usedCells.size
    }
  };
}

function map(v, a, b, c, d) { return (v - a) * (d - c) / (b - a) + c; }
function clamp(v, min, max) { return Math.min(Math.max(v, min), max); }

function smooth(m) {
  const r = m.length, c = m[0].length;
  const o = JSON.parse(JSON.stringify(m));
  for (let i = 1; i < r - 1; i++)
    for (let j = 1; j < c - 1; j++)
      o[i][j] = (
        m[i][j] + m[i-1][j] + m[i+1][j] +
        m[i][j-1] + m[i][j+1]
      ) / 5;
  return o;
}
