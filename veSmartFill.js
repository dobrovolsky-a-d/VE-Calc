/**
 * veSmartFill.js
 *
 * Физически осмысленная интерполяция VE карты.
 *
 * Логика:
 * 1. Якорные ячейки (mask=true) — реальные данные, не трогаем
 * 2. По якорям строим 2D полиномиальную поверхность (бикубик)
 * 3. Пустые зоны заполняем значениями с поверхности
 * 4. На стыках — плавный blend между реальными данными и моделью
 * 5. Физические ограничения: VE в диапазоне 40-130%
 * 6. Экстраполяция за пределы якорей — консервативная (оригинал + небольшая коррекция)
 */

const VE_MIN = 40;
const VE_MAX = 130;

// Насколько далеко от якорей мы доверяем модели (в ячейках)
const TRUST_RADIUS = 4;

// Вес blend на границе: 0 = полностью модель, 1 = полностью оригинал
// Плавно переходим от модели (рядом с якорями) к оригиналу (далеко)
const BLEND_FALLOFF = 1.2;

export function smartFill(veMatrix, mask, veOriginal, rpmAxis, loadAxis) {

  const rows = veMatrix.length;
  const cols = veMatrix[0].length;

  // --- Собираем якоря ---
  const anchors = [];
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      if (mask[i][j]) {
        anchors.push({
          // Нормализуем оси в [0,1] для стабильности полинома
          rpmN: normalize(rpmAxis[i], rpmAxis),
          mapN: normalize(loadAxis[j], loadAxis),
          ve:   veMatrix[i][j],
          i, j
        });
      }
    }
  }

  if (anchors.length < 4) {
    // Слишком мало якорей — возвращаем как есть
    return veMatrix;
  }

  // --- Строим полиномиальную модель ---
  const model = fitPolynomial(anchors);

  // --- Считаем расстояние каждой ячейки до ближайшего якоря ---
  const dist = distanceMap(mask, rows, cols);

  // --- Заполняем пустые ячейки ---
  const out = clone(veMatrix);

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {

      // Якорные ячейки не трогаем — только выводим предупреждение если аномалия
      if (mask[i][j]) continue;

      const rpmN = normalize(rpmAxis[i], rpmAxis);
      const mapN = normalize(loadAxis[j], loadAxis);

      const predicted = evalPolynomial(model, rpmN, mapN);
      const clamped   = clamp(predicted, VE_MIN, VE_MAX);

      const d = dist[i][j];

      if (d === 0) {
        // Прямо рядом с якорем — доверяем модели полностью
        out[i][j] = clamped;
      } else if (d <= TRUST_RADIUS) {
        // Переходная зона — blend между моделью и оригиналом
        const t = Math.min(1, (d / TRUST_RADIUS) * BLEND_FALLOFF);
        out[i][j] = lerp(clamped, veOriginal[i][j], t);
      } else {
        // Далеко от якорей — консервативно: оригинал с небольшой поправкой от модели
        const delta = clamped - veOriginal[i][j];
        const conservativeDelta = clamp(delta * 0.2, -5, 5); // макс 5% коррекция вдалеке
        out[i][j] = clamp(veOriginal[i][j] + conservativeDelta, VE_MIN, VE_MAX);
      }
    }
  }

  // --- Финальный проход: сглаживание только на стыках ---
  return blendBoundary(out, mask, rows, cols);
}

/* ============================================================
   ПОЛИНОМИАЛЬНАЯ РЕГРЕССИЯ 2D
   Степень 3 — достаточно для формы VE, не перефитим
   Термы: 1, x, y, x², xy, y², x³, x²y, xy², y³
   ============================================================ */

function getTerms(x, y) {
  return [
    1,
    x, y,
    x*x, x*y, y*y,
    x*x*x, x*x*y, x*y*y, y*y*y
  ];
}

