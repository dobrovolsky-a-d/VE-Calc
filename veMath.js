export function calculateVE(log, veOld, interpMode = "off") {

  const rows = veOld.rows;
  const cols = veOld.cols;

  const cellCorr = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => [])
  );

  const coverage = makeMatrix(rows, cols, 0);
  const usedCells = new Set();

  for (let i = 0; i < log.length; i++) {

    const p = log[i];

    let factor = p.afr / p.afrTarget;
    factor = clamp(factor, 0.75, 1.25);

    const r = clamp(Math.floor(mapRange(p.map, 0, 40, 0, rows - 1)), 0, rows - 1);
    const c = clamp(Math.floor(mapRange(p.rpm, 800, 7000, 0, cols - 1)), 0, cols - 1);

    cellCorr[r][c].push(factor);
    coverage[r][c]++;

    usedCells.add(`${r}:${c}`);
  }

  const veCalc = makeMatrix(rows, cols, 0);
  const corrPct = makeMatrix(rows, cols, 0);
  const hasData = makeMatrix(rows, cols, false);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {

      const samples = cellCorr[r][c];

      if (samples.length < 3) {
        veCalc[r][c] = veOld.values[r][c];
        corrPct[r][c] = 0;
        continue;
      }

      hasData[r][c] = true;

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

  let veInterp = clone(veCalc);

  if (interpMode === "soft")
    veInterp = interpolateSoft(veInterp, hasData);

  if (interpMode === "medium")
    veInterp = interpolateMedium(veInterp, hasData);

  if (interpMode === "hard")
    veInterp = interpolateHard(veInterp, hasData);

  const veFinal = smooth(veInterp);

  return {
    VE_old: veOld.values,
    VE_new: veFinal,
    Correction: corrPct,
    coverage: coverage,
    stats: {
      usedCells: usedCells.size
    }
  };
}

/* ---------- SOFT ---------- */

function interpolateSoft(matrix, mask) {

  const r = matrix.length;
  const c = matrix[0].length;

  const out = clone(matrix);

  for (let i = 0; i < r; i++) {
    for (let j = 0; j < c; j++) {

      if (mask[i][j]) continue;

      const n = [];

      if (i > 0) n.push(out[i - 1][j]);
      if (i < r - 1) n.push(out[i + 1][j]);
      if (j > 0) n.push(out[i][j - 1]);
      if (j < c - 1) n.push(out[i][j + 1]);

      if (n.length)
        out[i][j] = n.reduce((a, b) => a + b, 0) / n.length;
    }
  }

  return out;
}

/* ---------- MEDIUM ---------- */

function interpolateMedium(matrix, mask) {

  const r = matrix.length;
  const c = matrix[0].length;

  const out = clone(matrix);

  for (let i = 0; i < r; i++) {

    let last = null;

    for (let j = 0; j < c; j++) {

      if (mask[i][j]) {

        if (last !== null && j - last > 1) {

          const v0 = out[i][last];
          const v1 = out[i][j];

          for (let k = last + 1; k < j; k++) {

            const t = (k - last) / (j - last);
            out[i][k] = v0 + (v1 - v0) * t;

          }
        }

        last = j;
      }
    }
  }

  return out;
}

/* ---------- HARD (distance interpolation) ---------- */

function interpolateHard(matrix, mask) {

  const r = matrix.length;
  const c = matrix[0].length;

  const out = clone(matrix);

  const points = [];

  for (let i = 0; i < r; i++)
    for (let j = 0; j < c; j++)
      if (mask[i][j])
        points.push({ i, j, v: matrix[i][j] });

  for (let i = 0; i < r; i++) {
    for (let j = 0; j < c; j++) {

      if (mask[i][j]) continue;

      let num = 0;
      let den = 0;

      for (const p of points) {

        const d = Math.hypot(p.i - i, p.j - j) + 0.0001;

        const w = 1 / d;

        num += p.v * w;
        den += w;
      }

      out[i][j] = num / den;
    }
  }

  return out;
}

/* helpers */

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

  const r = m.length;
  const c = m[0].length;

  const o = clone(m);

  for (let i = 1; i < r - 1; i++)
    for (let j = 1; j < c - 1; j++)
      o[i][j] =
        (m[i][j] +
        m[i-1][j] +
        m[i+1][j] +
        m[i][j-1] +
        m[i][j+1]) / 5;

  return o;
}

function clone(m) {
  return JSON.parse(JSON.stringify(m));
}
