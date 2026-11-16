// Synthesized sound effects (Web Audio, no audio files, no network). The audio
// context is created on the first user gesture; every effect is a short
// oscillator or noise burst with an envelope, so nothing is loaded or fetched.

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;
  let noiseBuffer = null;

  function ensure() {
    if (context !== null) return context;
    const Ctor = window.AudioContext ?? window.webkitAudioContext;
    if (!Ctor) return null;
    context = new Ctor();
    master = context.createGain();
    master.gain.value = 0.25;
    master.connect(context.destination);
    // One second of white noise, reused by every noise burst.
    noiseBuffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return context;
  }

  /** Call from any user gesture so the context is allowed to start. */
  function unlock() {
    const ctx = ensure();
    if (ctx !== null && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function tone(type, from, to, seconds, volume, delay = 0) {
    if (muted) return;
    const ctx = ensure();
    if (ctx === null) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + seconds);
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + seconds);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + seconds + 0.02);
  }

  function noise(seconds, volume, filterFreq, delay = 0) {
    if (muted) return;
    const ctx = ensure();
    if (ctx === null || noiseBuffer === null) return;
    const t0 = ctx.currentTime + delay;
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + seconds);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(t0);
    source.stop(t0 + seconds + 0.02);
  }

  return {
    unlock,
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    shoot() {
      tone('square', 880, 320, 0.08, 0.12);
    },
    explosion() {
      noise(0.35, 0.5, 900);
      tone('sine', 160, 40, 0.3, 0.35);
    },
    hit() {
      noise(0.2, 0.4, 500);
      tone('sawtooth', 220, 60, 0.25, 0.25);
    },
    powerup() {
      tone('sine', 523, 523, 0.09, 0.2);
      tone('sine', 659, 659, 0.09, 0.2, 0.08);
      tone('sine', 784, 784, 0.14, 0.2, 0.16);
    },
    waveClear() {
      tone('triangle', 392, 392, 0.12, 0.22);
      tone('triangle', 523, 523, 0.12, 0.22, 0.1);
      tone('triangle', 659, 659, 0.2, 0.22, 0.2);
    },
    gameOver() {
      tone('sawtooth', 330, 55, 0.9, 0.22);
      noise(0.6, 0.25, 400, 0.1);
    },
  };
}
