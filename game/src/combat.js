import * as T from 'three';

const ZERO = new T.Vector2(0, 0);

function pistol() {
  const model = new T.Group();
  const dark = new T.MeshStandardMaterial({ color: 0x252c2b, metalness: .58, roughness: .33 });
  const grip = new T.MeshStandardMaterial({ color: 0x584337, roughness: .78 });
  const brass = new T.MeshStandardMaterial({ color: 0xc09b5d, metalness: .62, roughness: .3 });
  const receiver = new T.Mesh(new T.BoxGeometry(.15, .12, .43), dark);
  receiver.position.set(0, -.015, -.2);
  model.add(receiver);
  const barrel = new T.Mesh(new T.CylinderGeometry(.034, .034, .28, 8), dark);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, .01, -.49);
  model.add(barrel);
  const handle = new T.Mesh(new T.BoxGeometry(.115, .22, .13), grip);
  handle.rotation.x = -.19;
  handle.position.set(0, -.15, -.065);
  model.add(handle);
  const sight = new T.Mesh(new T.BoxGeometry(.028, .032, .09), brass);
  sight.position.set(0, .062, -.31);
  model.add(sight);
  const flash = new T.Mesh(new T.SphereGeometry(.07, 8, 6), new T.MeshBasicMaterial({ color: 0xffcf77, transparent: true, opacity: .9 }));
  flash.position.set(0, .01, -.61);
  flash.visible = false;
  model.add(flash);
  model.position.set(.34, -.31, -.54);
  model.rotation.x = -.08;
  return { model, flash };
}

export class Combat {
  constructor(scene, camera, player, { audio, police, pedestrians } = {}) {
    this.scene = scene;
    this.camera = camera;
    this.player = player;
    this.audio = audio;
    this.police = police;
    this.pedestrians = pedestrians;
    this.magazine = 8;
    this.capacity = 8;
    this.reserve = 48;
    this.cooldown = 0;
    this.reloadTime = 0;
    this.reloadDuration = 1.15;
    this.shotsFired = 0;
    this.hits = 0;
    this.effects = [];
    this.raycaster = new T.Raycaster();
    this.raycaster.far = 62;
    const weapon = pistol();
    this.weapon = weapon.model;
    this.flash = weapon.flash;
    camera.add(this.weapon);
  }

  muzzle() {
    return this.weapon.localToWorld(new T.Vector3(0, .01, -.61));
  }

  trace(start, end, hit) {
    const geometry = new T.BufferGeometry().setFromPoints([start, end]);
    const material = new T.LineBasicMaterial({ color: hit ? 0xffbb63 : 0xf5dcac, transparent: true, opacity: .82, depthWrite: false });
    const line = new T.Line(geometry, material);
    line.frustumCulled = false;
    this.scene.add(line);
    this.effects.push({ object: line, time: .07, geometry, material });
  }

  spark(point) {
    const geometry = new T.SphereGeometry(.095, 6, 5);
    const material = new T.MeshBasicMaterial({ color: 0xffc86a, transparent: true, opacity: 1 });
    const flare = new T.Mesh(geometry, material);
    flare.position.copy(point);
    this.scene.add(flare);
    this.effects.push({ object: flare, time: .2, geometry, material });
  }

  fire() {
    if (this.cooldown > 0 || this.reloadTime > 0 || this.magazine <= 0) return false;
    this.magazine--;
    this.cooldown = .23;
    this.shotsFired++;
    this.flash.visible = true;
    this.flash.scale.setScalar(.65 + Math.random() * .8);
    this.audio?.gunshot();
    this.police?.raise('unlicensed firearm', 18);
    this.raycaster.setFromCamera(ZERO, this.camera);
    const hits = this.raycaster.intersectObjects(this.scene.children, true).filter(hit => !this.weapon.getObjectById(hit.object.id));
    const hit = hits.find(item => item.object.type !== 'Line' && !item.object.isInstancedMesh);
    const start = this.muzzle();
    const end = hit?.point ?? this.raycaster.ray.origin.clone().addScaledVector(this.raycaster.ray.direction, 48);
    this.trace(start, end, Boolean(hit));
    if (hit) {
      this.hits++;
      this.spark(hit.point);
      this.pedestrians?.scatter(hit.point.x, hit.point.z, 19);
    }
    return true;
  }

  reload() {
    if (this.magazine === this.capacity || this.reserve <= 0 || this.reloadTime > 0) return false;
    this.reloadTime = this.reloadDuration;
    this.audio?.reload();
    return true;
  }

  update(dt, input, seated = false) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.flash.visible = this.cooldown > .15;
    this.weapon.visible = !seated;
    for (let index = this.effects.length - 1; index >= 0; index--) {
      const effect = this.effects[index];
      effect.time -= dt;
      effect.object.material.opacity = Math.max(0, effect.time / .2);
      if (effect.time <= 0) {
        this.scene.remove(effect.object);
        effect.geometry.dispose();
        effect.material.dispose();
        this.effects.splice(index, 1);
      }
    }
    if (this.reloadTime > 0) {
      this.reloadTime -= dt;
      if (this.reloadTime <= 0) {
        const load = Math.min(this.capacity - this.magazine, this.reserve);
        this.magazine += load;
        this.reserve -= load;
      }
    }
    if (input.take('KeyR')) this.reload();
    if (input.take('KeyF') || input.take('MousePrimary')) this.fire();
  }

  status() {
    return { magazine: this.magazine, reserve: this.reserve, reloading: this.reloadTime > 0, shots: this.shotsFired, hits: this.hits };
  }
}
