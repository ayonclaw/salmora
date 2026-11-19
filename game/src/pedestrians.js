import * as T from 'three';
import { seeded, between, integer, pick } from './rng.js';
import { cube, standard } from './geometry.js';

const COUNT = 180;
const skinMats = [0x986648, 0xc08862, 0x694d40, 0xb17a55, 0x805744, 0xd1a17c].map(color => standard(color));
const clothes = [0x365a54, 0xaa674c, 0x6b6d84, 0x473a39, 0x9a8662, 0x3d6572, 0xa38b77].map(color => standard(color));
const trousers = [0x333d45, 0x4b5045, 0x403b3b, 0x667067].map(color => standard(color));
const hairMats = [0x3a2b25, 0x6d4c32, 0x292628, 0x84704c].map(color => standard(color));
const FORMS = {
  body: new T.BoxGeometry(.52, .64, .32),
  head: new T.SphereGeometry(.2, 9, 7),
  legs: new T.BoxGeometry(.17, .57, .19),
  feet: new T.BoxGeometry(.2, .12, .27),
  arms: new T.BoxGeometry(.145, .49, .16),
  hair: new T.SphereGeometry(.213, 8, 5),
  cap: new T.CylinderGeometry(.19, .21, .12, 8),
};
const sidewalkNodes = [
  [-101, -126], [-72, -126], [-30, -126], [30, -126], [73, -126],
  [84, -111], [84, -73], [84, -31], [84, -4],
  [72, -84], [42, -84], [6, -84], [-29, -84], [-74, -84],
  [-84, -69], [-84, -30], [-84, -4],
  [-73, -42], [-36, -42], [0, -42], [38, -42], [73, -42],
  [0, -19], [40, -18], [72, -16],
  [-5, -12], [5, -12], [-8, -24], [8, -24],
  [-10, -3], [10, -3], [-3, 9], [3, 9],
  [-16, -41], [-10, -44], [10, -40], [16, -43],
  [-12, -83], [12, -83], [-83, -95], [-80, -73],
  [-16, 14], [16, 15], [-13, 31], [13, 32], [0, 45], [0, 50],
  [-34, -40], [34, -40], [-45, -82], [45, -82],
];

function positionOn(a, b, t) {
  return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t };
}

const sharedTransform = new T.Object3D();

function buildLine(scene, geometry, material, count) {
  const mesh = new T.InstancedMesh(geometry, material, count);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  scene.add(mesh);
  return mesh;
}

function setPart(mesh, i, position, scale, yaw = 0, sway = 0) {
  const object = sharedTransform;
  object.position.set(position.x, position.y ?? scale[1] / 2 + .18, position.z);
  object.scale.set(...scale);
  object.rotation.y = yaw;
  object.rotation.z = sway;
  object.updateMatrix();
  mesh.setMatrixAt(i, object.matrix);
}

function routeFor(index) {
  const start = index % sidewalkNodes.length;
  const length = 8 + index % 11;
  return Array.from({ length }, (_, step) => sidewalkNodes[(start + step * (index % 4 + 1)) % sidewalkNodes.length]);
}

export class Pedestrians {
  constructor(scene, seed = 90411) {
    this.scene = scene;
    this.rand = seeded(seed);
    this.people = Array.from({ length: COUNT }, (_, i) => {
      const route = routeFor(i);
      const start = integer(this.rand, 0, route.length - 1);
      if (i % 2) route.reverse();
      return {
        route, leg: start, t: this.rand(), speed: between(this.rand, .38, 1.03),
        phase: between(this.rand, 0, Math.PI * 2), pause: between(this.rand, 0, 3),
        color: pick(this.rand, clothes), trousers: pick(this.rand, trousers),
        skin: pick(this.rand, skinMats), hair: pick(this.rand, hairMats),
        x: 0, z: 0, yaw: 0, fleeX: 0, fleeZ: 0, fleeing: 0,
      };
    });
    this.meshes = {
      body: buildLine(scene, FORMS.body, clothes[0], COUNT),
      head: buildLine(scene, FORMS.head, skinMats[0], COUNT),
      leftLeg: buildLine(scene, FORMS.legs, trousers[0], COUNT),
      rightLeg: buildLine(scene, FORMS.legs, trousers[1], COUNT),
      leftFoot: buildLine(scene, FORMS.feet, standard(0x35322d), COUNT),
      rightFoot: buildLine(scene, FORMS.feet, standard(0x3d3530), COUNT),
      leftArm: buildLine(scene, FORMS.arms, clothes[0], COUNT),
      rightArm: buildLine(scene, FORMS.arms, clothes[0], COUNT),
      hair: buildLine(scene, FORMS.hair, hairMats[0], COUNT),
      cap: buildLine(scene, FORMS.cap, standard(0x564434), COUNT),
    };
    this.time = 0;
    this.update(0);
  }

