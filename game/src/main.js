// TIDE & THUNDER — bootstrap and game loop: builds Port Tempest, wires every
// system together, runs the menu / playing / paused / busted states, and serves
// the screenshot presets (?shot=drive|chase|foot|mission) the maker uses.

import * as THREE from 'three';
import { CITY, MISSIONS, TUNING } from './config.js';
import { buildCity } from './city.js';
import { Storm } from './storm.js';
import { SoundEngine } from './audio.js';
import { Traffic } from './vehicles.js';
import { Pedestrians, Gangsters, HealthPacks } from './people.js';
import { Player } from './player.js';
import { Police } from './police.js';
import { Combat } from './combat.js';
import { Missions } from './missions.js';
import { Hud } from './hud.js';
import { loadSave, writeSave, clearSave } from './save.js';

window.__gameErrors = [];
window.addEventListener('error', (e) => window.__gameErrors.push(String(e.message || e.error)));

const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a1e4f);
scene.fog = new THREE.Fog(0x3a2b5e, 70, 430);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(-40, 26, -60);

const hemi = new THREE.HemisphereLight(0x8a7fd8, 0x1a1410, 0.78);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffb46b, 1.15);
sun.position.set(120, 80, -60);
scene.add(sun);

// ---- world state (one object every system reads) ----
const saved = loadSave();
const state = {
  cash: saved ? saved.cash : 250,
  totalEarned: saved ? saved.totalEarned : 0,
  status: 'menu', // menu | playing | paused | ended
  save() {
    writeSave({
      cash: state.cash,
      missionIndex: missions.index,
      completedCount: missions.completedCount,
      totalEarned: state.totalEarned,
    });
  },
};

const sound = new SoundEngine();
const hud = new Hud();
const city = buildCity(scene);
const storm = new Storm(scene, sound);
const traffic = new Traffic(scene, city);
const pedestrians = new Pedestrians(scene);
const gangsters = new Gangsters(scene);
const healthPacks = new HealthPacks(scene);

const player = new Player(scene, city, sound, {
  onSteal: (pos) => {
    police.addWanted(1, 'theft');
    pedestrians.scare(pos.x, pos.z, 25);
    hud.toast('Car stolen! Harbor Police noticed. +1 star', 3000);
  },
  onEnterCar: (name) => { hud.toast(`Driving — ${name}`, 1800); },
  onExitCar: () => { hud.toast('On foot. Watch the streets.', 1600); },
  onCrash: (speed) => { if (sound) sound.crash(); },
});
state.player = player;
state.hud = hud;
state.sound = sound;

const police = new Police(scene, city, {
  onBusted: () => endRun('BUSTED', 'The Harbor Police dragged Mara out of the street. $200 bail, and the crew is not impressed.'),
  onRam: () => { /* the ram itself is the punishment */ },
});
state.police = police;
state.traffic = traffic;
state.missions = null; // set below (missions needs state first)

const combat = new Combat(scene, sound, {
  onShotPolice: () => {
    police.addWanted(1, 'shooting');
    hud.toast('You shot at the police! +1 star', 2400);
  },
  onKillGangster: () => {
    state.cash += 50;
    hud.toast('Lookout down. +$50', 1800);
  },
  onHitPedestrian: () => {
    police.addWanted(1, 'assault');
    hud.toast('A bystander went down! +1 star', 2400);
  },
});
state.gangsters = gangsters;

const missions = new Missions(scene, state);
state.missions = missions;
state.save = state.save.bind(state);
if (saved) missions.setProgress(saved.missionIndex, saved.completedCount);
hud.refreshMissionList(missions.index);
hud.setCash(state.cash);
hud.setHealth(player.health, TUNING.playerMaxHealth);
hud.setStars(0);
hud.setObjective(missions.done
  ? 'CREW LEGEND — free roam Port Tempest.'
  : `Press N to start ${missions.currentDef.name} — ${missions.currentDef.brief}`);

// ---- damage / end-of-run ----
let damageCooldown = 0;
function damagePlayer(amount, fromPos) {
  if (state.status !== 'playing' || damageCooldown > 0) return;
  damageCooldown = 0.4;
  const dead = player.damage(amount);
  hud.flashDamage();
  hud.setHealth(player.health, TUNING.playerMaxHealth);
  if (dead) endRun('WASTED', 'Mara went down in the rain. The Harbor Crew pays the hospital bill — $200 — and the night goes on.');
}

