// audio.js — Procedural Web Audio engine for Bounce Tales
// All sounds are synthesised in real-time: zero external files required.
class AudioEngine {
  constructor() {
    this.ctx    = null;
    this.enabled = false;
    this.muted   = false;
    this.musicVolume = 0.7; // default 70%
    this.sfxVolume = 0.8; // default 80%
    this.musicInterval = null;
    this.musicIndex = 0;
    this._tryInit();
  }

  _tryInit() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.enabled = true;

      // SFX and Music Gain nodes
      this.musicGainNode = this.ctx.createGain();
      this.sfxGainNode = this.ctx.createGain();
      this.musicGainNode.connect(this.ctx.destination);
      this.sfxGainNode.connect(this.ctx.destination);

      this.updateVolumes();
    } catch (e) {
      console.warn('[Audio] Web Audio API unavailable');
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().then(() => {
        this.startMusic();
      }).catch(() => {});
    } else {
      this.startMusic();
    }
  }

  updateVolumes() {
    if (!this.enabled || !this.ctx) return;
    const mVol = this.muted ? 0 : this.musicVolume;
    const sVol = this.muted ? 0 : this.sfxVolume;

    const t = this.ctx.currentTime;
    if (this.musicGainNode) {
      this.musicGainNode.gain.setTargetAtTime(mVol, t, 0.05);
    }
    if (this.sfxGainNode) {
      this.sfxGainNode.gain.setTargetAtTime(sVol, t, 0.05);
    }
  }

  setMusicVolume(vol) {
    this.musicVolume = vol / 100;
    this.updateVolumes();
  }

  setSfxVolume(vol) {
    this.sfxVolume = vol / 100;
    this.updateVolumes();
  }

  toggle() {
    this.muted = !this.muted;
    this.updateVolumes();
    return this.muted;
  }

  startMusic() {
    if (!this.enabled || !this.ctx) return;
    if (this.musicInterval) return;

    this.musicIndex = 0;

    // Am -> F -> C -> G
    const chords = [
      [220, 261, 329, 440], // Am
      [174, 220, 261, 349], // F
      [261, 329, 392, 523], // C
      [196, 246, 293, 392]  // G
    ];

    this.musicInterval = setInterval(() => {
      if (this.muted || this.musicVolume <= 0 || !this.ctx) return;
      if (this.ctx.state === 'suspended') return;

      const t = this.ctx.currentTime;
      const chordIdx = Math.floor(this.musicIndex / 8) % chords.length;
      const step = this.musicIndex % 8;
      const chord = chords[chordIdx];

      // Arpeggiator pattern
      const pattern = [0, 1, 2, 3, 2, 1, 0, 1];
      const freq = chord[pattern[step]];

      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.musicGainNode);

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(0.18, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);

        osc.start(t);
        osc.stop(t + 0.25);
      } catch (err) {
        console.warn('[Audio] Failed to schedule music note', err);
      }

      this.musicIndex++;
    }, 180);
  }

  stopMusic() {
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }

  // ──────────────────────────────────────────────
  // Core primitives
  // ──────────────────────────────────────────────

  _play({ freq = 440, freq2 = null, type = 'sine', duration = 0.2,
          vol = 0.22, attack = 0.005, startTime = null }) {
    if (!this.enabled || this.muted || !this.ctx) return;
    const ctx = this.ctx;
    const t   = startTime ?? ctx.currentTime;

    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(this.sfxGainNode || ctx.destination);

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (freq2 !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, freq2), t + duration);
    }

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(vol, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    osc.start(t);
    osc.stop(t + duration + 0.03);
  }

  _noise({ duration = 0.1, vol = 0.15, cutoff = 400, startTime = null }) {
    if (!this.enabled || this.muted || !this.ctx) return;
    const ctx  = this.ctx;
    const t    = startTime ?? ctx.currentTime;
    const sr   = ctx.sampleRate;
    const frames = Math.ceil(sr * duration);

    const buf  = ctx.createBuffer(1, frames, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

    const src  = ctx.createBufferSource();
    src.buffer = buf;

    const filt = ctx.createBiquadFilter();
    filt.type  = 'lowpass';
    filt.frequency.value = cutoff;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    src.connect(filt);
    filt.connect(gain);
    gain.connect(this.sfxGainNode || ctx.destination);
    src.start(t);
    src.stop(t + duration + 0.03);
  }

  // ──────────────────────────────────────────────
  // Game sounds
  // ──────────────────────────────────────────────

  jump() {
    this._play({ freq: 220, freq2: 500, type: 'square', duration: 0.11, vol: 0.11, attack: 0.002 });
  }

  land() {
    this._noise({ duration: 0.06, vol: 0.11, cutoff: 320 });
    this._play({ freq: 110, freq2: 60, type: 'sine', duration: 0.09, vol: 0.17, attack: 0.001 });
  }

  bounce() {
    this._play({ freq: 300, freq2: 460, type: 'triangle', duration: 0.08, vol: 0.09, attack: 0.001 });
  }

  trampoline() {
    this._play({ freq: 160, freq2: 820, type: 'triangle', duration: 0.28, vol: 0.2,  attack: 0.001 });
    this._play({ freq: 320, freq2: 960, type: 'sine',     duration: 0.22, vol: 0.11, attack: 0.01  });
  }

  die() {
    this._play({ freq: 370, freq2: 55, type: 'sawtooth', duration: 0.5,  vol: 0.26, attack: 0.001 });
    this._noise({ duration: 0.32, vol: 0.16, cutoff: 800 });
  }

  egg() {
    if (!this.enabled || this.muted || !this.ctx) return;
    const t = this.ctx.currentTime;
    [523, 659, 784].forEach((f, i) =>
      this._play({ freq: f, type: 'sine', duration: 0.18, vol: 0.16, attack: 0.005, startTime: t + i * 0.07 })
    );
  }

  lifePickup() {
    if (!this.enabled || this.muted || !this.ctx) return;
    const t = this.ctx.currentTime;
    [659, 784, 988, 1175, 1319].forEach((f, i) =>
      this._play({ freq: f, type: 'triangle', duration: 0.2, vol: 0.15, attack: 0.005, startTime: t + i * 0.07 })
    );
  }

  key() {
    if (!this.enabled || this.muted || !this.ctx) return;
    const t = this.ctx.currentTime;
    [784, 988, 1175, 1568].forEach((f, i) =>
      this._play({ freq: f, type: 'sine', duration: 0.15, vol: 0.15, attack: 0.003, startTime: t + i * 0.055 })
    );
  }

  gateOpen() {
    if (!this.enabled || this.muted || !this.ctx) return;
    const t = this.ctx.currentTime;
    this._play({ freq: 300, freq2: 600,  type: 'square', duration: 0.18, vol: 0.12, attack: 0.005, startTime: t });
    this._play({ freq: 500, freq2: 1000, type: 'sine',   duration: 0.22, vol: 0.09, attack: 0.01,  startTime: t + 0.05 });
  }

  fireball() {
    this._play({ freq: 880, freq2: 220, type: 'sawtooth', duration: 0.09, vol: 0.12, attack: 0.001 });
    this._noise({ duration: 0.07, vol: 0.09, cutoff: 2800 });
  }

  fireballHit() {
    this._noise({ duration: 0.13, vol: 0.2, cutoff: 1400 });
    this._play({ freq: 260, freq2: 65, type: 'square', duration: 0.13, vol: 0.16, attack: 0.001 });
  }

  invulnerable() {
    if (!this.enabled || this.muted || !this.ctx) return;
    const t = this.ctx.currentTime;
    [523, 659, 784, 1047].forEach((f, i) =>
      this._play({ freq: f, type: 'sine', duration: 0.28, vol: 0.13, attack: 0.01, startTime: t + i * 0.08 })
    );
  }

  transform() {
    this._play({ freq: 260, freq2: 840, type: 'triangle', duration: 0.32, vol: 0.17, attack: 0.02 });
    this._play({ freq: 520, freq2: 175, type: 'sine',     duration: 0.28, vol: 0.09, attack: 0.05 });
  }

  levelComplete() {
    if (!this.enabled || this.muted || !this.ctx) return;
    const t = this.ctx.currentTime;
    [523, 659, 784, 1047, 1319].forEach((f, i) =>
      this._play({ freq: f, type: 'sine', duration: 0.28, vol: 0.19, attack: 0.01, startTime: t + i * 0.1 })
    );
  }

  gameOver() {
    if (!this.enabled || this.muted || !this.ctx) return;
    const t = this.ctx.currentTime;
    [392, 330, 294, 220].forEach((f, i) =>
      this._play({ freq: f, freq2: f * 0.82, type: 'sawtooth', duration: 0.38, vol: 0.17, attack: 0.01, startTime: t + i * 0.17 })
    );
  }

  win() {
    if (!this.enabled || this.muted || !this.ctx) return;
    const t = this.ctx.currentTime;
    [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) =>
      this._play({ freq: f, type: 'sine', duration: 0.3, vol: 0.19, attack: 0.01, startTime: t + i * 0.12 })
    );
  }

  speedShoes() {
    this._play({ freq: 300, freq2: 1200, type: 'sawtooth', duration: 0.2, vol: 0.08, attack: 0.002 });
    this._noise({ duration: 0.12, vol: 0.06, cutoff: 4000 });
  }

  shieldPickup() {
    if (!this.enabled || this.muted || !this.ctx) return;
    const t = this.ctx.currentTime;
    [880, 1108, 1320].forEach((f, i) =>
      this._play({ freq: f, type: 'sine', duration: 0.22, vol: 0.12, attack: 0.003, startTime: t + i * 0.06 })
    );
  }

  menuStart() {
    this._play({ freq: 440, freq2: 880, type: 'sine', duration: 0.25, vol: 0.13, attack: 0.01 });
  }
}

const AUDIO = new AudioEngine();
