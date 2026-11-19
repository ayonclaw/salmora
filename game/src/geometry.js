import * as T from 'three';

export const cube = new T.BoxGeometry();
export const pole = new T.CylinderGeometry(0.58, 0.8, 1, 7);
export const sphere = new T.SphereGeometry(.5, 10, 7);
export const standard = (color, extras = {}) => new T.MeshStandardMaterial({ color, roughness: .83, ...extras });

export function mesh(parent, geometry, material, x, y, z, sx = 1, sy = 1, sz = 1) {
  const item = new T.Mesh(geometry, material);
  item.position.set(x, y, z);
  item.scale.set(sx, sy, sz);
  parent.add(item);
  return item;
}

export function box(parent, material, x, y, z, sx, sy, sz) {
  return mesh(parent, cube, material, x, y, z, sx, sy, sz);
}

export function ground(parent, material, x, y, z, w, d) {
  const item = mesh(parent, new T.PlaneGeometry(w, d), material, x, y, z);
  item.rotation.x = -Math.PI / 2;
  item.receiveShadow = true;
  return item;
}

export class Batch {
  constructor(geometry, material, { cast = false, receive = true } = {}) {
    this.geometry = geometry;
    this.material = material;
    this.cast = cast;
    this.receive = receive;
    this.transforms = [];
    this.dummy = new T.Object3D();
  }

  add(x, y, z, sx, sy, sz, yaw = 0, pitch = 0, roll = 0, color = null) {
    const o = this.dummy;
    o.position.set(x, y, z);
    o.rotation.set(pitch, yaw, roll, 'YXZ');
    o.scale.set(sx, sy, sz);
    o.updateMatrix();
    this.transforms.push({ matrix: o.matrix.clone(), color });
  }

  flush(parent) {
    if (!this.transforms.length) return;
    const result = new T.InstancedMesh(this.geometry, this.material, this.transforms.length);
    this.transforms.forEach(({ matrix, color }, i) => {
      result.setMatrixAt(i, matrix);
      if (color !== null) result.setColorAt(i, new T.Color(color));
    });
    result.castShadow = this.cast;
    result.receiveShadow = this.receive;
    result.computeBoundingSphere();
    parent.add(result);
    this.transforms.length = 0;
    return result;
  }
}
