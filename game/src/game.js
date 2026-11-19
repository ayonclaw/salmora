import * as T from 'three';
import { CITY, START, PARKED, districtAt } from './config.js';
import { seeded, between } from './rng.js';
import { buildCity } from './city.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Car } from './car.js';
import { Traffic } from './traffic.js';
import { Pedestrians } from './pedestrians.js';
import { FollowCamera } from './camera.js';
import { Input } from './input.js';
import { HUD } from './hud.js';
import { Police } from './police.js';
import { Combat } from './combat.js';
import { Missions } from './missions.js';
import { CityAudio } from './audio.js';
import { SaveSlot } from './save.js';

const byId = id => document.getElementById(id);
const url = new URL(location.href);
const shot = url.searchParams.get('shot');
const allowedShots = new Set(['title', 'street', 'vista', 'drive', 'chase']);
const quality = url.searchParams.get('quality') === 'low';
const isShot = allowedShots.has(shot);
const titleScreen = !isShot || shot === 'title';
const arrival = byId('arrival');
const pauseCard = byId('pause');
const failure = byId('failure');

function message(error) {
  failure.hidden = false;
  byId('failure-text').textContent = `This browser could not start Salmora's 3D view. ${error?.message ?? String(error)}`;
  console.error('[Salmora startup]', error);
}

function challengeNoise(seed) {
  const rand = seeded(seed);
  let checksum = 0;
  for (let i = 0; i < 5000; i++) checksum ^= Math.floor(between(rand, 0, 65535));
  return checksum;
}

