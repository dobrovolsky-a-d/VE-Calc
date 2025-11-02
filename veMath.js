// ====== veMath.js ======

export function calculateVE(log, veOld) {
  const rows = veOld.rows, cols = veOld.cols;
  const corrSum = makeMatrix(rows, cols, 0), count = makeMatrix(rows, cols, 0);

  // --- обработка лога ---
  log.forEach(p => {
    const afr = p.afr;
    const afrTarget = p.afrTarget;
    
    // ✅ ПРАВИЛЬНОЕ направление коррекции
    const afrCorr = limit(afrTarget / afr, 0.75, 1.25);
    
    const i = clamp(Math.floor(mapRange(p.map, 20, 200, 0, rows - 1)), 0, rows - 1);
    const j = clamp(Math.floor(mapRange(p.rpm, 800, 7000, 0, cols - 1)), 0, cols - 1);
    
    corrSum[i][j] += afrCorr;
    count[i][j]++;
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

  // --- улучшенная интерполяция пустых ячеек ---
  const veInterpolated = interpolateEmptyCells(veNew, count, veOld.values);

  // --- адаптивное сглаживание ---
  const veSmooth = adaptiveSmoothMatrix(veInterpolated, count);

  return {
    VE_old: veOld.values,
    VE_new: veSmooth,
    Correction: corrPercent,
    DataPoints: count // для отладки
  };
}

// Новая улучшенная интерполяция
function interpolateEmptyCells(matrix, count, fallback) {
  const rows = matrix.length, cols = matrix[0].length;
  const result = makeMatrix(rows, cols, 0);
  
  // Сначала копируем все существующие значения
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      result[i][j] = matrix[i][j];
    }
  }
  
  // Затем интерполируем пустые ячейки
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      if (count[i][j] === 0) {
        // Ищем ближайшие известные значения в радиусе
        const neighbors = [];
        const radius = 2;
        
        for (let di = -radius; di <= radius; di++) {
          for (let dj = -radius; dj <= radius; dj++) {
            const ni = i + di, nj = j + dj;
            if (ni >= 0 && ni < rows && nj >= 0 && nj < cols && count[ni][nj] > 0) {
              neighbors.push(matrix[ni][nj]);
            }
          }
        }
        
        if (neighbors.length > 0) {
          // Среднее значение соседей
          result[i][j] = neighbors.reduce((a, b) => a + b, 0) / neighbors.length;
        } else {
          result[i][j] = fallback[i][j] || 0;
        }
      }
    }
  }
  
  return result;
}

// Адаптивное сглаживание (меньше сглаживания там, где больше данных)
function adaptiveSmoothMatrix(matrix, count) {
  const rows = matrix.length, cols = matrix[0].length;
  const result = makeMatrix(rows, cols, 0);

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const dataPoints = count[i][j];
      
      if (dataPoints >= 5) {
        // Много данных - минимальное сглаживание
        result[i][j] = matrix[i][j];
      } else if (dataPoints >= 2) {
        // Среднее сглаживание
        result[i][j] = smoothPoint(matrix, i, j, 1);
      } else {
        // Мало данных - сильное сглаживание
        result[i][j] = smoothPoint(matrix, i, j, 2);
      }
    }
  }

  return result;
}

function smoothPoint(matrix, i, j, radius) {
  let sum = 0, n = 0;
  
  for (let di = -radius; di <= radius; di++) {
    for (let dj = -radius; dj <= radius; dj++) {
      const ni = i + di, nj = j + dj;
      if (ni >= 0 && ni < matrix.length && nj >= 0 && nj < matrix[0].length) {
        sum += matrix[ni][nj];
        n++;
      }
    }
  }
  
  return n ? sum / n : matrix[i][j];
}

// ====== вспомогательные функции ======
function makeMatrix(r, c, val) {
  return Array.from({ length: r }, () => Array(c).fill(val));
}

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

function limit(v, min, max) {
  return isNaN(v) ? 1 : Math.min(Math.max(v, min), max);
}

function mapRange(v, inMin, inMax, outMin, outMax) {
  return (v - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
}
