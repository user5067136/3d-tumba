/**
 * Экспорт модели: COLLADA (.dae) для SketchUp / Blender и загрузка файлов.
 */
import { MeshStandardMaterial, BoxGeometry, CylinderGeometry } from 'three';
import { ColladaExporter } from 'three/addons/exporters/ColladaExporter.js';
import { MATERIAL_DEFS, DIMENSIONS } from './nightstand.js';

export const FILE_BASENAME = `tumba-${DIMENSIONS.width}x${DIMENSIONS.depth}x${DIMENSIONS.height}`;

export function downloadFile(filename, content, mime = 'text/plain;charset=utf-8') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function plainMaterial(matKey) {
  const def = MATERIAL_DEFS[matKey] ?? MATERIAL_DEFS.body;
  return new MeshStandardMaterial({
    name: def.label,
    color: def.exportColor,
    roughness: 0.6,
    metalness: def.metalness,
  });
}

/**
 * Экспорт в COLLADA. Текстуры не включаются — вместо них чистые цвета,
 * чтобы .dae открывался в SketchUp без дополнительных файлов.
 * @param {import('three').Object3D} root
 * @returns {string}
 */
export function exportDae(root) {
  const clone = root.clone(true);

  const boxCache = new Map();

  clone.traverse((node) => {
    if (!node.isMesh) return;

    node.material = plainMaterial(node.userData.matKey);
    node.castShadow = false;
    node.receiveShadow = false;

    // в SketchUp удобнее простые бруски: скругления оставляем только в просмотрщике
    const part = node.userData.part;
    if (part) {
      const key = part.size.join('x');
      if (!boxCache.has(key)) {
        boxCache.set(key, new BoxGeometry(part.size[0], part.size[1], part.size[2]));
      }
      node.geometry = boxCache.get(key);
    } else if (node.geometry.type === 'CylinderGeometry') {
      const { radiusTop, radiusBottom, height } = node.geometry.parameters;
      node.geometry = new CylinderGeometry(radiusTop, radiusBottom, height, 20, 1);
    }
  });

  // экспортируем ящик закрытым
  const drawer = clone.getObjectByName('Ящик');
  if (drawer) drawer.position.z = 0;

  clone.updateMatrixWorld(true);

  const exporter = new ColladaExporter();
  const result = exporter.parse(clone, undefined, {
    version: '1.4.1',
    author: '3d-tumba',
    upAxis: 'Y_UP',
    unitName: 'millimeter',
    unitMeter: 0.001,
  });

  if (!result || !result.data) {
    throw new Error('Не удалось сформировать .dae');
  }

  return result.data;
}
