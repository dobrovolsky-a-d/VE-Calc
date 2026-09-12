/**
 * ve3d.js — Stage X style 3D map editor
 * - Белая сетка с точками на пересечениях
 * - Клик — выбрать точку, Ctrl+клик — добавить к выделению
 * - +/- или стрелки вверх/вниз — менять значение выделенных
 * - Настраиваемый шаг 0.5–10
 *
 * options (необязательный 7-й параметр) — для использования с картами кроме VE:
 *   { label: "VE %", min: 40, max: 130 }
 * Если не передан — поведение идентично старому (VE, 40–130%), ничего не ломает.
 */

// Модульная переменная — гарантирует что на window висит только ОДИН keydown
// листенер за раз, даже если show3D() вызывается повторно (переоткрытие,
// разные вкладки/карты) без явного клика по "Закрыть". Без этого каждый повторный
// вызов копил ещё один листенер, и один "+" срабатывал N раз одновременно.
let activeKeyHandler = null;

export function show3D(container, veMatrix, rpmAxis, loadAxis, mask, onTableUpdate, options) {

  // Снимаем листенер предыдущего открытия 3D, если он ещё жив
  if (activeKeyHandler) {
    window.removeEventListener("keydown", activeKeyHandler);
    activeKeyHandler = null;
  }

  const VAL_LABEL = (options && options.label) || "VE %";
  const VAL_MIN   = (options && typeof options.min === "number") ? options.min : 40;
  const VAL_MAX   = (options && typeof options.max === "number") ? options.max : 130;

  const TOOLBAR_H = 50;
  const H = 550;

  container.innerHTML = "";
  container.style.cssText = "width:100%;position:relative;background:#111;border-radius:10px;overflow:hidden;";
  container.style.height = (TOOLBAR_H + H) + "px";

  let veData = veMatrix.map(r => [...r]);
  const originalData = veMatrix.map(r => [...r]); // неизменная копия — для наложения "до/после"
  let showOverlay = false;
  const selected = new Set();

  // sceneAPI связывает toolbar-функции (adjustSelected и т.д.) с рендер-сценой,
  // которая создаётся асинхронно после загрузки Three.js
  const sceneAPI = { rebuild: null, ready: false };

  function cellKey(i, j) { return `${i}_${j}`; }

  /* ---------------- Toolbar ---------------- */

  const toolbar = document.createElement("div");
  toolbar.style.cssText = "position:absolute;top:10px;left:10px;z-index:20;display:flex;gap:8px;align-items:center;flex-wrap:wrap;";

  function btn(text, bg, cb) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = text;
    b.style.cssText = `background:${bg};color:white;border:none;border-radius:6px;padding:5px 12px;cursor:pointer;font-size:12px;font-family:system-ui;`;
    b.onclick = cb;
    return b;
  }

  const stepLabel = document.createElement("span");
  stepLabel.style.cssText = "color:#aaa;font-size:12px;font-family:system-ui;";
  stepLabel.textContent = "Шаг:";

  const stepInput = document.createElement("input");
  stepInput.type  = "number";
  stepInput.value = "0.1";
  stepInput.min   = "0.1";
  stepInput.max   = "10";
  stepInput.step  = "0.1";
  stepInput.style.cssText = "width:55px;padding:4px;border-radius:5px;border:1px solid #444;background:#222;color:#fff;font-size:12px;text-align:center;";

  const plusBtn  = btn("+ Вверх", "#2a6", () => {
    plusBtn.disabled = true; minusBtn.disabled = true;
    adjustSelected(+parseFloat(stepInput.value));
    setTimeout(() => { plusBtn.disabled = false; minusBtn.disabled = false; }, 150);
  });
  const minusBtn = btn("− Вниз",  "#a44", () => {
    plusBtn.disabled = true; minusBtn.disabled = true;
    adjustSelected(-parseFloat(stepInput.value));
    setTimeout(() => { plusBtn.disabled = false; minusBtn.disabled = false; }, 150);
  });

  const clearBtn = btn("Снять выделение", "#555", () => {
    selected.clear();
    if (sceneAPI.rebuild) sceneAPI.rebuild();
    updateSelectionUI();
  });

  const resetViewBtn = btn("🎥 Сброс вида", "#456", () => {
    if (sceneAPI.resetView) sceneAPI.resetView();
  });

  const copyBtn = btn("📋 Copy table", "#28a745", () => {
    const text = veData.map(r => r.map(v => v.toFixed(2)).join("\t")).join("\n");
    navigator.clipboard.writeText(text).then(() => {
      copyBtn.textContent = "✓ Скопировано!";
      setTimeout(() => copyBtn.textContent = "📋 Copy table", 1500);
    });
  });

  const closeBtn = btn("✕ Закрыть", "rgba(255,255,255,0.1)", () => {
    if (activeKeyHandler) {
      window.removeEventListener("keydown", activeKeyHandler);
      activeKeyHandler = null;
    }
    container.style.display = "none";
  });
  closeBtn.style.border = "1px solid rgba(255,255,255,0.25)";

  const undoBtn = btn("↩ Undo", "#8855cc", () => undo());

  const overlayBtn = btn("👁 Было/Стало", "#e67e22", () => {
    showOverlay = !showOverlay;
    overlayBtn.style.background = showOverlay ? "#27ae60" : "#e67e22";
    overlayBtn.textContent = showOverlay ? "👁 Скрыть исходник" : "👁 Было/Стало";
    if (sceneAPI.rebuild) sceneAPI.rebuild();
  });

  [stepLabel, stepInput, plusBtn, minusBtn, undoBtn, overlayBtn, clearBtn, resetViewBtn, copyBtn, closeBtn].forEach(el => toolbar.appendChild(el));
  container.appendChild(toolbar);

  /* ---------------- Info bar (общая строка снизу) ---------------- */

  const infoBar = document.createElement("div");
  infoBar.style.cssText = "position:absolute;bottom:10px;left:10px;z-index:20;color:#aaa;font-size:11px;font-family:system-ui;background:rgba(0,0,0,0.5);padding:4px 10px;border-radius:5px;";
  container.appendChild(infoBar);

  function updateInfoBar() {
    if (selected.size === 0) {
      infoBar.textContent = "Клик — выбрать | Ctrl+клик — добавить | Shift+тащить — область | +/- — изменить";
      return;
    }
    const vals = [...selected].map(k => {
      const [i, j] = k.split("_").map(Number);
      return veData[i][j];
    });
    const min = Math.min(...vals).toFixed(1);
    const max = Math.max(...vals).toFixed(1);
    infoBar.textContent = `Выделено: ${selected.size} ячеек | VE: ${min === max ? min : min + " – " + max}`;
  }

  /* ---------------- Detail panel (RPM/MAP/VE выбранных точек) ---------------- */
  // Отдельная панель слева, под тулбаром — не перекрывает саму сетку с точками

  const detailPanel = document.createElement("div");
  detailPanel.style.cssText = "position:absolute;top:60px;left:10px;z-index:20;color:#ddd;font-size:11px;font-family:monospace;background:rgba(0,0,0,0.55);padding:8px 10px;border-radius:6px;max-height:180px;overflow-y:auto;min-width:150px;display:none;";
  container.appendChild(detailPanel);

  function updateDetailPanel() {
    if (selected.size === 0) {
      detailPanel.style.display = "none";
      return;
    }

    detailPanel.style.display = "block";

    const rows = [...selected].map(k => {
      const [i, j] = k.split("_").map(Number);
      return { rpm: Math.round(rpmAxis[i]), map: loadAxis[j].toFixed(1), ve: veData[i][j] };
    });

    // Сортируем по RPM затем по MAP для читаемости
    rows.sort((a, b) => a.rpm - b.rpm || a.map - b.map);

    const header = `<div style="color:#888;margin-bottom:4px;border-bottom:1px solid #333;padding-bottom:3px;">RPM &nbsp; MAP &nbsp; VE%</div>`;
    const lines = rows.map(r =>
      `<div>${String(r.rpm).padEnd(6)} ${String(r.map).padEnd(6)} <b style="color:#8cf;">${r.ve.toFixed(1)}</b></div>`
    ).join("");

    detailPanel.innerHTML = header + lines;
  }

  function updateSelectionUI() {
    updateInfoBar();
    updateDetailPanel();
  }

  // Теперь когда все функции и DOM-узлы готовы — можно вызвать первичное обновление
  updateSelectionUI();

  const hint = document.createElement("div");
  hint.style.cssText = "position:absolute;bottom:10px;right:15px;color:#555;font-size:10px;font-family:system-ui;z-index:10;";
  hint.textContent = "ЛКМ — вращать  |  Колёсико — зум  |  ПКМ — сдвиг  |  Shift+ЛКМ — выделить область";
  container.appendChild(hint);

  /* ---------------- Изменение значений + Undo ---------------- */

  const history = []; // стек снапшотов veData перед каждым изменением
  const MAX_HISTORY = 50;

  function pushHistory() {
    history.push(veData.map(r => [...r]));
    if (history.length > MAX_HISTORY) history.shift();
  }

  function undo() {
    if (history.length === 0 || !sceneAPI.rebuild) return;
    veData = history.pop();
    sceneAPI.rebuild();
    updateSelectionUI();
    if (onTableUpdate) onTableUpdate(veData);
  }

  let isAdjusting = false;
  let lastAdjustTime = 0;
  const MIN_ADJUST_INTERVAL_MS = 120; // жёсткий дебаунс — не даёт двум вызовам пройти быстрее этого окна

  function adjustSelected(delta) {
    const now = Date.now();

    if (selected.size === 0 || isAdjusting || !sceneAPI.rebuild) {
      return;
    }
    if (now - lastAdjustTime < MIN_ADJUST_INTERVAL_MS) {
      return;
    }
    lastAdjustTime = now;
    isAdjusting = true;

    pushHistory();

    selected.forEach(k => {
      const [i, j] = k.split("_").map(Number);
      veData[i][j] = Math.max(VAL_MIN, Math.min(VAL_MAX, veData[i][j] + delta));
    });

    sceneAPI.rebuild();
    updateSelectionUI();
    if (onTableUpdate) onTableUpdate(veData);

    isAdjusting = false;
  }

  const keyHandler = (e) => {
    if (e.target.tagName === "INPUT") return;
    const step = parseFloat(stepInput.value) || 0.1;
    if (e.key === "+" || e.key === "=" || e.key === "ArrowUp")   { e.preventDefault(); adjustSelected(+step); }
    if (e.key === "-" || e.key === "_" || e.key === "ArrowDown") { e.preventDefault(); adjustSelected(-step); }
    if (e.key === "Escape") { selected.clear(); if (sceneAPI.rebuild) sceneAPI.rebuild(); updateSelectionUI(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); }
  };

  activeKeyHandler = keyHandler;
  window.addEventListener("keydown", keyHandler);

  /* ---------------- Three.js сцена ---------------- */

  if (window.THREE) {
    initScene();
  } else {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
    script.onload = initScene;
    document.head.appendChild(script);
  }

  function initScene() {
    const THREE = window.THREE;
    const rows  = veData.length;
    const cols  = veData[0].length;
    let   W     = container.clientWidth;
    if (!W || W < 100) {
      W = (container.parentElement && container.parentElement.clientWidth > 100)
        ? container.parentElement.clientWidth
        : (document.body.clientWidth || 900);
    }

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.top      = TOOLBAR_H + "px";
    renderer.domElement.style.left     = "0";
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);

    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 1000);

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dir = new THREE.DirectionalLight(0xffffff, 0.6);
    dir.position.set(20, 40, 20);
    scene.add(dir);

    const scaleX  = 30 / (cols - 1);
    const scaleZ  = 30 / (rows - 1);
    const offsetX = -15;
    const offsetZ = -15;

    function getVeMinMax() {
      const flat = veData.flat();
      return [Math.min(...flat), Math.max(...flat)];
    }
    function getScaleY(vMin, vMax) { return 15 / ((vMax - vMin) || 1); }

    function veColor(ve, vMin, vMax) {
      const t = (ve - vMin) / ((vMax - vMin) || 1);
      const c = new THREE.Color();
      // Зелёный участок приглушён (0.6 макс вместо 1.0) — рельеф лучше читается
      if      (t < 0.25) c.setRGB(0, t * 2.4, 1);
      else if (t < 0.5)  c.setRGB(0, 0.6, 1 - (t - 0.25) * 2.4);
      else if (t < 0.75) c.setRGB((t - 0.5) * 4, 0.6, 0);
      else               c.setRGB(1, 0.6 * (1 - (t - 0.75) * 4), 0);
      return c;
    }

    let surfaceMesh = null;
    let wireMesh    = null;
    let pointsMesh  = null;
    let overlayMesh = null;
    const vertexPositions = [];

    // --- Colorbar (создаём DOM один раз, дальше только текст) ---
    const colorbar = createColorbarDOM(container);

    // --- Overlay для подписей осей (создаём один раз) ---
    const overlay = document.createElement("div");
    overlay.style.cssText = `position:absolute;top:${TOOLBAR_H}px;left:0;width:100%;height:${H}px;pointer-events:none;overflow:hidden;`;
    container.appendChild(overlay);

    let labelDefs = [];
    let labelEls  = [];

    function rebuildLabels(vMin, vMax) {
      // Удаляем старые
      labelEls.forEach(el => el.remove());
      labelDefs = [];
      labelEls  = [];

      const rpmStep = Math.max(1, Math.floor(rows / 6));
      for (let i = 0; i < rows; i += rpmStep) {
        labelDefs.push({ pos: new THREE.Vector3(offsetX - 2, 0, i * scaleZ + offsetZ), text: Math.round(rpmAxis[i]) + "", color: "#66ff88" });
      }
      const mapStep = Math.max(1, Math.floor(cols / 6));
      for (let j = 0; j < cols; j += mapStep) {
        labelDefs.push({ pos: new THREE.Vector3(j * scaleX + offsetX, 0, 17), text: loadAxis[j].toFixed(1), color: "#ffaa55" });
      }
      for (let k = 0; k <= 5; k++) {
        const ve = vMin + (vMax - vMin) * k / 5;
        labelDefs.push({ pos: new THREE.Vector3(offsetX - 2, (ve - vMin) * getScaleY(vMin, vMax), offsetZ - 1), text: ve.toFixed(0) + "%", color: "#aaaaff" });
      }
      labelDefs.push({ pos: new THREE.Vector3(offsetX - 5, 2, 0),  text: "RPM",     color: "#44ff88", bold: true });
      labelDefs.push({ pos: new THREE.Vector3(0, -1, 19),           text: "MAP psi", color: "#ff8844", bold: true });
      labelDefs.push({ pos: new THREE.Vector3(offsetX - 5, 10, offsetZ), text: VAL_LABEL, color: "#aaaaff", bold: true });

      labelEls = labelDefs.map(lp => {
        const el = document.createElement("div");
        el.textContent = lp.text;
        el.style.cssText = `position:absolute;color:${lp.color};font-size:${lp.bold ? "12px" : "10px"};font-weight:${lp.bold ? "bold" : "normal"};font-family:system-ui,monospace;white-space:nowrap;text-shadow:0 0 4px #000,0 0 2px #000;transform:translate(-50%,-50%);`;
        overlay.appendChild(el);
        return el;
      });
    }

    function updateLabelPositions() {
      const W2 = container.clientWidth;
      labelDefs.forEach((lp, idx) => {
        const v = lp.pos.clone().project(camera);
        labelEls[idx].style.display = v.z > 1 ? "none" : "block";
        labelEls[idx].style.left = ((v.x * 0.5 + 0.5) * W2) + "px";
        labelEls[idx].style.top  = ((-v.y * 0.5 + 0.5) * H) + "px";
      });
    }

    function rebuildSurface() {
      if (surfaceMesh)  { scene.remove(surfaceMesh);  surfaceMesh.geometry.dispose();  surfaceMesh.material.dispose(); }
      if (wireMesh)     { scene.remove(wireMesh);     wireMesh.geometry.dispose();     wireMesh.material.dispose(); }
      if (pointsMesh)   { scene.remove(pointsMesh);   pointsMesh.geometry.dispose();   pointsMesh.material.dispose(); }
      if (overlayMesh)  { scene.remove(overlayMesh);  overlayMesh.geometry.dispose();  overlayMesh.material.dispose(); overlayMesh = null; }

      vertexPositions.length = 0;

      // Диапазон высоты — общий для текущей и (если включено) исходной карты,
      // иначе при overlay поверхности были бы в разном масштабе и накладывались неверно
      let flatForRange = veData.flat();
      if (showOverlay) flatForRange = flatForRange.concat(originalData.flat());
      const vMin = Math.min(...flatForRange);
      const vMax = Math.max(...flatForRange);
      const sy = getScaleY(vMin, vMax);

      const positions = [];
      const colors    = [];
      const indices   = [];
      const ptPos     = [];
      const ptColors  = [];

      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
          const x = j * scaleX + offsetX;
          const y = (veData[i][j] - vMin) * sy;
          const z = i * scaleZ + offsetZ;

          positions.push(x, y, z);
          vertexPositions.push({ i, j, x, y, z });

          const c   = veColor(veData[i][j], vMin, vMax);
          const dim = (mask && !mask[i][j]) ? 0.65 : 1.0;
          colors.push(c.r * dim, c.g * dim, c.b * dim);

          if (selected.has(cellKey(i, j))) {
            ptPos.push(x, y + 0.12, z);
            ptColors.push(0.2, 0.9, 1.0);
          } else {
            ptPos.push(x, y + 0.05, z);
            ptColors.push(1, 1, 1);
          }
        }
      }

      for (let i = 0; i < rows - 1; i++) {
        for (let j = 0; j < cols - 1; j++) {
          const a = i * cols + j;
          const b = i * cols + j + 1;
          const c = (i + 1) * cols + j;
          const d = (i + 1) * cols + j + 1;
          indices.push(a, c, b, b, c, d);
        }
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute("color",    new THREE.Float32BufferAttribute(colors, 3));
      geo.setIndex(indices);
      geo.computeVertexNormals();

      surfaceMesh = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({
        vertexColors: true, side: THREE.DoubleSide, shininess: 40
      }));
      scene.add(surfaceMesh);

      wireMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        wireframe: true, color: 0x000000, opacity: 0.45, transparent: true
      }));
      scene.add(wireMesh);

      const ptGeo = new THREE.BufferGeometry();
      ptGeo.setAttribute("position", new THREE.Float32BufferAttribute(ptPos, 3));
      ptGeo.setAttribute("color",    new THREE.Float32BufferAttribute(ptColors, 3));
      pointsMesh = new THREE.Points(ptGeo, new THREE.PointsMaterial({
        size: 0.35, vertexColors: true, sizeAttenuation: true
      }));
      scene.add(pointsMesh);

      // --- Полупрозрачная поверхность исходной (немодифицированной) карты ---
      if (showOverlay) {
        const oPositions = [];
        const oIndices   = [];

        for (let i = 0; i < rows; i++) {
          for (let j = 0; j < cols; j++) {
            const x = j * scaleX + offsetX;
            const y = (originalData[i][j] - vMin) * sy;
            const z = i * scaleZ + offsetZ;
            oPositions.push(x, y, z);
          }
        }
        for (let i = 0; i < rows - 1; i++) {
          for (let j = 0; j < cols - 1; j++) {
            const a = i * cols + j;
            const b = i * cols + j + 1;
            const c = (i + 1) * cols + j;
            const d = (i + 1) * cols + j + 1;
            oIndices.push(a, c, b, b, c, d);
          }
        }

        const oGeo = new THREE.BufferGeometry();
        oGeo.setAttribute("position", new THREE.Float32BufferAttribute(oPositions, 3));
        oGeo.setIndex(oIndices);
        oGeo.computeVertexNormals();

        overlayMesh = new THREE.Mesh(oGeo, new THREE.MeshBasicMaterial({
          color: 0xffffff, wireframe: false, transparent: true, opacity: 0.25,
          side: THREE.DoubleSide, depthWrite: false
        }));
        scene.add(overlayMesh);
      }

      updateColorbarLabels(colorbar, vMin, vMax);
      rebuildLabels(vMin, vMax);
    }

    // Регистрируем rebuild в sceneAPI — теперь кнопки тулбара могут его вызывать
    sceneAPI.rebuild = rebuildSurface;
    sceneAPI.ready   = true;

    rebuildSurface();

    const grid = new THREE.GridHelper(30, 10, 0x333333, 0x222222);
    scene.add(grid);

    /* ---------------- Camera orbit ---------------- */

    let isDragging = false, isRight = false;
    let startX = 0, startY = 0, lastX = 0, lastY = 0;
    let theta = -0.7, phi = 1.0, radius = 48;
    let panX = 0, panY = 2;
    let didDrag = false;

    function updateCamera() {
      camera.position.set(
        radius * Math.sin(phi) * Math.sin(theta) + panX,
        radius * Math.cos(phi) + panY,
        radius * Math.sin(phi) * Math.cos(theta)
      );
      camera.lookAt(panX, panY, 0);
    }
    updateCamera();

    sceneAPI.resetView = () => {
      theta = -0.7; phi = 1.0; radius = 48; panX = 0; panY = 2;
      updateCamera();
    };

    renderer.domElement.addEventListener("contextmenu", e => e.preventDefault());

    // --- Shift+перетаскивание — прямоугольное выделение нескольких точек сразу ---
    let isBoxSelecting = false;
    let boxStartX = 0, boxStartY = 0;

    const selectionBox = document.createElement("div");
    selectionBox.style.cssText = "position:absolute;border:1px solid #2ecbff;background:rgba(46,203,255,0.15);display:none;pointer-events:none;z-index:15;";
    container.appendChild(selectionBox);

    renderer.domElement.addEventListener("mousedown", e => {
      if (e.shiftKey && e.button === 0) {
        isBoxSelecting = true;
        const rect = renderer.domElement.getBoundingClientRect();
        boxStartX = e.clientX - rect.left;
        boxStartY = e.clientY - rect.top;
        selectionBox.style.left   = boxStartX + "px";
        selectionBox.style.top    = (TOOLBAR_H + boxStartY) + "px";
        selectionBox.style.width  = "0px";
        selectionBox.style.height = "0px";
        selectionBox.style.display = "block";
        return;
      }
      isDragging = true;
      isRight    = e.button === 2;
      startX = lastX = e.clientX;
      startY = lastY = e.clientY;
      didDrag = false;
    });

    window.addEventListener("mousemove", e => {
      if (isBoxSelecting) {
        const rect = renderer.domElement.getBoundingClientRect();
        const curX = e.clientX - rect.left;
        const curY = e.clientY - rect.top;
        const left = Math.min(boxStartX, curX);
        const top  = Math.min(boxStartY, curY);
        selectionBox.style.left   = left + "px";
        selectionBox.style.top    = (TOOLBAR_H + top) + "px";
        selectionBox.style.width  = Math.abs(curX - boxStartX) + "px";
        selectionBox.style.height = Math.abs(curY - boxStartY) + "px";
        return;
      }
    });

    window.addEventListener("mouseup", e => {
      if (isBoxSelecting) {
        isBoxSelecting = false;
        selectionBox.style.display = "none";

        const rect = renderer.domElement.getBoundingClientRect();
        const curX = e.clientX - rect.left;
        const curY = e.clientY - rect.top;
        const boxLeft   = Math.min(boxStartX, curX);
        const boxRight  = Math.max(boxStartX, curX);
        const boxTop    = Math.min(boxStartY, curY);
        const boxBottom = Math.max(boxStartY, curY);

        // Слишком маленький бокс — это случайный клик, а не выделение
        if (boxRight - boxLeft < 4 && boxBottom - boxTop < 4) return;

        if (!e.ctrlKey) selected.clear();

        vertexPositions.forEach(vp => {
          const screenPos = new THREE.Vector3(vp.x, vp.y, vp.z).project(camera);
          const sx = (screenPos.x * 0.5 + 0.5) * rect.width;
          const sy = (-screenPos.y * 0.5 + 0.5) * rect.height;

          if (sx >= boxLeft && sx <= boxRight && sy >= boxTop && sy <= boxBottom && screenPos.z < 1) {
            selected.add(cellKey(vp.i, vp.j));
          }
        });

        rebuildSurface();
        updateSelectionUI();
        return;
      }
      isDragging = false;
    });

    window.addEventListener("mousemove", e => {
      if (!isDragging || isBoxSelecting) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      if (Math.abs(e.clientX - startX) > 3 || Math.abs(e.clientY - startY) > 3) didDrag = true;
      if (isRight) { panX -= dx * 0.05; panY += dy * 0.05; }
      else { theta -= dx * 0.01; phi = Math.max(0.1, Math.min(Math.PI - 0.1, phi - dy * 0.01)); }
      updateCamera();
    });
    renderer.domElement.addEventListener("wheel", e => {
      e.preventDefault();
      radius = Math.max(10, Math.min(150, radius + e.deltaY * 0.05));
      updateCamera();
    }, { passive: false });

    /* ---------------- Click selection ---------------- */

    const raycaster = new THREE.Raycaster();
    raycaster.params.Points.threshold = 0.5;
    const mouse = new THREE.Vector2();

    renderer.domElement.addEventListener("click", e => {
      if (didDrag || e.shiftKey) return;

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x =  ((e.clientX - rect.left)  / rect.width)  * 2 - 1;
      mouse.y = -((e.clientY - rect.top)   / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);

      const ptHits = raycaster.intersectObject(pointsMesh);
      let bestIdx = -1;

      if (ptHits.length > 0) {
        bestIdx = ptHits[0].index;
      } else {
        const hits = raycaster.intersectObject(surfaceMesh);
        if (hits.length === 0) {
          if (!e.ctrlKey) { selected.clear(); rebuildSurface(); updateSelectionUI(); }
          return;
        }
        const pt = hits[0].point;
        let bestDist = Infinity;
        vertexPositions.forEach((vp, idx) => {
          const d = Math.hypot(vp.x - pt.x, vp.z - pt.z);
          if (d < bestDist) { bestDist = d; bestIdx = idx; }
        });
      }

      if (bestIdx < 0) return;

      const { i, j } = vertexPositions[bestIdx];
      const key = cellKey(i, j);

      if (e.ctrlKey) {
        if (selected.has(key)) selected.delete(key);
        else selected.add(key);
      } else {
        selected.clear();
        selected.add(key);
      }

      rebuildSurface();
      updateSelectionUI();
    });

    window.addEventListener("resize", () => {
      const W2 = container.clientWidth;
      renderer.setSize(W2, H);
      camera.aspect = W2 / H;
      camera.updateProjectionMatrix();
    });

    function animate() {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
      updateLabelPositions();
    }
    animate();
  }
}

