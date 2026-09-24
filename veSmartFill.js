/**
 * veSmartFill.js
 *
 * IDW (Inverse Distance Weighting) интерполяция VE карты с анизотропным весом.
 *
 * Почему заменили прежний полиномиальный smart-режим:
 * Полином строит ОДНУ гладкую поверхность на всю карту — у него фиксированная
 * "гибкость" везде одновременно. Из-за этого он либо слишком гладко проходит
 * переходные режимы (резкие скачки по нагрузке — вход в буст, смена фазы турбины),
 * либо начинает волноваться там, где карта должна быть плоской.
 *
 * IDW устраняет "вырванные куски" других методов (soft/engine), которые смотрят
 * только на 4 соседние ячейки — из-за чего разные дыры заполнялись независимо
 * и не согласованно друг с другом. IDW смотрит на ВСЕ реальные точки карты сразу
 * и взвешивает их по расстоянию — результат согласован по всей поверхности.
 *
 * Анизотропность: RPM и MAP физически разные оси — по оборотам карта обычно
 * гладкая (плато), по нагрузке случаются резкие реальные переходы. Поэтому
 * расстояние по MAP считается "дороже" (весит больше), чем по RPM — далёкие
 * по нагрузке точки меньше тянут интерполяцию, резкие переходы не размываются.
 *
 * Логика:
 * 1. Якорные ячейки (mask=true) — реальные данные, тоже участвуют в IDW
 *    (могут слегка сдвинуться сами, для более гладкой согласованной поверхности —
 *    но только под влиянием ближайших соседних якорей, не пустых зон)
 * 2. Каждая ячейка получает взвешенное среднее ВСЕХ якорей, вес = 1/distance^power
 * 3. Анизотропный вес расстояния — regulируемый параметр anisotropy (0..1):
 *    anisotropy=0   → расстояние считается одинаково по RPM и MAP (изотропно)
 *    anisotropy=1   → расстояние по MAP считается вдвое "дороже", чем по RPM
 * 4. Физические ограничения: значение всегда в диапазоне VAL_MIN..VAL_MAX
 */

const IDW_POWER = 2; // стандартный показатель степени для IDW — баланс локальности/гладкости

export function smartFill(veMatrix, mask, veOriginal, rpmAxis, loadAxis, options = {}) {

  const rows = veMatrix.length;
  const cols = veMatrix[0].length;

  const valMin = options.min ?? 40;
  const valMax = options.max ?? 130;
  const anisotropy = clamp01(options.anisotropy ?? 0.5); // 0..1, дефолт — умеренный перекос к MAP

  // --- Собираем якоря (все ячейки с реальными данными) ---
  const anchors = [];
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      if (mask[i][j]) {
        anchors.push({
          rpmN: normalize(rpmAxis[i], rpmAxis),
          mapN: normalize(loadAxis[j], loadAxis),
          ve:   veMatrix[i][j],
          i, j
        });
      }
    }
  }

  if (anchors.length < 2) {
    // Недостаточно данных для осмысленной интерполяции — возвращаем как есть
    return veMatrix;
  }

  // Вес осей: чем выше anisotropy, тем "дороже" расстояние по MAP относительно RPM.
  // При anisotropy=0 веса равны (1,1) — обычное евклидово расстояние.
  // При anisotropy=1 вес MAP вдвое выше веса RPM.
  const rpmWeight = 1;
  const mapWeight = 1 + anisotropy; // от 1 (изотропно) до 2 (map "дороже" в 2 раза)

  const out = makeMatrix(rows, cols, 0);

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {

      const rpmN = normalize(rpmAxis[i], rpmAxis);
      const mapN = normalize(loadAxis[j], loadAxis);

      let weightSum = 0;
      let valueSum  = 0;
      let exactHit  = null; // если попали точно в якорь — используем его напрямую

      for (const a of anchors) {
        const dRpm = (rpmN - a.rpmN) * rpmWeight;
        const dMap = (mapN - a.mapN) * mapWeight;
        const dist = Math.sqrt(dRpm * dRpm + dMap * dMap);

        if (dist < 1e-9) {
          exactHit = a.ve;
          break;
        }

        const w = 1 / Math.pow(dist, IDW_POWER);
        weightSum += w;
        valueSum  += w * a.ve;
      }

      let value = exactHit !== null ? exactHit : (valueSum / weightSum);
      out[i][j] = clamp(value, valMin, valMax);
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

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function makeMatrix(r, c, v) {
  return Array.from({ length: r }, () => Array(c).fill(v));
}