function fitPolynomial(anchors) {

  const n = anchors.length;
  const termCount = getTerms(0, 0).length;

  // Строим матрицу A (n x termCount) и вектор b (n)
  const A = [];
  const b = [];

  for (let k = 0; k < n; k++) {
    A.push(getTerms(anchors[k].rpmN, anchors[k].mapN));
    b.push(anchors[k].ve);
  }

  // Решаем методом наименьших квадратов: (Aᵀ·A)·x = Aᵀ·b
  return leastSquares(A, b, termCount);
}

function evalPolynomial(coeffs, x, y) {
  const terms = getTerms(x, y);
  return terms.reduce((sum, t, i) => sum + t * (coeffs[i] || 0), 0);
}

/* ============================================================
   МЕТОД НАИМЕНЬШИХ КВАДРАТОВ (без внешних библиотек)
   ============================================================ */

function leastSquares(A, b, termCount) {

  const n = A.length;

  // AᵀA
  const AtA = Array.from({length: termCount}, () => Array(termCount).fill(0));
  // Aᵀb
  const Atb = Array(termCount).fill(0);

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < termCount; j++) {
      Atb[j] += A[i][j] * b[i];
      for (let k = 0; k < termCount; k++) {
        AtA[j][k] += A[i][j] * A[i][k];
      }
    }
  }

  // Решаем систему AtA * x = Atb методом Гаусса
  return gaussianElimination(AtA, Atb);
}

function gaussianElimination(A, b) {

  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {

    // Поиск максимального элемента для устойчивости
    let maxRow = col;
    for (let row = col+1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row;
    }
    [M[col], M[maxRow]] = [M[maxRow], M[col]];

    if (Math.abs(M[col][col]) < 1e-12) continue; // вырожденная строка

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = M[row][col] / M[col][col];
      for (let k = col; k <= n; k++) {
        M[row][k] -= factor * M[col][k];
      }
    }
  }

  return M.map((row, i) =>
    Math.abs(M[i][i]) < 1e-12 ? 0 : row[n] / M[i][i]
  );
}

/* ============================================================
   КАРТА РАССТОЯНИЙ до ближайшего якоря
   ============================================================ */

function distanceMap(mask, rows, cols) {

  const dist = Array.from({length: rows}, () => Array(cols).fill(Infinity));

  // BFS от всех якорей
  const queue = [];

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      if (mask[i][j]) {
        dist[i][j] = 0;
        queue.push([i, j]);
      }
    }
  }

  const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
  let head = 0;

  while (head < queue.length) {
    const [ci, cj] = queue[head++];
    for (const [di, dj] of dirs) {
      const ni = ci + di;
      const nj = cj + dj;
      if (ni >= 0 && ni < rows && nj >= 0 && nj < cols) {
        if (dist[ni][nj] > dist[ci][cj] + 1) {
          dist[ni][nj] = dist[ci][cj] + 1;
          queue.push([ni, nj]);
        }
      }
    }
  }

  return dist;
}

/* ============================================================
   СГЛАЖИВАНИЕ ТОЛЬКО НА СТЫКАХ
   Якорные ячейки не трогаем, сглаживаем только переходы
   ============================================================ */

function blendBoundary(m, mask, rows, cols) {

  const out = clone(m);

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {

      if (mask[i][j]) continue; // якоря не трогаем

      const vals = [m[i][j]];
      const dirs = [[-1,0],[1,0],[0,-1],[0,1]];

      for (const [di, dj] of dirs) {
        const ni = i+di, nj = j+dj;
        if (ni >= 0 && ni < rows && nj >= 0 && nj < cols) {
          vals.push(m[ni][nj]);
        }
      }

      const avg = vals.reduce((a,b) => a+b, 0) / vals.length;

      // Лёгкий blend: 70% своё значение + 30% среднее соседей
      out[i][j] = 0.7 * m[i][j] + 0.3 * avg;
    }
  }

  return out;
}

/* ============================================================
   HELPERS
   ============================================================ */

function normalize(val, axis) {
  const min = axis[0];
  const max = axis[axis.length - 1];
  if (max === min) return 0;
  return (val - min) / (max - min);
}

function lerp(a, b, t) {
  return a * (1 - t) + b * t;
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function clone(m) {
  return JSON.parse(JSON.stringify(m));
}
