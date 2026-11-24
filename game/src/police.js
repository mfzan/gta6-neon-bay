// TIDE & THUNDER — the Port Tempest Harbor Police: a 0–5 star wanted level,
// interceptors that spawn, chase and ram, foot officers who bust the player,
// and a heat level that cools when the player breaks line of sight.

import * as THREE from 'three';
import { TUNING } from './config.js';
import { createCarMesh } from './vehicles.js';
import { makePersonMesh } from './people.js';
import { collideCircle, groundHeightAt } from './city.js';

export class Police {
  constructor(scene, city, callbacks) {
    this.scene = scene;
    this.city = city;
    this.cb = callbacks; // { onBusted, onCarDestroyed }
    this.wanted = 0;
    this.heat = 0;        // 0..1 within the current star level
    this.cars = [];
    this.officers = [];
    this.spawnTimer = 0;
    this.flashPhase = 0;
    this.bustedTimer = 0;
  }

  get level() {
    return this.wanted;
  }

  addWanted(n, reason) {
    const before = this.wanted;
    this.wanted = Math.max(0, Math.min(5, this.wanted + n));
    if (this.wanted > before) this.heat = 0.4;
    return this.wanted;
  }

  setWanted(n) {
    this.wanted = Math.max(0, Math.min(5, n));
    this.heat = 0.5;
  }

  clearWanted() {
    this.wanted = 0;
    this.heat = 0;
    this.despawnAll();
  }

  desiredCarCount() {
    return this.wanted === 0 ? 0 : Math.min(5, this.wanted + 1);
  }

  spawnCarAt(x, z) {
    const mesh = createCarMesh(0x14141c, 'police');
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    this.cars.push({ mesh, speed: 0, stuck: 0 });
  }

