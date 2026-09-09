/**
 * ve3d.js
 * Интерактивный 3D просмотр VE карты на Three.js
 * Крутится мышкой, цвет по значению VE (как в EcuFlash)
 */

export function show3D(container, veMatrix, rpmAxis, loadAxis, mask) {

  // Очищаем контейнер
  container.innerHTML = "";
  container.style.cssText = "width:100%;height:500px;position:relative;background:#1a1a2e;border-radius:10px;overflow:hidden;";

  // Кнопка закрыть
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "✕ Закрыть";
  closeBtn.style.cssText = "position:absolute;top:10px;right:15px;z-index:10;background:rgba(255,255,255,0.15);color:white;border:1px solid rgba(255,255,255,0.3);border-radius:6px;padding:4px 12px;cursor:pointer;font-size:13px;";
  closeBtn.onclick = () => { container.style.display = "none"; };
  container.appendChild(closeBtn);

  // --- Three.js через CDN ---
  const script = document.createElement("script");
  script.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
  script.onload = () => init3D(container, veMatrix, rpmAxis, loadAxis, mask);
  document.head.appendChild(script);
}

function init3D(container, veMatrix, rpmAxis, loadAxis, mask) {

  const THREE = window.THREE;

  const W = container.clientWidth;
  const H = container.clientHeight;

  const rows = veMatrix.length;
  const cols = veMatrix[0].length;

  // --- Renderer ---
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(W, H);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  // --- Scene ---
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);
  scene.fog = new THREE.Fog(0x1a1a2e, 80, 200);

  // --- Camera ---
  const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 1000);
  camera.position.set(30, 25, 40);
  camera.lookAt(0, 0, 0);

  // --- Lights ---
  const ambient = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambient);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(20, 40, 20);
  dirLight.castShadow = true;
  scene.add(dirLight);

  const pointLight = new THREE.PointLight(0x4488ff, 0.5, 100);
  pointLight.position.set(-20, 30, -20);
  scene.add(pointLight);

  // --- VE min/max для нормализации ---
  const flat = veMatrix.flat();
  const veMin = Math.min(...flat);
  const veMax = Math.max(...flat);

  // --- Размеры сцены ---
  const scaleX = 30 / (cols - 1);   // MAP ось
  const scaleZ = 30 / (rows - 1);   // RPM ось
  const scaleY = 15 / (veMax - veMin || 1); // VE высота

  const offsetX = -15;
  const offsetZ = -15;

  // --- Геометрия поверхности ---
  const geometry = new THREE.BufferGeometry();

  const positions = [];
  const colors    = [];
  const indices   = [];

  // Цветовая шкала как в EcuFlash: синий → зелёный → жёлтый → красный
  function veColor(ve) {
    const t = (ve - veMin) / (veMax - veMin || 1);
    const c = new THREE.Color();

    if (t < 0.25) {
      c.setRGB(0, t * 4, 1);                          // синий → голубой
    } else if (t < 0.5) {
      c.setRGB(0, 1, 1 - (t - 0.25) * 4);            // голубой → зелёный
    } else if (t < 0.75) {
      c.setRGB((t - 0.5) * 4, 1, 0);                 // зелёный → жёлтый
    } else {
      c.setRGB(1, 1 - (t - 0.75) * 4, 0);            // жёлтый → красный
    }

    return c;
  }

  // Вершины
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const x = j * scaleX + offsetX;
      const y = (veMatrix[i][j] - veMin) * scaleY;
      const z = i * scaleZ + offsetZ;

      positions.push(x, y, z);

      const c = veColor(veMatrix[i][j]);

      // Ячейки без данных (достроены моделью) — чуть темнее
      const dimFactor = (mask && !mask[i][j]) ? 0.6 : 1.0;
      colors.push(c.r * dimFactor, c.g * dimFactor, c.b * dimFactor);
    }
  }

  // Индексы треугольников
  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < cols - 1; j++) {
      const a = i * cols + j;
      const b = i * cols + j + 1;
      const c = (i + 1) * cols + j;
      const d = (i + 1) * cols + j + 1;

      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color",    new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshPhongMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    shininess: 60,
    specular: new THREE.Color(0x333333)
  });

  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  // --- Wireframe поверх ---
  const wireMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    wireframe: true,
    opacity: 0.08,
    transparent: true
  });
  const wire = new THREE.Mesh(geometry, wireMat);
  scene.add(wire);

  // --- Оси ---
  addAxes(scene, THREE, rpmAxis, loadAxis, veMin, veMax, scaleX, scaleZ, scaleY, offsetX, offsetZ, rows, cols, renderer, camera, container);

  // --- Colorbar ---
  addColorbar(container, veMin, veMax);

  // --- Подсказка ---
  const hint = document.createElement("div");
  hint.style.cssText = "position:absolute;top:10px;left:10px;color:#aaa;font-size:12px;font-family:system-ui;";
  hint.textContent = "🖱 ЛКМ — вращать  |  Колёсико — зум  |  ПКМ — сдвиг";
  container.appendChild(hint);

  // --- Mouse orbit ---
  let isDragging  = false;
  let isRightDrag = false;
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

  renderer.domElement.addEventListener("mousedown", e => {
    isDragging  = true;
    isRightDrag = e.button === 2;
    lastX = e.clientX;
    lastY = e.clientY;
  });

  renderer.domElement.addEventListener("contextmenu", e => e.preventDefault());

  window.addEventListener("mouseup",   () => { isDragging = false; });

  window.addEventListener("mousemove", e => {
    if (!isDragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;

    if (isRightDrag) {
      panX -= dx * 0.05;
      panY += dy * 0.05;
    } else {
      theta -= dx * 0.01;
      phi    = Math.max(0.1, Math.min(Math.PI - 0.1, phi - dy * 0.01));
    }

    updateCamera();
  });

  renderer.domElement.addEventListener("wheel", e => {
    radius = Math.max(10, Math.min(150, radius + e.deltaY * 0.05));
    updateCamera();
  });

  // --- Resize ---
  window.addEventListener("resize", () => {
    const W2 = container.clientWidth;
    const H2 = container.clientHeight;
    renderer.setSize(W2, H2);
    camera.aspect = W2 / H2;
    camera.updateProjectionMatrix();
  });

  // --- Render loop ---
  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
    if (renderer._updateLabels) renderer._updateLabels();
  }
  animate();
}

