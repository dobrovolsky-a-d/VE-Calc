export function calculateVE(log, veOld, mode = "off") {

  const rows = veOld.rows;
  const cols = veOld.cols;

  const rpmAxis = veOld.rpmAxis;
  const loadAxis = veOld.loadAxis;

  const cell = makeMatrix(rows, cols, []);
  const coverage = makeMatrix(rows, cols, 0);

  // --- BINNING ---
  for (let p of log) {

    const mapPsi = p.map * 14.5038;

    const r = findClosest(rpmAxis, p.rpm);
    const c = findClosest(loadAxis, mapPsi);

    let factor = p.afr / p.afrTarget;

    if (factor < 0.75) factor = 0.75;
    if (factor > 1.25) factor = 1.25;

    cell[r][c].push(factor);
    coverage[r][c]++;
  }

  // --- CALC ---
  const veNew = makeMatrix(rows, cols, 0);
  const corr = makeMatrix(rows, cols, 0);
  const mask = makeMatrix(rows, cols, false);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {

      const samples = cell[r][c];

      if (!samples.length) {
        veNew[r][c] = veOld.values[r][c];
        continue;
      }

      mask[r][c] = true;

      const avg = average(samples);
      const w = Math.min(samples.length / 5, 1);
      const factor = 1 + (avg - 1) * w;

      veNew[r][c] = veOld.values[r][c] * factor;
      corr[r][c] = (factor - 1) * 100;
    }
  }

  let out = clone(veNew);

  if (mode === "soft") out = interpolateSoft(out, mask);
  if (mode === "hard") out = smoothNTimes(out, 8);

  out = smooth(out);

  return {
    VE_old: veOld.values,
    VE_new: out,
    Correction: corr,
    coverage
  };
}

/* helpers */

function findClosest(axis, value) {
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

function makeMatrix(r, c, val) {
  return Array.from({ length: r }, () =>
    Array.from({ length: c }, () =>
      Array.isArray(val) ? [] : val
    )
  );
}

function average(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
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

function clone(m) {
  return JSON.parse(JSON.stringify(m));
}
