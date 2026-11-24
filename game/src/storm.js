// TIDE & THUNDER — the live storm: driving rain, lightning flashes, thunder,
// and a wet-road grip value the driving model reads every frame.

import * as THREE from 'three';
import { TUNING } from './config.js';

export class Storm {
  constructor(scene, sound) {
    this.scene = scene;
    this.sound = sound;
    this.time = 0;
    this.nextBolt = 4 + Math.random() * 6;
    this.flash = 0;
    this.rainLevel = 0.85;

    // Rain: a cloud of streaks falling around the camera, recycled endlessly.
    const COUNT = 1400;
    this.rainCount = COUNT;
    const positions = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 120;
      positions[i * 3 + 1] = Math.random() * 60;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 120;
    }
    this.rainGeo = new THREE.BufferGeometry();
    this.rainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.rainMat = new THREE.PointsMaterial({
      color: 0xaaccee, size: 0.35, transparent: true, opacity: 0.55, sizeAttenuation: true,
    });
    this.rain = new THREE.Points(this.rainGeo, this.rainMat);
    this.rain.frustumCulled = false;
    scene.add(this.rain);

    // Lightning bolt: a jagged line that appears for a blink.
    this.boltGeo = new THREE.BufferGeometry();
    this.boltMat = new THREE.LineBasicMaterial({ color: 0xd6e9ff, transparent: true, opacity: 0 });
    this.bolt = new THREE.Line(this.boltGeo, this.boltMat);
    this.bolt.frustumCulled = false;
    scene.add(this.bolt);

    this.flashDiv = document.getElementById('bolt-flash');
  }

  // Current road grip: wet roads slide, and the storm never lets up.
  grip() {
    return TUNING.wetGrip + (1 - this.rainLevel) * (TUNING.dryGrip - TUNING.wetGrip);
  }

  update(dt, cameraPos, hemiLight, dirLight) {
    this.time += dt;

    // Rain falls and follows the camera.
    const pos = this.rainGeo.attributes.position.array;
    for (let i = 0; i < this.rainCount; i++) {
      pos[i * 3 + 1] -= dt * 55;
      pos[i * 3] += dt * 6; // wind slant
      if (pos[i * 3 + 1] < 0) {
        pos[i * 3 + 1] = 45 + Math.random() * 15;
        pos[i * 3] = cameraPos.x + (Math.random() - 0.5) * 120;
        pos[i * 3 + 2] = cameraPos.z + (Math.random() - 0.5) * 120;
      }
    }
    this.rainGeo.attributes.position.needsUpdate = true;
    // Drops recycle around the camera, so the Points object itself stays at origin.

    // Lightning schedule.
    this.nextBolt -= dt;
    if (this.nextBolt <= 0) {
      this.nextBolt = 5 + Math.random() * 9;
      this.flash = 1;
      this.strikeBolt(cameraPos);
      if (this.sound) this.sound.thunder();
    }
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 3.2);
      const f = this.flash * this.flash;
      hemiLight.intensity = 0.78 + f * 1.6;
      dirLight.intensity = 1.15 + f * 2.2;
      this.boltMat.opacity = f * 0.9;
      if (this.flashDiv) this.flashDiv.style.opacity = String(f * 0.35);
    } else {
      hemiLight.intensity = 0.78;
      dirLight.intensity = 1.15;
      this.boltMat.opacity = 0;
      if (this.flashDiv) this.flashDiv.style.opacity = '0';
    }
    if (this.sound) this.sound.setRainLevel(this.rainLevel);
  }

  strikeBolt(cameraPos) {
    // A jagged polyline from the sky down near the camera.
    const points = [];
    let x = cameraPos.x + (Math.random() - 0.5) * 160;
    let z = cameraPos.z + (Math.random() - 0.5) * 160;
    let y = 90;
    points.push(new THREE.Vector3(x, y, z));
    while (y > 0) {
      y -= 12 + Math.random() * 10;
      x += (Math.random() - 0.5) * 14;
      z += (Math.random() - 0.5) * 14;
      points.push(new THREE.Vector3(x, Math.max(0, y), z));
    }
    this.boltGeo.setFromPoints(points);
  }
}