/* ============================================================
   ОСИ И ПОДПИСИ
   ============================================================ */

function addAxes(scene, THREE, rpmAxis, loadAxis, veMin, veMax, scaleX, scaleZ, scaleY, offsetX, offsetZ, rows, cols, renderer, camera, container) {

  // Сетка дна
  const gridHelper = new THREE.GridHelper(30, 10, 0x333355, 0x222244);
  gridHelper.position.y = 0;
  scene.add(gridHelper);

  // Линии осей
  function makeLine(points, color) {
    const geo = new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(...p)));
    const mat = new THREE.LineBasicMaterial({ color });
    scene.add(new THREE.Line(geo, mat));
  }

  const maxY = (veMax - veMin) * scaleY;
  makeLine([[offsetX, 0, offsetZ], [offsetX, maxY, offsetZ]], 0x8888ff); // VE ось
  makeLine([[offsetX, 0, offsetZ], [15, 0, offsetZ]], 0xff8844);          // MAP ось
  makeLine([[offsetX, 0, offsetZ], [offsetX, 0, 15]], 0x44ff88);          // RPM ось

  // --- HTML overlay для подписей ---
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:hidden;";
  container.appendChild(overlay);

  // Точки 3D которые надо подписать
  const labelPoints = [];

  // RPM подписи
  const rpmStep = Math.max(1, Math.floor(rows / 6));
  for (let i = 0; i < rows; i += rpmStep) {
    const z = i * scaleZ + offsetZ;
    labelPoints.push({ pos: new THREE.Vector3(offsetX - 1, 0, z), text: Math.round(rpmAxis[i]) + "", color: "#88ff99" });
  }

  // MAP подписи
  const mapStep = Math.max(1, Math.floor(cols / 6));
  for (let j = 0; j < cols; j += mapStep) {
    const x = j * scaleX + offsetX;
    labelPoints.push({ pos: new THREE.Vector3(x, 0, 16), text: loadAxis[j].toFixed(1), color: "#ffaa66" });
  }

  // VE подписи по высоте
  const veSteps = 5;
  for (let k = 0; k <= veSteps; k++) {
    const ve = veMin + (veMax - veMin) * k / veSteps;
    const y  = (ve - veMin) * scaleY;
    labelPoints.push({ pos: new THREE.Vector3(offsetX - 1, y, offsetZ - 1), text: ve.toFixed(0) + "%", color: "#aaaaff" });
  }

  // Названия осей
  labelPoints.push({ pos: new THREE.Vector3(offsetX - 3, 1, 0),   text: "RPM", color: "#44ff88", bold: true });
  labelPoints.push({ pos: new THREE.Vector3(0, 0, 18),             text: "MAP psi", color: "#ff8844", bold: true });
  labelPoints.push({ pos: new THREE.Vector3(offsetX - 3, maxY + 1, offsetZ), text: "VE %", color: "#8888ff", bold: true });

  // Обновляем позиции подписей при каждом кадре
  const labelEls = labelPoints.map(lp => {
    const el = document.createElement("div");
    el.textContent = lp.text;
    el.style.cssText = `
      position:absolute;
      color:${lp.color};
      font-size:${lp.bold ? "12px" : "10px"};
      font-weight:${lp.bold ? "bold" : "normal"};
      font-family:system-ui,monospace;
      white-space:nowrap;
      text-shadow:0 0 4px #000, 0 0 2px #000;
      transform:translate(-50%,-50%);
    `;
    overlay.appendChild(el);
    return el;
  });

  // Экспортируем функцию обновления — вызывается из render loop
  renderer._updateLabels = () => {
    const W = container.clientWidth;
    const H = container.clientHeight;

    labelPoints.forEach((lp, idx) => {
      const v = lp.pos.clone().project(camera);
      const x = (v.x * 0.5 + 0.5) * W;
      const y = (-v.y * 0.5 + 0.5) * H;

      // Прячем если за камерой
      labelEls[idx].style.display = (v.z > 1) ? "none" : "block";
      labelEls[idx].style.left = x + "px";
      labelEls[idx].style.top  = y + "px";
    });
  };
}

