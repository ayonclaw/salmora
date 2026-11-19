import * as T from 'three';
import { seeded, integer, pick } from './rng.js';

function paint(width, height, draw, repeat = false) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  draw(c.getContext('2d'), width, height);
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  tex.anisotropy = 8;
  if (repeat) tex.wrapS = tex.wrapT = T.RepeatWrapping;
  return tex;
}

function grain(ctx, w, h, rand, count, light = .15) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = rand() < .5 ? `rgba(16,27,29,${rand() * light})` : `rgba(249,224,179,${rand() * light})`;
    ctx.fillRect(rand() * w, rand() * h, 1 + rand() * 4, 1 + rand() * 2);
  }
}

function pavement(color, tiles, seed) {
  return paint(256, 256, (ctx, w, h) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    const rand = seeded(seed);
    grain(ctx, w, h, rand, 13000, .28);
    if (!tiles) return;
    for (let y = 0; y < h; y += 64) {
      ctx.fillStyle = '#695e52';
      ctx.fillRect(0, y, w, 2);
      for (let x = y % 128 ? 32 : 0; x < w; x += 64) ctx.fillRect(x, y, 2, 64);
      ctx.fillStyle = '#d1baa4';
      ctx.fillRect(0, y + 2, w, 1);
    }
  }, true);
}

const families = [
  { wall: '#bc775e', sill: '#edbc96', frame: '#572d29', panes: 2, shape: 'arch' },
  { wall: '#d7bf98', sill: '#f5dcaf', frame: '#47605e', panes: 3, shape: 'wide' },
  { wall: '#688980', sill: '#a4b5a0', frame: '#263a3a', panes: 2, shape: 'tall' },
  { wall: '#a9a5a0', sill: '#ccc3ae', frame: '#334c54', panes: 3, shape: 'industrial' },
];

function facade(style, index) {
  return paint(256, 256, (ctx, w, h) => {
    const rand = seeded(345 + index);
    ctx.fillStyle = style.wall;
    ctx.fillRect(0, 0, w, h);
    grain(ctx, w, h, rand, 4400, .22);
    for (let y = 11; y < h; y += 12) {
      ctx.fillStyle = index === 0 ? '#965d4b55' : '#3f42351a';
      ctx.fillRect(0, y, w, 1);
      if (index === 0) for (let x = y % 24 ? 0 : 17; x < w; x += 34) ctx.fillRect(x, y, 1, 12);
    }
    const ww = [111, 179, 91, 168][index];
    const x = (w - ww) / 2;
    const y = 42;
    const hh = index === 3 ? 143 : 161;
    ctx.fillStyle = style.sill;
    ctx.fillRect(x - 8, y - 6, ww + 16, hh + 12);
    ctx.fillStyle = style.frame;
    ctx.fillRect(x, y, ww, hh);
    const glass = ctx.createLinearGradient(0, y, 0, y + hh);
    glass.addColorStop(0, '#618087');
    glass.addColorStop(.47, '#29434b');
    glass.addColorStop(1, index === 1 ? '#a78352' : '#182b32');
    ctx.fillStyle = glass;
    ctx.fillRect(x + 8, y + 7, ww - 16, hh - 14);
    ctx.fillStyle = '#bbdbcf37';
    ctx.beginPath();
    ctx.moveTo(x + 10, y + 9);
    ctx.lineTo(x + ww - 11, y + 9);
    ctx.lineTo(x + 9, y + hh * .74);
    ctx.fill();
    ctx.fillStyle = style.frame;
    for (let p = 1; p < style.panes; p++) ctx.fillRect(x + ww * p / style.panes - 3, y, 6, hh);
    ctx.fillRect(x, y + hh * .56, ww, 7);
    ctx.fillStyle = style.sill;
    ctx.fillRect(x - 13, y + hh + 4, ww + 26, 8);
    ctx.fillRect(0, 238, w, 4);
    if (style.shape === 'arch') {
      ctx.strokeStyle = style.sill;
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.ellipse(w / 2, y + 2, ww / 2 + 4, 24, 0, Math.PI, 2 * Math.PI);
      ctx.stroke();
    }
  }, true);
}

export function textures() {
  return {
    asphalt: pavement('#42494b', false, 44),
    paving: pavement('#a79785', true, 187),
    facades: families.map(facade),
  };
}

const boards = [
  ['#183b3a', '#ffe4ab'], ['#8d3828', '#fff0c8'],
  ['#e2b66c', '#222f29'], ['#203b55', '#f1e9cf'],
  ['#533749', '#ffe0ac'], ['#3f553b', '#fff0c5'],
];

const signboards = new Map();

export function signTexture(text, id = 0, line = 'SALMORA TRADE CO.') {
  const key = `${id}:${text}:${line}`;
  if (signboards.has(key)) return signboards.get(key);
  const texture = paint(256, 64, (ctx, w, h) => {
    const [back, ink] = boards[id % boards.length];
    ctx.fillStyle = back;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 3;
    const side = 5;
    ctx.strokeRect(side, side, w - side * 2, h - side * 2);
    ctx.strokeRect(side + 3, side + 3, w - (side + 3) * 2, h - (side + 3) * 2);
    ctx.fillStyle = ink;
    ctx.textAlign = 'center';
    ctx.font = id % 3 === 0 ? 'bold 30px Georgia' : '900 27px sans-serif';
    ctx.fillText(text.toUpperCase(), w / 2, 35, w - 24);
    ctx.font = 'bold 10px monospace';
    ctx.fillText(line, w / 2, 52, w - 28);
    grain(ctx, w, h, seeded(id + 422), 280);
  });
  signboards.set(key, texture);
  return texture;
}

export function awningTexture() {
  return paint(128, 64, (ctx, w, h) => {
    for (let x = 0; x < w; x += 16) {
      ctx.fillStyle = x % 32 ? '#e9c197' : '#9e4a38';
      ctx.fillRect(x, 0, 16, h);
    }
    grain(ctx, w, h, seeded(3761), 900);
  });
}

export function shadowTexture() {
  return paint(64, 64, (ctx) => {
    const fade = ctx.createRadialGradient(32, 32, 3, 32, 32, 32);
    fade.addColorStop(0, '#080f16b0');
    fade.addColorStop(.55, '#080f1660');
    fade.addColorStop(1, '#080f1600');
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, 64, 64);
  });
}

export function pennantPalette(rand) {
  return pick(rand, [0xd68c46, 0x356f6a, 0xdac18d, 0xa84e42]);
}
