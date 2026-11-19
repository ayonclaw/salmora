import * as T from 'three';

const CRUISERS = 5;
const BLOCK = new T.BoxGeometry(1, 1, 1);
const spawn = [[-42, 0], [42, -42], [0, -84], [-84, -42], [84, -84]];
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const angleDelta = value => Math.atan2(Math.sin(value), Math.cos(value));

function matrixAt(mesh, index, x, y, z, sx, sy, sz, yaw) {
  const object = new T.Object3D();
  object.position.set(x, y, z);
  object.scale.set(sx, sy, sz);
  object.rotation.y = yaw;
  object.updateMatrix();
  mesh.setMatrixAt(index, object.matrix);
}

function addLine(scene, geometry, material, count) {
  const mesh = new T.InstancedMesh(geometry, material, count);
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

export class Police {
  constructor(scene, { onShot = () => {}, onRam = () => {}, audio = null } = {}) {
    this.scene = scene;
    this.onShot = onShot;
    this.onRam = onRam;
    this.audio = audio;
    this.heat = 0;
    this.stars = 0;
    this.unseen = 0;
    this.shotClock = 0;
    this.sirenClock = 0;
    this.lastCrime = '';
    this.crimes = [];
    this.cruisers = spawn.map(([x, z], index) => ({
      index, x, z, yaw: index % 2 ? Math.PI : 0, speed: 0,
      cooldown: 1.4 + index * .7, ramCooldown: 0, phase: index * 1.7,
    }));
    const bodyMaterial = new T.MeshStandardMaterial({ color: 0xe6e3d7, roughness: .4, metalness: .28 });
    const blueMaterial = new T.MeshStandardMaterial({ color: 0x263e69, roughness: .35, metalness: .22 });
    const glassMaterial = new T.MeshStandardMaterial({ color: 0x1e343b, roughness: .25, metalness: .15 });
    const tireMaterial = new T.MeshStandardMaterial({ color: 0x202625, roughness: .95 });
    const redMaterial = new T.MeshBasicMaterial({ color: 0xff3626, toneMapped: false });
    const blueLight = new T.MeshBasicMaterial({ color: 0x269cff, toneMapped: false });
    const body = addLine(scene, BLOCK, bodyMaterial, CRUISERS);
    const hood = addLine(scene, BLOCK, blueMaterial, CRUISERS);
    const roof = addLine(scene, BLOCK, bodyMaterial, CRUISERS);
    const glass = addLine(scene, BLOCK, glassMaterial, CRUISERS);
    const wheels = addLine(scene, BLOCK, tireMaterial, CRUISERS * 4);
    const red = addLine(scene, BLOCK, redMaterial, CRUISERS);
    const blue = addLine(scene, BLOCK, blueLight, CRUISERS);
    body.frustumCulled = false;
    hood.frustumCulled = false;
    roof.frustumCulled = false;
    glass.frustumCulled = false;
    wheels.frustumCulled = false;
    red.frustumCulled = false;
    blue.frustumCulled = false;
    this.parts = { body, hood, roof, glass, wheels, red, blue };
    this.sync();
  }

  raise(reason = 'public disturbance', amount = 20) {
    this.heat = clamp(this.heat + amount, 0, 100);
    this.stars = Math.min(5, Math.max(1, Math.ceil(this.heat / 20)));
    this.lastCrime = reason;
    this.crimes.push({ reason, time: performance.now(), heat: this.heat });
    if (this.crimes.length > 12) this.crimes.shift();
    this.unseen = 0;
    this.sync();
    return this.stars;
  }

  cool(amount = 18) {
    this.heat = Math.max(0, this.heat - amount);
    this.stars = this.heat < 1 ? 0 : Math.ceil(this.heat / 20);
  }

  hasLineOfSight(player, cruiser) {
    const distance = Math.hypot(player.pos.x - cruiser.x, player.pos.z - cruiser.z);
    if (distance > 62 || player.pos.y > 8) return false;
    const samples = Math.max(2, Math.floor(distance / 5));
    for (let step = 1; step < samples; step++) {
      const t = step / samples;
      if (this.scene.userData.collision?.solid(
        cruiser.x + (player.pos.x - cruiser.x) * t,
        cruiser.z + (player.pos.z - cruiser.z) * t,
        .15,
        1.2 + (player.pos.y - 1.2) * t,
      )) return false;
    }
    return true;
  }

  update(dt, player, world, pedestrians, traffic) {
    const active = this.cruisers.slice(0, this.stars);
    const seen = active.some(cruiser => this.hasLineOfSight(player, cruiser));
    if (this.stars && seen) this.unseen = 0;
    else this.unseen += dt;
    if (this.unseen > 8 && this.heat > 0) {
      this.heat = Math.max(0, this.heat - dt * 1.45);
      this.stars = this.heat < 1 ? 0 : Math.ceil(this.heat / 20);
    }
    this.shotClock += dt;
    this.sirenClock += dt;
    if (this.sirenClock > .12) {
      this.sirenClock = 0;
      this.audio?.updateSiren?.(this.stars, world.camera.position, player.pos);
    }
    for (const cruiser of this.cruisers) {
      cruiser.ramCooldown = Math.max(0, cruiser.ramCooldown - dt);
      const isActive = cruiser.index < this.stars;
      if (isActive) {
        const dx = player.pos.x - cruiser.x;
        const dz = player.pos.z - cruiser.z;
        const distance = Math.hypot(dx, dz);
        const desired = Math.atan2(-dx, -dz);
        const turn = clamp(angleDelta(desired - cruiser.yaw), -1.7 * dt, 1.7 * dt);
        cruiser.yaw += turn;
        const pace = Math.min(15 + this.stars * 1.2, distance * .72);
        cruiser.speed += (pace - cruiser.speed) * (1 - Math.exp(-dt * 1.35));
        if (distance > 4.1) {
          const nextX = cruiser.x - Math.sin(cruiser.yaw) * cruiser.speed * dt;
          const nextZ = cruiser.z - Math.cos(cruiser.yaw) * cruiser.speed * dt;
          if (!world.city.collision.blocked(nextX, nextZ, 1.05, .2)) {
            cruiser.x = nextX;
            cruiser.z = nextZ;
          } else {
            cruiser.yaw += Math.sign(turn || .4) * 1.1 * dt;
            cruiser.speed *= .83;
          }
        } else {
          cruiser.speed *= .7;
          if (cruiser.ramCooldown <= 0) {
            cruiser.ramCooldown = 2.4;
            this.onRam(8 + this.stars * 2);
            pedestrians.scatter(player.pos.x, player.pos.z, 24);
          }
        }
        if (distance < 26 && this.shotClock > Math.max(1.7, 5 - this.stars * .55)) {
          this.shotClock = 0;
          this.onShot(4 + this.stars);
          pedestrians.scatter(player.pos.x, player.pos.z, 16);
        }
        if (distance < 30) traffic.scatter(cruiser.x, cruiser.z, 20);
      } else {
        cruiser.speed = Math.max(0, cruiser.speed - dt * 3);
      }
    }
    this.sync();
  }

  sync() {
    const { body, hood, roof, glass, wheels, red, blue } = this.parts;
    const flash = Math.sin(performance.now() / 95) > 0;
    this.cruisers.forEach((cruiser, index) => {
      const { x, z, yaw } = cruiser;
      const active = this.stars > 0;
      matrixAt(body, index, x, .72, z, 1.82, .72, 4.3, yaw);
      matrixAt(hood, index, x, .86, z - .94, 1.74, .24, 2.18, yaw);
      matrixAt(roof, index, x, 1.25, z + .03, 1.62, .24, 2.12, yaw);
      matrixAt(glass, index, x, 1.3, z + .05, 1.55, .48, 1.82, yaw);
      const sx = Math.sin(yaw);
      const cz = Math.cos(yaw);
      for (let side = -1; side <= 1; side += 2) {
        for (let end = -1; end <= 1; end += 2) {
          const part = index * 4 + (side + 1) + (end + 1) / 2;
          matrixAt(wheels, part, x - side * .94 * cz - end * 1.3 * sx, .37, z + side * .94 * sx - end * 1.3 * cz, .2, .43, .76, yaw);
        }
      }
      matrixAt(red, index, x - .35 * cz, 1.69, z + .02 + .35 * sx, .72, .25, .36, yaw);
      matrixAt(blue, index, x + .35 * cz, 1.69, z + .02 - .35 * sx, .72, .25, .36, yaw);
      red.material.opacity = active && flash ? 1 : active ? .15 : .07;
      blue.material.opacity = active && !flash ? 1 : active ? .15 : .07;
      red.material.transparent = true;
      blue.material.transparent = true;
    });
    for (const mesh of Object.values(this.parts)) mesh.instanceMatrix.needsUpdate = true;
  }

  status() {
    return { stars: this.stars, heat: Math.round(this.heat), unseen: this.unseen, crime: this.lastCrime };
  }
}
