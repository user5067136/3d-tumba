/**
 * Прикроватная тумба 600 × 450 × 510 мм.
 * Все размеры — в миллиметрах, ось Y — вверх, +Z — «на зрителя» (фасад).
 */
import {
  Group,
  Mesh,
  MeshStandardMaterial,
  CylinderGeometry,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createWoodTexture } from './textures.js';

export const DIMENSIONS = { width: 600, depth: 450, height: 510 };
export const DRAWER_TRAVEL = 300;

/** Панели корпуса и ящика (мм). */
export const PARTS = [
  // ножки
  { id: 'leg-fl', name: 'Ножка передняя левая', group: 'case', mat: 'leg', min: [-288, 0, 167], size: [46, 60, 46], round: 5 },
  { id: 'leg-fr', name: 'Ножка передняя правая', group: 'case', mat: 'leg', min: [242, 0, 167], size: [46, 60, 46], round: 5 },
  { id: 'leg-bl', name: 'Ножка задняя левая', group: 'case', mat: 'leg', min: [-288, 0, -213], size: [46, 60, 46], round: 5 },
  { id: 'leg-br', name: 'Ножка задняя правая', group: 'case', mat: 'leg', min: [242, 0, -213], size: [46, 60, 46], round: 5 },

  // корпус
  { id: 'bottom', name: 'Днище', group: 'case', mat: 'inner', min: [-282, 60, -225], size: [564, 18, 432], round: 1.5 },
  { id: 'side-left', name: 'Боковина левая', group: 'case', mat: 'body', min: [-300, 60, -225], size: [18, 432, 432], round: 1.5 },
  { id: 'side-right', name: 'Боковина правая', group: 'case', mat: 'body', min: [282, 60, -225], size: [18, 432, 432], round: 1.5 },
  { id: 'back', name: 'Задняя стенка', group: 'case', mat: 'back', min: [-282, 78, -225], size: [564, 414, 8], round: 0.8 },
  { id: 'divider', name: 'Полка над нишей', group: 'case', mat: 'inner', min: [-282, 282, -225], size: [564, 18, 432], round: 1.5 },
  { id: 'rail', name: 'Царга верхняя', group: 'case', mat: 'body', min: [-282, 468, 189], size: [564, 24, 18], round: 1 },
  { id: 'top', name: 'Столешница', group: 'case', mat: 'body', min: [-300, 492, -225], size: [600, 18, 450], round: 2.5 },

  // ящик
  { id: 'drawer-front', name: 'Фасад ящика', group: 'drawer', mat: 'front', min: [-282, 300, 207], size: [564, 186, 18], round: 2.5 },
  { id: 'drawer-left', name: 'Боковина ящика левая', group: 'drawer', mat: 'inner', min: [-276, 308, -163], size: [12, 160, 370], round: 1 },
  { id: 'drawer-right', name: 'Боковина ящика правая', group: 'drawer', mat: 'inner', min: [264, 308, -163], size: [12, 160, 370], round: 1 },
  { id: 'drawer-bottom', name: 'Днище ящика', group: 'drawer', mat: 'inner', min: [-276, 308, -163], size: [552, 8, 370], round: 0.8 },
  { id: 'drawer-back', name: 'Задняя стенка ящика', group: 'drawer', mat: 'inner', min: [-276, 316, -163], size: [552, 152, 12], round: 0.8 },
];

/** Ручка-скоба: перекладина вдоль X + две стойки. */
export const HANDLE = {
  y: 393,
  frontZ: 225,
  barZ: 241,
  barLength: 340,
  barRadius: 7,
  stemRadius: 5,
  stemX: 150,
};

