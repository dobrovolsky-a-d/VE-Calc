/**
 * mapEditor.js
 * Универсальная вкладка "3D Map Editor" — любая карта RPM×Load → значение
 * (ignition, boost target, и т.д.). Использует тот же движок show3D что и VE Calc,
 * но полностью независима от него — не трогает veOld/lastResult из app.js.
 */

import { parseVEFromText } from "./parseVEfromText.js";
import { show3D } from "./ve3d.js";

let currentMapData = null; // последняя распарсенная карта, для Copy

export function initMapEditor() {

  document.getElementById("openMapEditorBtn").onclick = () => {
    try {
      const label = document.getElementById("mapLabelInput").value.trim() || "Value";
      const min   = parseFloat(document.getElementById("mapMinInput").value);
      const max   = parseFloat(document.getElementById("mapMaxInput").value);

      const parsed = parseVEFromText(
        document.getElementById("mapRpmAxis").value,
        document.getElementById("mapLoadAxis").value,
        document.getElementById("mapTableInput").value
      );

      currentMapData = parsed;

      const container = document.getElementById("mapEditor3dContainer");
      container.style.display = "block";

      void container.offsetWidth;

      requestAnimationFrame(() => {
        show3D(
          container,
          parsed.values,
          parsed.rpmAxis,
          parsed.loadAxis,
          null,
          (updated) => {
            document.getElementById("mapTableInput").value =
              updated.map(r => r.map(v => v.toFixed(2)).join("\t")).join("\n");
          },
          {
            label: label,
            min: isNaN(min) ? undefined : min,
            max: isNaN(max) ? undefined : max
          }
        );
        setDebugMap(`Карта загружена: ${parsed.rows} x ${parsed.cols}. Метка: "${label}", диапазон: ${isNaN(min) ? "40" : min}–${isNaN(max) ? "130" : max}`);
      });

    } catch (e) {
      console.error(e);
      setDebugMap("ERROR:\n" + e.message);
    }
  };

  // Пресеты для быстрого выбора типа карты — просто заполняют label/min/max
  document.querySelectorAll(".map-preset-btn").forEach(btn => {
    btn.onclick = () => {
      document.getElementById("mapLabelInput").value = btn.dataset.label;
      document.getElementById("mapMinInput").value    = btn.dataset.min;
      document.getElementById("mapMaxInput").value    = btn.dataset.max;
    };
  });
}

function setDebugMap(text) {
  const dbg = document.getElementById("mapEditorDebug");
  if (dbg) dbg.textContent = text;
}