function endRun(title, text) {
  if (state.status !== 'playing') return;
  state.status = 'ended';
  const penalty = Math.min(state.cash, TUNING.bustCashPenalty);
  state.cash -= penalty;
  missions.fail(title === 'BUSTED' ? 'Busted — the job is blown. Press N to retry.' : 'Wasted — the job is blown. Press N to retry.');
  police.clearWanted();
  hud.showEnd(title, `${text} (Lost $${penalty}.)`);
  hud.setCash(state.cash);
  state.save();
  if (document.pointerLockElement) document.exitPointerLock();
}

function respawn() {
  player.resetToSpawn();
  police.clearWanted();
  hud.hideEnd();
  hud.setHealth(player.health, TUNING.playerMaxHealth);
  hud.setObjective(missions.currentDef
    ? `Press N to start ${missions.currentDef.name}.`
    : 'CREW LEGEND — free roam Port Tempest.');
  state.status = 'playing';
  state.save();
}

// ---- input ----
const keys = new Set();
let mouseDX = 0;
let mouseDY = 0;
let pointerLocked = false;

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    if (state.status === 'playing') pauseGame();
    else if (state.status === 'paused') resumeGame();
    return;
  }
  keys.add(e.code);
  if (e.code === 'KeyM') {
    const muted = sound.toggleMute();
    hud.toast(muted ? 'Sound muted' : 'Sound on', 1200);
  }
  if (state.status !== 'playing') return;
  if (e.code === 'KeyE') {
    if (player.onFoot) player.tryEnterCar(traffic);
    else player.exitCar();
  }
  if (e.code === 'KeyN') {
    if (!missions.active && missions.currentDef) missions.start();
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

canvas.addEventListener('click', () => {
  if (state.status !== 'playing') return;
  sound.ensure();
  if (!pointerLocked) {
    try {
      const p = canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch { /* pointer lock is a nicety, not a requirement */ }
  }
});
document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === canvas;
});
document.addEventListener('mousemove', (e) => {
  if (pointerLocked) {
    mouseDX += e.movementX || 0;
    mouseDY += e.movementY || 0;
  }
});
canvas.addEventListener('mousedown', (e) => {
  if (state.status !== 'playing' || !player.onFoot || e.button !== 0) return;
  sound.ensure();
  combat.shoot(player.eyePosition(), player.aimDirection(), gangsters, police, pedestrians);
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

function pauseGame() {
  if (state.status !== 'playing') return;
  state.status = 'paused';
  hud.showPause(`Cash $${state.cash} · Jobs done ${missions.completedCount}/4 · Wanted ${'★'.repeat(police.level)}${'☆'.repeat(5 - police.level)}`);
  if (document.pointerLockElement) document.exitPointerLock();
}

function resumeGame() {
  hud.hidePause();
  state.status = 'playing';
}

document.getElementById('start-btn').addEventListener('click', () => startGame(false));
document.getElementById('continue-btn').addEventListener('click', () => startGame(true));
document.getElementById('resume-btn').addEventListener('click', resumeGame);
document.getElementById('restart-btn').addEventListener('click', () => {
  clearSave();
  state.cash = 250;
  state.totalEarned = 0;
  missions.setProgress(0, 0);
  hud.refreshMissionList(0);
  player.resetToSpawn();
  police.clearWanted();
  hud.hidePause();
  startGame(false);
});
document.getElementById('respawn-btn').addEventListener('click', respawn);

function startGame(continued) {
  sound.ensure();
  hud.hideStart();
  hud.hideEnd();
  state.status = 'playing';
  if (!continued) {
    hud.setObjective(missions.currentDef
      ? `Press N to start ${missions.currentDef.name} — ${missions.currentDef.brief}`
      : 'Free roam Port Tempest.');
  }
  hud.toast(continued ? 'Welcome back to Port Tempest.' : 'Port Tempest. One stormy night. Four jobs.', 3200);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- screenshot presets: real game states, staged for the camera ----
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
function applyShotPreset() {
  if (!shot) return;
  hud.hideStart();
  state.status = 'playing';
  sound.ensure();
  if (shot === 'drive') {
    const spot = city.parkedSpots[0];
    const parked = player.parked[0];
    parked.mesh.position.set(40, 0, -40);
    parked.mesh.rotation.y = Math.PI / 2;
    player.enterCar(parked.mesh, parked.name);
    player.carSpeed = 24;
    player.carHeading = Math.PI / 2;
    player.camYaw = Math.PI / 2;
    missions.start();
  } else if (shot === 'chase') {
    const parked = player.parked[0];
    parked.mesh.position.set(0, 0, 20);
    parked.mesh.rotation.y = 0;
    player.enterCar(parked.mesh, parked.name);
    player.carSpeed = 32;
    player.carHeading = 0;
    player.camYaw = 0;
    missions.setProgress(3, 3);
    missions.start();
    police.setWanted(4);
    for (let i = 0; i < 4; i++) police.spawnCarNear(player.pos.x, player.pos.z);
    // Two interceptors ahead, head-on in the camera's view.
    police.spawnCarAt(3, 90);
    police.spawnCarAt(-4, 68);
  } else if (shot === 'foot') {
    // Open avenue, camera looking down the street: player, coupe and lookouts all in frame.
    player.pos.set(0, 0, -20);
    player.mesh.position.copy(player.pos);
    player.camYaw = 0;
    player.camPitch = 0.12;
    const coupe = player.parked[0];
    coupe.mesh.position.set(4, 0, -34);
    coupe.mesh.rotation.y = 0;
    gangsters.spawnSquad(-6, -46, 2);
    hud.setObjective('On foot in the Neon District — press E to take the coupe, click to fire.');
  } else if (shot === 'mission') {
    const parked = player.parked[1];
    parked.mesh.position.set(-120, 0, -120);
    parked.mesh.rotation.y = Math.PI / 4;
    player.enterCar(parked.mesh, parked.name);
    player.carHeading = Math.PI / 4;
    player.camYaw = Math.PI / 4;
    missions.setProgress(1, 1);
    missions.start();
  }
  hud.toast('TIDE & THUNDER — Port Tempest', 2000);
}

// ---- main loop ----
const clock = new THREE.Clock();
let menuAngle = 0;
let trafficRespawnTimer = 0;
let firstFrame = true;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  damageCooldown = Math.max(0, damageCooldown - dt);

  if (state.status === 'menu') {
    // Slow orbit over the city behind the title screen.
    menuAngle += dt * 0.03;
    camera.position.set(Math.sin(menuAngle) * 150, 55, Math.cos(menuAngle) * 150 - 20);
    camera.lookAt(0, 8, 20);
    storm.update(dt, camera.position, hemi, sun);
    traffic.update(dt);
    pedestrians.update(dt, player.pos);
  } else if (state.status === 'playing') {
    player.gripValue = storm.grip();
    player.update(dt, keys, mouseDX, mouseDY, traffic.cars.map((c) => c));
    mouseDX = 0;
    mouseDY = 0;
    player.updateCamera(camera);
    storm.update(dt, camera.position, hemi, sun);
    traffic.update(dt);
    pedestrians.update(dt, player.pos);
    gangsters.update(dt, player.pos, player.onFoot, (amount, fromPos) => damagePlayer(amount, fromPos));
    police.update(dt, player, traffic.cars);
    missions.update(dt);
    combat.update(dt);
    healthPacks.update(dt, player.pos, (amount) => {
      player.heal(amount);
      hud.setHealth(player.health, TUNING.playerMaxHealth);
      hud.toast(`Health +${amount}`, 1600);
      if (sound) sound.pickup();
    });
    sound.updateSiren(dt, police.level);
    hud.tickClock(dt);
    hud.setStars(police.level);
    hud.setCash(state.cash);
    hud.setHealth(player.health, TUNING.playerMaxHealth);
    hud.setSpeed(player.onFoot ? 0 : player.speedMph, player.onFoot ? '' : player.carName);
    hud.setCrosshair(player.onFoot);
    hud.drawMinimap(state);
    trafficRespawnTimer -= dt;
    if (trafficRespawnTimer <= 0) {
      trafficRespawnTimer = 6;
      traffic.respawnOne();
    }
  }
  // Paused / ended: freeze the world, keep rendering the frame.

  renderer.render(scene, camera);
  if (firstFrame) {
    firstFrame = false;
    applyShotPreset();
    window.__gameReady = true;
  }
}

hud.showStart(!!saved);
window.__game = { state, player, police, missions, traffic, gangsters, hud, version: 'tide-and-thunder-1.0' };
animate();
