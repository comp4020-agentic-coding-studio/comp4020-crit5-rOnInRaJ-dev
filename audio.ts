// All sound is synthesised at runtime: a looping noise source through a
// bandpass for the wind, and two short envelopes for the one-shots. No audio
// files to load, decode or ship.
//
// Everything no-ops until `startAudio()` runs, because browsers only allow an
// AudioContext to start inside a user gesture — and because that keeps this
// module importable from tests, where AudioContext doesn't exist.

let ctx: AudioContext | null = null;
let whooshGain: GainNode | null = null;
let whooshFilter: BiquadFilterNode | null = null;

// Speed range the whoosh maps over, px/s. Below the floor there's silence.
const QUIET_SPEED = 260;
const LOUD_SPEED = 1900;
const MAX_WHOOSH_GAIN = 0.22;

function noiseBuffer(audio: AudioContext): AudioBuffer {
  const buffer = audio.createBuffer(1, audio.sampleRate * 2, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/** Call from a click/keydown handler. Safe to call repeatedly. */
export function startAudio() {
  if (ctx) {
    void ctx.resume();
    return;
  }
  ctx = new AudioContext();

  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx);
  source.loop = true;

  whooshFilter = ctx.createBiquadFilter();
  whooshFilter.type = "bandpass";
  whooshFilter.frequency.value = QUIET_SPEED;
  whooshFilter.Q.value = 1.1;

  whooshGain = ctx.createGain();
  whooshGain.gain.value = 0;

  source.connect(whooshFilter).connect(whooshGain).connect(ctx.destination);
  source.start();
}

/**
 * Wind noise tracking speed: faster is louder and higher. Ramped with
 * setTargetAtTime rather than assigned, or every frame's new value clicks.
 */
export function setSpeed(speed: number) {
  if (!ctx || !whooshGain || !whooshFilter) return;
  const t = Math.min(1, Math.max(0, (speed - QUIET_SPEED) / (LOUD_SPEED - QUIET_SPEED)));
  const now = ctx.currentTime;
  whooshGain.gain.setTargetAtTime(t * t * MAX_WHOOSH_GAIN, now, 0.08);
  whooshFilter.frequency.setTargetAtTime(240 + t * 1500, now, 0.08);
}

export function stopWind() {
  if (!ctx || !whooshGain) return;
  whooshGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
}

/** Rope fired and stuck: a short downward thwip. */
export function ropeShot() {
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(1200, now);
  osc.frequency.exponentialRampToValueAtTime(180, now + 0.14);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.18, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.18);
}

/** Boost collected: a rising two-note chime. */
export function boostChime() {
  if (!ctx) return;
  const now = ctx.currentTime;
  for (const [i, freq] of [523.25, 783.99].entries()) {
    const at = now + i * 0.08;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, at);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.22, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.26);

    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + 0.28);
  }
}
