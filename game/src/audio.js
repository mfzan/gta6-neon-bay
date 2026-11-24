// TIDE & THUNDER — procedural sound only. No audio files: every sound is
// synthesized with WebAudio (engine hum, sirens, rain, gunshots, thunder).

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.rainGain = null;
    this.rainSrc = null;
    this.started = false;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);
    this.startLoops();
    this.started = true;
  }

  makeNoiseBuffer(seconds = 2) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  startLoops() {
    // Engine hum: low sawtooth whose pitch follows speed (setEngineSpeed).
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const engineFilter = this.ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 320;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.0;
    this.engineOsc.connect(engineFilter);
    engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();

    // Rain: looped white noise through a lowpass, always on once the game starts.
    this.rainSrc = this.ctx.createBufferSource();
    this.rainSrc.buffer = this.makeNoiseBuffer(3);
    this.rainSrc.loop = true;
    const rainFilter = this.ctx.createBiquadFilter();
    rainFilter.type = 'lowpass';
    rainFilter.frequency.value = 1400;
    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.value = 0.05;
    this.rainSrc.connect(rainFilter);
    rainFilter.connect(this.rainGain);
    this.rainGain.connect(this.master);
    this.rainSrc.start();

    // Police siren: two-tone triangle, silent until wanted > 0.
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 720;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0.0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
    this.sirenPhase = 0;
  }

  setEngineSpeed(speed01, driving) {
    if (!this.ctx) return;
    const target = driving ? 0.05 + speed01 * 0.09 : 0.0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
    this.engineOsc.frequency.setTargetAtTime(52 + speed01 * 130, this.ctx.currentTime, 0.1);
  }

  updateSiren(dt, wanted) {
    if (!this.ctx) return;
    this.sirenPhase += dt;
    const wail = Math.sin(this.sirenPhase * 2.4) > 0 ? 660 : 920;
    this.sirenOsc.frequency.setTargetAtTime(wail, this.ctx.currentTime, 0.05);
    const target = wanted > 0 ? 0.028 + wanted * 0.006 : 0.0;
    this.sirenGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.2);
  }

  setRainLevel(level01) {
    if (!this.ctx) return;
    this.rainGain.gain.setTargetAtTime(0.02 + level01 * 0.06, this.ctx.currentTime, 0.5);
  }

  gunshot() {
    if (!this.ctx || this.muted) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.makeNoiseBuffer(0.18);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 900;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.16);
    src.connect(filter); filter.connect(gain); gain.connect(this.master);
    src.start();
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(180, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.12);
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.25, this.ctx.currentTime);
    og.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);
    osc.connect(og); og.connect(this.master);
    osc.start(); osc.stop(this.ctx.currentTime + 0.13);
  }

  thunder() {
    if (!this.ctx || this.muted) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.makeNoiseBuffer(2.5);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 2.2);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 2.4);
    src.connect(filter); filter.connect(gain); gain.connect(this.master);
    src.start();
  }

  pickup() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    [660, 880, 1320].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now + i * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.22, now + i * 0.07 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.25);
      osc.connect(gain); gain.connect(this.master);
      osc.start(now + i * 0.07); osc.stop(now + i * 0.07 + 0.3);
    });
  }

  crash() {
    if (!this.ctx || this.muted) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.makeNoiseBuffer(0.3);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
    src.connect(filter); filter.connect(gain); gain.connect(this.master);
    src.start();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.55;
    return this.muted;
  }
}
