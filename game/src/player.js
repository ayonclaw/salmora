import * as T from 'three';
import { START, WALK } from './config.js';
import { box, mesh, sphere, standard } from './geometry.js';
import { shadowTexture } from './textures.js';

function outfit() {
  const body = new T.Group();
  const coat = standard(0xad683d);
  const cuffs = standard(0x553b35);
  const pants = standard(0x233c43);
  const sole = standard(0x292b29);
  const skin = standard(0xa86f50);
  const hair = standard(0x312820);
  const canvas = standard(0xb69c72);
  const buckle = standard(0x6a7063, { metalness: .35 });

  box(body, coat, 0, 1.17, 0, .43, .45, .27);
  box(body, cuffs, 0, .96, 0, .39, .1, .27);
  box(body, coat, 0, 1.36, .015, .4, .12, .28);
  mesh(body, sphere, skin, 0, 1.52, -.015, .245, .28, .234);
  mesh(body, sphere, hair, 0, 1.6, .002, .259, .182, .241);
  box(body, hair, 0, 1.574, -.112, .21, .035, .14);
  box(body, skin, 0, 1.4, -.01, .13, .11, .13);
  box(body, canvas, 0, 1.14, .179, .29, .35, .142);
  box(body, buckle, 0, 1.12, .253, .082, .067, .024);
  for (const side of [-1, 1]) {
    box(body, canvas, side * .146, 1.26, -.137, .052, .23, .027);
    box(body, canvas, side * .142, 1.315, .017, .049, .07, .32);
  }
  const legs = [];
  const arms = [];
  for (const side of [-1, 1]) {
    const leg = new T.Group();
    leg.position.set(side * .103, .91, 0);
    body.add(leg);
    box(leg, pants, 0, -.39, 0, .165, .76, .163);
    box(leg, sole, 0, -.819, -.043, .181, .166, .252);
    box(leg, canvas, 0, -.866, -.047, .185, .048, .252);
    legs.push(leg);
    const arm = new T.Group();
    arm.position.set(side * .24, 1.342, 0);
    arm.rotation.z = side * .07;
    body.add(arm);
    box(arm, coat, 0, -.196, 0, .126, .39, .159);
    box(arm, cuffs, 0, -.381, 0, .12, .061, .136);
    box(arm, skin, 0, -.433, -.013, .098, .08, .115);
    arms.push(arm);
  }
  body.traverse(o => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return { body, arms, legs };
}

const wrap = angle => Math.atan2(Math.sin(angle), Math.cos(angle));

export class Player {
  pos = new T.Vector3();
  yaw = START.yaw;
  vy = 0;
  gait = 0;
  stride = 0;
  cash = 80;
  health = 100;
  grounded = true;
  seated = false;

  constructor(scene, collision) {
    this.collision = collision;
    this.model = outfit();
    scene.add(this.model.body);
    const shade = new T.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    this.shadow = new T.Mesh(new T.PlaneGeometry(1.45, 1.25), shade);
    this.shadow.rotation.x = -Math.PI / 2;
    scene.add(this.shadow);
    this.reset();
  }

  reset() {
    this.exit(START.x, START.z, START.yaw);
    this.gait = this.stride = 0;
    this.cash = 80;
    this.health = 100;
  }

  enter() {
    this.seated = true;
    this.vy = 0;
    this.sync();
  }

  exit(x, z, yaw) {
    this.seated = false;
    this.pos.set(x, this.collision.height(x, z), z);
    this.yaw = yaw;
    this.vy = 0;
    this.grounded = true;
    this.sync();
  }

  update(dt, input, viewYaw, extra) {
    const { forward, side } = input.axes();
    const norm = Math.max(1, Math.hypot(forward, side));
    const sprint = input.down('ShiftLeft', 'ShiftRight');
    const speed = (sprint ? WALK.sprint : WALK.pace) / norm;
    const sin = Math.sin(viewYaw);
    const cos = Math.cos(viewYaw);
    const dx = (-sin * forward + cos * side) * speed;
    const dz = (-cos * forward - sin * side) * speed;
    if (input.take('Space') && this.grounded) {
      this.vy = WALK.jump;
      this.grounded = false;
    }
    const oldX = this.pos.x;
    const oldZ = this.pos.z;
    this.collision.slide(this.pos, dx * dt, dz * dt, WALK.radius, extra);
    const moved = Math.hypot(this.pos.x - oldX, this.pos.z - oldZ);
    if (moved > .001) {
      const target = Math.atan2(-dx, -dz);
      this.yaw += wrap(target - this.yaw) * (1 - Math.exp(-dt * 18));
      this.gait += moved * 3.9;
    }
    const floor = this.collision.height(this.pos.x, this.pos.z);
    this.vy -= WALK.gravity * dt;
    this.pos.y += this.vy * dt;
    this.grounded = this.pos.y <= floor;
    if (this.grounded) {
      this.pos.y = floor;
      this.vy = 0;
    }
    this.stride += ((moved > .001 && this.grounded ? (sprint ? .79 : .51) : 0) - this.stride) * (1 - Math.exp(-dt * 14));
    this.sync();
  }

  sync() {
    const { body, arms, legs } = this.model;
    body.visible = this.shadow.visible = !this.seated;
    body.position.copy(this.pos);
    body.position.y += Math.abs(Math.sin(this.gait)) * this.stride * .065;
    body.rotation.y = this.yaw;
    arms.forEach((arm, ix) => arm.rotation.x = Math.sin(this.gait + ix * Math.PI) * this.stride * .72);
    legs.forEach((leg, ix) => leg.rotation.x = -Math.sin(this.gait + ix * Math.PI) * this.stride);
    this.shadow.position.set(this.pos.x, this.collision.height(this.pos.x, this.pos.z) + .015, this.pos.z);
    this.shadow.material.opacity = Math.max(.16, .88 - (this.pos.y - this.shadow.position.y) * .46);
  }
}