/* ---------------- Colorbar helpers ---------------- */

function createColorbarDOM(container) {
  const wrap = document.createElement("div");
  wrap.style.cssText = "position:absolute;right:15px;top:60px;z-index:10;";

  const bar = document.createElement("div");
  bar.style.cssText = "width:14px;height:180px;background:linear-gradient(to bottom,rgb(255,0,0),rgb(255,153,0),rgb(0,153,0),rgb(0,153,153),rgb(0,0,255));border-radius:3px;border:1px solid #333;";
  wrap.appendChild(bar);

  const lblTop = document.createElement("div");
  lblTop.style.cssText = "position:absolute;right:20px;top:-8px;color:#aaa;font-size:10px;font-family:monospace;white-space:nowrap;";
  wrap.appendChild(lblTop);

  const lblMid = document.createElement("div");
  lblMid.style.cssText = "position:absolute;right:20px;top:82px;color:#aaa;font-size:10px;font-family:monospace;white-space:nowrap;";
  wrap.appendChild(lblMid);

  const lblBot = document.createElement("div");
  lblBot.style.cssText = "position:absolute;right:20px;top:172px;color:#aaa;font-size:10px;font-family:monospace;white-space:nowrap;";
  wrap.appendChild(lblBot);

  container.appendChild(wrap);

  return { lblTop, lblMid, lblBot };
}

function updateColorbarLabels(colorbar, veMin, veMax) {
  colorbar.lblTop.textContent = veMax.toFixed(0) + "%";
  colorbar.lblMid.textContent = ((veMin + veMax) / 2).toFixed(0) + "%";
  colorbar.lblBot.textContent = veMin.toFixed(0) + "%";
}
