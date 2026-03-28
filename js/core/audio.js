const AudioFX = {
  _ctx: null,
  get ctx() {
    if (!this._ctx) {
      try {
        this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        return null;
      }
    }
    return this._ctx;
  },
  _play(f1, f2, type = 'sine', dur = 0.3, vol = 0.2) {
    if (!this.ctx || !window.S?.settings?.sounds) return;
    try {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.connect(g);
      g.connect(this.ctx.destination);
      o.type = type;
      o.frequency.setValueAtTime(f1, this.ctx.currentTime);
      if (f2) o.frequency.setValueAtTime(f2, this.ctx.currentTime + dur / 2);
      g.gain.setValueAtTime(vol, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
      o.start();
      o.stop(this.ctx.currentTime + dur);
    } catch (e) {}
  },
  correct() { this._play(523, 659, 'sine', 0.4, 0.25); },
  wrong() { this._play(200, 150, 'sawtooth', 0.3, 0.2); },
  levelUp() {
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => this._play(f, f, 'sine', 0.2, 0.25), i * 120));
  },
  badge() { this._play(700, 900, 'triangle', 0.5, 0.2); },
  click() { this._play(300, 300, 'sine', 0.06, 0.1); }
};

window.AudioFX = AudioFX;

