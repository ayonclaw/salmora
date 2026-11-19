import * as T from 'three';
import { seeded, between } from './rng.js';

const shape = new T.BoxGeometry(1, 1, 1);
const paint = colors => colors.map(color => new T.MeshStandardMaterial({
  color, roughness: .68, metalness: .13,
}));

const route = [
  [-84, -126], [84, -126], [84, -42], [-84, -42],
];

function buildRoute(lane) {
  const points = route.map(([x, z]) => {
    const dx = x - 84;
    const dz = z + 84;
    const sign = dx === 0 ? 1 : Math.sign(dx);
    const signZ = dz === 0 ? 1 : Math.sign(dz);
    return [x + (Math.abs(dz) < 1 ? -signZ * lane : 0), z + (Math.abs(dx) < 1 ? sign * lane : 0)];
  });
  const legs = [];
  let distance = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    legs.push({ a, b, length, start: distance });
    distance += length;
  }
  return { legs, length: distance };
}

function sample(route, distance) {
  const wrapped = ((distance % route.length) + route.length) % route.length;
  const leg = route.legs.find(item => wrapped < item.start + item.length) ?? route.legs.at(-1);
  const t = (wrapped - leg.start) / leg.length;
  const dx = leg.b[0] - leg.a[0];
  const dz = leg.b[1] - leg.a[1];
  return {
    x: leg.a[0] + dx * t,
    z: leg.a[1] + dz * t,
    yaw: Math.atan2(-dx, -dz),
  };
}

function addPart(mesh, index, x, y, z, sx, sy, sz, yaw, color = null) {
  const dummy = new T.Object3D();
  dummy.position.set(x, y, z);
  dummy.scale.set(sx, sy, sz);
  dummy.rotation.y = yaw;
  dummy.updateMatrix();
  mesh.setMatrixAt(index, dummy.matrix);
  if (color !== null) mesh.setColorAt(index, new T.Color(color));
}

export class Traffic {
  constructor(scene, seed = 44071) {
    const rand = seeded(seed);
    const carPaint = paint([0x9e634c, 0x738a79, 0xc39f63, 0x647887, 0xa7a393, 0x494e4c, 0xb46e4c]);
    const tire = new T.MeshStandardMaterial({ color: 0x292e2d, roughness: .95 });
    const window = new T.MeshStandardMaterial({ color: 0x243e42, roughness: .42, metalness: .19 });
    const lamps = new T.MeshStandardMaterial({ color: 0xeac48b, emissive: 0x4e3421, roughness: .35 });
    const red = new T.MeshStandardMaterial({ color: 0x933d31, emissive: 0x39130f, roughness: .4 });
    const wheel = new T.InstancedMesh(shape, tire, 4 * 12);
    const bodies = new T.InstancedMesh(shape, carPaint, 12);
    const cabins = new T.InstancedMesh(shape, carPaint, 12);
    const windows = new T.InstancedMesh(shape, window, 4 * 12);
    const headlights = new T.InstancedMesh(shape, lamps, 2 * 12);
    const tails = new T.InstancedMesh(shape, red, 2 * 12);
    const all = [wheel, bodies, cabins, windows, headlights, tails];
    for (const item of all) {
      item.castShadow = true;
      item.receiveShadow = true;
      scene.add(item);
    }
    const upper = buildRoute(-2.7);
    const lower = buildRoute(2.7);
    this.cars = Array.from({ length: 12 }, (_, i) => ({
      route: i % 2 ? upper : lower,
      distance: between(rand, 0, 1) * (i % 2 ? upper.length : lower.length),
      speed: between(rand, 3.5, 6.8),
      color: i % carPaint.length,
      phase: rand() * Math.PI * 2,
    }));
    this.parts = { wheel, bodies, cabins, windows, headlights, tails };
    this.elapsed = 0;
    this.update(0);
  }

  update(dt) {
    this.elapsed += dt;
    const { wheel, bodies, cabins, windows, headlights, tails } = this.parts;
    let i = 0;
    for (let index = 0; index < this.cars.length; index++) {
      const car = this.cars[index];
      const p = sample(car.route, car.distance + this.elapsed * car.speed);
      const bob = Math.sin(this.elapsed * 3 + car.phase) * .014;
      addPart(bodies, index, p.x, .68 + bob, p.z, 1.7, .67, 3.85, p.yaw, [0x9e634c, 0x738a79, 0xc39f63, 0x647887, 0xa7a393, 0x494e4c, 0xb46e4c][car.color]);
      addPart(cabins, index, p.x, 1.21 + bob, p.z - .1, 1.4, .56, 1.94, p.yaw, [0x9e634c, 0x738a79, 0xc39f63, 0x647887, 0xa7a393, 0x494e4c, 0xb46e4c][car.color]);
      const sx = Math.sin(p.yaw);
      const cz = Math.cos(p.yaw);
      for (const side of [-1, 1]) {
        for (const end of [-1, 1]) {
          const x = p.x - side * .84 * cz - end * 1.18 * sx;
          const z = p.z + side * .84 * sx - end * 1.18 * cz;
          addPart(wheel, i, x, .35 + bob, z, .17, .36, .66, p.yaw);
        }
        const sideX = p.x - side * .709 * cz;
        const sideZ = p.z + side * .709 * sx;
        for (const end of [-1, 1]) {
          addPart(windows, i++, sideX + end * .58 * -sx, 1.23 + bob, sideZ + end * .58 * -cz, .043, .35, .66, p.yaw);
        }
        addPart(headlights, index * 2 + (side + 1) / 2, p.x - side * .56 * cz + 1.922 * -sx, .7, p.z + side * .56 * sx + 1.922 * -cz, .22, .17, .045, p.yaw);
        addPart(tails, index * 2 + (side + 1) / 2, p.x - side * .56 * cz - 1.922 * -sx, .7, p.z + side * .56 * sx - 1.922 * -cz, .22, .19, .055, p.yaw);
      }
    }
    for (const item of Object.values(this.parts)) item.instanceMatrix.needsUpdate = true;
  }
}
