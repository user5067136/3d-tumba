/**
 * Экспорт статических моделей в models/:
 *   tumba.obj + tumba.mtl  — Wavefront (цвет: графит)
 *   tumba.glb              — glTF 2.0 Binary
 *   tumba.stl              — бинарный STL
 *   tumba-01.zip           — архив (obj + mtl + инструкция для SketchUp)
 *
 * Запуск: npm run export-models
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { OBJExporter } from '../node_modules/three/examples/jsm/exporters/OBJExporter.js';
import { STLExporter } from '../node_modules/three/examples/jsm/exporters/STLExporter.js';
import { GLTFExporter } from '../node_modules/three/examples/jsm/exporters/GLTFExporter.js';
import { buildTumba, FINISHES } from '../assets/js/model.js';

// --- минимальная полифилла FileReader для GLTFExporter в Node ---
globalThis.FileReader = class FileReader {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buf) => { this.result = buf; this.onloadend?.(); });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = 'data:application/octet-stream;base64,' + Buffer.from(buf).toString('base64');
      this.onloadend?.();
    });
  }
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outDir = path.join(root, 'models');
fs.mkdirSync(outDir, { recursive: true });

const f3 = (n) => n.toFixed(4);

const finish = FINISHES.find((f) => f.id === 'graphite');
const kd = new THREE.Color(finish.color);

const mtl = [
  '# TUMBA·01 — матовая ПУ-эмаль, цвет «Графит»',
  'newmtl tumba_lacquer',
  `Ka ${f3(kd.r)} ${f3(kd.g)} ${f3(kd.b)}`,
  `Kd ${f3(kd.r)} ${f3(kd.g)} ${f3(kd.b)}`,
  'Ks 0.2200 0.2200 0.2200',
  'Ns 42',
  'illum 2',
  '',
].join('\n');

const skpReadme = [
  'TUMBA·01 — прикроватная тумба',
  '============================',
  '',
  'Единицы модели: миллиметры. Ориентация: Y вверх, фасад смотрит на +Z.',
  'Габариты корпуса: 520 × 544 × 430 мм (верхняя плита 544 × 452 мм).',
  '',
  'Как открыть в SketchUp:',
  '  1. SketchUp Pro: File → Import… → тип файла "OBJ" → выберите tumba-01.obj.',
  '     Обязательно положите tumba.mtl рядом — материал подхватится автоматически.',
  '  2. SketchUp Free (веб): импорт OBJ недоступен, откройте модель в Blender',
  '     (бесплатно, blender.org) через File → Import → Wavefront (.obj),',
  '     затем сохраните и откройте результат в SketchUp.',
  '  3. После импорта проверьте масштаб (1 ед. = 1 мм) и сохраните как .skp.',
  '',
  'Файлы архива:',
  '  tumba-01.obj — геометрия (Wavefront OBJ)',
  '  tumba.mtl    — материал "tumba_lacquer" (цвет #3F4956, матовая эмаль)',
  '',
  'Лицензия: CC0 — делайте с моделью что угодно.',
  'Исходник: https://github.com/user5067136/3d-tumba',
  '',
].join('\n');

const modelRoot = buildTumba('graphite').root;

/** Сжимаем «хвосты» float-ов (…0002) до 4 знаков — минус ~40% к размеру OBJ. */
const trimFloats = (text) =>
  text.replace(/-?\d+\.\d+/g, (m) => String(Math.round(parseFloat(m) * 10000) / 10000));

// --- OBJ ---
const objRaw = new OBJExporter().parse(modelRoot);
const obj = 'mtllib tumba.mtl\n' + trimFloats(objRaw);
fs.writeFileSync(path.join(outDir, 'tumba-01.obj'), obj);
fs.writeFileSync(path.join(outDir, 'tumba.mtl'), mtl);
console.log('✓ tumba-01.obj', fmtKB(obj.length));

// --- STL (бинарный) ---
const stl = new STLExporter().parse(modelRoot, { binary: true });
const stlBuf = Buffer.from(stl.buffer ?? stl);
fs.writeFileSync(path.join(outDir, 'tumba-01.stl'), stlBuf);
console.log('✓ tumba-01.stl', fmtKB(stlBuf.length));

// --- GLB (асинхронно) ---
const glbBuffer = await new Promise((resolve, reject) => {
  new GLTFExporter().parse(
    buildTumba('graphite').root,
    resolve,
    reject,
    { binary: true }
  );
});
const glbBuf = Buffer.from(glbBuffer);
fs.writeFileSync(path.join(outDir, 'tumba-01.glb'), glbBuf);
console.log('✓ tumba-01.glb', fmtKB(glbBuf.length));

function fmtKB(n) { return `(${(n / 1024).toFixed(1)} КБ)`; }

/* ---------------- минимальный ZIP-писатель (deflate) ---------------- */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function makeZip(entries) {
  const chunks = [];
  const central = [];
  let offset = 0;
  const DOS_TIME = 0x5b20;
  const DOS_DATE = 0x5866;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const comp = zlib.deflateRawSync(entry.data, { level: 9 });
    const crc = crc32(entry.data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);      // UTF-8 имена
    local.writeUInt16LE(8, 8);           // method 8 = deflate
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comp.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, nameBuf, comp);

    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0x0800, 8);
    cen.writeUInt16LE(8, 10);            // method 8
    cen.writeUInt16LE(DOS_TIME, 12);
    cen.writeUInt16LE(DOS_DATE, 14);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(comp.length, 20);
    cen.writeUInt32LE(entry.data.length, 24);
    cen.writeUInt16LE(nameBuf.length, 28);
    cen.writeUInt16LE(0, 36);            // internal attrs
    cen.writeUInt32LE(0, 38);            // external attrs
    cen.writeUInt32LE(offset, 42);
    central.push(Buffer.concat([cen, nameBuf]));

    offset += local.length + nameBuf.length + comp.length;
  }

  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...chunks, centralBuf, end]);
}

// --- ZIP (deflate) ---
const zip = makeZip([
  { name: 'tumba-01.obj', data: Buffer.from(obj) },
  { name: 'tumba.mtl', data: Buffer.from(mtl) },
  { name: 'SKP-КАК-ОТКРЫТЬ.txt', data: Buffer.from(skpReadme, 'utf8') },
]);
fs.writeFileSync(path.join(outDir, 'tumba-01.zip'), zip);
console.log('✓ tumba-01.zip', fmtKB(zip.length));
