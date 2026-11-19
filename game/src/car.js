import * as T from 'three';
import { PARKED, WAGON, WALK } from './config.js';
import { box, mesh, standard } from './geometry.js';
import { shadowTexture } from './textures.js';

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const approach = (n, goal, delta) => n + clamp(goal - n, -delta, delta);
const wheelZ = WAGON.wheelbase / 2;

function profile(x, width, outline, material, group) {
  const shape = new T.Shape();
  outline.forEach(([z, y], i) => i ? shape.lineTo(-z, y) : shape.moveTo(-z, y));
  shape.closePath();
  const geometry = new T.ExtrudeGeometry(shape, { depth: width, steps: 1, bevelSegments: 1, bevelThickness: .035, bevelSize: .035 });
  const hull = mesh(group, geometry, material, x - width / 2, 0, 0);
  hull.rotation.y = Math.PI / 2;
  return hull;
}

function wagonMesh() {
  const root = new T.Group();
  const body = new T.Group();
  root.add(body);
  const paint = standard(0x38776d, { roughness: .34, metalness: .26 });
  const roof = standard(0xd6b984, { roughness: .59 });
  const chrome = standard(0xb6b5a5, { roughness: .36, metalness: .65 });
  const rubber = standard(0x252b29);
  const glass = standard(0x273f46, { roughness: .21, metalness: .43 });
  const gasket = standard(0x29322d);
  const ivory = standard(0xfce4b3, { emissive: 0xe7bd6e, emissiveIntensity: .54 });
  const cherry = standard(0xa23731, { emissive: 0x982918, emissiveIntensity: .42 });
  const amber = standard(0xdd9234, { emissive: 0xad561d, emissiveIntensity: .32 });

  profile(0, 1.74, [
    [-2.28, .48], [-2.32, .79], [-2.15, .96], [-1.1, 1.04],
    [1.98, 1.02], [2.23, .88], [2.25, .49],
  ], paint, body);
  profile(0, 1.61, [
    [-1.1, 1.02], [-.53, 1.65], [-.32, 1.7],
    [1.63, 1.7], [1.88, 1.56], [2.02, 1.01],
  ], roof, body);
  profile(0, 1.625, [[-1.01, 1.105], [-.51, 1.625], [1.63, 1.625], [1.91, 1.104]], glass, body);
  for (const side of [-1, 1]) {
    const x = side * .825;
    box(body, roof, x, 1.365, .35, .044, .55, .105);
    box(body, roof, x, 1.376, 1.34, .048, .53, .072);
    box(body, chrome, x, 1.08, .43, .056, .047, 2.91);
    box(body, chrome, side * .882, .809, .82, .035, .036, 2.8);
    box(body, chrome, side * .891, .948, .095, .051, .048, .21);
    box(body, chrome, side * .89, .948, 1.09, .051, .048, .21);
    box(body, gasket, side * .994, 1.087, -.887, .244, .064, .074);
    box(body, paint, side * 1.027, 1.113, -.911, .146, .134, .139);
    box(body, chrome, side * 1.027, 1.124, -.835, .124, .098, .024);
    box(body, ivory, side * .654, .798, -2.324, .38, .19, .048);
    box(body, amber, side * .753, .638, -2.329, .16, .092, .041);
    box(body, cherry, side * .737, .804, 2.237, .226, .206, .063);
    box(body, amber, side * .737, .901, 2.26, .226, .064, .031);
    box(body, chrome, side * .65, 1.755, .66, .043, .05, 1.83);
  }
  const windshield = box(body, glass, 0, 1.367, -.814, 1.485, .692, .041);
  windshield.rotation.x = .8;
  const rear = box(body, glass, 0, 1.353, 1.88, 1.415, .535, .052);
  rear.rotation.x = -.37;
  box(body, gasket, 0, .79, -2.343, .802, .185, .055);
  for (const dy of [-.058, 0, .058]) box(body, chrome, 0, .79 + dy, -2.375, .76, .015, .016);
  box(body, chrome, 0, .484, -2.28, 1.83, .136, .23);
  box(body, chrome, 0, .484, 2.226, 1.83, .136, .237);
  box(body, gasket, 0, .55, 2.342, 1.52, .055, .033);
  const plateCanvas = document.createElement('canvas');
  plateCanvas.width = 128;
  plateCanvas.height = 48;
  const ctx = plateCanvas.getContext('2d');
  ctx.fillStyle = '#f2dfac';
  ctx.fillRect(0, 0, 128, 48);
  ctx.fillStyle = '#263a34';
  ctx.font = 'bold 25px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('SQ 072', 64, 33);
  const plate = new T.CanvasTexture(plateCanvas);
  plate.colorSpace = T.SRGBColorSpace;
  const label = mesh(body, new T.PlaneGeometry(.34, .127), standard(0xffffff, { map: plate }), 0, .704, 2.274);
  label.name = 'Quay registration';

  const wheels = [];
  const tire = new T.CylinderGeometry(.42, .42, .265, 18);
  const rim = new T.CylinderGeometry(.268, .268, .285, 16);
  const lug = new T.CylinderGeometry(.092, .092, .306, 10);
  for (const z of [-wheelZ, wheelZ]) {
    for (const side of [-1, 1]) {
      const pivot = new T.Group();
      pivot.position.set(side * .811, .423, z);
      root.add(pivot);
      const roll = new T.Group();
      pivot.add(roll);
      for (const [geo, mat] of [[tire, rubber], [rim, chrome], [lug, gasket]]) {
        mesh(roll, geo, mat, 0, 0, 0).rotation.z = Math.PI / 2;
      }
      for (let i = 0; i < 6; i++) {
        const angle = i * Math.PI / 3;
        const slot = box(roll, gasket, side * .15, Math.sin(angle) * .176, Math.cos(angle) * .176, .018, .051, .071);
        slot.rotation.x = -angle;
      }
      wheels.push({ pivot, roll, front: z < 0 });
    }
  }
  root.traverse(o => {
    if (o.isMesh) o.castShadow = o.receiveShadow = true;
  });
  return { root, body, wheels, cherry };
}

