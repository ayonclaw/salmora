import * as T from 'three';

export class World {
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(57, 1, .08, 1350);
  elapsed = 0;
  frames = 0;
  accumulator = 0;
  previous = 0;
  paused = true;
  stages = false;

  constructor(host, low = false) {
    this.host = host;
    this.low = low;
    this.renderer = new T.WebGLRenderer({ antialias: !low, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1 : 1.5));
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.13;
    this.renderer.shadowMap.enabled = !low;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.domElement.tabIndex = 0;
    this.renderer.domElement.setAttribute('aria-label', 'Salmora 3D scene. Click Enter the quay to play.');
    host.append(this.renderer.domElement);
    this.scene.background = new T.Color(0xb7c5be);
    this.scene.fog = new T.FogExp2(0xb6c1b4, .0028);
    this.scene.add(new T.HemisphereLight(0xc7e1dd, 0x866349, 2.1));
    this.sun = new T.DirectionalLight(0xffd1a0, 3.7);
    this.sun.position.set(-75, 103, 64);
    this.sun.castShadow = !low;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -49;
    this.sun.shadow.camera.right = 49;
    this.sun.shadow.camera.top = 49;
    this.sun.shadow.camera.bottom = -49;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 235;
    this.sun.shadow.bias = -.00022;
    this.sun.shadow.normalBias = .035;
    this.sun.shadow.radius = 2;
    this.scene.add(this.sun, this.sun.target);
    this.sky();
    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize);
    this.resize();
  }

  sky() {
    const sky = new T.Mesh(new T.SphereGeometry(950, 24, 16), new T.ShaderMaterial({
      side: T.BackSide,
      depthWrite: false,
      uniforms: {
        horizon: { value: new T.Color(0xd8c7a8) },
        zenith: { value: new T.Color(0x5c8e9d) },
      },
      vertexShader: `varying vec3 skyPosition;
        void main() {
          skyPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }`,
      fragmentShader: `varying vec3 skyPosition;
        uniform vec3 horizon;
        uniform vec3 zenith;
        void main() {
          float y = normalize(skyPosition).y;
          vec3 col = mix(horizon,zenith,pow(max(y,0.0),.58));
          float sun = pow(max(dot(normalize(skyPosition),normalize(vec3(-.54,.43,.64))),0.0),310.0);
          gl_FragColor = vec4(col+sun*vec3(.65,.43,.19),1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }));
    sky.frustumCulled = false;
    this.scene.add(sky);
    const cloudGeo = new T.SphereGeometry(1, 12, 6);
    const cloudMat = new T.MeshBasicMaterial({ color: 0xebdcc0, transparent: true, opacity: .19, depthWrite: false });
    for (let i = 0; i < 9; i++) {
      const cloud = new T.Mesh(cloudGeo, cloudMat);
      const angle = i * .69;
      cloud.position.set(Math.sin(angle) * 410, 104 + i % 3 * 18, Math.cos(angle) * 410);
      cloud.scale.set(58 + i * 3, 4 + i % 3, 16);
      cloud.rotation.y = angle;
      this.scene.add(cloud);
    }
  }

  resize() {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  lightAt(x, z) {
    // Snap the shadow volume to shadow texels to avoid shimmering while walking.
    const snap = value => Math.round(value * 16) / 16;
    const sx = snap(x);
    const sz = snap(z);
    this.sun.target.position.set(sx, 0, sz);
    this.sun.position.set(sx - 75, 103, sz + 64);
    this.sun.target.updateMatrixWorld();
  }

  start(step, draw) {
    const fixed = 1 / 60;
    const tick = ms => {
      const delta = this.previous ? Math.min(.12, (ms - this.previous) / 1000) : fixed;
      this.previous = ms;
      if (!this.paused && !this.stages) {
        this.accumulator += delta;
        while (this.accumulator >= fixed) {
          step(fixed);
          this.elapsed += fixed;
          this.accumulator -= fixed;
        }
      } else this.accumulator = 0;
      draw(delta, this.stages ? 94.2 : this.elapsed);
      this.renderer.render(this.scene, this.camera);
      this.frames++;
    };
    this.renderer.setAnimationLoop(tick);
  }
}
