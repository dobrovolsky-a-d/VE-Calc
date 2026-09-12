/**
 * mapEditor.js
 * Универсальная вкладка "3D Map Editor" — любая карта RPM×Load → значение
 * (ignition, boost target, и т.д.). Использует тот же движок show3D что и VE Calc,
 * но полностью независима от него — не трогает veOld/lastResult из app.js.
 *
 * Сохранение карт: каждая карта хранится в localStorage под ключом
 * "mapEditor:<название>" и содержит {rpmAxis, loadAxis, table, label, min, max}.
 * Список названий (для dropdown) хранится отдельно под "mapEditor:__index".
 */

import { parseVEFromText } from "./parseVEfromText.js";
import { show3D } from "./ve3d.js";

const STORAGE_PREFIX = "mapEditor:";
const INDEX_KEY = STORAGE_PREFIX + "__index";

let currentMapData = null; // последняя распарсенная карта, для Copy
let suppressAutoSave = false; // true пока грузим сохранённую карту в поля — чтобы не сохранить её саму в себя

export function initMapEditor() {

  refreshSavedMapsList();

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

      // Автосохранение при открытии — карта попадает в список под введённым именем
      saveCurrentMapToStorage();

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
            // Правки в 3D тоже сохраняем в ту же карту автоматически
            saveCurrentMapToStorage();
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

  // Выбор карты из списка сохранённых
  document.getElementById("savedMapsSelect").onchange = (e) => {
    const name = e.target.value;
    if (!name) {
      clearMapForm();
      return;
    }
    loadMapFromStorage(name);
  };

  document.getElementById("deleteSavedMapBtn").onclick = () => {
    const select = document.getElementById("savedMapsSelect");
    const name = select.value;
    if (!name) {
      setDebugMap("Выбери карту в списке, чтобы удалить");
      return;
    }
    if (!confirm(`Удалить карту "${name}"? Это необратимо.`)) return;

    localStorage.removeItem(STORAGE_PREFIX + name);
    const index = getMapIndex().filter(n => n !== name);
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));

    refreshSavedMapsList();
    clearMapForm();
    setDebugMap(`Карта "${name}" удалена`);
  };

  // Автосохранение "на лету" при редактировании полей (не только по кнопке Open) —
  // так правки в названии/осях/таблице не теряются при переключении карт
  ["mapNameInput", "mapRpmAxis", "mapLoadAxis", "mapTableInput", "mapLabelInput", "mapMinInput", "mapMaxInput"]
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("blur", () => {
        if (!suppressAutoSave) saveCurrentMapToStorage();
      });
    });
}

/* ---------- localStorage helpers ---------- */

function getMapIndex() {
  try {
    return JSON.parse(localStorage.getItem(INDEX_KEY)) || [];
  } catch {
    return [];
  }
}

function saveCurrentMapToStorage() {
  const name = document.getElementById("mapNameInput").value.trim();
  if (!name) return; // без имени не сохраняем — иначе не сможем показать в списке

  const data = {
    rpmAxis: document.getElementById("mapRpmAxis").value,
    loadAxis: document.getElementById("mapLoadAxis").value,
    table: document.getElementById("mapTableInput").value,
    label: document.getElementById("mapLabelInput").value,
    min: document.getElementById("mapMinInput").value,
    max: document.getElementById("mapMaxInput").value
  };

  try {
    localStorage.setItem(STORAGE_PREFIX + name, JSON.stringify(data));
    const index = getMapIndex();
    if (!index.includes(name)) {
      index.push(name);
      localStorage.setItem(INDEX_KEY, JSON.stringify(index));
    }
    refreshSavedMapsList(name);
  } catch (e) {
    console.error("Не удалось сохранить карту в localStorage:", e);
  }
}

function loadMapFromStorage(name) {
  const raw = localStorage.getItem(STORAGE_PREFIX + name);
  if (!raw) {
    setDebugMap(`Карта "${name}" не найдена`);
    return;
  }

  try {
    const data = JSON.parse(raw);
    suppressAutoSave = true;

    document.getElementById("mapNameInput").value  = name;
    document.getElementById("mapRpmAxis").value    = data.rpmAxis || "";
    document.getElementById("mapLoadAxis").value   = data.loadAxis || "";
    document.getElementById("mapTableInput").value = data.table || "";
    document.getElementById("mapLabelInput").value = data.label || "VE %";
    document.getElementById("mapMinInput").value   = data.min ?? "40";
    document.getElementById("mapMaxInput").value   = data.max ?? "130";

    suppressAutoSave = false;
    setDebugMap(`Карта "${name}" загружена из сохранённых`);
  } catch (e) {
    console.error(e);
    setDebugMap("Ошибка чтения сохранённой карты:\n" + e.message);
  }
}

function clearMapForm() {
  suppressAutoSave = true;
  document.getElementById("mapNameInput").value  = "";
  document.getElementById("mapRpmAxis").value    = "";
  document.getElementById("mapLoadAxis").value   = "";
  document.getElementById("mapTableInput").value = "";
  suppressAutoSave = false;
}

function refreshSavedMapsList(selectName) {
  const select = document.getElementById("savedMapsSelect");
  const index = getMapIndex();

  const currentValue = selectName || select.value;

  select.innerHTML = '<option value="">— новая карта —</option>';
  index.forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  });

  if (currentValue && index.includes(currentValue)) {
    select.value = currentValue;
  }
}

function setDebugMap(text) {
  const dbg = document.getElementById("mapEditorDebug");
  if (dbg) dbg.textContent = text;
}
