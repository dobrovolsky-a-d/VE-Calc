export function calculateVE(log, veOld) {
  const rows = veOld.rows;
  const cols = veOld.cols;
  const corrSum = Array(rows).fill(0).map(() => Array(cols).fill(0));
  const count = Array(rows).fill(0).map(() => Array(cols).fill(0));

  console.log('VE table - RPM:', veOld.rpmAxis, 'MAP (PSI):', veOld.mapAxis);

  // --- обработка лога ---
  log.forEach((p) => {
    const afr = p.afr;
    const afrTarget = p.afrTarget;
    
    // ✅ ПРАВИЛЬНОЕ направление коррекции
    const afrCorr = limit(afrTarget / afr, 0.75, 1.25);
    
    // Находим индексы в таблице VE по осям PSI
    const i = findIndexInAxis(veOld.rpmAxis, p.rpm);
    const j = findIndexInAxis(veOld.mapAxis, p.map);
    
    if (i >= 0 && i < rows && j >= 0 && j < cols) {
      corrSum[i][j] += afrCorr;
      count[i][j]++;
    }
  });

  // --- пересчёт VE ---
  const veNew = Array(rows).fill(0).map(() => Array(cols).fill(0));
  const corrPercent = Array(rows).fill(0).map(() => Array(cols).fill(0));
  
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const avg = count[i][j] ? corrSum[i][j] / count[i][j] : 1;
      veNew[i][j] = (veOld.values[i][j] || 0) * avg;
      corrPercent[i][j] = (avg - 1) * 100;
    }
  }

  // --- простое сглаживание ---
  const veSmooth = simpleSmoothMatrix(veNew);

  return {
    VE_old: veOld.values,
    VE_new: veSmooth,
    Correction: corrPercent,
    DataPoints: count
  };
}

// Находит ближайший индекс в оси
function findIndexInAxis(axis, value) {
  for (let i = 0; i < axis.length; i++) {
    if (value <= axis[i]) return i;
  }
  return axis.length - 1;
}

// Вспомогательные функции...
function simpleSmoothMatrix(matrix) {
  const rows = matrix.length;
  const cols = matrix[0].length;
  const result = Array(rows).fill(0).map(() => Array(cols).fill(0));

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      let sum = 0;
      let n = 0;
      
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

function limit(v, min, max) {
  if (isNaN(v)) return 1;
  return Math.min(Math.max(v, min), max);
}