export const MATERIAL_DEFS = {
  body: { color: 0xffffff, roughness: 0.58, metalness: 0.03, wood: true, exportColor: 0xc9a478, label: 'Дуб' },
  front: { color: 0xf3e4d1, roughness: 0.54, metalness: 0.03, wood: true, exportColor: 0xd2ae84, label: 'Дуб — фасад' },
  inner: { color: 0xe4d0b7, roughness: 0.72, metalness: 0.02, wood: true, exportColor: 0xdcc3a4, label: 'Дуб — внутренние' },
  back: { color: 0xccb896, roughness: 0.82, metalness: 0.02, wood: true, exportColor: 0xbfa584, label: 'Дуб — задняя стенка' },
  leg: { color: 0xdec7a6, roughness: 0.55, metalness: 0.03, wood: true, exportColor: 0xc09a70, label: 'Дуб — ножки' },
  brass: { color: 0xb98f52, roughness: 0.3, metalness: 1, wood: false, exportColor: 0xb98f52, label: 'Латунь' },
};

export function buildMaterials() {
  const wood = createWoodTexture();
  const materials = {};

  for (const [key, def] of Object.entries(MATERIAL_DEFS)) {
    materials[key] = new MeshStandardMaterial({
      name: def.label,
      color: def.color,
      map: def.wood ? wood : null,
      roughness: def.roughness,
      metalness: def.metalness,
      envMapIntensity: def.wood ? 0.55 : 1.1,
    });
  }

  return materials;
}

function createPanel(part, material) {
  const [w, h, d] = part.size;
  const radius = Math.max(0.4, Math.min(part.round ?? 1, Math.min(w, h, d) / 2.05));
  const geometry = new RoundedBoxGeometry(w, h, d, 3, radius);
  const mesh = new Mesh(geometry, material);
  mesh.name = part.name;
  mesh.position.set(part.min[0] + w / 2, part.min[1] + h / 2, part.min[2] + d / 2);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.part = part;
  mesh.userData.matKey = part.mat;
  return mesh;
}

function createHandle(materials) {
  const group = new Group();
  group.name = 'Ручка';

  const bar = new Mesh(
    new CylinderGeometry(HANDLE.barRadius, HANDLE.barRadius, HANDLE.barLength, 28, 1),
    materials.brass
  );
  bar.name = 'Перекладина ручки';
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, HANDLE.y, HANDLE.barZ);
  bar.castShadow = true;
  bar.receiveShadow = true;
  bar.userData.matKey = 'brass';

  const stemGeometry = new CylinderGeometry(HANDLE.stemRadius, HANDLE.stemRadius, HANDLE.barZ - HANDLE.frontZ + 2, 20, 1);

  for (const x of [-HANDLE.stemX, HANDLE.stemX]) {
    const stem = new Mesh(stemGeometry, materials.brass);
    stem.name = 'Стойка ручки';
    stem.rotation.x = Math.PI / 2;
    stem.position.set(x, HANDLE.y, (HANDLE.frontZ + HANDLE.barZ) / 2);
    stem.castShadow = true;
    stem.receiveShadow = true;
    stem.userData.matKey = 'brass';
    group.add(stem);
  }

  group.add(bar);
  return group;
}

/**
 * Собирает модель.
 * @returns {{ root: Group, drawer: Group, pickables: Mesh[] }}
 */
export function buildNightstand(materials) {
  const root = new Group();
  root.name = 'Тумба 600 × 450 × 510';

  const caseGroup = new Group();
  caseGroup.name = 'Корпус';

  const drawer = new Group();
  drawer.name = 'Ящик';
  drawer.position.z = 0;

  const pickables = [];

  for (const part of PARTS) {
    const material = materials[part.mat];
    if (!material) continue;
    const mesh = createPanel(part, material);
    if (part.group === 'drawer') drawer.add(mesh);
    else caseGroup.add(mesh);
    pickables.push(mesh);
  }

  const handle = createHandle(materials);
  drawer.add(handle);
  handle.traverse((node) => {
    if (node.isMesh) pickables.push(node);
  });

  root.add(caseGroup, drawer);

  return { root, drawer, pickables };
}
