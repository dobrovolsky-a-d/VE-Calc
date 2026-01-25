export function calculateVE(log, veOld, interpMode = "off") {
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

  const veCalc = makeMatrix(rows, cols, 0);
  const corrPct = makeMatrix(rows, cols, 0);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const samples = cellCorr[r][c];
      if (samples.length < 3) {
        veCalc[r][c] = veOld.values[r][c];
        corrPct[r][c] = 0;
        continue;
      }

      const med = median(samples);
      const filtered = samples.filter(v => Math.abs(v - med) <= 0.15);
      if (!filtered.length) {
        veCalc[r][c] = veOld.values[r][c];
        corrPct[r][c] = 0;
        continue;
      }

      const avg = filtered.reduce((a, b) => a + b, 0) / filtered.length;
      veCalc[r][c] = veOld.values[r][c] * avg;
      corrPct[r][c] = (avg - 1) * 100;
    }
  }

  const veSmooth = smooth(veCalc);
  const veFinal =
    interpMode === "soft"
      ? interpolateSoft(veSmooth, veOld.values, cellCorr)
      : veSmooth;

  return {
    VE_old: veOld.values,
    VE_new: veFinal,
    Correction: corrPct,
    stats: {
      usedCells: usedCells.size
    }
  };
}

// ---------- INTERPOLATION (SOFT) ----------
function interpolateSoft(ve, veOld, cellCorr) {
  const r = ve.length, c = ve[0].length;
  const out = JSON.parse(JSON.stringify(ve));

  for (let i = 0; i < r; i++) {
    for (let j = 0; j < c; j++) {
      if (cellCorr[i][j].length > 0) continue; // есть реальные данные

      const neighbors = [];
      if (i > 0 && cellCorr[i - 1][j].length > 0) neighbors.push(out[i - 1][j]);
      if (i < r - 1 && cellCorr[i + 1][j].length > 0) neighbors.push(out[i + 1][j]);
      if (j > 0 && cellCorr[i][j - 1].length > 0) neighbors.push(out[i][j - 1]);
      if (j < c - 1 && cellCorr[i][j + 1].length > 0) neighbors.push(out[i][j + 1]);

      if (neighbors.length) {
        out[i][j] = neighbors.reduce((a, b) => a + b, 0) / neighbors.length;
      } else {
        out[i][j] = veOld[i][j];
      }
    }
  }
  return out;
}

// ---------- helpers ----------
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
      o[i][j] =
        (m[i][j] +
          m[i - 1][j] +
          m[i + 1][j] +
          m[i][j - 1] +
          m[i][j + 1]) /
        5;
  return o;
}
