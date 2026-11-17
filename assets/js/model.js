/**
 * TUMBA·01 — параметрическая модель прикроватной тумбы.
 * Все размеры в миллиметрах. Модуль общий: используется и в браузере
 * (импорт «three» резолвится через importmap), и в Node-скрипте экспорта
 * («three» берётся из node_modules) — поэтому единственная геометрия на оба пути.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from '../vendor/RoundedBoxGeometry.js';

export const DIMENSIONS = {
  width: 520,        // ширина корпуса
  height: 544,       // полная высота
  depth: 430,        // глубина корпуса
  topWidth: 544,     // верхняя плита с напуском
  topDepth: 452,
  plinthH: 56,       // высота утопленного цоколя
};

export const FINISHES = [
  { id: 'graphite', label: 'Графит',   color: '#3f4956', roughness: 0.62 },
  { id: 'sage',     label: 'Шалфей',   color: '#5e665c', roughness: 0.64 },
  { id: 'latte',    label: 'Латте',    color: '#a39384', roughness: 0.66 },
  { id: 'terracotta', label: 'Терракот', color: '#7e574a', roughness: 0.65 },
];

function part(name, mat, w, h, d, x, y, z, radius = 3, segments = 3) {
  const geo = new RoundedBoxGeometry(w, h, d, segments, radius);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = name;
  return mesh;
}

export function buildTumba(finishId = 'graphite') {
  const finish = FINISHES.find((f) => f.id === finishId) ?? FINISHES[0];

  const lacquer = new THREE.MeshPhysicalMaterial({
    name: 'tumba_lacquer',
    color: new THREE.Color(finish.color),
    roughness: finish.roughness,
    metalness: 0.04,
    clearcoat: 0.42,
    clearcoatRoughness: 0.55,
    envMapIntensity: 0.9,
  });

  const root = new THREE.Group();
  root.name = 'TUMBA-01';

  // ---- Цоколь (утоплен) -------------------------------------------------
  const plinth = part('plinth', lacquer, 468, DIMENSIONS.plinthH, 378, 0, DIMENSIONS.plinthH / 2, 0, 4);

  // ---- Боковины ----------------------------------------------------------
  const sideY = DIMENSIONS.plinthH + (516 - DIMENSIONS.plinthH) / 2; // 56..516
  const sideH = 516 - DIMENSIONS.plinthH;
  const sideX = 520 / 2 - 18 / 2;
  const sideLeft = part('side_left', lacquer, 18, sideH, 430, -sideX, sideY, 0, 3);
  const sideRight = part('side_right', lacquer, 18, sideH, 430, sideX, sideY, 0, 3);

  // ---- Задняя стенка (утоплена) ------------------------------------------
  const back = part('back', lacquer, 484, sideH, 10, 0, sideY, -210, 2);

  // ---- Полка ниши ---------------------------------------------------------
  const shelf = part('shelf', lacquer, 484, 16, 420, 0, 292, 5, 2); // y 284..300

  // ---- Тонкая накладная планка над фасадом (полка-«лыска») ----------------
  const ledge = part('ledge', lacquer, 484, 12, 10, 0, 298, 216, 2); // фронт на 221

  // ---- Верхняя плита (напуск по периметру) --------------------------------
  const topSlab = part('top_slab', lacquer, 544, 28, 452, 0, 530, 0, 4.5, 4); // y 516..544

  // ---- Ящик: панель + рамка «шейкер» ---------------------------------------
  const drawer = new THREE.Group();
  drawer.name = 'drawer';

  const drawerBase = part('drawer_base', lacquer, 476, 212, 18, 0, 172, 198, 3);
  drawerBase.castShadow = true;

  const stileL = part('frame_stile_left', lacquer, 44, 212, 8, -216, 172, 211, 2);
  const stileR = part('frame_stile_right', lacquer, 44, 212, 8, 216, 172, 211, 2);
  const railTop = part('frame_rail_top', lacquer, 388, 44, 8, 0, 256, 211, 2);
  const railBottom = part('frame_rail_bottom', lacquer, 388, 44, 8, 0, 88, 211, 2);

  drawer.add(drawerBase, stileL, stileR, railTop, railBottom);

  root.add(plinth, sideLeft, sideRight, back, shelf, ledge, topSlab, drawer);

  // ---- Раскладка для «разобранного вида» -----------------------------------
  const explodeParts = [
    { obj: topSlab, dir: new THREE.Vector3(0, 1, 0), dist: 175 },
    { obj: sideLeft, dir: new THREE.Vector3(-1, 0, 0), dist: 135 },
    { obj: sideRight, dir: new THREE.Vector3(1, 0, 0), dist: 135 },
    { obj: back, dir: new THREE.Vector3(0, 0, -1), dist: 165 },
    { obj: shelf, dir: new THREE.Vector3(0, 1, 0), dist: 78 },
    { obj: ledge, dir: new THREE.Vector3(0, 0, 1), dist: 205 },
    { obj: drawer, dir: new THREE.Vector3(0, 0, 1), dist: 255 },
    { obj: plinth, dir: new THREE.Vector3(0, 0, 0), dist: 0 },
  ];
  for (const p of explodeParts) p.base = p.obj.position.clone();

  return { root, lacquer, explodeParts, dimensions: DIMENSIONS };
}

/** Применяет коэффициент разборки 0..1 (для слайдера «Разобранный вид»). */
export function applyExplode(explodeParts, t) {
  const k = THREE.MathUtils.clamp(t, 0, 1);
  const e = k * k * (3 - 2 * k); // smoothstep — мягкий старт/финиш
  for (const p of explodeParts) {
    p.obj.position.copy(p.base).addScaledVector(p.dir, p.dist * e);
  }
}