  advance(person, distance) {
    let rest = distance;
    let safety = person.route.length + 1;
    while (rest > 0 && safety-- > 0) {
      const a = person.route[person.leg];
      const b = person.route[(person.leg + 1) % person.route.length];
      const legLength = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const onLeg = person.t * legLength;
      const step = Math.min(rest, legLength - onLeg);
      person.t = (onLeg + step) / legLength;
      rest -= step;
      if (person.t >= .9999) {
        person.leg = (person.leg + 1) % person.route.length;
        person.t = 0;
      }
    }
  }

  scatter(x, z, radius = 18) {
    for (const person of this.people) {
      const dx = person.x - x;
      const dz = person.z - z;
      if (Math.hypot(dx, dz) > radius) continue;
      const length = Math.hypot(dx, dz) || 1;
      person.fleeX = person.x + dx / length * (radius + 9);
      person.fleeZ = person.z + dz / length * (radius + 9);
      person.fleeing = 5.5;
      person.pause = 0;
    }
  }

  update(dt) {
    this.time += dt;
    this.people.forEach((person, index) => {
      if (person.fleeing > 0) {
        person.fleeing -= dt;
        const dx = person.fleeX - person.x;
        const dz = person.fleeZ - person.z;
        const distance = Math.hypot(dx, dz);
        if (distance > .35) {
          person.x += dx / distance * Math.min(distance, person.speed * 2.2 * dt);
          person.z += dz / distance * Math.min(distance, person.speed * 2.2 * dt);
          person.yaw = Math.atan2(dx, dz);
        }
      } else {
        if (person.pause > 0) person.pause -= dt;
        else this.advance(person, person.speed * dt);
        const a = person.route[person.leg];
        const b = person.route[(person.leg + 1) % person.route.length];
        const at = positionOn(a, b, person.t);
        const next = positionOn(a, b, Math.min(.999, person.t + .02));
        person.x = at.x;
        person.z = at.z;
        person.yaw = Math.atan2(next.x - at.x, next.z - at.z);
      }
      const gait = this.time * person.speed * 6 + person.phase;
      const swing = Math.sin(gait) * (person.fleeing > 0 ? .48 : .34);
      const bob = Math.abs(Math.sin(gait)) * .075;
      const angle = person.yaw;
      const frontX = Math.sin(angle);
      const frontZ = Math.cos(angle);
      const sideX = Math.cos(angle);
      const sideZ = -Math.sin(angle);
      const offset = (x, z, y) => ({ x: person.x + sideX * x + frontX * z, y: y + bob, z: person.z + sideZ * x + frontZ * z });
      const i = index;
      setPart(this.meshes.body, i, { x: person.x, y: 1.13 + bob, z: person.z }, [.52, .64, .32], angle);
      this.meshes.body.setColorAt(i, person.color.color);
      setPart(this.meshes.head, i, offset(0, .03, 1.69), [1, 1.06, .98], angle);
      this.meshes.head.setColorAt(i, person.skin.color);
      setPart(this.meshes.hair, i, offset(0, -.015, 1.79), [1.05, .58, 1.03], angle);
      this.meshes.hair.setColorAt(i, person.hair.color);
      setPart(this.meshes.cap, i, offset(0, 0, 1.91), [1, 1, 1], angle);
      this.meshes.cap.setColorAt(i, i % 3 ? person.color.color : new T.Color(0x564434));
      setPart(this.meshes.leftLeg, i, offset(-.14, 0, .57), [.17, .57, .19], angle, swing);
      setPart(this.meshes.rightLeg, i, offset(.14, 0, .57), [.17, .57, .19], angle, -swing);
      setPart(this.meshes.leftFoot, i, offset(-.14, .08, .26), [.2, .12, .27], angle, swing);
      setPart(this.meshes.rightFoot, i, offset(.14, .08, .26), [.2, .12, .27], angle, -swing);
      setPart(this.meshes.leftArm, i, offset(-.34, 0, 1.28), [.145, .49, .16], angle, -swing);
      this.meshes.leftArm.setColorAt(i, person.color.color);
      setPart(this.meshes.rightArm, i, offset(.34, 0, 1.28), [.145, .49, .16], angle, swing);
      this.meshes.rightArm.setColorAt(i, person.color.color);
    });
    for (const mesh of Object.values(this.meshes)) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  stats() {
    return { count: this.people.length, moving: this.people.filter(person => person.speed > 0 && person.pause <= 0).length, people: this.people };
  }
}
