export function calculateVE(log, veOld, interpMode = "off") {

  const rows = veOld.rows;
  const cols = veOld.cols;

  const rpmAxis = veOld.rpmAxis;
  const loadAxis = veOld.loadAxis;

  const cellCorr = makeMatrix(rows, cols, []);
  const coverage = makeMatrix(rows, cols, 0);

  for (let p of log) {

   const mapPsi = p.map * 14.5038;

const row = findClosestIndex(rpmAxis, p.rpm);
const col = findClosestIndex(loadAxis, mapPsi);

    let factor = p.afr / p.afrTarget;
    factor = clamp(factor, 0.75, 1.25);

    cellCorr[row][col].push(factor);
    coverage[row][col]++;
  }

  const veCalc = makeMatrix(rows, cols, 0);
  const corrPct = makeMatrix(rows, cols, 0);
  const hasData = makeMatrix(rows, cols, false);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {

      const samples = cellCorr[r][c];

      if (!samples.length) {
        veCalc[r][c] = veOld.values[r][c];
        continue;
      }

      hasData[r][c] = true;

      const avg = samples.reduce((a, b) => a + b, 0) / samples.length;

      const weight = Math.min(samples.length / 5, 1);

      veCalc[r][c] =
        veOld.values[r][c] * (1 + (avg - 1) * weight);

      corrPct[r][c] = (avg - 1) * 100;
    }
  }

  let veInterp = clone(veCalc);

  if (interpMode === "soft")
    veInterp = interpolateSoft(veInterp, hasData);

  if (interpMode === "medium")
    veInterp = smooth(interpolateSoft(veInterp, hasData));

  if (interpMode === "hard")
    veInterp = smoothNTimes(veInterp, 8);

  const veFinal = smooth(veInterp);

  return {
    VE_old: veOld.values,
    VE_new: veFinal,
    Correction: corrPct,
    coverage
  };
}

/* ---------- BINNING ---------- */

function findClosestIndex(axis, value) {
  let best = 0;
  let min = Math.abs(axis[0] - value);

  for (let i = 1; i < axis.length; i++) {
    const d = Math.abs(axis[i] - value);
    if (d < min) {
      min = d;
      best = i;
    }
  }

  return best;
}

/* ---------- INTERPOLATION ---------- */

function interpolateSoft(m, mask) {

  const out = clone(m);

  for (let i = 1; i < m.length - 1; i++) {
    for (let j = 1; j < m[0].length - 1; j++) {

      if (mask[i][j]) continue;

      out[i][j] =
        (m[i-1][j] + m[i+1][j] + m[i][j-1] + m[i][j+1]) / 4;
    }
  }

  return out;
}

/* ---------- HELPERS ---------- */

function makeMatrix(r, c, v) {
  return Array.from({ length: r }, () =>
    Array.from({ length: c }, () => Array.isArray(v) ? [] : v)
  );
}

function clamp(v, a, b) {
  return Math.min(Math.max(v, a), b);
}

function smooth(m) {

  const out = clone(m);

  for (let i = 1; i < m.length - 1; i++) {
    for (let j = 1; j < m[0].length - 1; j++) {
      out[i][j] =
        (m[i][j] +
         m[i-1][j] +
         m[i+1][j] +
         m[i][j-1] +
         m[i][j+1]) / 5;
    }
  }

  return out;
}

function smoothNTimes(m, n) {
  let out = clone(m);
  for (let i = 0; i < n; i++) out = smooth(out);
  return out;
}

function clone(m) {
  return JSON.parse(JSON.stringify(m));
}
