export const CITY = Object.freeze({
  pitch: 42,
  road: 12,
  halfBlocks: 3,
  rows: 4,
  kerb: 0.18,
  quay: 14,
  seed: 718042,
});

export const WEST = -CITY.halfBlocks * CITY.pitch;
export const EAST = -WEST;
export const NORTH = -CITY.rows * CITY.pitch;
export const SHORE = CITY.quay;
export const PIER = Object.freeze({ x: 0, width: 9, end: 53 });
// Reclaimed quay, starting at the Saltline wagon's door.
export const START = Object.freeze({ x: -15, z: 4.8, yaw: 0 });
export const PARKED = Object.freeze({ x: -13, z: 3.6, yaw: 0 });

export const WALK = Object.freeze({
  radius: 0.32,
  height: 1.64,
  pace: 4.4,
  sprint: 7.1,
  jump: 4.1,
  gravity: 17,
});

export const WAGON = Object.freeze({
  radius: 1.02,
  wheelbase: 2.55,
  topSpeed: 28,
  reverseSpeed: 7,
  acceleration: 8.2,
  brake: 17,
  coast: 2.1,
  steer: 0.56,
});

export function districtAt(x, z) {
  if (z > 19) return 'Pilot Pier';
  if (z > -28) return 'Lantern Quay';
  if (x < -42) return 'The Kilns';
  if (x > 42) return 'Salt Market';
  return 'High Cistern';
}