export class Car {
  pos = new T.Vector3();
  yaw = PARKED.yaw;
  speed = 0;
  steering = 0;
  roll = 0;
  occupied = false;
  braking = false;

  constructor(scene, collision) {
    this.collision = collision;
    this.vehicleObstacle = { x: 0, z: 0, w: 1.95, d: 4.7 };
    const { x, z } = PARKED;
    const forwardX = -Math.sin(PARKED.yaw);
    const forwardZ = -Math.cos(PARKED.yaw);
    this.vehicleObstacle.x = x + forwardX * .45;
    this.vehicleObstacle.z = z + forwardZ * .45;
    this.model = wagonMesh();
    this.shadow = new T.Mesh(new T.PlaneGeometry(3.6, 6.2), new T.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }));
    this.shadow.rotation.order = 'YXZ';
    this.shadow.rotation.x = -Math.PI / 2;
    scene.add(this.model.root, this.shadow);
    this.reset();
  }

  reset() {
    this.pos.set(PARKED.x, this.collision.height(PARKED.x, PARKED.z), PARKED.z);
    this.yaw = PARKED.yaw;
    this.speed = this.steering = this.roll = 0;
    this.braking = this.occupied = false;
    this.sync();
  }

  contains(x, z, padding = WALK.radius) {
    const dx = x - this.pos.x;
    const dz = z - this.pos.z;
    const c = Math.cos(this.yaw);
    const s = Math.sin(this.yaw);
    return Math.abs(dx * c - dz * s) < .97 + padding && Math.abs(dx * s + dz * c) < 2.34 + padding;
  }

  overlaps(x, z, yaw, margin = .14) {
    const dx = x - this.vehicleObstacle.x;
    const dz = z - this.vehicleObstacle.z;
    const a = Math.abs(Math.sin(yaw)) * 2.35 + Math.abs(Math.sin(this.yaw)) * .975 + margin;
    const b = Math.abs(Math.cos(yaw)) * 2.35 + Math.abs(Math.cos(this.yaw)) * .975 + margin;
    return Math.abs(dx) < a && Math.abs(dz) < b;
  }

  distanceTo(point) {
    return Math.hypot(point.x - this.pos.x, point.z - this.pos.z);
  }

  exitSpot() {
    const c = Math.cos(this.yaw);
    const s = Math.sin(this.yaw);
    for (const [right, back] of [[-1.63, -.59], [1.63, -.59], [-1.63, .9], [1.63, .9], [0, 2.82], [0, -2.82]]) {
      const x = this.pos.x + right * c + back * s;
      const z = this.pos.z - right * s + back * c;
      if (!this.collision.blocked(x, z, WALK.radius, this.collision.height(x, z))) return { x, z };
    }
    return null;
  }

  canRoll(x, z, yaw) {
    const s = Math.sin(yaw);
    const c = Math.cos(yaw);
    for (const end of [-1.32, 0, 1.32]) {
      if (this.collision.blocked(x + end * s, z + end * c, WAGON.radius, this.pos.y)) return false;
    }
    return true;
  }

  update(dt, input) {
    const { forward, side } = input.axes();
    const brake = input.down('Space');
    const opposing = forward !== 0 && Math.abs(this.speed) > .12 && Math.sign(this.speed) !== forward;
    this.braking = brake || opposing;
    if (this.braking) this.speed = approach(this.speed, 0, WAGON.brake * dt);
    else if (forward) {
      const cap = forward > 0 ? WAGON.topSpeed : WAGON.reverseSpeed;
      const pull = WAGON.acceleration * (1 - .62 * Math.abs(this.speed) / cap);
      this.speed = clamp(this.speed + forward * pull * dt, -WAGON.reverseSpeed, WAGON.topSpeed);
    } else this.speed = approach(this.speed, 0, WAGON.coast * dt);
    const maxSteer = WAGON.steer / (1 + Math.abs(this.speed) * .055);
    this.steering = approach(this.steering, -side * maxSteer, 3.7 * dt);
    const dYaw = this.speed * Math.tan(this.steering) / WAGON.wheelbase * dt;
    const midYaw = this.yaw + dYaw / 2;
    const yaw = this.yaw + dYaw;
    const travel = this.speed * dt;
    const x = this.pos.x - Math.sin(midYaw) * travel;
    const z = this.pos.z - Math.cos(midYaw) * travel;
    if (this.canRoll(x, z, yaw)) {
      this.pos.x = x;
      this.pos.z = z;
      this.yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
      this.roll = (this.roll - travel / .42) % (Math.PI * 2);
    } else {
      this.speed = 0;
    }
    this.pos.y += (this.collision.height(this.pos.x, this.pos.z) - this.pos.y) * (1 - Math.exp(-dt * 14));
    this.sync();
  }

  sync() {
    const { root, body, wheels, cherry } = this.model;
    root.position.copy(this.pos);
    root.rotation.y = this.yaw;
    body.rotation.z = clamp(this.speed * this.steering * -.013, -.09, .09);
    for (const { pivot, roll, front } of wheels) {
      pivot.rotation.y = front ? this.steering : 0;
      roll.rotation.x = this.roll;
    }
    cherry.emissiveIntensity = this.braking ? 1.36 : .42;
    this.shadow.position.set(this.pos.x, this.collision.height(this.pos.x, this.pos.z) + .023, this.pos.z);
    this.shadow.rotation.y = this.yaw;
  }
}
