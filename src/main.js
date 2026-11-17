import {
  Scene,
  Color,
  Fog,
  PerspectiveCamera,
  WebGLRenderer,
  PCFSoftShadowMap,
  ACESFilmicToneMapping,
  sRGBEncoding,
  HemisphereLight,
  DirectionalLight,
  CircleGeometry,
  PlaneGeometry,
  Mesh,
  MeshStandardMaterial,
  MeshBasicMaterial,
  CanvasTexture,
  PMREMGenerator,
  Raycaster,
  Vector2,
  Vector3,
  MathUtils,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { buildMaterials, buildNightstand, DRAWER_TRAVEL } from './nightstand.js';
import { buildSketchupScript } from './sketchup.js';
import { exportDae, downloadFile, FILE_BASENAME } from './exporters.js';

const canvas = document.getElementById('scene');
const loading = document.getElementById('loading');
const toggleButton = document.getElementById('drawer-toggle');
const toggleIcon = toggleButton.querySelector('[data-icon]');
const toggleLabel = toggleButton.querySelector('[data-label]');
const resetButton = document.getElementById('reset-view');
const exportRb = document.getElementById('export-rb');
const exportDaeButton = document.getElementById('export-dae');
const exportStatus = document.getElementById('export-status');

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const VIEW_TARGET = new Vector3(0, 252, 0);
const VIEW_DIRECTION = new Vector3(0.58, 0.45, 0.72).normalize();
const HOME = { position: new Vector3(), target: VIEW_TARGET.clone() };

let renderer;
try {
  renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
} catch (error) {
  loading.innerHTML = '<p>Не удалось запустить WebGL.<br>Попробуйте другой браузер.</p>';
  throw error;
}

renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputEncoding = sRGBEncoding;
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFSoftShadowMap;

const scene = new Scene();
scene.background = new Color('#efe7da');
scene.fog = new Fog('#efe7da', 2400, 6600);

const camera = new PerspectiveCamera(34, window.innerWidth / window.innerHeight, 10, 12000);

/** Дистанция камеры, при которой модель целиком влезает в кадр при любом aspect. */
function homeDistance() {
  const vHalf = MathUtils.degToRad(camera.fov) / 2;
  const dVertical = 660 / (2 * Math.tan(vHalf));
  const dHorizontal = 800 / (2 * Math.tan(vHalf) * Math.max(camera.aspect, 0.3));
  return MathUtils.clamp(Math.max(1560, dVertical, dHorizontal), 1300, 3200);
}

function updateHome() {
  HOME.position.copy(VIEW_TARGET).addScaledVector(VIEW_DIRECTION, homeDistance());
}

updateHome();
camera.position.copy(HOME.position);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(HOME.target);
controls.enableDamping = true;
controls.dampingFactor = 0.075;
controls.enablePan = false;
controls.minDistance = 760;
controls.maxDistance = 3600;
controls.minPolarAngle = 0.22;
controls.maxPolarAngle = MathUtils.degToRad(87);
controls.rotateSpeed = 0.75;
controls.zoomSpeed = 0.85;
controls.autoRotate = !reduceMotion;
controls.autoRotateSpeed = 0.4;
controls.update();

// --- окружение и свет -------------------------------------------------------

const pmrem = new PMREMGenerator(renderer);
const roomEnvironment = new RoomEnvironment();
scene.environment = pmrem.fromScene(roomEnvironment, 0.04).texture;
roomEnvironment.dispose?.();
pmrem.dispose();

const hemi = new HemisphereLight(0xfff7ec, 0xcbb393, 0.7);
scene.add(hemi);

const key = new DirectionalLight(0xfff1dc, 2.2);
key.position.set(1150, 1850, 1250);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 300;
key.shadow.camera.far = 5200;
key.shadow.camera.left = -1000;
key.shadow.camera.right = 1000;
key.shadow.camera.top = 1000;
key.shadow.camera.bottom = -1000;
key.shadow.bias = -0.0006;
key.shadow.normalBias = 1.5;
key.shadow.radius = 4;
scene.add(key);

const fill = new DirectionalLight(0xffe9d6, 0.5);
fill.position.set(-1400, 780, -900);
scene.add(fill);

const rim = new DirectionalLight(0xffffff, 0.35);
rim.position.set(-500, 520, 1400);
scene.add(rim);

// --- пол и контактная тень --------------------------------------------------

const ground = new Mesh(
  new CircleGeometry(9000, 96),
  new MeshStandardMaterial({ color: 0xece2d3, roughness: 1, metalness: 0 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.4;
ground.receiveShadow = true;
scene.add(ground);

function createContactShadow() {
  const size = 256;
  const canvasEl = document.createElement('canvas');
  canvasEl.width = canvasEl.height = size;
  const ctx = canvasEl.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, size * 0.06, size / 2, size / 2, size * 0.5);
  gradient.addColorStop(0, 'rgba(58, 40, 22, 0.55)');
  gradient.addColorStop(0.55, 'rgba(58, 40, 22, 0.2)');
  gradient.addColorStop(1, 'rgba(58, 40, 22, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new CanvasTexture(canvasEl);
  const material = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    opacity: 0.75,
  });
  const mesh = new Mesh(new PlaneGeometry(980, 840), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, 0.6, 0);
  mesh.renderOrder = 1;
  return mesh;
}

scene.add(createContactShadow());

// --- модель -----------------------------------------------------------------

const materials = buildMaterials();
const { root: nightstand, drawer, pickables } = buildNightstand(materials);
scene.add(nightstand);

// --- состояние ящика --------------------------------------------------------

const drawerState = { target: 0, progress: 0 };

function setDrawer(open) {
  drawerState.target = open ? 1 : 0;
  toggleButton.setAttribute('aria-pressed', String(open));
  toggleIcon.textContent = open ? '📥' : '📤';
  toggleLabel.textContent = open ? 'Закрыть ящик' : 'Открыть ящик';
}

function toggleDrawer() {
  setDrawer(drawerState.target < 0.5);
}

// --- управление камерой -----------------------------------------------------

let resetAnimation = null;

function resetView() {
  resetAnimation = {
    elapsed: 0,
    duration: reduceMotion ? 0.001 : 0.75,
    fromPosition: camera.position.clone(),
    fromTarget: controls.target.clone(),
  };
}

function updateResetAnimation(dt) {
  if (!resetAnimation) return;
  resetAnimation.elapsed += dt;
  const t = Math.min(resetAnimation.elapsed / resetAnimation.duration, 1);
  const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  camera.position.lerpVectors(resetAnimation.fromPosition, HOME.position, eased);
  controls.target.lerpVectors(resetAnimation.fromTarget, HOME.target, eased);
  controls.update();

  if (t >= 1) {
    resetAnimation = null;
    camera.position.copy(HOME.position);
    controls.target.copy(HOME.target);
    controls.update();
  }
}

controls.addEventListener('start', () => {
  controls.autoRotate = false;
  resetAnimation = null;
});

// --- выбор модели кликом ----------------------------------------------------

const raycaster = new Raycaster();
const pointer = new Vector2();
let pointerStart = null;

function toPointer(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

canvas.addEventListener('pointerdown', (event) => {
  pointerStart = { x: event.clientX, y: event.clientY, time: performance.now() };
});

canvas.addEventListener('pointerup', (event) => {
  if (!pointerStart) return;
  const moved = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
  const elapsed = performance.now() - pointerStart.time;
  pointerStart = null;
  if (moved > 8 || elapsed > 700) return;

  toPointer(event);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(pickables, false);
  if (hits.length) toggleDrawer();
});

// --- кнопки и экспорт -------------------------------------------------------

toggleButton.addEventListener('click', toggleDrawer);
resetButton.addEventListener('click', resetView);

let statusTimer = 0;
function setStatus(message, isError = false) {
  exportStatus.textContent = message;
  exportStatus.style.color = isError ? '#9b3d2a' : '';
  window.clearTimeout(statusTimer);
  if (message) {
    statusTimer = window.setTimeout(() => {
      exportStatus.textContent = '';
    }, 6000);
  }
}

function withBusy(button, task) {
  button.classList.add('is-busy');
  window.setTimeout(() => {
    try {
      task();
    } finally {
      button.classList.remove('is-busy');
    }
  }, 30);
}

exportRb.addEventListener('click', () => {
  withBusy(exportRb, () => {
    try {
      const script = buildSketchupScript();
      downloadFile(`${FILE_BASENAME}.rb`, script, 'text/plain;charset=utf-8');
      setStatus('Скрипт .rb сохранён — запустите его в Ruby Console');
    } catch (error) {
      console.error(error);
      setStatus('Не удалось создать .rb', true);
    }
  });
});

exportDaeButton.addEventListener('click', () => {
  withBusy(exportDaeButton, () => {
    try {
      const dae = exportDae(nightstand);
      downloadFile(`${FILE_BASENAME}.dae`, dae, 'model/vnd.collada+xml');
      setStatus('Модель .dae сохранена — SketchUp: File → Import');
    } catch (error) {
      console.error(error);
      setStatus('Не удалось создать .dae', true);
    }
  });
});

window.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
  if (event.code === 'Space') {
    if (event.target instanceof Element && event.target.closest('button')) return;
    event.preventDefault();
    toggleDrawer();
  }
  if (event.key === 'r' || event.key === 'R' || event.key === 'к' || event.key === 'К') {
    resetView();
  }
});

// --- анимация ---------------------------------------------------------------

const clock = { last: performance.now() };

function animate(now) {
  const dt = Math.min((now - clock.last) / 1000, 0.05);
  clock.last = now;

  const smoothing = reduceMotion ? 1 : 1 - Math.exp(-dt * 7.5);
  drawerState.progress += (drawerState.target - drawerState.progress) * smoothing;
  if (Math.abs(drawerState.target - drawerState.progress) < 0.0005) {
    drawerState.progress = drawerState.target;
  }
  drawer.position.z = drawerState.progress * DRAWER_TRAVEL;

  updateResetAnimation(dt);
  controls.update();

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

// --- размеры окна -----------------------------------------------------------

function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  updateHome();
}

window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', () => window.setTimeout(onResize, 120));

// --- старт ------------------------------------------------------------------

renderer.render(scene, camera);

const loadingWatchdog = window.setTimeout(() => loading.classList.add('is-done'), 4000);

requestAnimationFrame((now) => {
  clock.last = now;
  animate(now);
  requestAnimationFrame(() => {
    window.clearTimeout(loadingWatchdog);
    loading.classList.add('is-done');
  });
});

window.addEventListener('error', (event) => {
  console.error(event.error ?? event.message);
  if (loading.classList.contains('is-done')) return;
  window.clearTimeout(loadingWatchdog);
  loading.classList.remove('is-done');
  loading.innerHTML = '<p>Что-то пошло не так.<br>Обновите страницу или откройте её в другом браузере.</p>';
});

// витрина для отладки
window.__tumba = { scene, camera, controls, nightstand, drawer, setDrawer };
