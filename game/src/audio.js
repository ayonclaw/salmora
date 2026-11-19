export class CityAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.engine = null;
    this.siren = null;
    this.sirenGain = null;
    this.footClock = 0;
    this.engineAmount = 0;
    this.enabled = true;
    this.lastChord = -1;
  }

  async resume() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass || !this.enabled) return false;
    if (!this.context) this.createGraph(AudioContextClass);
    if (this.context.state === 'suspended') await this.context.resume();
    return this.context.state === 'running';
  }

  createGraph(AudioContextClass) {
    const context = new AudioContextClass();
    const master = context.createGain();
    master.gain.value = .22;
    master.connect(context.destination);
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -22;
    compressor.ratio.value = 3;
    master.connect(compressor);
    compressor.connect(context.destination);
    this.context = context;
    this.master = master;
    this.compressor = compressor;
    this.makeMusic();
    this.makeEngine();
    this.makeSiren();
  }

  makeMusic() {
    const context = this.context;
    this.music = [110, 164.81, 220].map((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const filter = context.createBiquadFilter();
      oscillator.type = index === 1 ? 'triangle' : 'sine';
      oscillator.frequency.value = frequency;
      filter.type = 'lowpass';
      filter.frequency.value = 520 + index * 120;
      gain.gain.value = index === 2 ? .012 : .021;
      oscillator.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      oscillator.start();
      return { oscillator, gain, base: frequency };
    });
    const lfo = context.createOscillator();
    const depth = context.createGain();
    lfo.frequency.value = .055;
    depth.gain.value = 9;
    lfo.connect(depth);
    depth.connect(this.music[0].oscillator.frequency);
    lfo.start();
    this.musicLfo = lfo;
  }

  makeEngine() {
    const context = this.context;
    const oscillator = context.createOscillator();
    const sub = context.createOscillator();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    oscillator.type = 'sawtooth';
    sub.type = 'triangle';
    filter.type = 'lowpass';
    filter.frequency.value = 280;
    gain.gain.value = 0;
    oscillator.frequency.value = 55;
    sub.frequency.value = 27.5;
    oscillator.connect(filter);
    sub.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    oscillator.start();
    sub.start();
    this.engine = { oscillator, sub, filter, gain };
  }

  makeSiren() {
    const context = this.context;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'square';
    oscillator.frequency.value = 650;
    gain.gain.value = 0;
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start();
    this.siren = oscillator;
    this.sirenGain = gain;
  }

  tone(frequency, duration, type = 'sine', volume = .12, endFrequency = frequency * .72) {
    if (!this.context || this.context.state !== 'running') return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(35, endFrequency), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(.001, now + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + .02);
  }

  gunshot() {
    this.tone(185, .16, 'sawtooth', .22, 48);
    this.tone(710, .055, 'square', .04, 180);
  }

  reload() {
    this.tone(620, .07, 'square', .035, 510);
    setTimeout(() => this.tone(430, .09, 'triangle', .04, 250), 170);
  }

  footstep() {
    this.tone(92, .055, 'triangle', .022, 52);
  }

  mission() {
    this.tone(523.25, .24, 'sine', .08, 523.25);
    setTimeout(() => this.tone(659.25, .36, 'sine', .08, 659.25), 100);
  }

  update(dt, { speed = 0, driving = false, wanted = 0, walking = false } = {}) {
    if (!this.context || this.context.state !== 'running') return;
    const now = this.context.currentTime;
    const amount = driving ? Math.min(1, Math.abs(speed) / 22) : 0;
    this.engineAmount += (amount - this.engineAmount) * (1 - Math.exp(-dt * 4));
    this.engine.gain.gain.setTargetAtTime(this.engineAmount * .045, now, .08);
    this.engine.oscillator.frequency.setTargetAtTime(48 + amount * 92, now, .1);
    this.engine.sub.frequency.setTargetAtTime(24 + amount * 45, now, .1);
    this.engine.filter.frequency.setTargetAtTime(180 + amount * 780, now, .12);
    const activeSiren = wanted > 0;
    this.sirenGain.gain.setTargetAtTime(activeSiren ? .018 + wanted * .004 : 0, now, .15);
    this.siren.frequency.setTargetAtTime(610 + Math.sin(now * 4.1) * (activeSiren ? 210 : 0), now, .08);
    if (walking) {
      this.footClock += dt;
      if (this.footClock >= .46) {
        this.footClock = 0;
        this.footstep();
      }
    } else this.footClock = 0;
    const chord = Math.floor(now / 17) % 4;
    if (chord !== this.lastChord) {
      this.lastChord = chord;
      const base = [110, 130.81, 146.83, 98][chord];
      this.music.forEach((voice, index) => {
        voice.oscillator.frequency.setTargetAtTime(base * [1, 1.5, 2][index], now, 2.5);
      });
    }
  }

  close() {
    if (this.context) this.context.close();
    this.context = null;
  }
}
