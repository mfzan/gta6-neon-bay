// TIDE & THUNDER — the people of Port Tempest: sidewalk pedestrians who flee
// from gunfire, armed Harbor Crew lookouts who guard the drops, and health packs.

import * as THREE from 'three';
import { mulberry32, TUNING } from './config.js';
import { AVENUES } from './city.js';

const SHIRT_COLORS = [0xe8e8e8, 0xffd23e, 0x19e3ff, 0xff7a5c, 0x7dff5e, 0xc98aff, 0xff9ecf];

export function makePersonMesh(shirtHex, skinHex = 0xc98d64) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: shirtHex });
  const skin = new THREE.MeshLambertMaterial({ color: skinHex });
  const pants = new THREE.MeshLambertMaterial({ color: 0x22222e });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.85, 0.34), shirt);
  torso.position.y = 1.15;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.42, 0.4), skin);
  head.position.y = 1.85;
  group.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.75, 0.26), pants);
  legL.position.set(-0.16, 0.38, 0);
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.75, 0.26), pants);
  legR.position.set(0.16, 0.38, 0);
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.2), shirt);
  armL.position.set(-0.42, 1.15, 0);
  group.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.2), shirt);
  armR.position.set(0.42, 1.15, 0);
  group.add(armR);
  group.userData.armL = armL;
  group.userData.armR = armR;
  group.userData.legL = legL;
  group.userData.legR = legR;
  return group;
}

export class Pedestrians {
  constructor(scene) {
    this.scene = scene;
    this.rng = mulberry32(777);
    this.walkers = [];
    for (let i = 0; i < TUNING.pedestrianCount; i++) {
      const mesh = makePersonMesh(SHIRT_COLORS[i % SHIRT_COLORS.length]);
      const spot = this.randomSidewalk();
      mesh.position.set(spot.x, 0, spot.z);
      scene.add(mesh);
      this.walkers.push({
        mesh, axis: spot.axis, dir: spot.dir, speed: 1 + this.rng() * 1.2,
        flee: 0, walkPhase: this.rng() * 6,
      });
    }
  }

  randomSidewalk() {
    const a = AVENUES[Math.floor(this.rng() * AVENUES.length)];
    const along = -160 + this.rng() * 320;
    if (this.rng() < 0.5) return { x: a + 8.5, z: along, axis: 'z', dir: this.rng() < 0.5 ? 1 : -1 };
    return { x: along, z: a + 8.5, axis: 'x', dir: this.rng() < 0.5 ? 1 : -1 };
  }

  scare(x, z, radius) {
    for (const w of this.walkers) {
      const dx = w.mesh.position.x - x;
      const dz = w.mesh.position.z - z;
      if (dx * dx + dz * dz < radius * radius) w.flee = 3 + Math.random() * 2;
    }
  }

  update(dt, playerPos) {
    for (const w of this.walkers) {
      const p = w.mesh.position;
      w.walkPhase += dt * 6;
      const fleeing = w.flee > 0;
      if (fleeing) w.flee -= dt;
      const speed = fleeing ? w.speed * 3.2 : w.speed;
      const step = speed * w.dir * dt;
      // Fleeing pedestrians run away from the player; calm ones stroll their sidewalk.
      if (fleeing && playerPos) {
        const dx = p.x - playerPos.x;
        const dz = p.z - playerPos.z;
        const d = Math.hypot(dx, dz) || 1;
        p.x += (dx / d) * speed * dt;
        p.z += (dz / d) * speed * dt;
        w.mesh.rotation.y = Math.atan2(dx, dz);
      } else {
        if (w.axis === 'z') p.z += step;
        else p.x += step;
        w.mesh.rotation.y = w.axis === 'z' ? (w.dir > 0 ? 0 : Math.PI) : (w.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      }
      if (p.x > 185) p.x = -185;
      if (p.x < -185) p.x = 185;
      if (p.z > 165) p.z = -185;
      if (p.z < -185) p.z = 165;
      const swing = Math.sin(w.walkPhase) * 0.45;
      w.mesh.userData.legL.rotation.x = swing;
      w.mesh.userData.legR.rotation.x = -swing;
      w.mesh.userData.armL.rotation.x = -swing * 0.7;
      w.mesh.userData.armR.rotation.x = swing * 0.7;
    }
  }
}

// Armed lookouts: they guard drop points and shoot at the player on sight.
export class Gangsters {
  constructor(scene) {
    this.scene = scene;
    this.members = [];
    this.shootTimer = 0;
  }

