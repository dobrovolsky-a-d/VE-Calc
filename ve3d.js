/**
 * ve3d.js
 * Интерактивный 3D просмотр VE карты на Three.js
 * Крутится мышкой, цвет по значению VE (как в EcuFlash)
 */

export function show3D(container, veMatrix, rpmAxis, loadAxis, mask) {

  // Очищаем контейнер
  container.innerHTML = "";
  container.style.cssText = "width:100%;height:500px;position:relative;background:#1a1a2e;border-radius:10px;overflow:hidden;";

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
  addAxes(scene, THREE, rpmAxis, loadAxis, veMin, veMax, scaleX, scaleZ, scaleY, offsetX, offsetZ, rows, cols);

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
  }
  animate();
}

/* ============================================================
   ОСИ И ПОДПИСИ
   ============================================================ */

function addAxes(scene, THREE, rpmAxis, loadAxis, veMin, veMax, scaleX, scaleZ, scaleY, offsetX, offsetZ, rows, cols) {

  const matLine = new THREE.LineBasicMaterial({ color: 0x444466 });

  // Сетка дна
  const gridHelper = new THREE.GridHelper(30, 10, 0x333355, 0x222244);
  gridHelper.position.y = 0;
  scene.add(gridHelper);

  // Подписи на осях через спрайты
  const canvas = document.createElement("canvas");
  canvas.width  = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");

  function makeLabel(text, x, y, z) {
    ctx.clearRect(0, 0, 256, 64);
    ctx.fillStyle = "rgba(0,0,0,0)";
    ctx.fillRect(0, 0, 256, 64);
    ctx.font = "bold 28px system-ui";
    ctx.fillStyle = "#aaaacc";
    ctx.textAlign = "center";
    ctx.fillText(text, 128, 42);

    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(x, y, z);
    sprite.scale.set(6, 1.5, 1);
    scene.add(sprite);
  }

  // RPM подписи (ось Z)
  const rpmStep = Math.max(1, Math.floor(rows / 5));
  for (let i = 0; i < rows; i += rpmStep) {
    const z = i * scaleZ + offsetZ;
    makeLabel(Math.round(rpmAxis[i]).toString(), offsetX - 4, -0.5, z);
  }

  // MAP подписи (ось X)
  const mapStep = Math.max(1, Math.floor(cols / 5));
  for (let j = 0; j < cols; j += mapStep) {
    const x = j * scaleX + offsetX;
    makeLabel(loadAxis[j].toFixed(1), x, -0.5, 15 + 4);
  }

  // Название осей
  makeLabel("RPM →", offsetX - 6, 2, 0);
  makeLabel("MAP (psi) →", 0, -0.5, 20);
  makeLabel("VE %", offsetX - 6, (veMax - veMin) * scaleY / 2, offsetZ - 4);
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
