import * as T from 'three';
import { seeded, between } from './rng.js';

const LIMIT = 72;
const sharedTransform = new T.Object3D();
const BODY = new T.BoxGeometry(1, 1, 1);
const PALETTE = [0x9e634c, 0x738a79, 0xc39f63, 0x647887, 0xa7a393, 0x494e4c, 0xb46e4c];
const ROUTE_CELLS = [
  [-84, -126, 84, -42], [-84, -168, 0, -84], [0, -126, 84, 0],
  [-126, -84, 42, 0], [-42, -168, 84, -84], [-84, -84, 84, 0],
  [-126, -126, -42, -42], [-42, -126, 42, -42], [42, -126, 126, -42],
  [-126, -84, -42, 0], [-42, -84, 42, 0], [42, -84, 126, 0],
];
const colors = palette => palette.map(color => new T.MeshStandardMaterial({ color, roughness: .68, metalness: .13 }));
const wrap = (value, size) => ((value % size) + size) % size;

function normal(dx, dz) {
  const size = Math.hypot(dx, dz) || 1;
  return { x: dz / size, z: -dx / size };
}

function makeRoute(cell, lane, id) {
  const [left, top, right, bottom] = cell;
  let points = [[left, top], [right, top], [right, bottom], [left, bottom]];
  if (id % 2) points = points.reverse();
  const shifted = points.map((point, index) => {
    const before = points[(index + points.length - 1) % points.length];
    const after = points[(index + 1) % points.length];
    const n1 = normal(point[0] - before[0], point[1] - before[1]);
    const n2 = normal(after[0] - point[0], after[1] - point[1]);
    const mx = n1.x + n2.x;
    const mz = n1.z + n2.z;
    const scale = Math.abs(mx * n2.x + mz * n2.z) < .01 ? lane : lane / (mx * n2.x + mz * n2.z);
    return [point[0] + mx * scale, point[1] + mz * scale];
  });
  const legs = [];
  let length = 0;
  shifted.forEach((a, index) => {
    const b = shifted[(index + 1) % shifted.length];
    const span = Math.hypot(b[0] - a[0], b[1] - a[1]);
    legs.push({ a, b, span, start: length, end: length + span });
    length += span;
  });
  return { id, points: shifted, legs, length };
}

function sample(route, distance) {
  const d = wrap(distance, route.length);
  const leg = route.legs.find(item => d < item.end) ?? route.legs[0];
  const t = (d - leg.start) / leg.span;
  const dx = leg.b[0] - leg.a[0];
  const dz = leg.b[1] - leg.a[1];
  return { x: leg.a[0] + dx * t, z: leg.a[1] + dz * t, yaw: Math.atan2(-dx, -dz), leg };
}

function closestDistance(route, x, z) {
  let best = { distance: Infinity, along: 0 };
  for (const leg of route.legs) {
    const dx = leg.b[0] - leg.a[0];
    const dz = leg.b[1] - leg.a[1];
    const t = Math.max(0, Math.min(1, ((x - leg.a[0]) * dx + (z - leg.a[1]) * dz) / (leg.span * leg.span)));
    const px = leg.a[0] + dx * t;
    const pz = leg.a[1] + dz * t;
    const distance = Math.hypot(x - px, z - pz);
    if (distance < best.distance) best = { distance, along: leg.start + t * leg.span };
  }
  return best.along;
}

function place(mesh, index, x, y, z, sx, sy, sz, yaw, color) {
  const object = sharedTransform;
  object.position.set(x, y, z);
  object.scale.set(sx, sy, sz);
  object.rotation.y = yaw;
  object.updateMatrix();
  mesh.setMatrixAt(index, object.matrix);
  if (color !== undefined && mesh.instanceColor) mesh.setColorAt(index, new T.Color(color));
}

function instanced(scene, geometry, material, count, shadow = false) {
  const mesh = new T.InstancedMesh(geometry, material, count);
  mesh.castShadow = shadow;
  mesh.receiveShadow = shadow;
  mesh.frustumCulled = false;
  scene.add(mesh);
  return mesh;
}

export class Traffic {
  constructor(scene, seed = 44071) {
    this.scene = scene;
    const random = seeded(seed);
    const paints = colors(PALETTE);
    const rubber = new T.MeshStandardMaterial({ color: 0x292e2d, roughness: .95 });
    const glass = new T.MeshStandardMaterial({ color: 0x243e42, roughness: .42, metalness: .19 });
    const head = new T.MeshStandardMaterial({ color: 0xeac48b, emissive: 0x4e3421, roughness: .35 });
    const tail = new T.MeshStandardMaterial({ color: 0x933d31, emissive: 0x39130f, roughness: .4 });
    const wheel = instanced(scene, BODY, rubber, LIMIT * 4, true);
    const bodies = instanced(scene, BODY, paints, LIMIT, true);
    const cabins = instanced(scene, BODY, paints, LIMIT, true);
    const windows = instanced(scene, BODY, glass, LIMIT * 4, true);
    const headlights = instanced(scene, BODY, head, LIMIT * 2);
    const tails = instanced(scene, BODY, tail, LIMIT * 2);
    const routes = ROUTE_CELLS.flatMap((cell, index) => [makeRoute(cell, 2.55, index * 2), makeRoute(cell, -2.55, index * 2 + 1)]);
    this.cars = Array.from({ length: LIMIT }, (_, index) => {
      const route = routes[index % routes.length];
      const offset = (index / LIMIT) * route.length + between(random, 0, route.length / 4);
      return {
        id: index, route, distance: wrap(offset, route.length), speed: between(random, 4.2, 8.3),
        targetSpeed: between(random, 5.2, 9.2), color: PALETTE[index % PALETTE.length],
        phase: random() * Math.PI * 2, x: 0, z: 0, yaw: 0, wait: 0, brake: 0,
      };
    });
    this.routes = routes;
    this.parts = { wheel, bodies, cabins, windows, headlights, tails };
    this.elapsed = 0;
    this.leases = new Map();
    this.update(0, { x: 0, z: -42 });
  }

