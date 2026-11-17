import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';
import { OBJExporter } from '../vendor/OBJExporter.js';
import { GLTFExporter } from '../vendor/GLTFExporter.js';
import { STLExporter } from '../vendor/STLExporter.js';
import { buildTumba, applyExplode, FINISHES } from './model.js';

const canvas = document.getElementById('scene-canvas');
const stage = document.getElementById('stage');

/* ---------- рендерер / сцена / камера ---------- */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.04;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(36, 1, 10, 30000);
camera.position.set(1660, 1380, 2050);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 252, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.autoRotate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
controls.autoRotateSpeed = 0.85;
controls.minDistance = 1050;
controls.maxDistance = 5200;
controls.maxPolarAngle = Math.PI * 0.52;
controls.enablePan = false;

/* ---------- окружение (studio IBL) ---------- */
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

/* ---------- свет ---------- */
scene.add(new THREE.HemisphereLight(0xffffff, 0xa8a59e, 0.5));

const key = new THREE.DirectionalLight(0xfff1e4, 2.1);
key.position.set(1500, 2300, 1400);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -1000;
key.shadow.camera.right = 1000;
key.shadow.camera.top = 1200;
key.shadow.camera.bottom = -800;
key.shadow.camera.near = 400;
key.shadow.camera.far = 6000;
key.shadow.bias = -0.00035;
key.shadow.radius = 7;
scene.add(key);

const fill = new THREE.DirectionalLight(0xdde7f5, 0.8);
fill.position.set(-1800, 1000, -700);
scene.add(fill);

const rim = new THREE.DirectionalLight(0xffffff, 1.15);
rim.position.set(-500, 1700, -2100);
scene.add(rim);

/* ---------- пол: тень + мягкая контактная подложка ---------- */
const floor = new THREE.Mesh(
  new THREE.CircleGeometry(7000, 64),
  new THREE.ShadowMaterial({ opacity: 0.22 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = 0;
floor.receiveShadow = true;
scene.add(floor);

function makeContactShadow() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 8, 128, 128, 128);
  g.addColorStop(0, 'rgba(20,24,30,0.42)');
  g.addColorStop(0.55, 'rgba(20,24,30,0.16)');
  g.addColorStop(1, 'rgba(20,24,30,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(1500, 1500),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.6;
  return m;
}
scene.add(makeContactShadow());

/* ---------- модель ---------- */
let currentFinish = FINISHES[0];
let model = buildTumba(currentFinish.id);
scene.add(model.root);

/* ---------- разобранный вид ---------- */
let explodeTarget = 0;
let explodeCurrent = 0;
const explodeInput = document.getElementById('explode');
const explodeValue = document.getElementById('explode-value');
if (explodeInput) {
  const syncFill = () => explodeInput.style.setProperty('--fill', `${explodeInput.value}%`);
  explodeInput.addEventListener('input', () => {
    explodeTarget = Number(explodeInput.value) / 100;
    if (explodeValue) explodeValue.textContent = `${explodeInput.value}%`;
    syncFill();
  });
  syncFill();
}

/* ---------- авто-вращение ---------- */
const rotateToggle = document.getElementById('toggle-rotate');
function syncRotateUI() {
  rotateToggle.setAttribute('aria-pressed', String(controls.autoRotate));
  rotateToggle.classList.toggle('is-on', controls.autoRotate);
}
if (rotateToggle) {
  rotateToggle.addEventListener('click', () => {
    controls.autoRotate = !controls.autoRotate;
    syncRotateUI();
  });
  syncRotateUI();
}

/* ---------- отделка ---------- */
const finishName = document.getElementById('finish-name');
const swatches = document.querySelectorAll('.swatch');
swatches.forEach((btn) => {
  btn.addEventListener('click', () => {
    const finish = FINISHES.find((f) => f.id === btn.dataset.finish);
    if (!finish) return;
    currentFinish = finish;
    model.lacquer.color.set(finish.color);
    model.lacquer.roughness = finish.roughness;
    swatches.forEach((b) => {
      b.classList.toggle('is-active', b === btn);
      b.setAttribute('aria-checked', String(b === btn));
    });
    if (finishName) finishName.textContent = finish.label;
  });
});

/* ---------- скачивание ---------- */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function flashButton(btn, text = 'Сохранено ✓') {
  if (!btn) return;
  const original = btn.dataset.label ?? btn.textContent;
  btn.dataset.label = original;
  btn.textContent = text;
  btn.classList.add('is-done');
  setTimeout(() => {
    btn.textContent = original;
    btn.classList.remove('is-done');
  }, 1700);
}

const freshModel = () => buildTumba(currentFinish.id).root; // чистая модель в нулевых позициях

const LINE = (hex) => {
  const c = new THREE.Color(hex);
  return `${c.r.toFixed(4)} ${c.g.toFixed(4)} ${c.b.toFixed(4)}`;
};

function makeMTL() {
  return [
    '# TUMBA·01 — матовая эмаль',
    'newmtl tumba_lacquer',
    `Ka ${LINE(currentFinish.color)}`,
    `Kd ${LINE(currentFinish.color)}`,
    'Ks 0.2200 0.2200 0.2200',
    'Ns 42',
    'illum 2',
    '',
  ].join('\n');
}

function wireDownload(id, handler) {
  const btn = document.getElementById(id);
  if (btn) btn.addEventListener('click', async () => {
    try { await handler(btn); flashButton(btn); }
    catch (err) { console.error(err); flashButton(btn, 'Ошибка :('); }
  });
}

wireDownload('btn-obj', (btn) => {
  const obj = new OBJExporter().parse(freshModel());
  downloadBlob(new Blob(['mtllib tumba.mtl\n' + obj], { type: 'text/plain;charset=utf-8' }), 'tumba-01.obj');
  downloadBlob(new Blob([makeMTL()], { type: 'text/plain;charset=utf-8' }), 'tumba.mtl');
});

wireDownload('btn-glb', () => new Promise((resolve, reject) => {
  new GLTFExporter().parse(
    freshModel(),
    (buffer) => { downloadBlob(new Blob([buffer], { type: 'model/gltf-binary' }), 'tumba-01.glb'); resolve(); },
    reject,
    { binary: true }
  );
}));

wireDownload('btn-stl', () => {
  const data = new STLExporter().parse(freshModel(), { binary: true });
  downloadBlob(new Blob([data.buffer ?? data], { type: 'model/stl' }), 'tumba-01.stl');
});

wireDownload('btn-png', () => {
  const prevBg = scene.background;
  scene.background = new THREE.Color('#e9ebee');
  renderer.render(scene, camera);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      scene.background = prevBg;
      renderer.render(scene, camera);
      if (blob) downloadBlob(blob, 'tumba-01.png');
      resolve();
    }, 'image/png');
  });
});

/* ---------- resize ---------- */
function resize() {
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);
window.addEventListener('orientationchange', resize);
resize();

/* ---------- цикл ---------- */
const clock = new THREE.Clock();
function tick() {
  requestAnimationFrame(tick);
  clock.getDelta();
  if (Math.abs(explodeTarget - explodeCurrent) > 0.0005) {
    explodeCurrent += (explodeTarget - explodeCurrent) * 0.14;
    applyExplode(model.explodeParts, explodeCurrent);
  }
  controls.update();
  renderer.render(scene, camera);
}
tick();