/* ============================================================
   COLORBAR
   ============================================================ */

function addColorbar(container, veMin, veMax) {

  const bar = document.createElement("div");
  bar.style.cssText = `
    position:absolute; right:15px; top:40px;
    width:20px; height:200px;
    background: linear-gradient(to bottom,
      rgb(255,0,0),
      rgb(255,255,0),
      rgb(0,255,0),
      rgb(0,255,255),
      rgb(0,0,255)
    );
    border-radius:4px;
    border:1px solid #444;
  `;
  container.appendChild(bar);

  const labelTop = document.createElement("div");
  labelTop.style.cssText = "position:absolute;right:40px;top:35px;color:#ccc;font-size:11px;font-family:system-ui;";
  labelTop.textContent = veMax.toFixed(1) + "%";
  container.appendChild(labelTop);

  const labelBot = document.createElement("div");
  labelBot.style.cssText = "position:absolute;right:40px;top:238px;color:#ccc;font-size:11px;font-family:system-ui;";
  labelBot.textContent = veMin.toFixed(1) + "%";
  container.appendChild(labelBot);

  const labelMid = document.createElement("div");
  labelMid.style.cssText = "position:absolute;right:40px;top:135px;color:#ccc;font-size:11px;font-family:system-ui;";
  labelMid.textContent = ((veMin + veMax) / 2).toFixed(1) + "%";
  container.appendChild(labelMid);
}
