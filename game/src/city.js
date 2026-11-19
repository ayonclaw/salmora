import * as T from 'three';
import { CITY, WEST, EAST, NORTH } from './config.js';
import { seeded, integer, between, shuffled } from './rng.js';
import { textures, signTexture, awningTexture } from './textures.js';
import { box, ground, cube, standard, Batch } from './geometry.js';
import { Collision } from './collision.js';
import { buildProps } from './props.js';
import { buildWaterfront } from './waterfront.js';

const names = [
  'Morrow & Sons', 'Blue Spool', 'Nine Fathoms', 'Copper Finch',
  'Last Ferry', 'Sable Radio', 'Drift Pharmacy', 'The Green Tin',
  'Quay Records', 'Lantern Noodles', 'Low Tide Tools', 'Kestrel Books',
  'Silt & Silk', 'Little Cistern', 'Amber Lantern', 'Saltbox Bakery',
  'Tern Exchange', 'Olive Motor', 'The Dry Dock', 'Wren Watches',
  'Pearl Laundry', 'Moss Leather', 'Second Bell', 'Vesper Tailors',
  'Saffron Steps', 'Brass Anchor', 'Paper Heron', 'Dune Repairs',
  'Cinder Coffee', 'Finch Flowers', 'White Current', 'Thimble House',
  'Oxbow Optics', 'Bay Office', 'The Eighth Knot', 'Gull Supplies',
  'Reed & Rafter', 'Juniper House', 'Mallow Grocer', 'Saffron Loom',
  'Nacre Cinema', 'Three Pilots', 'Harbor Linen', 'Oriole Parts',
  'The Cobalt Cup', 'Ebb Studio', 'Lost Parcel', 'Brine & Bread',
];

