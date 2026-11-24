// TIDE & THUNDER — Mara Voss: on-foot movement with mouse look, arcade car
// physics on rain-slick streets, and entering / stealing cars with E.

import * as THREE from 'three';
import { TUNING, CAR_COLORS } from './config.js';
import { collideCircle, groundHeightAt } from './city.js';
import { makePersonMesh } from './people.js';
import { createCarMesh } from './vehicles.js';

export class Player {
  constructor(scene, city, sound, callbacks) {
    this.scene = scene;
    this.city = city;
    this.sound = sound;
    this.cb = callbacks; // { onSteal, onEnterCar, onExitCar, onCrash }
    this.pos = new THREE.Vector3(city.spawn.x, 0, city.spawn.z);
    this.yaw = city.spawn.yaw;
    this.camYaw = city.spawn.yaw;
    this.camPitch = 0.32;
    this.health = TUNING.playerMaxHealth;
    this.onFoot = true;
    this.car = null;         // the driven car mesh (parked or stolen)
    this.carName = '';
    this.carSpeed = 0;
    this.carHeading = 0;
    this.steer = 0;
    this.moveDir = new THREE.Vector3();
    this.speedMph = 0;

    // Mara Voss: navy jacket, dark hair, unmistakable in a crowd.
    this.mesh = makePersonMesh(0x2f4a6a, 0xc98d64);
    this.mesh.position.copy(this.pos);
    scene.add(this.mesh);

    // Parked cars the player owns the keys to (well — one of them).
    this.parked = [];
    city.parkedSpots.forEach((spot, i) => {
      const info = CAR_COLORS[i % CAR_COLORS.length];
      const mesh = createCarMesh(info.hex, 'civilian');
      mesh.position.set(spot.x, 0, spot.z);
      mesh.rotation.y = spot.yaw;
      scene.add(mesh);
      this.parked.push({ mesh, name: info.name, taken: false });
    });
  }

  eyePosition() {
    return new THREE.Vector3(this.pos.x, this.pos.y + 1.7, this.pos.z);
  }

  aimDirection() {
    return new THREE.Vector3(-Math.sin(this.camYaw) * Math.cos(this.camPitch), Math.sin(this.camPitch), -Math.cos(this.camYaw) * Math.cos(this.camPitch));
  }

  nearestEnterableCar(maxDist = 6.5) {
    let best = null;
    let bestD = maxDist;
    for (const p of this.parked) {
      if (p.taken) continue;
      const d = Math.hypot(p.mesh.position.x - this.pos.x, p.mesh.position.z - this.pos.z);
      if (d < bestD) { bestD = d; best = { mesh: p.mesh, name: p.name, parked: p }; }
    }
    return best;
  }

  tryEnterCar(traffic) {
    if (!this.onFoot) return false;
    const parked = this.nearestEnterableCar();
    if (parked) {
      parked.parked.taken = true;
      this.enterCar(parked.mesh, parked.name);
      return true;
    }
    const near = traffic ? traffic.nearestCar(this.pos.x, this.pos.z, 6.5) : null;
    if (near) {
      traffic.removeCar(near);
      this.enterCar(near.mesh, 'Borrowed Sedan');
      if (this.cb.onSteal) this.cb.onSteal(near.mesh.position);
      return true;
    }
    return false;
  }

  enterCar(mesh, name) {
    this.onFoot = false;
    this.car = mesh;
    this.carName = name;
    this.carHeading = mesh.rotation.y;
    this.carSpeed = 0;
    this.mesh.visible = false;
    if (this.cb.onEnterCar) this.cb.onEnterCar(name);
  }

  exitCar() {
    if (this.onFoot || !this.car) return;
    const side = new THREE.Vector3(Math.cos(this.carHeading), 0, -Math.sin(this.carHeading));
    this.pos.set(
      this.car.position.x + side.x * 2.2,
      groundHeightAt(this.car.position.x + side.x * 2.2, this.car.position.z + side.z * 2.2),
      this.car.position.z + side.z * 2.2,
    );
    this.yaw = this.carHeading;
    this.camYaw = this.carHeading;
    this.onFoot = true;
    this.mesh.visible = true;
    this.mesh.position.copy(this.pos);
    this.car = null;
    this.carSpeed = 0;
    if (this.cb.onExitCar) this.cb.onExitCar();
  }

