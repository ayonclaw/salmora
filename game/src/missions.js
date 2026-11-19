import * as T from 'three';

const JOBS = [
  {
    title: 'The ferry ledger',
    objective: 'Meet the ferry clerk at Lantern Quay',
    dialogue: ['Mara: The tide took the old manifests.', 'Mara: Bring this ledger to the tide gauge.'],
    x: -15, z: 4.8, radius: 4.8, dwell: 1.15, maxHeat: 5, reward: 200,
  },
  {
    title: 'A dry copy',
    objective: 'Take the ledger to the High Cistern',
    dialogue: ['Clerk: The ink is running. Keep it above the spray.', 'Clerk: One last favor at Pilot Pier.'],
    x: 0, z: -42, radius: 5.2, dwell: 1.65, maxHeat: 0, reward: 330,
  },
  {
    title: 'Last crossing',
    objective: 'Deliver the copy at Pilot Pier',
    dialogue: ['Mara: The night ferry is finally accounted for.', 'Mara: Keep the quay lights on.'],
    x: 0, z: 34, radius: 5.5, dwell: 1.5, maxHeat: 1, reward: 460,
  },
];

function ring(scene) {
  const group = new T.Group();
  const gold = new T.MeshStandardMaterial({ color: 0xf4c775, emissive: 0x72501d, emissiveIntensity: .65, metalness: .23, roughness: .39 });
  const pale = new T.MeshBasicMaterial({ color: 0xffe6a7, transparent: true, opacity: .48, depthWrite: false });
  const loop = new T.Mesh(new T.TorusGeometry(1.35, .075, 9, 32), gold);
  loop.rotation.x = Math.PI / 2;
  loop.position.y = .17;
  group.add(loop);
  const echo = new T.Mesh(new T.TorusGeometry(1.7, .025, 6, 32), pale);
  echo.rotation.x = Math.PI / 2;
  echo.position.y = .12;
  group.add(echo);
  const beamMaterial = new T.MeshBasicMaterial({ color: 0xe9b66c, transparent: true, opacity: .16, depthWrite: false, side: T.DoubleSide });
  const beam = new T.Mesh(new T.CylinderGeometry(.34, .94, 8, 12, 1, true), beamMaterial);
  beam.position.y = 4;
  group.add(beam);
  group.userData.loop = loop;
  group.userData.echo = echo;
  group.userData.beam = beam;
  scene.add(group);
  return group;
}

export class Missions {
  constructor(scene, hud, save, { audio = null } = {}) {
    this.scene = scene;
    this.hud = hud;
    this.save = save;
    this.audio = audio;
    this.index = Math.min(3, Math.max(0, save?.data?.mission ?? 0));
    this.progress = 0;
    this.dialogueTime = 0;
    this.dialogueIndex = 0;
    this.completed = this.index;
    this.completions = [];
    this.elapsed = 0;
    this.beacon = ring(scene);
    this.lastMessage = '';
    this.syncBeacon();
    this.publish();
  }

  current() {
    return JOBS[this.index] ?? null;
  }

  syncBeacon() {
    const job = this.current();
    this.beacon.visible = Boolean(job);
    if (job) this.beacon.position.set(job.x, .04, job.z);
  }

  publish() {
    const job = this.current();
    const suffix = job ? `JOB ${String(this.index + 1).padStart(2, '0')} / ${job.title}` : 'ALL QUAY JOBS COMPLETE';
    this.hud?.setMission?.(suffix, job?.objective ?? 'The harbor ledger is complete');
  }

  complete(player, police) {
    const job = this.current();
    if (!job) return;
    const before = player.cash;
    player.cash += job.reward;
    this.completions.push({ index: this.index, title: job.title, payout: job.reward, before, after: player.cash });
    this.completed = this.index + 1;
    this.index++;
    this.progress = 0;
    this.dialogueTime = 7;
    this.dialogueIndex = 0;
    this.audio?.mission();
    this.hud?.toast?.(`DELIVERY COMPLETE   +${job.reward} CROWNS`);
    this.save?.checkpoint?.(player, police.stars, this.index);
    this.syncBeacon();
    this.publish();
  }

  update(dt, player, car, input, police) {
    this.elapsed += dt;
    this.dialogueTime = Math.max(0, this.dialogueTime - dt);
    const job = this.current();
    if (!job) {
      this.beacon.visible = false;
      this.hud?.setMission?.('HARBOR BOOK CLOSED', 'All three deliveries are complete');
      return { consumed: false, ready: false, progress: 1 };
    }
    const target = player.seated ? car.pos : player.pos;
    const distance = Math.hypot(target.x - job.x, target.z - job.z);
    const inRange = distance <= job.radius;
    const safe = police.stars <= job.maxHeat;
    if (inRange && safe) this.progress = Math.min(job.dwell, this.progress + dt);
    else this.progress = Math.max(0, this.progress - dt * 1.8);
    const ready = this.progress >= job.dwell;
    const interaction = ready && input.take('KeyQ');
    if (interaction) this.complete(player, police);
    const pulse = 1 + Math.sin(this.elapsed * 3.5) * .11;
    this.beacon.userData.loop.scale.setScalar(pulse);
    this.beacon.userData.echo.scale.setScalar(.94 + (1 - pulse) * .7);
    this.beacon.userData.beam.material.opacity = .12 + Math.max(0, Math.sin(this.elapsed * 2)) * .09;
    const percent = Math.round(this.progress / job.dwell * 100);
    let detail = job.objective;
    if (!safe) detail = `Lose the heat first · ${police.stars} wanted star${police.stars === 1 ? '' : 's'}`;
    else if (!inRange) detail = `${job.objective} · ${Math.round(distance)}m`;
    else if (!ready) detail = `Hold position · ${percent}%`;
    else detail = 'Press Q to hand it over';
    this.hud?.setMission?.(`JOB ${String(this.index + 1).padStart(2, '0')} / ${job.title}`, detail, this.progress / job.dwell);
    if (this.dialogueTime > 0) {
      const line = job.dialogue[this.dialogueIndex % job.dialogue.length];
      this.hud?.setDialogue?.(line, this.dialogueTime);
      if (Math.floor(this.elapsed * 1.3) !== Math.floor((this.elapsed - dt) * 1.3)) this.dialogueIndex++;
    }
    return { consumed: interaction, ready, progress: this.progress / job.dwell, distance, safe };
  }

  status() {
    return {
      index: this.index,
      completed: this.completed,
      title: this.current()?.title ?? 'complete',
      progress: this.current() ? Math.min(1, this.progress / this.current().dwell) : 1,
      payouts: this.completions.map(item => item.payout),
      lastMessage: this.lastMessage,
    };
  }

  stage(position = 0) {
    this.index = Math.max(0, Math.min(JOBS.length, position));
    this.progress = 0;
    this.syncBeacon();
    this.publish();
  }
}
