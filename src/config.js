// Game name: a brand name, the same in every language.
export const GAME_NAME = 'Seed & Destroy';

// Game version, shown on the start screen. Bump together with CHANGELOG.md.
export const VERSION = '0.42.3';

// Supabase backend (ZR-24). The publishable key is meant to be public: what a
// player may do is enforced by row level security and the server functions.
// Public web address of the game: links made in the Android app (invites,
// privacy page) point here, not to the app's own local pages (ZR-40). The
// site lives in the public repository proqltc-prog/seed-and-destroy (ZR-45).
export const WEB_URL = 'https://proqltc-prog.github.io/seed-and-destroy/';
export const BACKEND_URL = 'https://cmmgsnkvqcvjsxldflvo.supabase.co';
export const BACKEND_KEY = 'sb_publishable_n0s3szVue9P5xeMQm-gB_w_qddLZc4J';

// Logical canvas size; the canvas is scaled for high-DPI screens.
export const W = 360;
export const H = 640;

// Physics and level settings.
export const GRAVITY = 1500; // px/s²
export const SWIM = -430; // impulse on tap
export const SPEED_START = 150; // scroll speed at the start of a run (px/s)
export const SPEED_MAX = 150; // highest scroll speed: the same as the start, a fixed speed like Flappy Bird (ZR-63, was 260)
export const SPEED_RAMP_SCORE = 100; // score at which the highest speed is reached
export const GATE_W = 64;
export const GATE_SPACING = 210;
export const GATE_MAX_STEP = 170; // a new opening is at most this far above or below the previous one (ZR-61)
// Gate openings vary at random (big, small, big ...) around an average that
// shrinks with the score. The minimum keeps every opening comfortably passable
// (the cell is 26 px high).
export const GAP_MEAN_START = 190; // average opening at score 0
export const GAP_MEAN_END = 155; // average opening once the game is hard
export const GAP_SHRINK_SCORE = 60; // score at which the average reaches GAP_MEAN_END
export const GAP_VARIATION = 35; // openings vary up to this much around the average
export const GAP_MIN = 130; // never smaller than this
export const GAP_MAX = 230; // never larger than this

// Hearts (lives)
export const START_HEARTS = 3;
export const MAX_HEARTS = 3; // pickups never raise hearts above this
export const INVULNERABLE_TIME = 1.5; // seconds without damage after a hit
export const HEART_PICKUP_MIN_SCORE = 25; // pickups only appear once the game is harder
export const HEART_PICKUP_CHANCE = 0.03; // chance per new gate below RICH_SCORE, while below MAX_HEARTS (ZR-36)
export const HEART_PICKUP_CHANCE_LATE = 0.06; // chance per new gate from RICH_SCORE on
export const PICKUP_R = 11;

// Enemies: rival sperm cells (fat and thin) and white blood cells.
// One may appear in the space after a new gate; touching one costs a heart.
export const ENEMY_MIN_SCORE = 3; // no enemies during the first gates
export const ENEMY_RAMP_SCORE = 80; // score at which enemies are most frequent and fastest
export const ENEMY_CHANCE_START = 0.35; // chance per new gate at ENEMY_MIN_SCORE
export const ENEMY_CHANCE_MAX = 0.8; // chance per new gate from ENEMY_RAMP_SCORE on
export const ENEMY_MARGIN = 50; // keep enemies this far from the top and bottom
export const WBC_SHARE = 0.35; // share of up-and-down floaters (white blood cells and, later, the foes below)
export const FAT_SHARE = 0.15; // share of fat sperm cells among all enemies (ZR-62, was 0.35); the rest are thin
export const WBC_R = 16;
// More variety among the up-and-down floaters (ZR-37): playful and a bit
// educational. They take the place of a white blood cell, so the number of
// enemies stays the same. Each kind joins from its score on with a weight;
// the white blood cell always has weight 1, so later the mix gets richer.
export const FLOATERS = [
  { kind: 'fungus', minScore: 20, weight: 0.6, r: 16 },
  { kind: 'pill', minScore: 40, weight: 0.5, r: 14 },
  { kind: 'ring', minScore: 60, weight: 0.5, r: 15 },
];
export const FAT_R = 15;
export const THIN_R = 8;
export const FAT_SWIM = 30; // own swimming speed: fat ones drift back faster
export const THIN_SWIM = 70;
export const WBC_AMPLITUDE = 70; // white blood cells move this far up and down
export const WBC_OMEGA_START = 1.2; // up-and-down speed (rad/s) at the start
export const WBC_OMEGA_MAX = 3.5; // up-and-down speed from ENEMY_RAMP_SCORE on
export const PUFF_EVERY_MIN = 1.5; // fat ones puff every 1.5 to 3.5 seconds
export const PUFF_EVERY_RANGE = 2;
export const PUFF_TIME = 0.7; // a puff stays visible this long

