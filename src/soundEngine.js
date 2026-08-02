// Web Audio API Sound Engine for Arcade Sound Effects
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(freq, type, duration, gainVal = 0.1) {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      console.warn("Audio play error:", e);
    }
  }

  playCorrect() {
    this.playTone(523.25, 'sine', 0.1, 0.15); // C5
    setTimeout(() => this.playTone(659.25, 'sine', 0.1, 0.15), 80); // E5
    setTimeout(() => this.playTone(783.99, 'sine', 0.2, 0.18), 160); // G5
  }

  playWrong() {
    this.playTone(220, 'sawtooth', 0.15, 0.15);
    setTimeout(() => this.playTone(180, 'sawtooth', 0.25, 0.15), 100);
  }

  playCoin() {
    this.playTone(987.77, 'triangle', 0.08, 0.15); // B5
    setTimeout(() => this.playTone(1318.51, 'triangle', 0.25, 0.18), 80); // E6
  }

  playHit() {
    this.playTone(150, 'square', 0.1, 0.2);
    setTimeout(() => this.playTone(80, 'sawtooth', 0.15, 0.2), 50);
  }

  playClick() {
    this.playTone(400, 'sine', 0.04, 0.05);
  }

  playFanfare() {
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      setTimeout(() => this.playTone(freq, 'triangle', 0.3, 0.2), idx * 120);
    });
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }
}

export const sound = new SoundEngine();
