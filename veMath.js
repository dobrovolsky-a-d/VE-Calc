export function calculateVE(log, veOld, mode="off") {

  const { rpmAxis, loadAxis } = veOld;
  const rows = veOld.rows;
  const cols = veOld.cols;

  const sum = makeMatrix(rows, cols, 0);
  const weight = makeMatrix(rows, cols, 0);
  const coverage = makeMatrix(rows, cols, 0);
  const mask = makeMatrix(rows, cols, false);

  // --- BILINEAR BINNING ---
  for (let p of log) {

    const mapPsi = p.map * 14.5038;

    const r = findBounds(rpmAxis, p.rpm);
    const c = findBounds(loadAxis, mapPsi);

    const factor = clamp(p.afr / p.afrTarget, 0.75, 1.25);

    const w00 = (1-r.frac)*(1-c.frac);
    const w10 = r.frac*(1-c.frac);
    const w01 = (1-r.frac)*c.frac;
    const w11 = r.frac*c.frac;

    apply(r.i0, c.i0, w00);
    apply(r.i1, c.i0, w10);
    apply(r.i0, c.i1, w01);
    apply(r.i1, c.i1, w11);

    function apply(i,j,w){
      sum[i][j]+=factor*w;
      weight[i][j]+=w;
      coverage[i][j]++;
      mask[i][j] = true;
    }
  }

  // --- BASE CALC ---
  let out = makeMatrix(rows, cols, 0);
  const corr = makeMatrix(rows, cols, 0);

  for (let i=0;i<rows;i++){
    for (let j=0;j<cols;j++){

      if (weight[i][j] === 0){
        out[i][j] = veOld.values[i][j];
        continue;
      }

      const avg = sum[i][j]/weight[i][j];

      out[i][j] = veOld.values[i][j]*avg;
      corr[i][j] = (avg-1)*100;
    }
  }

  // --- INTERPOLATION ---
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

/* ---------- INTERPOLATION ---------- */

function interpolateSoft(m, mask){

  const out = clone(m);

  for (let i=1;i<m.length-1;i++){
    for (let j=1;j<m[0].length-1;j++){

      if (mask[i][j]) continue;

      out[i][j] =
        (m[i-1][j] +
         m[i+1][j] +
         m[i][j-1] +
         m[i][j+1]) / 4;
    }
  }

  return out;
}

function smooth(m){

  const out = clone(m);

  for (let i=1;i<m.length-1;i++){
    for (let j=1;j<m[0].length-1;j++){

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

function smoothNTimes(m,n){
  let out = clone(m);
  for (let i=0;i<n;i++) out = smooth(out);
  return out;
}

/* ---------- HELPERS ---------- */

function findBounds(axis,val){
  for (let i=0;i<axis.length-1;i++){
    if (val>=axis[i] && val<=axis[i+1]){
      const frac=(val-axis[i])/(axis[i+1]-axis[i]);
      return {i0:i,i1:i+1,frac};
    }
  }
  return {i0:axis.length-1,i1:axis.length-1,frac:0};
}

function makeMatrix(r,c,v){
  return Array.from({length:r},()=>Array(c).fill(v));
}

function clamp(v,a,b){
  return Math.max(a,Math.min(b,v));
}

function clone(m){
  return JSON.parse(JSON.stringify(m));
}
