import * as T from 'three';
import { START } from './config.js';

const limit = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const angle = x => Math.atan2(Math.sin(x), Math.cos(x));

export class FollowCamera {
  yaw = START.yaw;
  pitch = .21;
  orbit = 0;
  idle = 0;
  driving = false;
  eye = new T.Vector3();
  aim = new T.Vector3();
  focus = new T.Vector3();
  smoothFocus = new T.Vector3();

  constructor(camera, collision) {
    this.camera = camera;
    this.collision = collision;
  }

  walking(x, z) {
    this.driving = false;
    this.orbit = 0;
    this.idle = 0;
    this.pitch = .2;
    this.smoothFocus.set(x, this.collision.height(x, z) + 1.38, z);
  }

  drivingMode(car) {
    this.driving = true;
    this.pitch = .27;
    this.orbit = 0;
    this.idle = 0;
    this.yaw = car.yaw;
    this.smoothFocus.copy(car.pos).add(new T.Vector3(0, 1.27, 0));
  }

  look(input, dt, car) {
    const mouse = input.mouse();
    this.pitch = limit(this.pitch + mouse.y * .00235, -.11, .92);
    if (this.driving) {
      this.orbit = angle(this.orbit - mouse.x * .0031);
      this.idle = mouse.x === 0 ? this.idle + dt : 0;
      if (Math.abs(car.speed) > 2.7 && this.idle > 1.1) this.orbit *= Math.exp(-dt * 2.3);
      const goal = car.yaw + this.orbit;
      this.yaw += angle(goal - this.yaw) * (1 - Math.exp(-dt * 8));
    } else {
      this.yaw = angle(this.yaw - mouse.x * .0027);
    }
  }

  update(dt, target, speed = 0, immediate = false) {
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const distance = this.driving ? 6.4 + Math.min(Math.abs(speed) * .055, 1.65) : 3.9;
    const shoulder = this.driving ? 0 : .57;
    const ahead = this.driving ? 2.6 : .55;
    this.focus.copy(target);
    this.focus.y += this.driving ? 1.27 : 1.38;
    const ease = immediate ? 1 : 1 - Math.exp(-dt * 17);
    this.smoothFocus.lerp(this.focus, ease);
    const f = this.smoothFocus;
    const reach = distance * Math.cos(this.pitch);
    this.eye.set(sin * reach + cos * shoulder, .35 + Math.sin(this.pitch) * distance, cos * reach - sin * shoulder);
    // Stop tracing at the first wall, so moving away from it cannot make the
    // camera jump through the far side of adjacent geometry.
    let clear = 1;
    for (let i = 1; i <= 20; i++) {
      const t = i / 20;
      if (this.collision.solid(f.x + this.eye.x * t, f.z + this.eye.z * t, .24, f.y + this.eye.y * t - .13)) {
        clear = Math.max(.12, (i - 1) / 20);
        break;
      }
    }
    this.eye.multiplyScalar(clear).add(f);
    this.eye.y = Math.max(this.eye.y, 1.08);
    this.camera.position.copy(this.eye);
    this.aim.set(f.x - sin * ahead + cos * shoulder, f.y - .08, f.z - cos * ahead - sin * shoulder);
    this.camera.lookAt(this.aim);
  }

  stage(eye, point, fov) {
    this.camera.fov = fov;
    this.camera.position.set(...eye);
    this.camera.lookAt(...point);
    this.camera.updateProjectionMatrix();
  }
}
