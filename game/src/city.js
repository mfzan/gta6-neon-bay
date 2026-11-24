// TIDE & THUNDER — Port Tempest itself: street grid, procedural towers with lit
// windows, harbor water, causeway bridge, pier, palms, streetlights, neon signs.
// The city is seeded, so every load builds the same streets (good for screenshots).

import * as THREE from 'three';
import { CITY, PALETTE, mulberry32 } from './config.js';

export const AVENUES = [-160, -120, -80, -40, 0, 40, 80, 120, 160];

function makeWindowTexture(rng, base, litRatio) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  const warm = ['#ffd98a', '#ffe9b0', '#ffb46b'];
  const cool = ['#9fd8ff', '#bfe9ff', '#7dd7ff'];
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 6; col++) {
      const lit = rng() < litRatio;
      const x = 8 + col * 20;
      const y = 10 + row * 20;
      if (lit) {
        g.fillStyle = rng() < 0.6 ? warm[Math.floor(rng() * warm.length)] : cool[Math.floor(rng() * cool.length)];
        g.fillRect(x, y, 12, 12);
      } else {
        g.fillStyle = 'rgba(10,12,24,0.85)';
        g.fillRect(x, y, 12, 12);
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeGroundTexture() {
  const S = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const g = canvas.getContext('2d');
  const worldToPx = (v) => ((v + 240) / 480) * S;
  // Base asphalt.
  g.fillStyle = '#2c2c38';
  g.fillRect(0, 0, S, S);
  // Sidewalk blocks (lighter squares between roads).
  g.fillStyle = '#3d3a44';
  for (const bx of AVENUES) {
    for (const bz of AVENUES) {
      const cx = bx + 20;
      const cz = bz + 20;
      g.fillRect(worldToPx(cx - 16), worldToPx(cz - 16), worldToPx(32) - worldToPx(0), worldToPx(32) - worldToPx(0));
    }
  }
  // Roads: darker ribbons along every avenue.
  g.fillStyle = '#21212c';
  for (const a of AVENUES) {
    g.fillRect(worldToPx(a - 6), worldToPx(-200), worldToPx(12) - worldToPx(0), worldToPx(400) - worldToPx(0));
    g.fillRect(worldToPx(-200), worldToPx(a - 6), worldToPx(400) - worldToPx(0), worldToPx(12) - worldToPx(0));
  }
  // Centre dashes.
  g.fillStyle = '#c9a227';
  for (const a of AVENUES) {
    for (let v = -190; v < 190; v += 16) {
      g.fillRect(worldToPx(a - 0.4), worldToPx(v), 2, 8);
      g.fillRect(worldToPx(v), worldToPx(a - 0.4), 8, 2);
    }
  }
  // Crosswalks at intersections.
  g.fillStyle = 'rgba(230,230,230,0.75)';
  for (const ax of AVENUES) {
    for (const az of AVENUES) {
      for (let k = -5; k <= 5; k += 2.5) {
        g.fillRect(worldToPx(ax + k - 0.8), worldToPx(az - 7), 3, 14);
      }
    }
  }
  // Beach strip, then the harbor edge.
  g.fillStyle = '#8a7a5a';
  g.fillRect(0, worldToPx(CITY.harborZ), S, worldToPx(CITY.waterZ) - worldToPx(CITY.harborZ));
  g.fillStyle = '#0d3a52';
  g.fillRect(0, worldToPx(CITY.waterZ), S, S - worldToPx(CITY.waterZ));
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function groundHeightAt(x, z) {
  // The causeway bridge rises over the harbor inlet; everywhere else is street level.
  if (Math.abs(x) < CITY.bridgeHalfWidth && z > CITY.harborZ && z < 252) {
    if (z < 186) return ((z - CITY.harborZ) / 18) * CITY.bridgeTopY;
    if (z > 234) return ((252 - z) / 18) * CITY.bridgeTopY;
    return CITY.bridgeTopY;
  }
  return 0;
}

export function buildCity(scene) {
  const rng = mulberry32(CITY.seed);
  const colliders = [];
  const group = new THREE.Group();
  group.name = 'PortTempest';
  scene.add(group);

  // Ground: one textured plane carries the whole street map.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(480, 480),
    new THREE.MeshLambertMaterial({ map: makeGroundTexture() }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 20);
  group.add(ground);

  // Harbor water: a glossy plane south of the beach.
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(480, 130),
    new THREE.MeshPhongMaterial({ color: PALETTE.water, shininess: 120, transparent: true, opacity: 0.92 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.35, CITY.waterZ + 65);
  group.add(water);

  // Causeway bridge over the inlet, with ramps, rails and pillars.
  const deckMat = new THREE.MeshLambertMaterial({ color: 0x4a4a58 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(18, 1.2, 84), deckMat);
  deck.position.set(0, CITY.bridgeTopY - 0.6, 210);
  group.add(deck);
  for (const [rz, tilt] of [[177, 0.36], [243, -0.36]]) {
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(18, 1, 20), deckMat);
    ramp.position.set(0, CITY.bridgeTopY / 2, rz);
    ramp.rotation.x = tilt;
    group.add(ramp);
  }
  const railMatFixed = new THREE.MeshLambertMaterial({ color: 0x8a6a20, emissive: 0x332200 });
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.1, 84), railMatFixed);
    rail.position.set(side * 8.7, CITY.bridgeTopY + 0.5, 210);
    group.add(rail);
    colliders.push({ x0: side * 8.7 - 0.5, x1: side * 8.7 + 0.5, z0: 168, z1: 252 });
  }
  const pillarMat = new THREE.MeshLambertMaterial({ color: 0x5a5a68 });
  for (const pz of [186, 210, 234]) {
    for (const px of [-6, 6]) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 9, 8), pillarMat);
      pillar.position.set(px, 2, pz);
      group.add(pillar);
    }
  }

  // Wooden pier west of the bridge, jutting into the harbor.
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2a });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(10, 0.8, 42), pierMat);
  pier.position.set(-60, 0.9, 205);
  group.add(pier);
  for (let k = 0; k < 5; k++) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 3, 6), pierMat);
    post.position.set(-60 + (k % 2 === 0 ? -4.5 : 4.5), 0.5, 188 + k * 9);
    group.add(post);
  }

  // Buildings: 1-3 per block, seeded heights and facades, lit windows.
  const facades = ['#2e3448', '#3a2f45', '#26343c', '#453a2e', '#33283a'];
  const textures = facades.map((f) => makeWindowTexture(rng, f, 0.55));
  const neonColors = [PALETTE.neonPink, PALETTE.neonCyan, PALETTE.neonAmber, PALETTE.neonLime];
  let neonCount = 0;
  for (const bx of AVENUES) {
    for (const bz of AVENUES) {
      const cx = bx + 20;
      const cz = bz + 20;
      if (cz > 150) continue; // keep the beachfront open
      if (Math.abs(cx) < 24 && cz > 130) continue; // bridge approach stays clear
      const n = 1 + Math.floor(rng() * 3);
      for (let i = 0; i < n; i++) {
        const w = 11 + rng() * 9;
        const d = 11 + rng() * 9;
        const h = 10 + rng() * rng() * 42;
        const ox = (rng() - 0.5) * (28 - w);
        const oz = (rng() - 0.5) * (28 - d);
        const x = cx + ox;
        const z = cz + oz;
        const tex = textures[Math.floor(rng() * textures.length)];
        const mat = new THREE.MeshLambertMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.5 });
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        b.position.set(x, h / 2, z);
        group.add(b);
        // Rooftop box.
        const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.4, 1.6, d * 0.4), new THREE.MeshLambertMaterial({ color: 0x1c1c26 }));
        roof.position.set(x, h + 0.8, z);
        group.add(roof);
        colliders.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
        // Neon sign on some towers.
        if (rng() < 0.22 && neonCount < 16) {
          neonCount++;
          const sign = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 2.2, 5 + rng() * 4),
            new THREE.MeshBasicMaterial({ color: neonColors[neonCount % neonColors.length] }),
          );
          sign.position.set(x + w / 2 + 0.4, h * (0.55 + rng() * 0.25), z);
          group.add(sign);
        }
      }
    }
  }

  // Streetlights along the avenues (emissive lamps; no per-lamp real light for perf).
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2a2a33 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffd98a });
  for (const a of AVENUES) {
    for (let v = -140; v <= 140; v += 80) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 7, 6), poleMat);
      pole.position.set(a + 7, 3.5, v);
      group.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), lampMat);
      lamp.position.set(a + 7, 7.1, v);
      group.add(lamp);
    }
  }

  // Palm trees along the beach and a few plazas.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2a });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2e7d4f });
  const palmSpots = [];
  for (let x = -180; x <= 180; x += 30) palmSpots.push([x + (rng() - 0.5) * 8, 158 + rng() * 6]);
  for (let i = 0; i < 10; i++) palmSpots.push([(rng() - 0.5) * 320, (rng() - 0.5) * 320]);
  for (const [x, z] of palmSpots) {
    if (Math.abs(x) < 14 && z > 140) continue;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 6, 6), trunkMat);
    trunk.position.set(x, 3, z);
    trunk.rotation.z = (rng() - 0.5) * 0.2;
    group.add(trunk);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 6), leafMat);
    crown.scale.y = 0.55;
    crown.position.set(x, 6.4, z);
    group.add(crown);
  }

  // A few glowing billboards near the harbor for skyline identity.
  const boardMat = new THREE.MeshBasicMaterial({ color: PALETTE.neonPink });
  const board = new THREE.Mesh(new THREE.BoxGeometry(16, 6, 0.6), boardMat);
  board.position.set(-40, 26, 150);
  group.add(board);
  const board2 = new THREE.Mesh(new THREE.BoxGeometry(14, 5, 0.6), new THREE.MeshBasicMaterial({ color: PALETTE.neonCyan }));
  board2.position.set(60, 30, 150);
  group.add(board2);

  return {
    group,
    colliders,
    water,
    avenues: AVENUES,
    spawn: { x: -20, z: 0, yaw: Math.PI / 2 },
    parkedSpots: [
      { x: -14, z: 0, yaw: Math.PI / 2 }, { x: -26, z: 0, yaw: Math.PI / 2 }, { x: 10, z: 0, yaw: Math.PI / 2 },
    ],
  };
}

// Circle (player / car) vs building AABBs: push the circle out and report the hit.
export function collideCircle(colliders, x, z, radius) {
  let hit = false;
  for (const c of colliders) {
    const nx = Math.max(c.x0, Math.min(x, c.x1));
    const nz = Math.max(c.z0, Math.min(z, c.z1));
    const dx = x - nx;
    const dz = z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        const push = (radius - d) / d;
        x += dx * push;
        z += dz * push;
      } else {
        x += radius;
      }
    }
  }
  return { x, z, hit };
}

export function randomRoadPoint(rng) {
  const a = AVENUES[Math.floor(rng() * AVENUES.length)];
  const along = -160 + rng() * 320;
  if (rng() < 0.5) return { x: a + (rng() < 0.5 ? -3 : 3), z: along, axis: 'z', dir: rng() < 0.5 ? 1 : -1 };
  return { x: along, z: a + (rng() < 0.5 ? -3 : 3), axis: 'x', dir: rng() < 0.5 ? 1 : -1 };
}
