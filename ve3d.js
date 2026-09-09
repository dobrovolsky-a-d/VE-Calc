/**
 * ve3d.js
 * Интерактивный 3D просмотр и редактирование VE карты
 * - Крутится мышкой (ЛКМ), зум колёсиком, сдвиг ПКМ
 * - Клик по ячейке → редактирование значения
 * - Кнопка Copy выгружает отредактированную таблицу
 */

export function show3D(container, veMatrix, rpmAxis, loadAxis, mask, onTableUpdate) {

  container.innerHTML = "";
  container.style.cssText = "width:100%;position:relative;background:#1a1a2e;border-radius:10px;overflow:hidden;";

  // Рабочая копия таблицы — редактируем её
  let veData = veMatrix.map(r => [...r]);

  // Кнопки вверху
  const toolbar = document.createElement("div");
  toolbar.style.cssText = "position:absolute;top:10px;left:10px;z-index:10;display:flex;gap:8px;";

  const copyBtn = document.createElement("button");
  copyBtn.textContent = "📋 Copy table";
  copyBtn.style.cssText = "background:rgba(40,200,80,0.8);color:white;border:none;border-radius:6px;padding:5px 12px;cursor:pointer;font-size:12px;";
  copyBtn.onclick = () => {
    const text = veData.map(row => row.map(v => v.toFixed(2)).join("\t")).join("\n");
    navigator.clipboard.writeText(text).then(() => {
      copyBtn.textContent = "✓ Copied!";
      setTimeout(() => copyBtn.textContent = "📋 Copy table", 1500);
    });
  };

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "✕ Закрыть";
  closeBtn.style.cssText = "background:rgba(255,255,255,0.15);color:white;border:1px solid rgba(255,255,255,0.3);border-radius:6px;padding:5px 12px;cursor:pointer;font-size:12px;";
  closeBtn.onclick = () => { container.style.display = "none"; };

  toolbar.appendChild(copyBtn);
  toolbar.appendChild(closeBtn);
  container.appendChild(toolbar);

  // Подсказка
  const hint = document.createElement("div");
  hint.style.cssText = "position:absolute;bottom:10px;left:10px;color:#888;font-size:11px;font-family:system-ui;z-index:10;";
  hint.textContent = "ЛКМ — вращать  |  Колёсико — зум  |  ПКМ — сдвиг  |  Клик по ячейке — редактировать";
  container.appendChild(hint);

  // Canvas
  const canvasEl = document.createElement("canvas");
  container.appendChild(canvasEl);

  // Inline редактор
  const editor = document.createElement("input");
  editor.type = "number";
  editor.step = "0.1";
  editor.style.cssText = "position:absolute;display:none;width:60px;padding:3px;border:2px solid #4af;border-radius:4px;background:#1a1a2e;color:#4af;font-size:13px;font-weight:bold;text-align:center;z-index:20;";
  container.appendChild(editor);

  // Загружаем Three.js
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

    const rows = veData.length;
    const cols = veData[0].length;

    // Высота контейнера
    container.style.height = "520px";
    const W = container.clientWidth;
    const H = 520;
    canvasEl.width  = W;
    canvasEl.height = H;

    // --- Renderer ---
    const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(window.devicePixelRatio);

    // --- Scene ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);

    // --- Camera ---
    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 1000);
    camera.position.set(30, 25, 40);
    camera.lookAt(0, 0, 0);

    // --- Lights ---
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(20, 40, 20);
    scene.add(dir);

    // --- Масштаб ---
    const flat   = veData.flat();
    let veMin    = Math.min(...flat);
    let veMax    = Math.max(...flat);

    const scaleX = 30 / (cols - 1);
    const scaleZ = 30 / (rows - 1);
    const offsetX = -15;
    const offsetZ = -15;

    function scaleY() { return 15 / ((veMax - veMin) || 1); }

    // --- Сетка ---
    const gridHelper = new THREE.GridHelper(30, 10, 0x333355, 0x222244);
    scene.add(gridHelper);

    // --- Поверхность ---
    let surfaceMesh = null;
    let wireMesh    = null;

    // Храним позиции ячеек в 3D для raycasting подсветки
    const cellCenters = []; // {i, j, x, y, z}

    function buildSurface() {
      const flat2  = veData.flat();
      veMin = Math.min(...flat2);
      veMax = Math.max(...flat2);
      const sy = scaleY();

      if (surfaceMesh) { scene.remove(surfaceMesh); scene.remove(wireMesh); }
      cellCenters.length = 0;

      const geo      = new THREE.BufferGeometry();
      const positions = [];
      const colors    = [];
      const indices   = [];

      function veColor(ve) {
        const t = (ve - veMin) / ((veMax - veMin) || 1);
        const c = new THREE.Color();
        if      (t < 0.25) c.setRGB(0, t * 4, 1);
        else if (t < 0.5)  c.setRGB(0, 1, 1 - (t - 0.25) * 4);
        else if (t < 0.75) c.setRGB((t - 0.5) * 4, 1, 0);
        else               c.setRGB(1, 1 - (t - 0.75) * 4, 0);
        return c;
      }

      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
          const x = j * scaleX + offsetX;
          const y = (veData[i][j] - veMin) * sy;
          const z = i * scaleZ + offsetZ;
          positions.push(x, y, z);

          const c   = veColor(veData[i][j]);
          const dim = (mask && !mask[i][j]) ? 0.6 : 1.0;
          colors.push(c.r * dim, c.g * dim, c.b * dim);

          cellCenters.push({ i, j, x, y, z });
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

      geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute("color",    new THREE.Float32BufferAttribute(colors, 3));
      geo.setIndex(indices);
      geo.computeVertexNormals();

      surfaceMesh = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({
        vertexColors: true, side: THREE.DoubleSide, shininess: 60
      }));
      scene.add(surfaceMesh);

      wireMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        wireframe: true, color: 0x000000, opacity: 0.08, transparent: true
      }));
      scene.add(wireMesh);
    }

    buildSurface();

    // --- Подсветка выбранной ячейки ---
    const hlGeo = new THREE.SphereGeometry(0.25, 8, 8);
    const hlMat = new THREE.MeshBasicMaterial({ color: 0x00ccff });
    const hlSphere = new THREE.Mesh(hlGeo, hlMat);
    hlSphere.visible = false;
    scene.add(hlSphere);

    // --- HTML подписи осей ---
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:hidden;";
    container.appendChild(overlay);

    const labelDefs = [];

    // RPM
    const rpmStep = Math.max(1, Math.floor(rows / 6));
    for (let i = 0; i < rows; i += rpmStep) {
      labelDefs.push({ pos: new THREE.Vector3(offsetX - 1.5, 0, i * scaleZ + offsetZ), text: Math.round(rpmAxis[i]) + "", color: "#66ff88" });
    }
    // MAP
    const mapStep = Math.max(1, Math.floor(cols / 6));
    for (let j = 0; j < cols; j += mapStep) {
      labelDefs.push({ pos: new THREE.Vector3(j * scaleX + offsetX, 0, 16.5), text: loadAxis[j].toFixed(1), color: "#ffaa55" });
    }
    // VE
    for (let k = 0; k <= 5; k++) {
      const ve = veMin + (veMax - veMin) * k / 5;
      labelDefs.push({ pos: new THREE.Vector3(offsetX - 1.5, (ve - veMin) * scaleY(), offsetZ - 1), text: ve.toFixed(0) + "%", color: "#aaaaff" });
    }
    // Названия
    labelDefs.push({ pos: new THREE.Vector3(offsetX - 4, 2, 0),  text: "RPM", color: "#44ff88", bold: true });
    labelDefs.push({ pos: new THREE.Vector3(0, -1, 18),           text: "MAP psi", color: "#ff8844", bold: true });
    labelDefs.push({ pos: new THREE.Vector3(offsetX - 4, 8, offsetZ), text: "VE %", color: "#8888ff", bold: true });

    const labelEls = labelDefs.map(lp => {
      const el = document.createElement("div");
      el.textContent = lp.text;
      el.style.cssText = `position:absolute;color:${lp.color};font-size:${lp.bold ? "12px" : "10px"};font-weight:${lp.bold ? "bold" : "normal"};font-family:system-ui,monospace;white-space:nowrap;text-shadow:0 0 4px #000,0 0 2px #000;transform:translate(-50%,-50%);`;
      overlay.appendChild(el);
      return el;
    });

    function updateLabels() {
      const W2 = container.clientWidth;
      const H2 = container.clientHeight;
      labelDefs.forEach((lp, idx) => {
        const v = lp.pos.clone().project(camera);
        labelEls[idx].style.display = v.z > 1 ? "none" : "block";
        labelEls[idx].style.left = ((v.x * 0.5 + 0.5) * W2) + "px";
        labelEls[idx].style.top  = ((-v.y * 0.5 + 0.5) * H2) + "px";
      });
    }

    // --- Colorbar ---
    addColorbar(container, veMin, veMax);

    // --- Orbit controls ---
    let isDragging = false, isRight = false;
    let lastX = 0, lastY = 0;
    let theta = 0.6, phi = 0.8, radius = 55;
    let panX = 0, panY = 0;

    function updateCamera() {
      camera.position.set(
        radius * Math.sin(phi) * Math.sin(theta) + panX,
        radius * Math.cos(phi) + panY,
        radius * Math.sin(phi) * Math.cos(theta)
      );
      camera.lookAt(panX, panY, 0);
    }
    updateCamera();

    canvasEl.addEventListener("contextmenu", e => e.preventDefault());

    canvasEl.addEventListener("mousedown", e => {
      isDragging = true;
      isRight    = e.button === 2;
      lastX = e.clientX; lastY = e.clientY;
    });

    window.addEventListener("mouseup", () => { isDragging = false; });

    window.addEventListener("mousemove", e => {
      if (!isDragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      if (isRight) { panX -= dx * 0.05; panY += dy * 0.05; }
      else { theta -= dx * 0.01; phi = Math.max(0.1, Math.min(Math.PI - 0.1, phi - dy * 0.01)); }
      updateCamera();
    });

    canvasEl.addEventListener("wheel", e => {
      radius = Math.max(10, Math.min(150, radius + e.deltaY * 0.05));
      updateCamera();
    });

    // --- Raycaster для клика по ячейке ---
    const raycaster = new THREE.Raycaster();
    const mouse     = new THREE.Vector2();

    canvasEl.addEventListener("click", e => {
      if (Math.abs(e.clientX - lastX) > 3) return; // игнорируем drag-клики

      const rect = canvasEl.getBoundingClientRect();
      mouse.x =  ((e.clientX - rect.left)  / rect.width)  * 2 - 1;
      mouse.y = -((e.clientY - rect.top)   / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObject(surfaceMesh);

      if (hits.length === 0) { editor.style.display = "none"; return; }

      // Находим ближайшую вершину к точке пересечения
      const pt = hits[0].point;
      let bestDist = Infinity, bestCell = null;
      cellCenters.forEach(cc => {
        const d = Math.hypot(cc.x - pt.x, cc.z - pt.z);
        if (d < bestDist) { bestDist = d; bestCell = cc; }
      });

      if (!bestCell) return;

      const { i, j } = bestCell;

      // Подсвечиваем
      hlSphere.position.set(bestCell.x, bestCell.y + 0.3, bestCell.z);
      hlSphere.visible = true;

      // Показываем редактор
      const screenPos = new THREE.Vector3(bestCell.x, bestCell.y, bestCell.z).project(camera);
      const sx = (screenPos.x * 0.5 + 0.5) * container.clientWidth;
      const sy = (-screenPos.y * 0.5 + 0.5) * container.clientHeight;

      editor.value = veData[i][j].toFixed(1);
      editor.style.left    = (sx - 30) + "px";
      editor.style.top     = (sy - 12) + "px";
      editor.style.display = "block";
      editor.focus();
      editor.select();

      editor.onkeydown = (ev) => {
        if (ev.key === "Enter" || ev.key === "Tab") {
          const newVal = parseFloat(editor.value);
          if (!isNaN(newVal) && newVal >= 40 && newVal <= 130) {
            veData[i][j] = newVal;
            buildSurface();
            if (onTableUpdate) onTableUpdate(veData);
          }
          editor.style.display = "none";
          hlSphere.visible = false;
        }
        if (ev.key === "Escape") {
          editor.style.display = "none";
          hlSphere.visible = false;
        }
      };

      editor.onblur = () => {
        setTimeout(() => { editor.style.display = "none"; hlSphere.visible = false; }, 150);
      };
    });

    // --- Resize ---
    window.addEventListener("resize", () => {
      const W2 = container.clientWidth;
      renderer.setSize(W2, H);
      camera.aspect = W2 / H;
      camera.updateProjectionMatrix();
    });

    // --- Render loop ---
    function animate() {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
      updateLabels();
    }
    animate();
  }
}

function addColorbar(container, veMin, veMax) {
  // Удаляем старый если есть
  const old = container.querySelector(".colorbar-wrap");
  if (old) old.remove();

  const wrap = document.createElement("div");
  wrap.className = "colorbar-wrap";
  wrap.style.cssText = "position:absolute;right:15px;top:50px;z-index:10;";

  const bar = document.createElement("div");
  bar.style.cssText = "width:16px;height:180px;background:linear-gradient(to bottom,rgb(255,0,0),rgb(255,255,0),rgb(0,255,0),rgb(0,255,255),rgb(0,0,255));border-radius:4px;border:1px solid #444;";
  wrap.appendChild(bar);

  [[veMax, "top:-8px"], [((veMin+veMax)/2), "top:82px"], [veMin, "top:172px"]].forEach(([v, pos]) => {
    const lbl = document.createElement("div");
    lbl.style.cssText = `position:absolute;right:22px;${pos};color:#ccc;font-size:10px;font-family:system-ui;white-space:nowrap;`;
    lbl.textContent = v.toFixed(0) + "%";
    wrap.appendChild(lbl);
  });

  container.appendChild(wrap);
}
