import * as T from 'three';
import { CITY, WEST, EAST } from './config.js';
import { seeded, between, integer } from './rng.js';
import { Batch, cube, pole, standard } from './geometry.js';

function frondGeometry() {
  const points = [];
  for (let j = 0; j < 10; j++) {
    const a = j / 10;
    const b = (j + 1) / 10;
    const y = t => Math.sin(t * 2.8) * .53 - t * .43;
    const w = t => .21 * Math.sin(t * Math.PI) + .009;
    points.push(0, y(a), a, w(a), y(a) - .08, a, 0, y(b), b,
      0, y(b), b, w(a), y(a) - .08, a, w(b), y(b) - .08, b,
      -w(a), y(a) - .08, a, 0, y(a), a, 0, y(b), b,
      -w(a), y(a) - .08, a, 0, y(b), b, -w(b), y(b) - .08, b);
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(points, 3));
  g.computeVertexNormals();
  return g;
}

export function buildProps(parent, collision, blocks, roofs) {
  const wood = new Batch(pole, standard(0x94806a), { cast: true });
  const leaves = new Batch(frondGeometry(), standard(0xffffff, { side: T.DoubleSide }), { cast: true });
  const metal = new Batch(cube, standard(0x354446), { cast: true });
  const light = new Batch(cube, standard(0xffdfae, { emissive: 0xe6a25d, emissiveIntensity: .38 }));
  const clutter = new Batch(cube, standard(0xffffff), { cast: true });
  const rand = seeded(CITY.seed + 1843);
  let palms = 0;
  let lamps = 0;

  function palm(x, z, h) {
    palms++;
    wood.add(x, h / 2 + .18, z, .4, h, .4, 0, 0, -.045);
    for (let j = 0; j < 8; j++) {
      const s = between(rand, 2.45, 4.3);
      leaves.add(x + h * .022, h + .17, z, s, s, s, j * .785 + rand() * .4,
        between(rand, -.34, .25), .1, j % 2 ? 0x567549 : 0x7b9350);
    }
    collision.insert(x, z, .64, .64, h + .18);
  }

  function lamp(x, z, face) {
    lamps++;
    metal.add(x, 2.71, z, .13, 5.08, .13);
    metal.add(x, 5.17, z + face * .55, .13, .12, 1.12);
    metal.add(x, 5.09, z + face * 1.08, .51, .14, .37);
    light.add(x, 4.99, z + face * 1.08, .39, .08, .27);
    collision.insert(x, z, .23, .23, 5.3);
  }

  for (const b of blocks) {
    lamp(b.x - 11.8, b.z + 14.05, 1);
    lamp(b.x + 11.8, b.z - 14.05, -1);
    if (b.bz === -1 || rand() < .46) palm(b.x, b.z + 12.9, between(rand, 4.7, 7.6));
  }
  for (let x = WEST + 8; x < EAST - 4; x += 16) {
    lamp(x, 12.8, -1);
    if (Math.abs(x) > 8) palm(x + 4, 11.72, between(rand, 5.6, 8.7));
    if (x % 3) {
      const bx = x + 7;
      metal.add(bx - .63, .5, 12.65, .13, .62, .51);
      metal.add(bx + .63, .5, 12.65, .13, .62, .51);
      clutter.add(bx, .69, 12.65, 1.83, .11, .57, 0, 0, 0, 0xaa7953);
      clutter.add(bx, 1.0, 12.87, 1.83, .35, .1, 0, 0, 0, 0xaa7953);
      collision.insert(bx, 12.68, 1.83, .65, 1.19);
    }
  }
  for (const r of roofs) {
    for (let k = integer(rand, 1, 4); k > 0; k--) {
      const x = r.x + between(rand, -r.w * .33, r.w * .33);
      const z = r.z + between(rand, -r.d * .33, r.d * .33);
      const h = between(rand, .4, 1.7);
      clutter.add(x, r.h + h / 2, z, 1.1 + k * .34, h, 1.45, 0, 0, 0, k % 2 ? 0xb0a38d : 0x807b71);
      if (k === 1) metal.add(x, r.h + h + .38, z, .075, .8, .075);
    }
  }
  for (const b of [wood, leaves, metal, light, clutter]) b.flush(parent);
  return { palms, lamps };
}
