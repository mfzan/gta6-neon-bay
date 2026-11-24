// TIDE & THUNDER — the HUD: wanted stars, cash, health, speed, live minimap,
// objective line, toasts, and the start / pause / busted / wasted screens.

import { CITY, MISSIONS } from './config.js';

export class Hud {
  constructor() {
    this.starsEl = document.getElementById('wanted');
    this.cashEl = document.getElementById('cash');
    this.healthFill = document.getElementById('health-fill');
    this.speedEl = document.getElementById('speed');
    this.vehicleEl = document.getElementById('vehicle-name');
    this.objectiveEl = document.getElementById('objective-text');
    this.toastEl = document.getElementById('toast');
    this.clockEl = document.getElementById('clock');
    this.minimap = document.getElementById('minimap');
    this.mapCtx = this.minimap.getContext('2d');
    this.crosshair = document.getElementById('crosshair');
    this.damageFlash = document.getElementById('damage-flash');
    this.startScreen = document.getElementById('start-screen');
    this.pauseScreen = document.getElementById('pause-screen');
    this.endScreen = document.getElementById('end-screen');
    this.endTitle = document.getElementById('end-title');
    this.endText = document.getElementById('end-text');
    this.missionList = document.getElementById('mission-list');
    this.toastTimer = null;
    this.gameMinutes = 21 * 60 + 47;
  }

  setStars(level) {
    let s = '';
    for (let i = 0; i < 5; i++) s += i < level ? '★' : '<span class="off">☆</span>';
    this.starsEl.innerHTML = s;
  }

  setCash(cash) {
    this.cashEl.textContent = `$${cash.toLocaleString('en-US')}`;
  }

  setHealth(health, max) {
    this.healthFill.style.width = `${Math.max(0, (health / max) * 100)}%`;
  }

  setSpeed(mph, vehicleName) {
    this.speedEl.innerHTML = `${Math.round(mph)} <small>MPH</small>`;
    this.vehicleEl.textContent = vehicleName || '';
  }

  setObjective(text) {
    this.objectiveEl.textContent = text;
  }

  toast(text, ms = 2600) {
    this.toastEl.textContent = text;
    this.toastEl.style.opacity = '1';
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { this.toastEl.style.opacity = '0'; }, ms);
  }

  flashDamage() {
    this.damageFlash.style.opacity = '1';
    setTimeout(() => { this.damageFlash.style.opacity = '0'; }, 180);
  }

  setCrosshair(onFoot) {
    this.crosshair.style.display = onFoot ? 'block' : 'none';
  }

  showStart(hasSave) {
    this.startScreen.classList.remove('hidden');
    document.getElementById('continue-btn').classList.toggle('hidden', !hasSave);
  }

  hideStart() {
    this.startScreen.classList.add('hidden');
  }

  showPause(statsText) {
    document.getElementById('pause-stats').textContent = statsText;
    this.pauseScreen.classList.remove('hidden');
  }

  hidePause() {
    this.pauseScreen.classList.add('hidden');
  }

  showEnd(title, text) {
    this.endTitle.textContent = title;
    this.endText.textContent = text;
    this.endScreen.classList.remove('hidden');
  }

  hideEnd() {
    this.endScreen.classList.add('hidden');
  }

  refreshMissionList(nextIndex) {
    if (!this.missionList) return;
    const rows = MISSIONS.map((m, i) => {
      const cls = i < nextIndex ? 'done' : (i === nextIndex ? 'now' : '');
      const mark = i < nextIndex ? '✓' : `${i + 1}`;
      return `<div class="${cls}">${mark} &middot; ${m.name} — ${m.brief.split('.')[0]} &middot; $${m.reward}</div>`;
    });
    this.missionList.innerHTML = rows.join('');
  }

  tickClock(dt) {
    this.gameMinutes += dt * 0.6;
    const total = Math.floor(this.gameMinutes) % (24 * 60);
    const hh = String(Math.floor(total / 60)).padStart(2, '0');
    const mm = String(total % 60).padStart(2, '0');
    this.clockEl.innerHTML = `${hh}:${mm} &middot; PORT TEMPEST`;
  }

  // Live top-down minimap: roads, water, bridge, cars, police, beacon, player.
  drawMinimap(world) {
    const ctx = this.mapCtx;
    const W = 190;
    const H = 190;
    const scale = W / 480;
    const toMap = (x, z) => [(x + 240) * scale, (z + 220) * scale];
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0a1420';
    ctx.fillRect(0, 0, W, H);
    // Water.
    ctx.fillStyle = '#0d3a52';
    const [, wy] = toMap(0, CITY.waterZ);
    ctx.fillRect(0, wy, W, H - wy);
    // Roads.
    ctx.strokeStyle = '#4a4a58';
    ctx.lineWidth = 5;
    for (const a of [-160, -120, -80, -40, 0, 40, 80, 120, 160]) {
      const [ax] = toMap(a, 0);
      ctx.beginPath(); ctx.moveTo(ax, 0); ctx.lineTo(ax, H); ctx.stroke();
      const [, az] = toMap(0, a);
      ctx.beginPath(); ctx.moveTo(0, az); ctx.lineTo(W, az); ctx.stroke();
    }
    // Bridge.
    ctx.strokeStyle = '#ffb020';
    ctx.lineWidth = 4;
    const [bx] = toMap(0, 0);
    const [, bz1] = toMap(0, 168);
    const [, bz2] = toMap(0, 252);
    ctx.beginPath(); ctx.moveTo(bx, bz1); ctx.lineTo(bx, bz2); ctx.stroke();
    // Mission beacon.
    const beacon = world.missions ? world.missions.beaconPosition() : null;
    if (beacon) {
      const [mx, my] = toMap(beacon.x, beacon.z);
      const pulse = 5 + Math.sin(performance.now() * 0.006) * 2;
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath(); ctx.arc(mx, my, pulse, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', mx, my + 3);
    }
    // Traffic (yellow), police (flashing red/blue).
    if (world.traffic) {
      ctx.fillStyle = '#ffe27a';
      for (const c of world.traffic.cars) {
        const [mx, my] = toMap(c.mesh.position.x, c.mesh.position.z);
        ctx.fillRect(mx - 1.5, my - 1.5, 3, 3);
      }
    }
    if (world.police) {
      const flash = Math.sin(performance.now() * 0.012) > 0;
      ctx.fillStyle = flash ? '#ff2a2a' : '#2a6bff';
      for (const c of world.police.cars) {
        const [mx, my] = toMap(c.mesh.position.x, c.mesh.position.z);
        ctx.beginPath(); ctx.arc(mx, my, 3.5, 0, Math.PI * 2); ctx.fill();
      }
    }
    // Player arrow.
    if (world.player) {
      const [px, py] = toMap(world.player.pos.x, world.player.pos.z);
      const yaw = world.player.onFoot ? world.player.camYaw : world.player.carHeading;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(Math.PI - yaw);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // North marker.
    ctx.fillStyle = '#9fd8ff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('N', 6, 12);
  }
}
