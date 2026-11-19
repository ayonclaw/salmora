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

const byId = id => document.getElementById(id);
const url = new URL(location.href);
const shot = url.searchParams.get('shot');
const allowedShots = new Set(['title', 'street', 'vista', 'drive']);
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
    const city = buildCity(world.scene);
    world.city = city;
    world.waterfront = city.waterfront;
    const player = new Player(world.scene, city.collision);
    const car = new Car(world.scene, city.collision);
    const traffic = new Traffic(world.scene, CITY.seed + 441);
    const pedestrians = new Pedestrians(world.scene, CITY.seed + 922);
    const camera = new FollowCamera(world.camera, city.collision);
    const hud = new HUD(city);
    const input = new Input(world.renderer.domElement, () => pause());
    const state = { world, city, player, car, traffic, pedestrians, camera, hud, input };
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
      input.capture();
      host.focus({ preventScroll: true });
    }

    function resume() {
      world.paused = false;
      pauseCard.hidden = true;
      hud.show();
      input.capture();
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
      camera.walking(player.pos.x, player.pos.z);
      camera.update(1 / 60, player.pos, 0, true);
      hud.clearHint();
      hud.hint('welcome', 'WASD walk · E takes the wagon · mouse to look', 6.5);
    }

    function setShot(name) {
      world.stages = true;
      if (name === 'title') {
        arrival.hidden = false;
        hud.hide();
        player.exit(START.x, START.z, START.yaw);
        car.reset();
        camera.stage([65, 56, 85], [0, 4, -10], 47);
      } else {
        arrival.hidden = true;
        hud.show();
        if (name === 'vista') {
          player.exit(START.x, START.z, START.yaw);
          camera.stage([100, 68, 115], [0, 3, 25], 50);
        } else if (name === 'drive') {
          player.enter();
          car.speed = 8.4;
          car.yaw = .12;
          car.sync();
          camera.drivingMode(car);
          camera.orbit = .4;
          camera.yaw = car.yaw + .4;
          camera.update(1 / 60, car.pos, car.speed, true);
        } else {
          player.exit(START.x, START.z, START.yaw);
          camera.walking(player.pos.x, player.pos.z);
          camera.update(1 / 60, player.pos, 0, true);
        }
        hud.hint('welcome', 'WASD move · E takes the wagon · mouse to look', 5);
      }
    }

    function update(dt) {
      if (!world.paused && !world.stages) {
        if (input.take('KeyR')) reset();
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
      }
      world.waterfront.update(world.stages ? 94.2 : world.elapsed);
      traffic.update(dt);
      pedestrians.update(dt);
      hud.update(dt, player, car, player.seated ? camera.yaw : player.yaw);
      world.renderer.domElement.dataset.mode = player.seated ? 'driving' : 'walking';
      world.renderer.domElement.dataset.district = districtAt(player.seated ? car.pos.x : player.pos.x, player.seated ? car.pos.z : player.pos.z);
    }

    world.input = input;
    camera.walking(player.pos.x, player.pos.z);
    camera.update(1 / 60, player.pos, 0, true);
    world.start(update, (delta, time) => {
      if (world.stages) {
        world.waterfront.update(time);
        hud.update(delta, player, car, player.seated ? camera.yaw : player.yaw);
      }
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
      palms: city.props.palms,
      lamps: city.props.lamps,
      ambientMark: Math.floor(ambient() * 1000000),
    };
  } catch (error) {
    message(error);
  }
}

boot();
