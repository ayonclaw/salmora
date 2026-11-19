import { CITY, NORTH, WEST, EAST, PIER, SHORE, districtAt } from './config.js';

const el = id => document.getElementById(id);

export class HUD {
  promptTime = 0;
  promptKey = '';
  mapTime = 0;
  lastDistrict = '';

  constructor(city) {
    this.root = el('hud');
    this.district = el('district');
    this.cash = el('cash');
    this.health = el('health');
    this.speed = el('speed');
    this.speedValue = el('speed-value');
    this.prompt = el('prompt');
    this.canvas = el('map');
    this.ctx = this.canvas.getContext('2d');
    this.base = document.createElement('canvas');
    this.base.width = this.canvas.width;
    this.base.height = this.canvas.height;
    this.blocks = city.blocks;
    this.buildMap();
  }

  projection(x, z) {
    return {
      x: 8 + (x - WEST) / (EAST - WEST) * 164,
      y: 8 + (z - NORTH) / (SHORE + 28 - NORTH) * 128,
    };
  }

  buildMap() {
    const ctx = this.base.getContext('2d');
    ctx.fillStyle = '#344e50';
    ctx.fillRect(0, 0, 180, 144);
    const first = this.projection(WEST, NORTH);
    const last = this.projection(EAST, SHORE);
    ctx.fillStyle = '#8e9988';
    ctx.fillRect(first.x, first.y, last.x - first.x, last.y - first.y);
    ctx.strokeStyle = '#c7c9a7';
    ctx.lineWidth = 6.9;
    ctx.lineCap = 'butt';
    for (let col = -CITY.halfBlocks; col <= CITY.halfBlocks; col++) {
      const a = this.projection(col * CITY.pitch, NORTH);
      const b = this.projection(col * CITY.pitch, 0);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    for (let row = -CITY.rows; row <= 0; row++) {
      const a = this.projection(WEST, row * CITY.pitch);
      const b = this.projection(EAST, row * CITY.pitch);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.fillStyle = '#bab693';
    for (const b of this.blocks) {
      const a = this.projection(b.x - 12, b.z - 12);
      const d = this.projection(b.x + 12, b.z + 12);
      ctx.fillRect(a.x, a.y, d.x - a.x, d.y - a.y);
    }
    const a = this.projection(-PIER.width / 2, SHORE);
    const b = this.projection(PIER.width / 2, PIER.end);
    ctx.fillStyle = '#c7c9a7';
    ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
    ctx.strokeStyle = '#ffffff1c';
    ctx.lineWidth = 1;
    for (let y = 0; y < 144; y += 18) {
      ctx.beginPath();
      ctx.moveTo(0, y + .5);
      ctx.lineTo(180, y + .5);
      ctx.stroke();
    }
  }

  show() {
    this.root.hidden = false;
  }

  hide() {
    this.root.hidden = true;
  }

  hint(key, message, duration = 4.5) {
    if (key === this.promptKey) return;
    this.promptKey = key;
    this.promptTime = duration;
    this.prompt.textContent = message;
    this.prompt.classList.add('visible');
  }

  clearHint() {
    this.promptKey = '';
    this.promptTime = 0;
    this.prompt.classList.remove('visible');
  }

  update(dt, player, car, yaw) {
    const target = player.seated ? car.pos : player.pos;
    const district = districtAt(target.x, target.z);
    if (district !== this.lastDistrict) {
      this.lastDistrict = district;
      this.district.textContent = district;
      this.district.classList.remove('arrive');
      void this.district.offsetWidth;
      this.district.classList.add('arrive');
    }
    this.cash.textContent = player.cash.toLocaleString('en-US', { minimumIntegerDigits: 3 });
    this.health.value = player.health;
    this.speed.hidden = !player.seated;
    this.speedValue.textContent = String(Math.round(Math.abs(car.speed) * 3.6)).padStart(2, '0');
    if (this.promptTime > 0) {
      this.promptTime -= dt;
      if (this.promptTime <= 0) this.prompt.classList.remove('visible');
    }
    this.mapTime += dt;
    if (this.mapTime >= .08) {
      this.mapTime = 0;
      this.drawMap(target, car, yaw);
    }
  }

  drawMap(target, car, yaw) {
    const ctx = this.ctx;
    ctx.drawImage(this.base, 0, 0);
    const parked = this.projection(car.pos.x, car.pos.z);
    ctx.save();
    ctx.translate(parked.x, parked.y);
    ctx.rotate(-car.yaw);
    ctx.fillStyle = '#172c2e';
    ctx.fillRect(-2.8, -4, 5.6, 8);
    ctx.strokeStyle = '#edc78b';
    ctx.strokeRect(-2.8, -4, 5.6, 8);
    ctx.restore();
    const p = this.projection(target.x, target.z);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(-yaw);
    ctx.fillStyle = '#f4dfac';
    ctx.shadowColor = '#14272c';
    ctx.shadowBlur = 3;
    ctx.beginPath();
    ctx.moveTo(0, -6.7);
    ctx.lineTo(4.3, 4.8);
    ctx.lineTo(0, 2.6);
    ctx.lineTo(-4.3, 4.8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
