// TIDE & THUNDER — the Harbor Crew arc: four story missions with 3D beacons,
// package pickups, a lose-the-heat escape, and a finale chase to the harbor.

import * as THREE from 'three';
import { MISSIONS } from './config.js';

function makeBeaconMesh(colorHex) {
  const group = new THREE.Group();
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 2.2, 30, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
  );
  pillar.position.y = 15;
  group.add(pillar);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.4, 0.22, 8, 32),
    new THREE.MeshBasicMaterial({ color: colorHex }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.4;
  group.add(ring);
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  );
  core.position.y = 1.2;
  group.add(core);
  group.userData.ring = ring;
  group.userData.core = core;
  return group;
}

function makePackageMesh() {
  const group = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.9), new THREE.MeshLambertMaterial({ color: 0x8a5a2a }));
  box.position.y = 0.5;
  group.add(box);
  const glow = new THREE.Mesh(
    new THREE.BoxGeometry(1.05, 0.1, 1.05),
    new THREE.MeshBasicMaterial({ color: 0xffd23e }),
  );
  glow.position.y = 0.85;
  group.add(glow);
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.7, 14, 8, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
  );
  pillar.position.y = 7;
  group.add(pillar);
  return group;
}

export class Missions {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world; // { player, police, gangsters, sound, hud, save }
    this.index = 0;      // next mission to run
    this.active = null;  // runtime state of the running mission
    this.beacon = null;
    this.dropMeshes = [];
    this.completedCount = 0;
    this.time = 0;
  }

  get currentDef() {
    return MISSIONS[this.index] || null;
  }

  get done() {
    return this.index >= MISSIONS.length;
  }

  setProgress(index, completedCount) {
    this.index = index;
    this.completedCount = completedCount;
  }

  start() {
    const def = this.currentDef;
    if (!def || this.active) return;
    this.active = { def, dropsLeft: def.drops ? def.drops.length : 0, collected: 0, startedAt: this.time };
    if (def.startWanted) this.world.police.setWanted(def.startWanted);
    if (def.target) this.placeBeacon(def.target.x, def.target.z);
    if (def.drops) {
      def.drops.forEach((d, i) => {
        const mesh = makePackageMesh();
        mesh.position.set(d.x, 0, d.z);
        this.scene.add(mesh);
        this.dropMeshes.push({ mesh, x: d.x, z: d.z, taken: false });
        // Rival lookouts guard the second and fourth drops.
        if (i === 1 || i === 3) this.world.gangsters.spawnSquad(d.x, d.z, 2);
      });
    }
    if (def.id === 'storm-break') this.world.gangsters.spawnSquad(0, 150, 3);
    this.world.hud.setObjective(`${def.name} — ${def.brief}`);
    this.world.hud.toast(`${def.name}: ${def.brief}`, 4200);
    if (this.world.sound) this.world.sound.pickup();
  }

  placeBeacon(x, z) {
    this.clearBeacon();
    this.beacon = makeBeaconMesh(0xffd23e);
    this.beacon.position.set(x, 0, z);
    this.scene.add(this.beacon);
    this.beaconTarget = { x, z };
  }

  clearBeacon() {
    if (this.beacon) {
      this.scene.remove(this.beacon);
      this.beacon = null;
    }
    this.beaconTarget = null;
  }

  clearDrops() {
    for (const d of this.dropMeshes) this.scene.remove(d.mesh);
    this.dropMeshes = [];
  }

  complete() {
    const def = this.active.def;
    this.clearBeacon();
    this.clearDrops();
    this.world.gangsters.clear();
    this.active = null;
    this.index += 1;
    this.completedCount += 1;
    this.world.cash += def.reward;
    this.world.totalEarned += def.reward;
    this.world.police.clearWanted();
    this.world.hud.toast(`JOB DONE — ${def.name} +$${def.reward}`, 3600);
    if (this.world.sound) this.world.sound.pickup();
    this.world.hud.setObjective(this.done
      ? 'CREW LEGEND — the Harbor Crew is yours. Free roam: steal, drive, survive the storm.'
      : `Next job ready: ${MISSIONS[this.index].name} — press N to start it.`);
    this.world.save();
    this.world.hud.refreshMissionList(this.index);
  }

  fail(reason) {
    this.clearBeacon();
    this.clearDrops();
    this.world.gangsters.clear();
    this.active = null;
    this.world.hud.toast(reason, 3600);
    this.world.hud.setObjective(`Job failed. Press N to retry ${this.currentDef ? this.currentDef.name : 'the next job'}.`);
  }

  update(dt) {
    this.time += dt;
    if (this.beacon) {
      this.beacon.userData.ring.rotation.z += dt * 1.2;
      this.beacon.userData.core.position.y = 1.2 + Math.sin(this.time * 3) * 0.25;
    }
    for (const d of this.dropMeshes) {
      if (!d.taken) d.mesh.rotation.y += dt;
    }
    if (!this.active) return;
    const def = this.active.def;
    const p = this.world.player.pos;

    if (def.target) {
      const d = Math.hypot(p.x - def.target.x, p.z - def.target.z);
      if (d < 6) {
        this.complete();
        return;
      }
    }
    if (def.drops) {
      for (const drop of this.dropMeshes) {
        if (drop.taken) continue;
        if (Math.hypot(p.x - drop.x, p.z - drop.z) < 3) {
          drop.taken = true;
          this.scene.remove(drop.mesh);
          this.active.collected += 1;
          this.active.dropsLeft -= 1;
          if (this.world.sound) this.world.sound.pickup();
          this.world.hud.toast(`Package ${this.active.collected}/5 secured`, 1800);
          this.world.hud.setObjective(`${def.name} — ${this.active.dropsLeft} package${this.active.dropsLeft === 1 ? '' : 's'} left.`);
          if (this.active.dropsLeft <= 0) {
            this.complete();
            return;
          }
        }
      }
    }
    if (def.id === 'heat-wave' && this.world.police.level === 0) {
      this.complete();
    }
  }

  beaconPosition() {
    if (this.beaconTarget) return this.beaconTarget;
    if (this.active && this.active.def.drops) {
      const next = this.dropMeshes.find((d) => !d.taken);
      if (next) return { x: next.x, z: next.z };
    }
    return null;
  }
}
