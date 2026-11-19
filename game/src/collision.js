import { CITY, WEST, EAST, NORTH, SHORE, PIER } from './config.js';

const CELL = 16;
const mod = (n, d) => ((n % d) + d) % d;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export class Collision {
  constructor() {
    this.cells = new Map();
    this.obstacles = [];
  }

  insert(x, z, width, depth, top) {
    const item = { l: x - width / 2, r: x + width / 2, t: z - depth / 2, b: z + depth / 2, top };
    this.obstacles.push(item);
    for (let col = Math.floor(item.l / CELL); col <= Math.floor(item.r / CELL); col++) {
      for (let row = Math.floor(item.t / CELL); row <= Math.floor(item.b / CELL); row++) {
        const key = `${col}:${row}`;
        if (!this.cells.has(key)) this.cells.set(key, []);
        this.cells.get(key).push(item);
      }
    }
  }

  height(x, z) {
    if (z > CITY.road / 2) return CITY.kerb;
    if (z > -CITY.road / 2) return 0;
    const px = mod(x + CITY.road / 2, CITY.pitch);
    const pz = mod(z + CITY.road / 2, CITY.pitch);
    return px > CITY.road && pz > CITY.road ? CITY.kerb : 0;
  }

  inside(x, z, r) {
    if (x - r < WEST || x + r > EAST || z - r < NORTH) return false;
    return z + r <= SHORE || (Math.abs(x - PIER.x) + r < PIER.width / 2 && z + r <= PIER.end);
  }

  solid(x, z, radius, y) {
    const rsq = radius * radius;
    for (let col = Math.floor((x - radius) / CELL); col <= Math.floor((x + radius) / CELL); col++) {
      for (let row = Math.floor((z - radius) / CELL); row <= Math.floor((z + radius) / CELL); row++) {
        const bucket = this.cells.get(`${col}:${row}`);
        if (!bucket) continue;
        for (const b of bucket) {
          if (y >= b.top) continue;
          const dx = x - clamp(x, b.l, b.r);
          const dz = z - clamp(z, b.t, b.b);
          if (dx * dx + dz * dz < rsq) return true;
        }
      }
    }
    return false;
  }

  blocked(x, z, r, y) {
    return !this.inside(x, z, r) || this.solid(x, z, r, y);
  }

  slide(pos, dx, dz, r, extra = () => false) {
    const free = (x, z) => !this.blocked(x, z, r, pos.y) && !extra(x, z);
    if (free(pos.x + dx, pos.z)) pos.x += dx;
    if (free(pos.x, pos.z + dz)) pos.z += dz;
  }
}
