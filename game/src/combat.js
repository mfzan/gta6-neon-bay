// TIDE & THUNDER — combat: Mara's pistol, hitscan shots with tracers,
// muzzle flash, and the consequences of shooting the wrong people.

import * as THREE from 'three';
import { TUNING } from './config.js';

export class Combat {
  constructor(scene, sound, callbacks) {
    this.scene = scene;
    this.sound = sound;
    this.cb = callbacks; // { onShotPolice, onKillGangster, onHitPedestrian }
    this.tracers = [];
    this.cooldown = 0;
    this.muzzle = new THREE.PointLight(0xffc266, 0, 18);
    this.scene.add(this.muzzle);
  }

  canShoot() {
    return this.cooldown <= 0;
  }

  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.muzzle.intensity = Math.max(0, this.muzzle.intensity - dt * 60);
    for (const t of [...this.tracers]) {
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / 0.12);
      if (t.life <= 0) {
        this.scene.remove(t.line);
        this.tracers = this.tracers.filter((x) => x !== t);
      }
    }
  }

  shoot(origin, dir, gangsters, police, pedestrians) {
    if (!this.canShoot()) return null;
    this.cooldown = 0.28;
    if (this.sound) this.sound.gunshot();
    const end = origin.clone().addScaledVector(dir, 90);

    // Muzzle flash at the barrel.
    this.muzzle.position.copy(origin).addScaledVector(dir, 1.2);
    this.muzzle.intensity = 9;

    let hitPoint = end;
    let hitKind = null;
    let hitTarget = null;

    // Gangsters first: they are the ones shooting back.
    const g = gangsters ? gangsters.rayHit(origin, dir) : null;
    if (g) {
      hitKind = 'gangster';
      hitTarget = g;
      hitPoint = g.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0));
    } else if (police) {
      // Police cars are big targets: ray vs circle in the XZ plane.
      let bestT = 90;
      for (const c of police.cars) {
        const p = c.mesh.position;
        const ox = p.x - origin.x;
        const oz = p.z - origin.z;
        const t = ox * dir.x + oz * dir.z;
        if (t < 0 || t > bestT) continue;
        const px = origin.x + dir.x * t;
        const pz = origin.z + dir.z * t;
        if (Math.hypot(px - p.x, pz - p.z) < 2.2) {
          bestT = t;
          hitKind = 'police-car';
          hitTarget = c;
          hitPoint = new THREE.Vector3(px, 1, pz);
        }
      }
      if (!hitKind) {
        for (const o of police.officers) {
          const p = o.mesh.position;
          const ox = p.x - origin.x;
          const oy = (p.y + 1.2) - origin.y;
          const oz = p.z - origin.z;
          const t = ox * dir.x + oy * dir.y + oz * dir.z;
          if (t < 0 || t > bestT) continue;
          const px = origin.x + dir.x * t;
          const py = origin.y + dir.y * t;
          const pz = origin.z + dir.z * t;
          if (Math.hypot(px - p.x, py - (p.y + 1.2), pz - p.z) < 1.1) {
            bestT = t;
            hitKind = 'officer';
            hitTarget = o;
            hitPoint = new THREE.Vector3(px, py, pz);
          }
        }
      }
    }
    if (!hitKind && pedestrians) {
      // Hitting a bystander is possible — and the city notices.
      for (const w of pedestrians.walkers) {
        const p = w.mesh.position;
        const ox = p.x - origin.x;
        const oy = (p.y + 1.2) - origin.y;
        const oz = p.z - origin.z;
        const t = ox * dir.x + oy * dir.y + oz * dir.z;
        if (t < 0 || t > 90) continue;
        const px = origin.x + dir.x * t;
        const py = origin.y + dir.y * t;
        const pz = origin.z + dir.z * t;
        if (Math.hypot(px - p.x, py - (p.y + 1.2), pz - p.z) < 1.0) {
          hitKind = 'pedestrian';
          hitTarget = w;
          hitPoint = new THREE.Vector3(px, py, pz);
          break;
        }
      }
    }

    // Tracer line from muzzle to impact.
    const geo = new THREE.BufferGeometry().setFromPoints([origin.clone().addScaledVector(dir, 1.2), hitPoint]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 1 }));
    line.frustumCulled = false;
    this.scene.add(line);
    this.tracers.push({ line, life: 0.12 });

    if (hitKind === 'gangster' && gangsters) {
      const dead = gangsters.damage(hitTarget, TUNING.pistolDamage);
      if (dead) {
        gangsters.remove(hitTarget);
        if (this.cb.onKillGangster) this.cb.onKillGangster(hitPoint);
      }
    } else if ((hitKind === 'police-car' || hitKind === 'officer') && this.cb.onShotPolice) {
      this.cb.onShotPolice(hitPoint);
    } else if (hitKind === 'pedestrian') {
      if (pedestrians) pedestrians.scare(hitPoint.x, hitPoint.z, 30);
      if (this.cb.onHitPedestrian) this.cb.onHitPedestrian(hitPoint);
    }
    return { kind: hitKind, point: hitPoint };
  }
}
