const controlKeys = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyQ', 'KeyR', 'KeyF', 'Backspace', 'Space',
  'ShiftLeft', 'ShiftRight', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight',
]);

export class Input {
  held = new Set();
  pressed = new Set();
  dx = 0;
  dy = 0;
  active = false;

  constructor(canvas, onPause) {
    this.canvas = canvas;
    const pause = () => {
      if (this.active) onPause();
    };
    window.addEventListener('keydown', event => {
      if (!this.active) return;
      if (event.code === 'Escape') {
        pause();
        return;
      }
      if (!controlKeys.has(event.code)) return;
      event.preventDefault();
      if (!this.held.has(event.code) && !event.repeat) this.pressed.add(event.code);
      this.held.add(event.code);
    });
    window.addEventListener('keyup', event => this.held.delete(event.code));
    window.addEventListener('mousedown', event => {
      if (this.active && event.button === 0) {
        this.pressed.add('MousePrimary');
        event.preventDefault();
      }
    });
    window.addEventListener('blur', pause);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) pause();
    });
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement !== canvas && this.locked) pause();
      this.locked = document.pointerLockElement === canvas;
    });
    document.addEventListener('mousemove', event => {
      if (!this.active) return;
      const locked = document.pointerLockElement === canvas;
      if (!locked && !(event.buttons === 1 && event.target === canvas)) return;
      this.dx += event.movementX;
      this.dy += event.movementY;
    });
  }

  capture() {
    this.active = true;
    try {
      this.canvas.requestPointerLock()?.catch(() => {});
    } catch {
      // The same camera supports drag-to-look when capture is unavailable.
    }
  }

  release() {
    this.active = false;
    this.held.clear();
    this.pressed.clear();
    this.dx = this.dy = 0;
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }

  down(...keys) {
    return keys.some(key => this.held.has(key));
  }

  take(key) {
    return this.pressed.delete(key);
  }

  axes() {
    return {
      forward: Number(this.down('KeyW', 'ArrowUp')) - Number(this.down('KeyS', 'ArrowDown')),
      side: Number(this.down('KeyD', 'ArrowRight')) - Number(this.down('KeyA', 'ArrowLeft')),
    };
  }

  mouse() {
    const sample = { x: this.dx, y: this.dy };
    this.dx = this.dy = 0;
    return sample;
  }
}