  damage(amount) {
    this.health = Math.max(0, this.health - amount);
    return this.health <= 0;
  }

  heal(amount) {
    this.health = Math.min(TUNING.playerMaxHealth, this.health + amount);
  }

  resetToSpawn() {
    if (this.car) {
      this.scene.remove(this.car);
      this.car = null;
    }
    this.onFoot = true;
    this.mesh.visible = true;
    this.pos.set(this.city.spawn.x, 0, this.city.spawn.z);
    this.mesh.position.copy(this.pos);
    this.health = TUNING.playerMaxHealth;
    this.carSpeed = 0;
    // A fresh parked car waits near spawn after a bust.
    for (const p of this.parked) {
      if (!p.taken) return;
    }
    const spot = this.city.parkedSpots[0];
    const mesh = createCarMesh(0xd84040, 'civilian');
    mesh.position.set(spot.x, 0, spot.z);
    mesh.rotation.y = spot.yaw;
    this.scene.add(mesh);
    this.parked.push({ mesh, name: 'Sunset Coupe', taken: false });
  }

  update(dt, keys, mouseDX, mouseDY, trafficCars) {
    this.camYaw -= mouseDX * 0.0026;
    this.camPitch = Math.max(-0.5, Math.min(0.7, this.camPitch - mouseDY * 0.0022));

    if (this.onFoot) {
      this.updateOnFoot(dt, keys);
    } else {
      this.updateDriving(dt, keys, trafficCars);
    }
    if (this.sound) this.sound.setEngineSpeed(Math.abs(this.carSpeed) / TUNING.carMaxSpeed, !this.onFoot);
  }