export function buildCity(scene) {
  const collision = new Collision();
  const group = new T.Group();
  group.name = 'Salmora street grid';
  scene.add(group);
  const tex = textures();
  const roadMap = tex.asphalt.clone();
  roadMap.repeat.set(54, 45);
  const stoneMap = tex.paving.clone();
  stoneMap.repeat.set(5, 5);
  const street = standard(0xffffff, { map: roadMap });
  const sidewalk = standard(0xffffff, { map: stoneMap });
  const kerb = standard(0xc8b69a);
  const white = standard(0xe5d4ae);
  const ochre = standard(0xca9955);
  const roof = standard(0x6b6960);
  const trim = standard(0xd1bba0);
  const glass = standard(0x243e46, { metalness: .35, roughness: .3 });
  const dark = standard(0x293733);
  const awning = standard(0xffffff, { map: awningTexture(), side: T.DoubleSide });
  const marks = new Batch(cube, white);
  const yellow = new Batch(cube, ochre);
  const ledges = new Batch(cube, trim, { cast: true });
  const doorFrames = new Batch(cube, dark);
  const doorGlass = new Batch(cube, glass);
  const roofObjects = [];
  const blocks = [];
  const buildings = [];
  const shops = [];
  const signMaterials = new Map();
  const signPlane = new T.PlaneGeometry(1, 1);
  const span = EAST - WEST;

  ground(group, street, 0, -.015, NORTH / 2, span, -NORTH + 12);
  // Islands leave a continuous twelve-metre carriageway at each grid line.
  for (let bx = -CITY.halfBlocks; bx < CITY.halfBlocks; bx++) {
    for (let bz = -CITY.rows; bz < 0; bz++) {
      const x = (bx + .5) * CITY.pitch;
      const z = (bz + .5) * CITY.pitch;
      const size = CITY.pitch - CITY.road;
      const slab = box(group, sidewalk, x, CITY.kerb / 2, z, size, CITY.kerb, size);
      slab.receiveShadow = true;
      // A lighter strip along each edge makes the kerb readable at street level.
      ledges.add(x, .17, z + size / 2, size, .1, .23);
      ledges.add(x, .17, z - size / 2, size, .1, .23);
      ledges.add(x + size / 2, .17, z, .23, .1, size);
      ledges.add(x - size / 2, .17, z, .23, .1, size);
      blocks.push({ x, z, size, bx, bz });
    }
  }
  const promenade = box(group, sidewalk, 0, .06, 10.2, span, .24, 8.4);
  promenade.receiveShadow = true;
  box(group, kerb, 0, .16, 6.15, span, .18, .24);

  function crossing(x, z, horizontal) {
    for (let n = -4; n <= 4; n++) {
      const offset = n * .94;
      if (horizontal) marks.add(x + offset, .012, z, .53, .018, 2.25);
      else marks.add(x, .012, z + offset, 2.25, .018, .53);
    }
  }

  // Longitudinal stripes stop before the crossings, leaving intersections clean.
  for (let row = -CITY.rows; row <= 0; row++) {
    const z = row * CITY.pitch;
    for (let col = -CITY.halfBlocks; col < CITY.halfBlocks; col++) {
      const x = col * CITY.pitch;
      for (let dash = 0; dash < 5; dash++) {
        yellow.add(x + 12 + dash * 4.2, .018, z - .13, 2.2, .02, .09);
        yellow.add(x + 12 + dash * 4.2, .018, z + .13, 2.2, .02, .09);
      }
      marks.add(x + 23, .015, z - 5.5, 21, .015, .12);
      marks.add(x + 23, .015, z + 5.5, 21, .015, .12);
      crossing(x + 8, z, true);
    }
  }
  for (let col = -CITY.halfBlocks; col <= CITY.halfBlocks; col++) {
    const x = col * CITY.pitch;
    for (let row = -CITY.rows; row < 0; row++) {
      const z = row * CITY.pitch;
      for (let dash = 0; dash < 5; dash++) {
        yellow.add(x - .13, .018, z + 12 + dash * 4.2, .09, .02, 2.2);
        yellow.add(x + .13, .018, z + 12 + dash * 4.2, .09, .02, 2.2);
      }
      crossing(x, z + 8, false);
      marks.add(x - 4.6, .02, z + 10.2, 2.2, .02, .15);
    }
  }

  const wallBatches = [];
  const facadeBatches = [];
  for (let f = 0; f < 4; f++) {
    wallBatches.push(new Batch(cube, standard([0xb2765c, 0xcbb894, 0x63867d, 0x9c9b95][f]), { cast: true }));
    facadeBatches.push(new Batch(new T.PlaneGeometry(), standard(0xffffff, { map: tex.facades[f] })));
  }

  function windows(x, z, w, d, floors, f) {
    const batch = facadeBatches[f];
    const cols = Math.max(2, Math.floor(w / 3.2));
    const sides = Math.max(2, Math.floor(d / 3.2));
    for (let floor = 0; floor < floors; floor++) {
      const y = 4.6 + floor * 3.15;
      for (let col = 0; col < cols; col++) {
        const wx = x - w / 2 + (col + .5) * w / cols;
        batch.add(wx, y, z + d / 2 + .015, w / cols, 3.15, 1);
        batch.add(wx, y, z - d / 2 - .015, w / cols, 3.15, 1, Math.PI);
      }
      for (let col = 0; col < sides; col++) {
        const wz = z - d / 2 + (col + .5) * d / sides;
        batch.add(x + w / 2 + .015, y, wz, d / sides, 3.15, 1, Math.PI / 2);
        batch.add(x - w / 2 - .015, y, wz, d / sides, 3.15, 1, -Math.PI / 2);
      }
    }
  }

  function storefront(x, z, w, yaw, name, id) {
    const entry = new T.Group();
    entry.position.set(x, .18, z);
    entry.rotation.y = yaw;
    group.add(entry);
    box(entry, dark, 0, 1.15, 0, w - .6, 2.3, .13);
    box(entry, glass, -.65, 1.25, .085, Math.max(1, w - 2.2), 1.75, .06);
    box(entry, trim, w / 2 - 1.14, 1.15, .11, .12, 2.3, .12);
    box(entry, glass, w / 2 - .69, 1.12, .13, .64, 2.13, .06);
    box(entry, trim, w / 2 - .47, 1.08, .19, .05, .2, .06);
    const key = `${id}:${name}`;
    if (!signMaterials.has(key)) signMaterials.set(key, standard(0xffffff, {
      map: signTexture(name, id, id % 2 ? 'EST. AFTER THE FLOOD' : 'LANTERN QUAY • SALMORA'),
    }));
    const board = new T.Mesh(signPlane, signMaterials.get(key));
    board.scale.set(w - .35, .97, 1);
    board.position.set(0, 2.82, .16);
    entry.add(board);
    if (id % 3 !== 1) {
      const shade = box(entry, awning, 0, 2.46, .55, w - .4, .09, 1.28);
      shade.rotation.x = .16;
      shade.castShadow = true;
      box(entry, awning, 0, 2.3, 1.17, w - .4, .24, .06);
    }
    shops.push({ name, x, z });
  }

  for (const block of blocks) {
    const rand = seeded(CITY.seed + (block.bx + 5) * 197 + (block.bz + 6) * 131);
    const localNames = shuffled(rand, names);
    let nameCursor = 0;
    for (let qz = -1; qz <= 1; qz += 2) {
      for (let qx = -1; qx <= 1; qx += 2) {
        const w = between(rand, 9.3, 11.8);
        const d = between(rand, 9.6, 11.7);
        const x = block.x + qx * 6.25;
        const z = block.z + qz * 6.25;
        const family = integer(rand, 0, 3);
        const floors = block.bz === -1 ? integer(rand, 2, 4) : integer(rand, 2, 7);
        const h = 3.18 + floors * 3.15;
        wallBatches[family].add(x, h / 2 + .18, z, w, h, d);
        collision.insert(x, z, w, d, h + .18);
        buildings.push({ x, z, w, d, h, family });
        windows(x, z, w, d, floors, family);
        const cap = box(group, roof, x, h + .18, z, w + .16, .18, d + .16);
        cap.receiveShadow = true;
        ledges.add(x, h - .04, z, w + .5, .25, d + .5);
        ledges.add(x, 3.4, z, w + .2, .2, d + .2);
        if (family === 1) {
          ledges.add(x - w / 2, h / 2, z + d / 2 + .07, .38, h, .25);
          ledges.add(x + w / 2, h / 2, z + d / 2 + .07, .38, h, .25);
        }
        roofObjects.push({ x, z, h: h + .28, w, d, rand });
        const shopYaw = qz > 0 ? 0 : Math.PI;
        for (let side = -1; side <= 1; side += 2) {
          const signX = x + side * w / 4;
          storefront(signX, z + qz * (d / 2 + .04), w / 2, shopYaw, localNames[nameCursor++], nameCursor + family * 9);
        }
        // Side entrances face the narrower side streets.
        doorFrames.add(x + qx * (w / 2 + .03), 1.4, z, .12, 2.4, 1.6);
        doorGlass.add(x + qx * (w / 2 + .11), 1.35, z, .08, 2.1, 1.2);
      }
    }
  }

  marks.flush(group);
  yellow.flush(group);
  ledges.flush(group);
  doorFrames.flush(group);
  doorGlass.flush(group);
  wallBatches.forEach(batch => batch.flush(group));
  facadeBatches.forEach(batch => batch.flush(group));
  const props = buildProps(group, collision, blocks, roofObjects);
  const waterfront = buildWaterfront(group, collision);
  return { group, collision, blocks, buildings, shops, props, waterfront };
}
