export function calculateVE(log, veOld, mode="off", MIN_SAMPLES=3) {

  const { rpmAxis, loadAxis } = veOld;
  const rows = veOld.rows;
  const cols = veOld.cols;

  const sum      = makeMatrix(rows, cols, 0);
  const weight   = makeMatrix(rows, cols, 0);
  const coverage = makeMatrix(rows, cols, 0);
  const mask     = makeMatrix(rows, cols, false);

  // --- BILINEAR ---
  for (let p of log) {

    const r = findBounds(rpmAxis, p.rpm);
    const c = findBounds(loadAxis, p.map); // p.map уже PSI

    const factor = clamp(p.afr / p.afrTarget, 0.75, 1.25);

    const w00 = (1-r.frac)*(1-c.frac);
    const w10 =    r.frac *(1-c.frac);
    const w01 = (1-r.frac)*   c.frac;
    const w11 =    r.frac *   c.frac;

    apply(r.i0, c.i0, w00);
    apply(r.i1, c.i0, w10);
    apply(r.i0, c.i1, w01);
    apply(r.i1, c.i1, w11);

    function apply(i, j, w) {
      sum[i][j]      += factor * w;
      weight[i][j]   += w;
      coverage[i][j] ++;
    }
  }

  let out  = makeMatrix(rows, cols, 0);
  const corr = makeMatrix(rows, cols, null); // FIX: null для ячеек без данных

  // --- BASE CALC + FILTER ---
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {

      if (coverage[i][j] < MIN_SAMPLES) {
        out[i][j]  = veOld.values[i][j];
        mask[i][j] = false;
        continue;
      }

      const avg  = sum[i][j] / weight[i][j];
      out[i][j]  = veOld.values[i][j] * avg;
      corr[i][j] = (avg - 1) * 100;
      mask[i][j] = true;
    }
  }

  // --- INTERPOLATION ---
  if (mode === "soft")   out = interpolateSoft(out, mask);
  if (mode === "hard")   out = smoothNTimes(out, 8);
  if (mode === "engine") out = engineInterpolation(out, mask);

  // FIX: сглаживание только если выбран режим (не при mode="off")
  if (mode !== "off") out = smooth(out);

  return {
    VE_old:     veOld.values,
    VE_new:     out,
    Correction: corr,
    coverage
  };
}

/* ================= ENGINE ================= */

function engineInterpolation(m, mask) {

  const out = clone(m);

  for (let i = 0; i < m.length; i++) {
    for (let j = 0; j < m[0].length; j++) {

      if (mask[i][j]) continue;

      const neighbors = [];

      if (i > 0             && mask[i-1][j]) neighbors.push(m[i-1][j]);
      if (i < m.length-1    && mask[i+1][j]) neighbors.push(m[i+1][j]);
      if (j > 0             && mask[i][j-1]) neighbors.push(m[i][j-1]);
      if (j < m[0].length-1 && mask[i][j+1]) neighbors.push(m[i][j+1]);

      if (neighbors.length === 0) continue;

      const avg = neighbors.reduce((a,b) => a+b, 0) / neighbors.length;

      let loadBias = 0;
      if (
        j > 0 && j < m[0].length-1 &&
        mask[i][j-1] && mask[i][j+1]
      ) {
        loadBias = (m[i][j+1] - m[i][j-1]) * 0.3;
      }

      out[i][j] = avg + loadBias;
    }
  }

  return out;
}

/* ================= SOFT ================= */

function interpolateSoft(m, mask) {

  const out = clone(m);

  for (let i = 1; i < m.length-1; i++) {
    for (let j = 1; j < m[0].length-1; j++) {

      if (mask[i][j]) continue;

      const vals = [];

      if (mask[i-1][j]) vals.push(m[i-1][j]);
      if (mask[i+1][j]) vals.push(m[i+1][j]);
      if (mask[i][j-1]) vals.push(m[i][j-1]);
      if (mask[i][j+1]) vals.push(m[i][j+1]);

      if (vals.length === 0) continue;

      out[i][j] = vals.reduce((a,b) => a+b, 0) / vals.length;
    }
  }

  return out;
}

/* ================= SMOOTH ================= */

// FIX: обрабатываем края матрицы (граничные ячейки копируются с соседей)
function smooth(m) {

  const out = clone(m);
  const rows = m.length;
  const cols = m[0].length;

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {

      const vals = [m[i][j]];

      if (i > 0)      vals.push(m[i-1][j]);
      if (i < rows-1) vals.push(m[i+1][j]);
      if (j > 0)      vals.push(m[i][j-1]);
      if (j < cols-1) vals.push(m[i][j+1]);

      out[i][j] = vals.reduce((a,b) => a+b, 0) / vals.length;
    }
  }

  return out;
}

function smoothNTimes(m, n) {
  let out = clone(m);
  for (let i = 0; i < n; i++) out = smooth(out);
  return out;
}

/* ================= HELPERS ================= */

// FIX: корректная обработка значений за пределами оси (клампинг на начало/конец)
function findBounds(axis, val) {

  // ниже минимума — клампим на первый интервал
  if (val <= axis[0]) {
    return { i0: 0, i1: 1, frac: 0 };
  }

  // выше максимума — клампим на последний интервал
  if (val >= axis[axis.length-1]) {
    return { i0: axis.length-2, i1: axis.length-1, frac: 1 };
  }

  for (let i = 0; i < axis.length-1; i++) {
    if (val >= axis[i] && val <= axis[i+1]) {
      const frac = (val - axis[i]) / (axis[i+1] - axis[i]);
      return { i0: i, i1: i+1, frac };
    }
  }

  // fallback (не должно сюда попасть)
  return { i0: axis.length-2, i1: axis.length-1, frac: 1 };
}

function makeMatrix(r, c, v) {
  return Array.from({ length: r }, () => Array(c).fill(v));
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function clone(m) {
  return JSON.parse(JSON.stringify(m));
}