  spawnCarNear(x, z) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 35 + Math.random() * 25;
    const sx = Math.max(-185, Math.min(185, x + Math.sin(angle) * dist));
    const sz = Math.max(-185, Math.min(185, z + Math.cos(angle) * dist));
    this.spawnCarAt(sx, sz);
  }

  spawnOfficerNear(x, z) {
    const mesh = makePersonMesh(0x1c2f6e, 0xc98d64);
    const angle = Math.random() * Math.PI * 2;
    mesh.position.set(x + Math.sin(angle) * 8, 0, z + Math.cos(angle) * 8);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.14, 0.44), new THREE.MeshBasicMaterial({ color: 0x0e1a3a }));
    cap.position.y = 2.1;
    mesh.add(cap);
    this.scene.add(mesh);
    this.officers.push({ mesh, speed: 5.2 });
  }

  despawnAll() {
    for (const c of this.cars) this.scene.remove(c.mesh);
    for (const o of this.officers) this.scene.remove(o.mesh);
    this.cars = [];
    this.officers = [];
  }

  // Is any police unit close enough to see the player?
  anyUnitNear(playerPos, radius) {
    for (const c of this.cars) {
      if (Math.hypot(c.mesh.position.x - playerPos.x, c.mesh.position.z - playerPos.z) < radius) return true;
    }
    for (const o of this.officers) {
      if (Math.hypot(o.mesh.position.x - playerPos.x, o.mesh.position.z - playerPos.z) < radius) return true;
    }
    return false;
  }

  update(dt, player, trafficCars) {
    this.flashPhase += dt * 6;
    const flashOn = Math.sin(this.flashPhase) > 0;
    for (const c of this.cars) {
      if (c.mesh.userData.redLens) c.mesh.userData.redLens.material.color.setHex(flashOn ? 0xff2a2a : 0x550000);
      if (c.mesh.userData.blueLens) c.mesh.userData.blueLens.material.color.setHex(flashOn ? 0x0a1a44 : 0x2a6bff);
    }

    if (this.wanted === 0) {
      // Heat gone: units peel off and drive away.
      if (this.cars.length > 0 || this.officers.length > 0) {
        this.despawnAll();
      }
      return;
    }

    // Reinforcements arrive until the street is full of flashing lights.
    this.spawnTimer -= dt;
    if (this.cars.length < this.desiredCarCount() && this.spawnTimer <= 0) {
      this.spawnTimer = 1.6;
      this.spawnCarNear(player.pos.x, player.pos.z);
    }
    if (this.wanted >= 3 && this.officers.length < 2 && player.onFoot && this.spawnTimer <= -0.5) {
      this.spawnOfficerNear(player.pos.x, player.pos.z);
    }

    // Heat decays only while no unit can see the player.
    const seen = this.anyUnitNear(player.pos, 30);
    if (!seen) {
      this.heat -= dt * (TUNING.wantedDecayPerSec + TUNING.wantedHiddenBonus);
    } else {
      this.heat = Math.min(1, this.heat + dt * 0.05);
    }
    if (this.heat <= 0 && this.wanted > 0) {
      this.wanted -= 1;
      this.heat = this.wanted > 0 ? 0.7 : 0;
      if (this.wanted === 0) this.despawnAll();
    }

    const targetSpeed = Math.min(TUNING.policeTopSpeed, 26 + this.wanted * 4);
    for (const c of this.cars) {
      const p = c.mesh.position;
      const dx = player.pos.x - p.x;
      const dz = player.pos.z - p.z;
      const d = Math.hypot(dx, dz);
      // Ram: aim slightly ahead of a moving player.
      const lead = player.onFoot ? 0 : 0.6;
      const tx = player.pos.x + (player.onFoot ? 0 : Math.sin(player.carHeading) * player.carSpeed * lead);
      const tz = player.pos.z + (player.onFoot ? 0 : Math.cos(player.carHeading) * player.carSpeed * lead);
      const wantYaw = Math.atan2(tx - p.x, tz - p.z);
      let dy = wantYaw - c.mesh.rotation.y;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      c.mesh.rotation.y += dy * Math.min(1, dt * 3.2);
      c.speed += (targetSpeed - c.speed) * Math.min(1, dt * 0.9);
      if (d > 4) {
        const step = c.speed * dt;
        let nx = p.x + Math.sin(c.mesh.rotation.y) * step;
        let nz = p.z + Math.cos(c.mesh.rotation.y) * step;
        const hit = collideCircle(this.city.colliders, nx, nz, 1.9);
        if (hit.hit) {
          c.speed *= 0.4;
          c.stuck += dt;
          if (c.stuck > 3) {
            // Stuck on a building: respawn the unit elsewhere.
            this.scene.remove(c.mesh);
            this.cars = this.cars.filter((x) => x !== c);
            this.spawnCarNear(player.pos.x, player.pos.z);
            continue;
          }
        } else {
          c.stuck = 0;
        }
        nx = hit.x; nz = hit.z;
        p.set(nx, groundHeightAt(nx, nz), nz);
      }
      // Ram contact: shove the player's car and slow it.
      if (d < 3.6 && !player.onFoot) {
        player.carSpeed *= 0.86;
        if (this.cb.onRam) this.cb.onRam();
      }
      for (const w of c.mesh.userData.wheels || []) w.rotation.x += (c.speed * dt) / 0.38;
    }

    // Foot officers close in and bust the player on contact.
    for (const o of this.officers) {
      const p = o.mesh.position;
      const dx = player.pos.x - p.x;
      const dz = player.pos.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > 1.4) {
        o.mesh.rotation.y = Math.atan2(dx, dz);
        p.x += (dx / d) * o.speed * dt;
        p.z += (dz / d) * o.speed * dt;
        p.y = groundHeightAt(p.x, p.z);
        const swing = performance.now() * 0.012;
        o.mesh.userData.legL.rotation.x = Math.sin(swing) * 0.5;
        o.mesh.userData.legR.rotation.x = -Math.sin(swing) * 0.5;
      } else if (player.onFoot) {
        this.bustedTimer += dt;
        if (this.bustedTimer > 0.8 && this.cb.onBusted) {
          this.bustedTimer = 0;
          this.cb.onBusted();
        }
      }
    }
    if (this.officers.length === 0) this.bustedTimer = 0;
  }
}
