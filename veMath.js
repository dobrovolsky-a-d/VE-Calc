// ====== veMath.js ======

export function calculateVE(log, veOld) {
  const rows = veOld.rows;
  const cols = veOld.cols;
  const corrSum = makeMatrix(rows, cols, 0);
  const count = makeMatrix(rows, cols, 0);

  console.log('Starting VE calculation with:', rows, 'rows,', cols, 'cols');

  // --- обработка лога ---
  log.forEach((p, index) => {
    try {
      const afr = p.afr;
      const afrTarget = p.afrTarget;
      
      // ✅ ПРАВИЛЬНОЕ направление коррекции
      const afrCorr = limit(afrTarget / afr, 0.75, 1.25);
      
      const i = clamp(Math.floor(mapRange(p.map, 20, 200, 0, rows - 1)), 0, rows - 1);
      const j = clamp(Math.floor(mapRange(p.rpm, 800, 7000, 0, cols - 1)), 0, cols - 1);
      
      corrSum[i][j] += afrCorr;
      count[i][j]++;
    } catch (err) {
      console.error('Error processing log point', index, p, err);
    }
  });

  // --- пересчёт VE ---
  const veNew = makeMatrix(rows, cols, 0);
  const corrPercent = makeMatrix(rows, cols, 0);
  
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const avg = count[i][j] ? corrSum[i][j] / count[i][j] : 1;
      veNew[i][j] = (veOld.values[i][j] || 0) * avg;
      corrPercent[i][j] = (avg - 1) * 100;
    }
  }

  // --- простое сглаживание без сложной логики ---
  const veSmooth = simpleSmoothMatrix(veNew);

  console.log('VE calculation completed');

  return {
    VE_old: veOld.values,
    VE_new: veSmooth,
    Correction: corrPercent,
    DataPoints: count
  };
}

// Простое сглаживание
function simpleSmoothMatrix(matrix) {
  const rows = matrix.length;
  const cols = matrix[0].length;
  const result = makeMatrix(rows, cols, 0);

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      let sum = 0;
      let n = 0;
      
      // 3x3 smoothing kernel
      for (let di = -1; di <= 1; di++) {
        for (let dj = -1; dj <= 1; dj++) {
          const ni = i + di;
          const nj = j + dj;
          if (ni >= 0 && ni < rows && nj >= 0 && nj < cols) {
            sum += matrix[ni][nj];
            n++;
          }
        }
      }
      
      result[i][j] = sum / n;
    }
  }

  return result;
}

// ====== вспомогательные функции ======
function makeMatrix(r, c, val) {
  const matrix = [];
  for (let i = 0; i < r; i++) {
    matrix.push(Array(c).fill(val));
  }
  return matrix;
}

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

function limit(v, min, max) {
  if (isNaN(v)) return 1;
  return Math.min(Math.max(v, min), max);
}

function mapRange(v, inMin, inMax, outMin, outMax) {
  return (v - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
}
