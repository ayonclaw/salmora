import * as T from 'three';
import { WEST, EAST, SHORE, PIER } from './config.js';
import { seeded, between } from './rng.js';
import { Batch, box, cube, ground, mesh, pole, standard } from './geometry.js';
import { pennantPalette, signTexture } from './textures.js';

export function buildWaterfront(group, collision) {
  const masonry = standard(0x89796a);
  const steel = standard(0x263e3e);
  const orange = standard(0xa85e39);
  const ivory = standard(0xe1c698);
  const glass = standard(0x35575e, { roughness: .27, metalness: .22 });
  const trim = new Batch(cube, standard(0xffffff), { cast: true });
  const posts = new Batch(pole, steel, { cast: true });
  const flagGeometry = new T.BufferGeometry();
  flagGeometry.setAttribute('position', new T.Float32BufferAttribute([-.5, .32, 0, 0, -.5, .08, .5, .32, 0], 3));
  flagGeometry.computeVertexNormals();
  const flags = new Batch(flagGeometry, standard(0xffffff, { side: T.DoubleSide }));
  const rand = seeded(72299);
  box(group, masonry, 0, -1.05, SHORE - .44, EAST - WEST, 2.25, 1.05).receiveShadow = true;
  for (let x = WEST + 1; x < EAST; x += 2) {
    if (Math.abs(x) < 5) continue;
    trim.add(x, .75, SHORE - .16, .12, 1.14, .11, 0, 0, 0, 0x314847);
    collision.insert(x, SHORE - .16, .24, .25, 1.4);
  }
  for (const sign of [-1, 1]) {
    const x = sign * (EAST + 5) / 2;
    for (const y of [.48, 1.24]) {
      box(group, steel, x, y, SHORE - .16, EAST - 5, .095, .1);
      collision.insert(x, SHORE - .16, EAST - 5, .14, 1.29);
    }
  }
  const deckLength = PIER.end - SHORE;
  box(group, masonry, 0, -.14, SHORE + deckLength / 2, PIER.width, .64, deckLength).receiveShadow = true;
  for (let z = SHORE + .3; z < PIER.end; z += .5) {
    trim.add(0, .179, z, PIER.width - .16, .005, .025, 0, 0, 0, 0xa08d70);
  }
  for (const side of [-1, 1]) {
    const x = side * 4.26;
    box(group, steel, x, 1.18, SHORE + deckLength / 2, .11, .12, deckLength);
    collision.insert(x, SHORE + deckLength / 2, .15, deckLength, 1.25);
    for (let z = SHORE + 1; z < PIER.end; z += 2.8) {
      posts.add(x, .66, z, .23, 1.1, .23);
      if (Math.round(z) % 2) posts.add(x * .84, -1.44, z, .62, 3.16, .62);
    }
  }
  for (const x of [-5.15, 5.15]) {
    posts.add(x, 2.44, 11.3, .22, 4.59, .22);
    box(group, steel, x, 4.68, 11.3, .36, .18, .36);
  }
  box(group, steel, 0, 4.45, 11.3, 10.45, .15, .15);
  const sign = standard(0xffffff, { map: signTexture('Pilot Pier', 0, 'FERRY SERVICE / BERTH 01'), side: T.DoubleSide });
  mesh(group, new T.PlaneGeometry(5.1, 1.05), sign, 0, 4.04, 11.39);
  for (let x = -10; x <= 10; x += .52) {
    flags.add(x, 5.38 + (x / 10) ** 2 * .87, 11.21, .39, .48, .65, .14, 0, between(rand, -.14, .14), pennantPalette(rand));
  }
  for (const x of [-10, 10]) posts.add(x, 3.22, 11.2, .14, 6.08, .14);

  // Working ferry, tied below the pedestrian deck.
  const ferry = new T.Group();
  ferry.position.set(10.5, -1.52, 37);
  ferry.rotation.y = -.08;
  group.add(ferry);
  const hullShape = new T.Shape();
  hullShape.moveTo(-2.65, -8.8);
  hullShape.lineTo(2.65, -8.8);
  hullShape.lineTo(2.96, 5.3);
  hullShape.quadraticCurveTo(2.1, 8.5, 0, 10.4);
  hullShape.quadraticCurveTo(-2.1, 8.5, -2.96, 5.3);
  hullShape.closePath();
  const hull = mesh(ferry, new T.ExtrudeGeometry(hullShape, { depth: 1.63, bevelEnabled: false }), steel, 0, -.52, 0);
  hull.rotation.x = -Math.PI / 2;
  const stripe = mesh(ferry, new T.ExtrudeGeometry(hullShape, { depth: .2, bevelEnabled: false }), orange, 0, .57, 0);
  stripe.rotation.x = -Math.PI / 2;
  box(ferry, ivory, 0, 2.2, -1.25, 4.55, 2.16, 9.8);
  box(ferry, orange, 0, 3.38, -1.25, 4.83, .23, 10.19);
  box(ferry, ivory, 0, 1.24, 5.24, 5.3, .22, 4.1);
  for (const side of [-1, 1]) {
    for (let z = -5; z <= 2.7; z += 1.42) box(ferry, glass, side * 2.282, 2.48, z, .035, .81, 1.12);
    for (const x of [-1.33, 0, 1.33]) box(ferry, glass, x, 2.55, -1.25 + side * 4.91, 1.13, .77, .035);
  }
  box(ferry, steel, .78, 3.93, -4.26, .66, 1.02, .71);
  box(ferry, ivory, -.92, 3.97, 1.16, .065, 1.13, .065);

  const beacon = new T.Group();
  beacon.position.set(0, .18, 51.4);
  group.add(beacon);
  mesh(beacon, pole, masonry, 0, .21, 0, 1.64, .42, 1.64);
  mesh(beacon, pole, ivory, 0, 1.59, 0, 1.33, 2.5, 1.33);
  mesh(beacon, pole, orange, 0, 1.78, 0, 1.18, .58, 1.18);
  mesh(beacon, pole, glass, 0, 3.12, 0, 1.03, .64, 1.03);
  mesh(beacon, new T.ConeGeometry(.66, .61, 8), orange, 0, 3.74, 0);
  collision.insert(0, 51.4, 1.65, 1.65, 3.95);

  const waterMaterial = new T.ShaderMaterial({
    uniforms: { tide: { value: 0 } },
    vertexShader: `varying vec3 world;
      uniform float tide;
      void main() {
        vec4 p = modelMatrix * vec4(position, 1.0);
        p.y += .075*sin(p.z*.31+tide*1.13)+.04*sin(p.x*.63-p.z*.27+tide);
        world = p.xyz;
        gl_Position = projectionMatrix * viewMatrix * p;
      }`,
    fragmentShader: `varying vec3 world;
      uniform float tide;
      void main() {
        vec2 p = world.xz;
        float a = sin(p.y*1.44+p.x*.34+tide*1.75+sin(p.x*.7)*1.1);
        float b = sin(p.y*2.25-p.x*.45-tide*.9+cos(p.y*.55));
        float c = sin(p.y*.38+p.x*.22+tide*.8);
        float foam = pow(max(0.0,a*.64+b*.36),8.0);
        vec3 near = mix(vec3(.055,.225,.249),vec3(.13,.42,.405),.49+c*.21+a*.09);
        vec2 eye = cameraPosition.xz - p;
        float d = length(eye);
        float gold = exp(-abs(p.x+9.0+p.y*.33)*.028)*smoothstep(24.0,165.0,p.y);
        near += foam * vec3(.17,.26,.24) + foam * gold * vec3(.54,.34,.14);
        float mist = smoothstep(75.0,460.0,d);
        gl_FragColor = vec4(mix(near,vec3(.60,.67,.64),mist*.91),1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const water = mesh(group, new T.PlaneGeometry(1400, 1260, 36, 32), waterMaterial, 0, -1.72, 155);
  water.rotation.x = -Math.PI / 2;
  // Low outer breakwater and islands along the far shipping channel.
  const hills = new Batch(new T.IcosahedronGeometry(1, 1), standard(0xffffff), { receive: false });
  for (let i = 0; i < 36; i++) {
    const left = i < 19;
    const x = left ? between(rand, -335, -111) : between(rand, 119, 399);
    const z = left ? between(rand, 226, 300) : between(rand, 282, 354);
    hills.add(x, -4, z, between(rand, 30, 64), between(rand, 10, 31), between(rand, 15, 41), rand() * Math.PI, 0, 0, left ? 0x596d68 : 0x607474);
  }
  for (let i = 0; i < 26; i++) {
    const x = -150 + i * 11.6;
    const z = 134 + Math.sin(i * .27) * 9;
    if (i > 10 && i < 16) continue;
    hills.add(x, -1.5, z, 7.8, between(rand, 1.7, 3.6), 6.5, rand() * 3, 0, 0, 0x756c60);
  }
  for (const batch of [trim, posts, flags, hills]) batch.flush(group);
  return {
    ferry,
    update(seconds) {
      waterMaterial.uniforms.tide.value = seconds;
      ferry.position.y = -1.51 + Math.sin(seconds * .85 + .4) * .085;
      ferry.rotation.z = Math.sin(seconds * .67) * .013;
    },
  };
}