async function boot() {
  const host = byId('viewport');
  let world;
  try {
    world = new World(host, quality);
    world.challenge = challengeNoise(CITY.seed);
  } catch (error) {
    message(error);
    return;
  }

  try {
    const city = buildCity(world.scene, quality);
    world.city = city;
    world.waterfront = city.waterfront;
    world.scene.userData.collision = city.collision;
    const player = new Player(world.scene, city.collision);
    const save = new SaveSlot();
    player.cash = save.data.cash;
    player.health = save.data.health;
    if (save.validPosition(save.data.position)) player.exit(save.data.position.x, save.data.position.z, save.data.position.yaw);
    const car = new Car(world.scene, city.collision);
    const traffic = new Traffic(world.scene, CITY.seed + 441);
    const pedestrians = new Pedestrians(world.scene, CITY.seed + 922);
    const camera = new FollowCamera(world.camera, city.collision);
    const hud = new HUD(city);
    const input = new Input(world.renderer.domElement, () => pause());
    const audio = new CityAudio();
    const police = new Police(world.scene, {
      audio,
      onShot: damage => { player.health = Math.max(0, player.health - damage); },
      onRam: damage => { player.health = Math.max(0, player.health - damage); },
    });
    const combat = new Combat(world.scene, world.camera, player, { audio, police, pedestrians });
    combat.weapon.visible = false;
    const missions = new Missions(world.scene, hud, save, { audio });
    let saveClock = 0;
    const state = { world, city, player, car, traffic, pedestrians, camera, hud, input, police, combat, missions, audio, save };
    state.step = update;
    window.__salmora = state;
    window.__game = world;

    function pause() {
      if (!input.active) return;
      input.release();
      world.paused = true;
      hud.hide();
      pauseCard.hidden = false;
    }

    function enter() {
      arrival.hidden = true;
      pauseCard.hidden = true;
      failure.hidden = true;
      world.paused = false;
      hud.show();
      hud.hint('controls', 'WASD walk · E borrow wagon · Q deliver · F pistol · R reload', 6.5);
      input.capture();
      audio.resume().catch(() => {});
      host.focus({ preventScroll: true });
    }

    function resume() {
      world.paused = false;
      pauseCard.hidden = true;
      hud.show();
      input.capture();
      audio.resume().catch(() => {});
      host.focus({ preventScroll: true });
    }

    byId('start').addEventListener('click', enter);
    byId('resume').addEventListener('click', resume);
    host.addEventListener('click', () => {
      if (!world.paused && !arrival.hidden) enter();
    });

    function reset() {
      player.reset();
      car.reset();
      police.cool(100);
      missions.stage(0);
      save.reset();
      camera.walking(player.pos.x, player.pos.z);
      camera.update(1 / 60, player.pos, 0, true);
      hud.clearHint();
      hud.hint('welcome', 'WASD walk · E borrow wagon · Q deliver · F fires · R reloads', 6.5);
    }

    function vistaCounts() {
      world.scene.updateMatrixWorld(true);
      world.camera.updateMatrixWorld(true);
      const projection = new T.Matrix4().multiplyMatrices(world.camera.projectionMatrix, world.camera.matrixWorldInverse);
      const frustum = new T.Frustum().setFromProjectionMatrix(projection);
      const cars = traffic.cars.filter(car => frustum.containsPoint(new T.Vector3(car.x, .9, car.z))).length;
      const walkers = pedestrians.people.filter(person => frustum.containsPoint(new T.Vector3(person.x, 1, person.z))).length;
      return { cars, walkers, totalCars: traffic.cars.length, totalWalkers: pedestrians.people.length };
    }

    function setShot(name) {
      world.stages = true;
      world.paused = true;
      if (name === 'title') {
        arrival.hidden = false;
        hud.hide();
        player.exit(START.x, START.z, START.yaw);
        car.reset();
        camera.stage([65, 56, 85], [0, 4, -10], 47);
      } else {
        arrival.hidden = true;
        hud.show();
        combat.weapon.visible = name === 'drive' || name === 'chase';
        missions.stage(0);
        if (name === 'vista') {
          player.exit(START.x, START.z, START.yaw);
          traffic.update(0, { x: 0, z: -42 });
          pedestrians.update(0);
          camera.stage([35, 48, 30], [0, 1, -50], 59);
          const counts = vistaCounts();
          console.info(`[Salmora vista] cars in frustum=${counts.cars}/${counts.totalCars}, walkers=${counts.walkers}/${counts.totalWalkers}`);
          if (counts.cars < 10 || counts.walkers < 20) throw new Error(`Vista coverage too low: ${counts.cars} cars, ${counts.walkers} walkers`);
          window.__salmoraVistaCounts = counts;
        } else if (name === 'drive' || name === 'chase') {
          player.exit(START.x, START.z, START.yaw);
          car.reset();
          if (name === 'chase') {
            car.pos.set(-2.7, city.collision.height(-2.7, -3), -3);
            car.yaw = 0;
            car.speed = 8.4;
            car.occupied = true;
            car.stolen = true;
            player.enter();
            player.pos.copy(car.pos);
            police.cruisers[0].x = -2.7;
            police.cruisers[0].z = 8;
            police.cruisers[0].yaw = 0;
            police.raise('reported vehicle theft', 68);
            car.sync();
            camera.stage([15, 12, 18], [-3, 1, 1], 55);
          } else {
            player.enter();
            car.occupied = true;
            car.speed = 8.4;
            car.yaw = .12;
            player.pos.copy(car.pos);
            police.raise('night ferry pursuit', 62);
            car.sync();
            camera.drivingMode(car);
            camera.orbit = .4;
            camera.yaw = car.yaw + .4;
            camera.update(1 / 60, car.pos, car.speed, true);
          }
        } else {
          player.exit(START.x, START.z, START.yaw);
          camera.walking(player.pos.x, player.pos.z);
          camera.update(1 / 60, player.pos, 0, true);
        }
        hud.hint('controls', 'WASD walk · E vehicle · Q deliver · F fire · R reload', 5);
      }
    }

    function update(dt) {
      if (!world.paused && !world.stages) {
        if (input.take('Backspace')) reset();
        missions.update(dt, player, car, input, police);
        if (input.take('KeyE')) {
          if (player.seated) {
            if (Math.abs(car.speed) < 1.2) {
              const spot = car.exitSpot();
              if (spot) {
                car.occupied = false;
                player.exit(spot.x, spot.z, camera.yaw);
                camera.walking(spot.x, spot.z);
                hud.hint('exit', 'Back on the quay · E returns to the wagon', 4.3);
              } else hud.hint('blocked-exit', 'No room to step out here', 2.8);
            } else hud.hint('moving', 'Slow to a halt before stepping out', 2.3);
          } else if (car.distanceTo(player.pos) < 4.2 && Math.abs(car.speed) < 1.3) {
            player.enter();
            car.occupied = true;
            car.speed = 0;
            if (!car.stolen) {
              car.stolen = true;
              police.raise('vehicle theft', 24);
              hud.toast('SALTLINE WAGON / REPORTED STOLEN');
            }
            camera.drivingMode(car);
            hud.hint('driving', 'W drive · A/D steer · S brake or reverse · E steps out', 5.2);
          }
        }
        if (player.seated) {
          if (!car.occupied) {
            car.occupied = true;
            car.speed = 0;
            player.enter();
            camera.drivingMode(car);
          }
          car.update(dt, input);
          player.pos.copy(car.pos);
          player.yaw = car.yaw;
          camera.look(input, dt, car);
          world.lightAt(car.pos.x, car.pos.z);
          camera.update(dt, car.pos, car.speed);
        } else {
          camera.look(input, dt, car);
          player.update(dt, input, camera.yaw, (x, z) => car.overlaps(x, z, camera.yaw));
          camera.walking(player.pos.x, player.pos.z);
          world.lightAt(player.pos.x, player.pos.z);
          camera.update(dt, player.pos, 0);
          if (car.distanceTo(player.pos) < 4.7) hud.hint('wagon', 'E   Borrow the Saltline wagon', 4.7);
        }
        const focus = player.seated ? car.pos : player.pos;
        traffic.update(dt, focus);
        pedestrians.update(dt);
        const pursued = player.seated ? { ...player, pos: car.pos } : player;
        police.update(dt, pursued, world, pedestrians, traffic);
        combat.update(dt, input, player.seated);
        audio.update(dt, {
          speed: car.speed,
          driving: player.seated,
          wanted: police.stars,
          walking: !player.seated && Math.hypot(...Object.values(input.axes())) > 0,
        });
        saveClock += dt;
        if (saveClock > 2) {
          saveClock = 0;
          const savePosition = player.seated ? car.pos : player.pos;
          save.update({
            cash: player.cash,
            health: player.health,
            wanted: police.stars,
            mission: missions.index,
            position: { x: savePosition.x, y: savePosition.y, z: savePosition.z, yaw: player.seated ? car.yaw : player.yaw },
          });
        }
      } else {
        traffic.update(dt, player.seated ? car.pos : player.pos);
        pedestrians.update(dt);
      }
      world.waterfront.update(world.stages ? 94.2 : world.elapsed);
      hud.update(dt, player, car, player.seated ? camera.yaw : player.yaw, police, combat);
      world.renderer.domElement.dataset.mode = player.seated ? 'driving' : 'walking';
      world.renderer.domElement.dataset.district = districtAt(player.seated ? car.pos.x : player.pos.x, player.seated ? car.pos.z : player.pos.z);
    }

    world.input = input;
    camera.walking(player.pos.x, player.pos.z);
    camera.update(1 / 60, player.pos, 0, true);
    world.start(update, (delta, time) => {
      if (world.stages) {
        const focus = player.seated ? car.pos : player.pos;
        traffic.update(delta, focus);
        pedestrians.update(delta);
      }
      world.waterfront.update(world.stages ? time : world.elapsed);
      hud.update(delta, player, car, player.seated ? camera.yaw : player.yaw, police, combat);
    });

    if (isShot) setShot(shot);
    else {
      camera.stage([65, 56, 85], [0, 4, -10], 47);
      hud.hide();
    }
    // Deterministic ambient details can be inspected without changing the world seed.
    const ambient = seeded(CITY.seed + 9);
    window.__salmoraMeta = {
      title: 'Salmora: After the Flood',
      story: 'A boat-repair runner brings the evening ferry through a waterfront still rebuilding after the second seawall gave way.',
      seed: CITY.seed,
      shot: isShot ? shot : null,
      blocks: city.blocks.length,
      buildings: city.buildings.length,
      storefronts: city.shops.length,
      uniqueShopNames: new Set(city.shops.map(item => item.name)).size,
      trafficVehicles: traffic.cars.length,
      pedestrians: pedestrians.people.length,
      movingTraffic: traffic.stats().moving,
      movingPedestrians: pedestrians.stats().moving,
      wanted: police.status(),
      missions: missions.status(),
      vistaCounts: window.__salmoraVistaCounts ?? null,
      palms: city.props.palms,
      lamps: city.props.lamps,
      ambientMark: Math.floor(ambient() * 1000000),
    };
  } catch (error) {
    message(error);
  }
}

boot();
