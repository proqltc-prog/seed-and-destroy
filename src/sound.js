// Sound (ZR-102): a cheerful "pong, poing, poing" on every
// swim tap, a lower "poing" on a collision and a deep one on the last heart.
// It is one short cartoon sound (drop_004 from Kenney's Interface Sounds,
// CC0, see sounds/LICENSE.txt), played with the Web Audio API at different
// speeds: slower sounds lower and bigger. Taps vary a little in speed, so no
// two sound the same. Tried and dropped by the owner: sounds made in code
// (they sounded like a bird) and recorded water splashes.
// No vibration: tried and dropped by the owner. The window is passed in;
// without Web Audio the game simply stays silent.

export const SOUND_DIR = 'sounds/';
export const SOUND_FILES = ['drop_004.ogg'];
export const FILE_GAIN = [1]; // loudness per file

// Per kind: which files (index in SOUND_FILES), how loud, and the playback
// speed: `rate` up to `rate * (1 + spread)`.
export const SPLASHES = {
  stroke: { files: [0], gain: 0.5, rate: 0.9, spread: 0.35 }, // a swim tap: "pong, poing, poing"
  hit: { files: [0], gain: 0.9, rate: 0.7, spread: 0 }, // a heart lost: lower
  last: { files: [0], gain: 1, rate: 0.45, spread: 0 }, // the last heart: a deep "poooing"
};

// Loads and decodes every sound file once. A file that fails stays null:
// that sound is then simply not played.
export function loadSamples(ctx, fetchFile) {
  return Promise.all(SOUND_FILES.map(async (file) => {
    try {
      const response = await fetchFile(SOUND_DIR + file);
      return await ctx.decodeAudioData(await response.arrayBuffer());
    } catch (e) {
      return null;
    }
  }));
}

// Plays one sound file at the given loudness and speed.
export function playSample(ctx, buffer, volume, rate) {
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = rate;
  const gain = ctx.createGain();
  gain.gain.value = volume;
  source.connect(gain);
  gain.connect(ctx.destination);
  source.start();
}

// The sound for the game. Browsers only allow sound after a tap,
// so `unlock` is called on every tap; the audio context is made then and the
// sound starts loading. Until it is loaded the game stays silent.
export function createFeedback(win, rng = Math.random) {
  let ctx = null;
  let samples = null;
  function context() {
    const AudioCtx = win.AudioContext ?? win.webkitAudioContext;
    if (!ctx && AudioCtx) {
      try {
        ctx = new AudioCtx();
        loadSamples(ctx, (url) => win.fetch(url)).then((loaded) => { samples = loaded; });
      } catch (e) {
        ctx = null;
      }
    }
    return ctx;
  }
  function unlock() {
    const c = context();
    if (c?.state === 'suspended') c.resume().catch(() => {});
  }
  // One sound of this kind (a file picked at random), once loaded.
  function splash(kind) {
    const c = context();
    const p = SPLASHES[kind];
    const index = p.files[Math.floor(rng() * p.files.length)];
    const buffer = samples?.[index];
    if (!c || !buffer) return;
    try {
      playSample(c, buffer, p.gain * FILE_GAIN[index], p.rate * (1 + rng() * p.spread));
    } catch (e) {
      // Ignore: no sound this time.
    }
  }
  // A collision: 'hit' or 'last', when the sound is switched on.
  function impact(s, kind) {
    if (s.sound) splash(kind);
  }
  // A swim tap.
  function stroke(s) {
    if (s.sound) splash('stroke');
  }
  return { unlock, splash, impact, stroke };
}
