// TIDE & THUNDER — vehicles: boxy neon-era cars built from primitives,
// traffic that loops the avenues, and black-and-white police interceptors.

import * as THREE from 'three';
import { AVENUES, randomRoadPoint } from './city.js';
import { mulberry32, TUNING } from './config.js';

export function createCarMesh(colorHex, kind = 'civilian') {
  const group = new THREE.Group();
  group.name = kind === 'police' ? 'PoliceInterceptor' : 'TrafficCar';
  const paint = new THREE.MeshLambertMaterial({ color: colorHex });
  const dark = new THREE.MeshLambertMaterial({ color: 0x14141c });
  const glass = new THREE.MeshPhongMaterial({ color: 0x0e2a3a, shininess: 90 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), paint);
  body.position.y = 0.62;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.1), glass);
  cabin.position.set(0, 1.18, -0.25);
  group.add(cabin);
  // Headlights and taillights.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const side of [-0.65, 0.65]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), headMat);
    head.position.set(side, 0.62, 2.22);
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), tailMat);
    tail.position.set(side, 0.62, -2.22);
    group.add(tail);
  }
  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  group.userData.wheels = [];
  for (const [wx, wz] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    const wheel = new THREE.Mesh(wheelGeo, dark);
    wheel.position.set(wx, 0.38, wz);
    group.add(wheel);
    group.userData.wheels.push(wheel);
  }
  if (kind === 'police') {
    // White doors + light bar.
    const doorMat = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
    const doors = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.4, 1.6), doorMat);
    doors.position.set(0, 0.62, 0.1);
    group.add(doors);
    const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.14, 0.4), dark);
    barBase.position.set(0, 1.52, -0.25);
    group.add(barBase);
    const redLens = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.42), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
    redLens.position.set(-0.3, 1.56, -0.25);
    group.add(redLens);
    const blueLens = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.42), new THREE.MeshBasicMaterial({ color: 0x2a6bff }));
    blueLens.position.set(0.3, 1.56, -0.25);
    group.add(blueLens);
    group.userData.redLens = redLens;
    group.userData.blueLens = blueLens;
  }
  group.userData.kind = kind;
  return group;
}

// One traffic car: drives its avenue, turns at intersections, avoids nothing
// (it is a city, not a parade) but never leaves the road grid.
export class Traffic {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.rng = mulberry32(4242);
    this.cars = [];
    const palette = [0xd84040, 0xf2c230, 0x19e3ff, 0x2e3a55, 0x7dff5e, 0x8a4dff, 0xd8d8e0, 0x3a7d5e];
    for (let i = 0; i < TUNING.trafficCount; i++) {
      const spot = randomRoadPoint(this.rng);
      const mesh = createCarMesh(palette[i % palette.length], 'civilian');
      mesh.position.set(spot.x, 0, spot.z);
      mesh.rotation.y = spot.axis === 'z' ? (spot.dir > 0 ? 0 : Math.PI) : (spot.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      scene.add(mesh);
      this.cars.push({
        mesh, axis: spot.axis, dir: spot.dir,
        speed: 7 + this.rng() * 6,
        heading: mesh.rotation.y,
        turnCooldown: 2 + this.rng() * 4,
      });
    }
  }

  update(dt) {
    for (const car of this.cars) {
      car.turnCooldown -= dt;
      const p = car.mesh.position;
      const step = car.speed * car.dir * dt;
      if (car.axis === 'z') p.z += step;
      else p.x += step;
      // At an intersection, sometimes turn onto the cross avenue.
      const nearX = AVENUES.some((a) => Math.abs(p.x - a) < 1.2);
      const nearZ = AVENUES.some((a) => Math.abs(p.z - a) < 1.2);
      if (nearX && nearZ && car.turnCooldown <= 0 && Math.random() < 0.5) {
        car.turnCooldown = 4;
        if (car.axis === 'z') {
          car.axis = 'x';
          car.dir = Math.random() < 0.5 ? 1 : -1;
          p.z = AVENUES.reduce((best, a) => (Math.abs(a - p.z) < Math.abs(best - p.z) ? a : best), AVENUES[0]);
          p.z += car.dir > 0 ? -3 : 3;
        } else {
          car.axis = 'z';
          car.dir = Math.random() < 0.5 ? 1 : -1;
          p.x = AVENUES.reduce((best, a) => (Math.abs(a - p.x) < Math.abs(best - p.x) ? a : best), AVENUES[0]);
          p.x += car.dir > 0 ? 3 : -3;
        }
      }
      // Wrap around the city edge instead of driving into the sea.
      if (p.x > 178) { p.x = -178; }
      if (p.x < -178) { p.x = 178; }
      if (p.z > 162) { p.z = -178; car.axis = 'z'; }
      if (p.z < -178) { p.z = 162; car.axis = 'z'; }
      const targetYaw = car.axis === 'z' ? (car.dir > 0 ? 0 : Math.PI) : (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      let dy = targetYaw - car.mesh.rotation.y;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      car.mesh.rotation.y += dy * Math.min(1, dt * 6);
      for (const w of car.mesh.userData.wheels) w.rotation.x += (car.speed * dt) / 0.38;
    }
  }

  nearestCar(x, z, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of this.cars) {
      const dx = car.mesh.position.x - x;
      const dz = car.mesh.position.z - z;
      const d = Math.hypot(dx, dz);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  removeCar(car) {
    this.scene.remove(car.mesh);
    this.cars = this.cars.filter((c) => c !== car);
  }

  respawnOne() {
    if (this.cars.length >= TUNING.trafficCount) return;
    const spot = randomRoadPoint(this.rng);
    const palette = [0xd84040, 0xf2c230, 0x19e3ff, 0x2e3a55, 0x7dff5e, 0x8a4dff];
    const mesh = createCarMesh(palette[Math.floor(this.rng() * palette.length)], 'civilian');
    mesh.position.set(spot.x, 0, spot.z);
    this.scene.add(mesh);
    this.cars.push({ mesh, axis: spot.axis, dir: spot.dir, speed: 7 + this.rng() * 6, heading: 0, turnCooldown: 3 });
  }
}
