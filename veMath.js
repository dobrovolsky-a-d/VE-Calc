export function calculateVE(log, veOld) {
  const rows = veOld.rows, cols = veOld.cols;
  const corrSum = makeMatrix(rows, cols, 0), count = makeMatrix(rows, cols, 0);

  log.forEach(p => {
    const afr = p.afr;
    const afrTarget = p.afrTarget;
    const afrCorr = limit(afrTarget / afr, 0.75, 1.25);
    const i = clamp(Math.floor(mapRange(p.map, 20, 200, 0, rows-1)), 0, rows-1);
    const j = clamp(Math.floor(mapRange(p.rpm, 800, 7000, 0, cols-1)), 0, cols-1);
    corrSum[i][j] += afrCorr;
    count[i][j]++;
  });

  const veNew = makeMatrix(rows, cols, 0), corrPercent = makeMatrix(rows, cols, 0);
  for (let i=0;i<rows;i++) {
    for (let j=0;j<cols;j++) {
      const avg = count[i][j] ? corrSum[i][j]/count[i][j] : 1;
      veNew[i][j] = (veOld.values[i][j] || 0) * avg;
      corrPercent[i][j] = (avg - 1) * 100;
    }
  }

  const veSmooth = smoothMatrix(veNew, 3);
  return { VE_old: veOld.values, VE_new: veSmooth, Correction: corrPercent };
}

function makeMatrix(r,c,val){ return Array.from({length:r},()=>Array(c).fill(val)); }
function clamp(v,min,max){ return Math.min(Math.max(v,min),max); }
function limit(v,min,max){ return isNaN(v)?1:Math.min(Math.max(v,min),max); }
function mapRange(v,inMin,inMax,outMin,outMax){ return (v-inMin)*(outMax-outMin)/(inMax-inMin)+outMin; }
function smoothMatrix(matrix,size){
  const r=matrix.length, c=matrix[0].length, half=Math.floor(size/2);
  const res=makeMatrix(r,c,0);
  for(let i=0;i<r;i++){
    for(let j=0;j<c;j++){
      let sum=0, n=0;
      for(let di=-half; di<=half; di++){
        for(let dj=-half; dj<=half; dj++){
          const ni=i+di, nj=j+dj;
          if(ni>=0 && ni<r && nj>=0 && nj<c){ sum+=matrix[ni][nj]; n++; }
        }
      }
      res[i][j] = n ? sum/n : matrix[i][j];
    }
  }
  return res;
}
