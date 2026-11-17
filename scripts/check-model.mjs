import * as THREE from 'three';
import { buildTumba, applyExplode } from '../assets/js/model.js';
const { root, explodeParts } = buildTumba('graphite');
const box = new THREE.Box3();
root.updateMatrixWorld(true);
for (const child of root.children) {
  if (child.isMesh) {
    const b = new THREE.Box3().setFromObject(child);
    console.log(child.name.padEnd(28), 'y', b.min.y.toFixed(1), '→', b.max.y.toFixed(1), '| z', b.min.z.toFixed(1), '→', b.max.z.toFixed(1));
  } else {
    for (const sub of child.children) {
      const b = new THREE.Box3().setFromObject(sub);
      console.log((child.name + '/' + sub.name).padEnd(28), 'y', b.min.y.toFixed(1), '→', b.max.y.toFixed(1), '| z', b.min.z.toFixed(1), '→', b.max.z.toFixed(1));
    }
  }
}
const all = new THREE.Box3().setFromObject(root);
console.log('\nИТОГО bbox:', all.min.toArray().map(n=>n.toFixed(1)), '→', all.max.toArray().map(n=>n.toFixed(1)));
console.log('Габариты Ш×В×Г:', (all.max.x-all.min.x).toFixed(0), '×', (all.max.y-all.min.y).toFixed(0), '×', (all.max.z-all.min.z).toFixed(0), 'мм');
let nan = 0;
root.traverse(o => { if (o.isMesh) { const p = o.geometry.attributes.position; for (let i=0;i<p.array.length;i++) if (Number.isNaN(p.array[i])) nan++; } });
console.log('NaN-вершин:', nan);
// разбор на 100% — не должен ломать bbox
applyExplode(explodeParts, 1); root.updateMatrixWorld(true);
const ex = new THREE.Box3().setFromObject(root);
console.log('bbox @100% explode:', ex.min.toArray().map(n=>n.toFixed(0)), '→', ex.max.toArray().map(n=>n.toFixed(0)));