// Start animation before every run (ZR-38): a group of sperm cells sets off
// together, the player breaks out ahead, and the egg (the goal) shows on the
// right before it moves off screen. A tap skips it.
export const LAUNCH_TIME = 2.2; // seconds until the run starts
export const LAUNCH_GROUP = 6; // sperm cells in the group besides the player
export const LAUNCH_BREAKOUT = 0.9; // seconds until the player breaks out
export const LAUNCH_EGG_LEAVE = 1.3; // seconds until the egg starts to move off
export const EGG_X = 285;
export const EGG_R = 36;

// Game over: a group of fast sperm cells overtakes the player, then a big
// fat one arrives late. Only after that the end screen appears.
export const OVERTAKE_GROUP = 5; // cells in the fast group
export const OVERTAKE_GROUP_SPEED = 320; // px/s
export const OVERTAKE_FAT_DELAY = 1.6; // seconds before the fat one arrives
export const OVERTAKE_FAT_SPEED = 170; // px/s
export const OVERTAKE_FAT_R = 22;

// Screen shake at high scores, simulating the mother walking: a rhythmic
// sway and bob that grows with the score. From CONTROL_SHAKE_SCORE on it
// also pushes the cell a little in the rhythm of the steps.
export const SHAKE_START_SCORE = 40; // no shake below this score
export const SHAKE_FULL_SCORE = 160; // full shake from this score on
export const SHAKE_MAX = 6; // largest screen offset in px
export const STEP_HZ = 1.8; // steps per second
export const CONTROL_SHAKE_SCORE = 100; // from here the shake affects the controls
export const CONTROL_NUDGE = 500; // largest push on the cell in px/s² (gravity is 1500)

// Credits: earned in play, spent in the store.
export const CREDITS_PER_GATE = 1;

// Rewarded ads (ZR-14/15, AdMob in the Android app): a watched ad pays
// AD_REWARD credits, at most AD_DAILY per day and one every AD_COOLDOWN
// (ZR-67); the server holds the rule.
// Test builds (testers, website) always show Google's test ads, so nobody
// clicks live ads while testing (AdMob policy). Only the Play Store build is
// switched to live ads: `npm run android -- --release` sets AD_LIVE (ZR-46).
export const AD_REWARD = 100;
export const AD_DAILY = 10;
export const AD_COOLDOWN = 30 * 60 * 1000; // ms between two credit videos (ZR-67)
export const AD_LIVE = false;
export const AD_TEST_UNIT = 'ca-app-pub-3940256099942544/5224354917';
export const AD_LIVE_UNITS = {
  credits: 'ca-app-pub-8394022188610476/2178261066', // "Credits filmpje": 10 a day, one per 30 min, +100 credits
  gate: 'ca-app-pub-8394022188610476/8552097726', // "Pogingen filmpje": new runs
  revive: 'ca-app-pub-8394022188610476/5190701126', // "Revive": one extra life per run (ZR-69)
};
// Every AD_GATE_RUNS runs a video unlocks the next AD_GATE_RUNS (ZR-43);
// 10 again since ZR-80 (ZR-69 had raised it to 15).
export const AD_GATE_RUNS = 10;
// Revive (ZR-69): once per run, after the last heart, a video continues the
// run where it ended. The player has REVIVE_DECIDE_TIME seconds to choose;
// after the revive the cell has 1 heart, is invulnerable for
// REVIVE_INVULNERABLE seconds and enemies within REVIVE_CLEAR_RADIUS vanish.
export const REVIVE_DECIDE_TIME = 10;
export const REVIVE_INVULNERABLE = 2;
export const REVIVE_CLEAR_RADIUS = 160;
// Streak bonus (ZR-23): gates in a row without losing a heart earn extra
// credits, 1 per gate after STREAK_START and 2 per gate after STREAK_DOUBLE.
// The server caps the bonus of a run with the same rule.
export const STREAK_START = 10;
export const STREAK_DOUBLE = 20;