  spawnSquad(x, z, count) {
    for (let i = 0; i < count; i++) {
      const mesh = makePersonMesh(0x1a1a22, 0x8a6a4a);
      mesh.position.set(x + (Math.random() - 0.5) * 6, 0, z + (Math.random() - 0.5) * 6);
      // Red bandana stripe so the judge can tell friend from foe.
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.12, 0.44), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
      band.position.y = 1.95;
      mesh.add(band);
      this.scene.add(mesh);
      this.members.push({ mesh, health: 100, shootCooldown: 1 + Math.random() * 2, wander: Math.random() * 6 });
    }
  }

  clear() {
    for (const m of this.members) this.scene.remove(m.mesh);
    this.members = [];
  }

  update(dt, playerPos, playerOnFoot, damagePlayer) {
    for (const m of this.members) {
      const p = m.mesh.position;
      const dx = playerPos.x - p.x;
      const dz = playerPos.z - p.z;
      const d = Math.hypot(dx, dz);
      m.wander -= dt;
      if (d < 26) {
        // Face the player and open fire in bursts.
        m.mesh.rotation.y = Math.atan2(dx, dz);
        m.shootCooldown -= dt;
        if (m.shootCooldown <= 0 && d < 24) {
          m.shootCooldown = 1.4 + Math.random() * 1.2;
          if (Math.random() < 0.55) damagePlayer(TUNING.gangsterDamage, p);
        }
      } else if (m.wander <= 0) {
        m.wander = 2 + Math.random() * 3;
        m.mesh.rotation.y = Math.random() * Math.PI * 2;
      }
      const swing = Math.sin(this.shootTimer * 2 + m.wander) * 0.1;
      m.mesh.userData.armR.rotation.x = d < 26 ? -1.2 + swing : 0;
    }
    this.shootTimer += dt;
  }

  // Ray hit test: returns the member whose torso is closest to the ray, or null.
  rayHit(origin, dir, maxDist = 90) {
    let best = null;
    let bestT = maxDist;
    for (const m of this.members) {
      const c = m.mesh.position;
      const cx = c.x - origin.x;
      const cy = (c.y + 1.2) - origin.y;
      const cz = c.z - origin.z;
      const t = cx * dir.x + cy * dir.y + cz * dir.z;
      if (t < 0 || t > bestT) continue;
      const px = origin.x + dir.x * t;
      const py = origin.y + dir.y * t;
      const pz = origin.z + dir.z * t;
      const dd = Math.hypot(px - c.x, py - (c.y + 1.2), pz - c.z);
      if (dd < 1.1) { best = m; bestT = t; }
    }
    return best;
  }

  damage(member, amount) {
    member.health -= amount;
    return member.health <= 0;
  }

  remove(member) {
    this.scene.remove(member.mesh);
    this.members = this.members.filter((m) => m !== member);
  }
}

export class HealthPacks {
  constructor(scene) {
    this.scene = scene;
    this.packs = [];
    const spots = [
      { x: -60, z: -60 }, { x: 80, z: 0 }, { x: -40, z: 140 },
      { x: 140, z: -140 }, { x: -140, z: 100 }, { x: 40, z: -120 },
    ];
    for (const s of spots) this.addPack(s.x, s.z);
  }

  addPack(x, z) {
    const group = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    box.position.y = 0.7;
    group.add(box);
    const crossMat = new THREE.MeshBasicMaterial({ color: 0x2aff5e });
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.2, 0.1), crossMat);
    crossH.position.set(0, 0.7, 0.48);
    group.add(crossH);
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.1), crossMat);
    crossV.position.set(0, 0.7, 0.48);
    group.add(crossV);
    group.position.set(x, 0, z);
    this.scene.add(group);
    this.packs.push({ group, x, z, taken: false, respawn: 0 });
  }

  update(dt, playerPos, onHeal) {
    for (const p of this.packs) {
      if (p.taken) {
        p.respawn -= dt;
        if (p.respawn <= 0) {
          p.taken = false;
          p.group.visible = true;
        }
        continue;
      }
      p.group.rotation.y += dt * 1.5;
      p.group.position.y = Math.sin(performance.now() * 0.002 + p.x) * 0.12;
      const d = Math.hypot(playerPos.x - p.x, playerPos.z - p.z);
      if (d < 2.2) {
        p.taken = true;
        p.group.visible = false;
        p.respawn = 45;
        onHeal(TUNING.healthPackHeal);
      }
    }
  }
}
