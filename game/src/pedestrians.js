import * as T from 'three';
import { seeded, between, integer, pick } from './rng.js';
import { cube, standard } from './geometry.js';

const skinMats = [0x986648, 0xc08862, 0x694d40, 0xb17a55, 0x805744, 0xd1a17c].map(color => standard(color));
const clothes = [0x365a54, 0xaa674c, 0x6b6d84, 0x473a39, 0x9a8662, 0x3d6572, 0xa38b77].map(color => standard(color));
const trousers = [0x333d45, 0x4b5045, 0x403b3b, 0x667067].map(color => standard(color));
const hairMats = [0x3a2b25, 0x6d4c32, 0x292628, 0x84704c].map(color => standard(color));
const forms = {
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
];

function positionOn(a, b, t) {
  return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t };
}

function buildLine(scene, geometry, material, count) {
  const mesh = new T.InstancedMesh(geometry, material, count);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function setPart(mesh, i, position, scale, yaw = 0, sway = 0) {
  const o = new T.Object3D();
  o.position.set(position.x, position.y ?? scale[1] / 2 + .18, position.z);
  o.scale.set(...scale);
  o.rotation.y = yaw;
  o.rotation.z = sway;
  o.updateMatrix();
  mesh.setMatrixAt(i, o.matrix);
}

export class Pedestrians {
  constructor(scene, seed = 90411) {
    this.scene = scene;
    this.rand = seeded(seed);
    this.people = Array.from({ length: 32 }, (_, i) => {
      const route = sidewalkNodes.slice(i % 7).concat(sidewalkNodes.slice(0, i % 7));
      let start = integer(this.rand, 0, route.length - 1);
      if (i % 2) route.reverse();
      return {
        route,
        leg: start,
        t: this.rand(),
        speed: between(this.rand, .38, 1.03),
        direction: integer(this.rand, 0, 1) ? 1 : -1,
        phase: between(this.rand, 0, Math.PI * 2),
        pause: between(this.rand, 0, 3),
        color: pick(this.rand, clothes),
        trousers: pick(this.rand, trousers),
        skin: pick(this.rand, skinMats),
        hair: pick(this.rand, hairMats),
        x: 0,
        z: 0,
        yaw: 0,
      };
    });
    this.meshes = {
      body: buildLine(scene, forms.body, clothes[0], 32),
      head: buildLine(scene, forms.head, skinMats[0], 32),
      leftLeg: buildLine(scene, forms.legs, trousers[0], 32),
      rightLeg: buildLine(scene, forms.legs, trousers[1], 32),
      leftFoot: buildLine(scene, forms.feet, standard(0x35322d), 32),
      rightFoot: buildLine(scene, forms.feet, standard(0x3d3530), 32),
      leftArm: buildLine(scene, forms.arms, clothes[0], 32),
      rightArm: buildLine(scene, forms.arms, clothes[0], 32),
      hair: buildLine(scene, forms.hair, hairMats[0], 32),
      cap: buildLine(scene, forms.cap, standard(0x564434), 32),
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

  update(dt) {
    this.time += dt;
    this.people.forEach((p, i) => {
      if (p.pause > 0) p.pause -= dt;
      else this.advance(p, p.speed * dt);
      const a = p.route[p.leg];
      const b = p.route[(p.leg + 1) % p.route.length];
      const at = positionOn(a, b, p.t);
      const next = positionOn(a, b, Math.min(.999, p.t + .02));
      const dx = next.x - at.x;
      const dz = next.z - at.z;
      p.x = at.x;
      p.z = at.z;
      p.yaw = Math.atan2(dx, dz);
      const gait = this.time * p.speed * 6 + p.phase;
      const swing = Math.sin(gait) * .34;
      const bob = Math.abs(Math.sin(gait)) * .075;
      const hip = { x: p.x, y: .91 + bob, z: p.z };
      const shoulder = { x: p.x, y: 1.39 + bob, z: p.z };
      const angle = p.yaw;
      const frontX = Math.sin(angle);
      const frontZ = Math.cos(angle);
      const sideX = Math.cos(angle);
      const sideZ = -Math.sin(angle);
      const offset = (x, z, y) => ({ x: p.x + sideX * x + frontX * z, y: y + bob, z: p.z + sideZ * x + frontZ * z });
      const count = this.people.length;
      setPart(this.meshes.body, i, { x: p.x, y: .18 + .95 + bob, z: p.z }, [.52, .64, .32], angle);
      this.meshes.body.setColorAt(i, p.color.color);
      setPart(this.meshes.head, i, offset(0, .03, 1.69), [1, 1.06, .98], angle);
      this.meshes.head.setColorAt(i, p.skin.color);
      setPart(this.meshes.hair, i, offset(0, -.015, 1.79), [1.05, .58, 1.03], angle);
      this.meshes.hair.setColorAt(i, p.hair.color);
      setPart(this.meshes.cap, i, offset(0, 0, 1.91), [1, 1, 1], angle);
      this.meshes.cap.setColorAt(i, i % 3 ? p.color.color : new T.Color(0x564434));
      setPart(this.meshes.leftLeg, i, offset(-.14, 0, .57), [.17, .57, .19], angle, swing);
      setPart(this.meshes.rightLeg, i, offset(.14, 0, .57), [.17, .57, .19], angle, -swing);
      setPart(this.meshes.leftFoot, i, offset(-.14, .08, .26), [.2, .12, .27], angle, swing);
      setPart(this.meshes.rightFoot, i, offset(.14, .08, .26), [.2, .12, .27], angle, -swing);
      setPart(this.meshes.leftArm, i, offset(-.34, 0, 1.28), [.145, .49, .16], angle, -swing);
      this.meshes.leftArm.setColorAt(i, p.color.color);
      setPart(this.meshes.rightArm, i, offset(.34, 0, 1.28), [.145, .49, .16], angle, swing);
      this.meshes.rightArm.setColorAt(i, p.color.color);
    });
    for (const mesh of Object.values(this.meshes)) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }
}