  updateOnFoot(dt, keys) {
    const run = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const speed = run ? TUNING.runSpeed : TUNING.walkSpeed;
    let fx = 0;
    let fz = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) fz += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) fz -= 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) fx -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) fx += 1;
    const len = Math.hypot(fx, fz);
    if (len > 0) {
      fx /= len;
      fz /= len;
      const sin = Math.sin(this.camYaw);
      const cos = Math.cos(this.camYaw);
      // Forward is -Z rotated by camYaw; strafe is its perpendicular.
      const moveX = -sin * fz + cos * fx;
      const moveZ = -cos * fz - sin * fx;
      let nx = this.pos.x + moveX * speed * dt;
      let nz = this.pos.z + moveZ * speed * dt;
      const hit = collideCircle(this.city.colliders, nx, nz, 0.7);
      nx = hit.x; nz = hit.z;
      this.pos.x = Math.max(-195, Math.min(195, nx));
      this.pos.z = Math.max(-195, Math.min(195, nz));
      this.pos.y = groundHeightAt(this.pos.x, this.pos.z);
      this.yaw = Math.atan2(moveX, moveZ);
      this.moveDir.set(moveX, 0, moveZ);
      const swing = performance.now() * 0.012;
      const amp = run ? 0.6 : 0.4;
      this.mesh.userData.legL.rotation.x = Math.sin(swing) * amp;
      this.mesh.userData.legR.rotation.x = -Math.sin(swing) * amp;
      this.mesh.userData.armL.rotation.x = -Math.sin(swing) * amp * 0.8;
      this.mesh.userData.armR.rotation.x = Math.sin(swing) * amp * 0.8;
    } else {
      this.mesh.userData.legL.rotation.x *= 0.8;
      this.mesh.userData.legR.rotation.x *= 0.8;
      this.mesh.userData.armL.rotation.x *= 0.8;
      this.mesh.userData.armR.rotation.x *= 0.8;
    }
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.yaw;
  }

  updateDriving(dt, keys, trafficCars) {
    const forward = keys.has('KeyW') || keys.has('ArrowUp');
    const back = keys.has('KeyS') || keys.has('ArrowDown');
    const left = keys.has('KeyA') || keys.has('ArrowLeft');
    const right = keys.has('KeyD') || keys.has('ArrowRight');
    const brake = keys.has('Space');

    if (forward) this.carSpeed += TUNING.carAccel * dt;
    else if (back) this.carSpeed -= (this.carSpeed > 0.5 ? TUNING.carBrake : TUNING.carAccel * 0.6) * dt;
    else {
      const drag = 8 * dt;
      if (Math.abs(this.carSpeed) <= drag) this.carSpeed = 0;
      else this.carSpeed -= Math.sign(this.carSpeed) * drag;
    }
    if (brake) this.carSpeed *= Math.max(0, 1 - 3.2 * dt);
    this.carSpeed = Math.max(-TUNING.carReverseMax, Math.min(TUNING.carMaxSpeed, this.carSpeed));

    // Steering: less bite at speed, and the storm makes the tail step out.
    const grip = this.gripValue !== undefined ? this.gripValue : TUNING.dryGrip;
    const steerInput = (left ? 1 : 0) - (right ? 1 : 0);
    const speedFactor = Math.min(1, Math.abs(this.carSpeed) / 14);
    this.steer += (steerInput - this.steer) * Math.min(1, dt * 8);
    const turnRate = TUNING.carTurn * this.steer * speedFactor * Math.sign(this.carSpeed || 1);
    this.carHeading += turnRate * dt * (0.55 + grip * 0.45);
    // Wet-road drift: the car slides sideways a touch when turning hard in the rain.
    const slide = (1 - grip) * this.steer * Math.abs(this.carSpeed) * 0.14;

    const hx = Math.sin(this.carHeading);
    const hz = Math.cos(this.carHeading);
    let nx = this.car.position.x + hx * this.carSpeed * dt + Math.cos(this.carHeading) * slide * dt;
    let nz = this.car.position.z + hz * this.carSpeed * dt - Math.sin(this.carHeading) * slide * dt;
    const hit = collideCircle(this.city.colliders, nx, nz, 1.9);
    if (hit.hit && Math.abs(this.carSpeed) > 6) {
      if (this.cb.onCrash) this.cb.onCrash(Math.abs(this.carSpeed));
      this.carSpeed *= 0.35;
    }
    nx = hit.x; nz = hit.z;
    // Bridge rails keep the car on the causeway.
    if (nz > 168 && nz < 252) {
      nx = Math.max(-7.6, Math.min(7.6, nx));
    }
    nx = Math.max(-195, Math.min(195, nx));
    nz = Math.max(-195, Math.min(250, nz));
    this.car.position.set(nx, groundHeightAt(nx, nz), nz);
    this.car.rotation.y = this.carHeading;
    // Gentle body roll into corners.
    this.car.rotation.z = -this.steer * speedFactor * 0.06;
    this.pos.copy(this.car.position);
    this.speedMph = Math.abs(this.carSpeed) * 2.1;

    // Bump traffic: a soft shunt, not a full crash.
    if (trafficCars) {
      for (const other of trafficCars) {
        const dx = other.mesh.position.x - nx;
        const dz = other.mesh.position.z - nz;
        const d = Math.hypot(dx, dz);
        if (d < 3.4 && d > 0.01) {
          this.carSpeed *= 0.82;
          if (this.cb.onCrash && Math.abs(this.carSpeed) > 10) this.cb.onCrash(6);
        }
      }
    }
    for (const w of this.car.userData.wheels || []) w.rotation.x += (this.carSpeed * dt) / 0.38;
    // Camera follows the car's heading.
    let dy = this.carHeading - this.camYaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.camYaw += dy * Math.min(1, dt * 2.2);
  }

  updateCamera(camera) {
    const dist = this.onFoot ? 6.5 : 10.5;
    const height = this.onFoot ? 3.1 : 4.4;
    const backX = Math.sin(this.camYaw);
    const backZ = Math.cos(this.camYaw);
    const target = this.onFoot
      ? new THREE.Vector3(this.pos.x, this.pos.y + 1.6, this.pos.z)
      : new THREE.Vector3(this.car.position.x, this.car.position.y + 1.4, this.car.position.z);
    const cx = target.x + backX * dist;
    const cz = target.z + backZ * dist;
    const cy = target.y + height - Math.sin(this.camPitch) * 3;
    camera.position.set(cx, cy, cz);
    camera.lookAt(target.x, target.y + 0.4, target.z);
  }
}
