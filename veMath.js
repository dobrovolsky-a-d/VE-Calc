// veMath.js — простая и надёжная версия VE калькулятора

export function calculateVE(log, veOld) {
  const rows = veOld.rows, cols = veOld.cols;
  const corrSum = makeMatrix(rows, cols, 0);
  const count = makeMatrix(rows, cols, 0);

  log.forEach(p => {
    const afr = parseFloat(p.afr);
    const afrTarget = parseFloat(p.afrTarget);
    if (!afr || !afrTarget) return;

    // коэффициент коррекции
    let corr = afr / afrTarget;
    corr = clamp(corr, 0.85, 1.15);

    // индекс ячеек
    const i = clamp(Math.floor(mapRange(p.map, 0, 40, 0, rows - 1)), 0, rows - 1);
    const j = clamp(Math.floor(mapRange(p.rpm, 800, 7000, 0, cols - 1)), 0, cols - 1);

    corrSum[i][j] += corr;
    count[i][j]++;
  });

  const veNew = makeMatrix(rows, cols, 0);
  const corrPercent = makeMatrix(rows, cols, 0);

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const avgCorr = count[i][j] ? corrSum[i][j] / count[i][j] : 1;
      veNew[i][j] = (veOld.values[i][j] || 0) * avgCorr;
      corrPercent[i][j] = (avgCorr - 1) * 100;
    }
  }

  // лёгкое сглаживание
  const veSmooth = smoothMatrix(veNew, 3);
  return { VE_old: veOld.values, VE_new: veSmooth, Correction: corrPercent };
}

// ---------------- Вспомогательные функции ----------------
function makeMatrix(r, c, val) {
  return Array.from({ length: r }, () => Array(c).fill(val));
}

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

function mapRange(v, inMin, inMax, outMin, outMax) {
  return (v - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
}

function smoothMatrix(matrix, size) {
  const r = matrix.length, c = matrix[0].length, half = Math.floor(size / 2);
  const res = makeMatrix(r, c, 0);

  for (let i = 0; i < r; i++) {
    for (let j = 0; j < c; j++) {
      let sum = 0, n = 0;
      for (let di = -half; di <= half; di++) {
        for (let dj = -half; dj <= half; dj++) {
          const ni = i + di, nj = j + dj;
          if (ni >= 0 && ni < r && nj >= 0 && nj < c) {
            sum += matrix[ni][nj];
            n++;
          }
        }
      }
      res[i][j] = n ? sum / n : matrix[i][j];
    }
  }
  return res;
}
