/**
 * Procedural wood texture — no external assets, works offline.
 */
import { CanvasTexture, RepeatWrapping, sRGBEncoding } from 'three';

function rand(seed) {
  // deterministic pseudo random so the grain looks the same on every load
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function createWoodTexture({
  size = 1024,
  base = '#c9a478',
  light = '#dcc09a',
  dark = '#7c532e',
  seed = 20240517,
} = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rnd = rand(seed);

  // base wash
  const grad = ctx.createLinearGradient(0, 0, size, size * 0.35);
  grad.addColorStop(0, light);
  grad.addColorStop(0.45, base);
  grad.addColorStop(1, base);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // broad tonal bands
  for (let i = 0; i < 26; i += 1) {
    const x = rnd() * size;
    const w = 18 + rnd() * 90;
    ctx.globalAlpha = 0.035 + rnd() * 0.05;
    ctx.fillStyle = rnd() > 0.5 ? dark : light;
    ctx.fillRect(x, 0, w, size);
  }
  ctx.globalAlpha = 1;

  // fine grain lines
  const lines = 260;
  for (let i = 0; i < lines; i += 1) {
    const x0 = rnd() * size;
    const amp = 3 + rnd() * 12;
    const freq = 1 + Math.floor(rnd() * 3);
    const alpha = 0.03 + rnd() * 0.14;
    ctx.beginPath();
    for (let y = -20; y <= size + 20; y += 12) {
      const t = (y / size) * Math.PI * 2 * freq;
      const x = x0 + Math.sin(t + rnd() * 0.02) * amp;
      if (y === -20) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = dark;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 0.6 + rnd() * 1.7;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // knots
  for (let k = 0; k < 3; k += 1) {
    const cx = rnd() * size;
    const cy = rnd() * size;
    const rings = 5 + Math.floor(rnd() * 4);
    for (let r = 0; r < rings; r += 1) {
      ctx.beginPath();
      ctx.ellipse(
        cx + (rnd() - 0.5) * 6,
        cy,
        10 + r * (5 + rnd() * 4),
        26 + r * (9 + rnd() * 7),
        (rnd() - 0.5) * 0.14,
        0,
        Math.PI * 2
      );
      ctx.strokeStyle = dark;
      ctx.globalAlpha = 0.1 + rnd() * 0.09;
      ctx.lineWidth = 1 + rnd() * 2;
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  // faint speckle for a matte, oiled look
  const dots = 2600;
  for (let i = 0; i < dots; i += 1) {
    ctx.globalAlpha = 0.02 + rnd() * 0.04;
    ctx.fillStyle = rnd() > 0.5 ? dark : light;
    ctx.fillRect(rnd() * size, rnd() * size, 1.2, 1.2);
  }
  ctx.globalAlpha = 1;

  const texture = new CanvasTexture(canvas);
  texture.encoding = sRGBEncoding;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}