  aheadGap(car) {
    let gap = Infinity;
    for (const other of this.cars) {
      if (other === car || other.route !== car.route) continue;
      const d = wrap(other.distance - car.distance, car.route.length);
      if (d > .1 && d < gap) gap = d;
    }
    return gap;
  }

  leaseJunction(car, now) {
    const position = sample(car.route, car.distance);
    const remaining = position.leg.end - car.distance;
    if (remaining > 9) return false;
    const point = position.leg.b;
    const key = `${Math.round(point[0] / 42)}:${Math.round(point[1] / 42)}`;
    const lease = this.leases.get(key);
    if (lease && lease.expires > now && lease.owner !== car.id && remaining < 5) return true;
    if (remaining < 4.2) this.leases.set(key, { owner: car.id, expires: now + 1.1 });
    return false;
  }

  stream(car, focus) {
    if (Math.hypot(car.x - focus.x, car.z - focus.z) < 230) return;
    let closest = null;
    for (const route of this.routes) {
      const distance = closestDistance(route, focus.x, focus.z);
      const spot = sample(route, distance);
      const gap = Math.hypot(spot.x - focus.x, spot.z - focus.z);
      if (!closest || gap < closest.gap) closest = { route, distance, gap };
    }
    if (closest) {
      car.route = closest.route;
      car.distance = wrap(closest.distance + (car.id % 2 ? -12 : 12), car.route.length);
      car.speed = 0;
    }
  }

  update(dt, focus = { x: 0, z: -42 }) {
    this.elapsed += dt;
    const now = this.elapsed;
    const { wheel, bodies, cabins, windows, headlights, tails } = this.parts;
    for (const car of this.cars) {
      let point = sample(car.route, car.distance);
      this.stream(car, focus);
      point = sample(car.route, car.distance);
      const gap = this.aheadGap(car);
      const safeGap = 8 + car.speed * 1.35;
      const queueFactor = gap < safeGap ? Math.max(.12, (gap - 4.5) / (safeGap - 4.5)) : 1;
      const junctionHold = this.leaseJunction(car, now);
      const pedestrianHold = Math.abs(point.z + 19) < 5 && Math.abs(point.x) < 8 && Math.sin(now * 1.3 + car.id) > .74;
      const desired = junctionHold || pedestrianHold ? 0 : car.targetSpeed * queueFactor;
      const response = desired < car.speed ? 5.8 : 1.15;
      car.speed += Math.max(-response * dt, Math.min(response * dt, desired - car.speed));
      car.wait = car.speed < .5 ? car.wait + dt : 0;
      if (car.wait > 4.5) {
        car.distance = wrap(car.distance + 3.5, car.route.length);
        car.wait = 0;
      }
      car.brake = desired < car.speed - .2;
      car.distance = wrap(car.distance + car.speed * dt, car.route.length);
      point = sample(car.route, car.distance);
      car.x = point.x;
      car.z = point.z;
      car.yaw = point.yaw;
      const bob = Math.sin(now * 3 + car.phase) * .014;
      const index = car.id;
      place(bodies, index, point.x, .68 + bob, point.z, 1.7, .67, 3.85, point.yaw, car.color);
      place(cabins, index, point.x, 1.21 + bob, point.z - .1, 1.4, .56, 1.94, point.yaw, car.color);
      const sx = Math.sin(point.yaw);
      const cz = Math.cos(point.yaw);
      for (const side of [-1, 1]) {
        for (const end of [-1, 1]) {
          const part = index * 4 + (side + 1) + (end + 1) / 2;
          const x = point.x - side * .84 * cz - end * 1.18 * sx;
          const z = point.z + side * .84 * sx - end * 1.18 * cz;
          place(wheel, part, x, .35 + bob, z, .17, .36, .66, point.yaw);
          place(windows, part, point.x - side * .709 * cz + end * .58 * -sx, 1.23 + bob,
            point.z + side * .709 * sx + end * .58 * -cz, .043, .35, .66, point.yaw);
        }
        const lampIndex = index * 2 + (side + 1) / 2;
        place(headlights, lampIndex, point.x - side * .56 * cz + 1.922 * -sx, .7, point.z + side * .56 * sx + 1.922 * -cz, .22, .17, .045, point.yaw);
        place(tails, lampIndex, point.x - side * .56 * cz - 1.922 * -sx, .7, point.z + side * .56 * sx - 1.922 * -cz, .22, .19, .055, point.yaw);
      }
    }
    for (const part of Object.values(this.parts)) part.instanceMatrix.needsUpdate = true;
  }

  scatter(x, z, radius = 25) {
    for (const car of this.cars) {
      if (Math.hypot(car.x - x, car.z - z) < radius) car.targetSpeed = Math.min(car.targetSpeed, 3.5);
    }
  }

  stats() {
    return { count: this.cars.length, moving: this.cars.filter(car => car.speed > .5).length, cars: this.cars };
  }
}
