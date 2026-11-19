const KEY = 'salmora.save.v2';
const VERSION = 2;
const clamp = (value, low, high) => Math.min(high, Math.max(low, Number(value) || 0));

function fresh() {
  return {
    version: VERSION,
    cash: 80,
    wanted: 0,
    mission: 0,
    health: 100,
    position: { x: -15, y: 0, z: 4.8, yaw: 0 },
  };
}

export class SaveSlot {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.writes = 0;
    this.data = this.read();
  }

  read() {
    try {
      const raw = this.storage?.getItem(KEY);
      if (!raw) return fresh();
      const saved = JSON.parse(raw);
      if (!saved || typeof saved !== 'object') return fresh();
      if (saved.version !== VERSION) return this.migrate(saved);
      const fallback = fresh();
      return {
        ...fallback,
        ...saved,
        cash: clamp(saved.cash, 0, 999999),
        wanted: clamp(saved.wanted, 0, 5),
        mission: clamp(saved.mission, 0, 3),
        health: clamp(saved.health, 0, 100),
        position: this.validPosition(saved.position) ? saved.position : fallback.position,
      };
    } catch {
      return fresh();
    }
  }

  migrate(saved) {
    const data = fresh();
    data.cash = clamp(saved.cash, 0, 999999);
    data.mission = clamp(saved.missionIndex ?? saved.mission, 0, 3);
    data.wanted = clamp(saved.wanted, 0, 5);
    data.position = this.validPosition(saved.position) ? saved.position : data.position;
    this.data = data;
    this.write();
    return data;
  }

  validPosition(position) {
    return position && ['x', 'y', 'z', 'yaw'].every(key => Number.isFinite(Number(position[key])));
  }

  write() {
    this.data.version = VERSION;
    try {
      this.storage?.setItem(KEY, JSON.stringify(this.data));
      this.writes++;
      return true;
    } catch {
      return false;
    }
  }

  update(values = {}) {
    const { position, ...rest } = values;
    Object.assign(this.data, rest);
    if (position && this.validPosition(position)) this.data.position = { ...position };
    return this.write();
  }

  checkpoint(player, wanted, mission) {
    return this.update({
      cash: player.cash,
      health: player.health,
      wanted: Math.min(5, Math.max(0, wanted)),
      mission,
      position: { x: player.pos.x, y: player.pos.y, z: player.pos.z, yaw: player.yaw },
    });
  }

  reset() {
    this.data = fresh();
    return this.write();
  }

  static get key() {
    return KEY;
  }
}