// Mystery boxes: a green boost box starts the active boost, a red weapon box
// the active weapon (ZR-36). The game does not pause. Below RICH_SCORE boxes
// and hearts are rare; from there on, when the game is fast and busy, boost
// boxes and hearts come more often.
export const RICH_SCORE = 100;
export const MYSTERY_MIN_SCORE = 5; // no boxes during the first gates
export const BOOST_BOX_CHANCE = 0.03; // chance per new gate below RICH_SCORE, when no box is on screen
export const BOOST_BOX_CHANCE_LATE = 0.07; // from RICH_SCORE on
export const WEAPON_BOX_CHANCE = 0.03; // chance per new gate, at any score
export const MYSTERY_R = 15;

// Boost effects
export const SHIELD_TIME = 5; // seconds of invulnerability (boost-shield)
export const DOUBLE_TIME = 20; // seconds of double score (boost-double)

// Weapon effects. `gates`: how many gates it can destroy; `time`: seconds.
// Weapon times since ZR-65. No weapon removes gate walls any more: the rockets blast the opening
// wider (ZR-77); the sword, the guns and the laser destroy flying objects only (ZR-55, ZR-76).
export const WEAPON_FX = {
  'weapon-sword': { kind: 'melee', time: 5, gates: 0, reach: 70 },
  'weapon-handgun': { kind: 'gun', time: 5, gates: 0, fireEvery: 0.3, spread: 0 },
  'weapon-standard': { kind: 'gun', time: 8, gates: 0, fireEvery: 0.45, spread: 0, pellets: 3, fan: 170 }, // shotgun (ZR-54)
  'weapon-minigun': { kind: 'gun', time: 8, gates: 0, fireEvery: 0.07, spread: 90 },
  // Rockets (ZR-77): `rockets` shots, at most one per `every` s, each at the next wall within
  // `range` px; the hit widens that opening by `widen` and a shockwave of `blast` px destroys enemies.
  // `into`: how far past the edge of the opening the rocket hits the wall (ZR-81).
  'weapon-missile': { kind: 'missile', time: 12, gates: 0, rockets: 4, every: 1, range: 260, widen: 0.6, blast: 110, into: 24 },
  // Chain laser (ZR-78): after a 0.5 s charge-up, every `every` s a zap hits the nearest enemy
  // ahead and jumps to the nearest enemy within `chainRange` px, `chain` enemies at most.
  'weapon-laser': { kind: 'laser', time: 10, gates: 0, charge: 0.5, every: 0.5, chain: 3, chainRange: 150 },
};
// Where shots leave each held weapon (ZR-72): the end of the barrel, the tip
// of the launcher or of the laser gun. Offsets from the cell centre; rx and ry
// add that many cell radii (the guns sit at the front of the cell, the
// launcher on its shoulder).
export const WEAPON_MUZZLE = {
  'weapon-handgun': { x: 13, y: 3, rx: 1, ry: 0 },
  'weapon-standard': { x: 22, y: 4, rx: 1, ry: 0 },
  'weapon-minigun': { x: 22, y: 6, rx: 1, ry: 0 },
  'weapon-missile': { x: 27, y: -2.5, rx: 0, ry: -1 },
  'weapon-laser': { x: 17, y: 4, rx: 1, ry: 0 },
};
export const BULLET_SPEED = 600; // px/s
export const MISSILE_SPEED = 520; // px/s
export const BURST_TIME = 0.4; // seconds a destroyed thing keeps flashing
// Impact effects (ZR-73): sparks and debris fly apart and fade in SPARK_TIME;
// a destroyed enemy flashes white for FLASH_TIME. At most SPARK_MAX pieces
// at once, so older phones stay smooth.
export const SPARK_TIME = 0.4;
export const FLASH_TIME = 0.15;
export const SPARK_MAX = 120;
export const SPARK_DRAG = 3; // per second: pieces slow down as they fly
export const ZAP_TIME = 0.25; // seconds a chain-laser bolt keeps glowing (ZR-78)
// The colour of the pieces per kind of enemy or floater.
export const DEBRIS_COLORS = {
  thin: '#dfe7f2', fat: '#ffd9a8', wbc: '#f4f7ff', fungus: '#9be36b', pill: '#ff8fb8', ring: '#ffcc4d',
};
// Extra credits (ZR-64): a heart while all hearts are full, and every enemy
// destroyed by a weapon. The server pays at most EXTRA_PER_GATE_MAX per gate.
export const HEART_FULL_CREDITS = 10;
export const KILL_CREDITS = 5;
export const EXTRA_PER_GATE_MAX = 15;
export const POPUP_TIME = 0.9; // seconds a "+5" stays on screen
export const POPUP_RISE = 40; // px a popup floats up during that time

export const BUBBLE_COUNT = 26;
export const MAX_DPR = 3;
export const MAX_DT = 1 / 30;
