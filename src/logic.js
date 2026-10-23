// Game rules and state, free of any drawing or browser code so it can be
// unit tested. Randomness is injected as `rng` (a function returning [0, 1)).
import {
  W, H, GRAVITY, SWIM, SPEED_START, SPEED_MAX, SPEED_RAMP_SCORE, GATE_W,
  GATE_SPACING, GATE_MAX_STEP, GAP_MEAN_START, GAP_MEAN_END, GAP_SHRINK_SCORE, GAP_VARIATION, GAP_MIN, GAP_MAX,
  BUBBLE_COUNT,
  START_HEARTS, MAX_HEARTS, INVULNERABLE_TIME, HEART_PICKUP_MIN_SCORE,
  HEART_PICKUP_CHANCE, HEART_PICKUP_CHANCE_LATE, RICH_SCORE, PICKUP_R,
  ENEMY_MIN_SCORE, ENEMY_RAMP_SCORE, ENEMY_CHANCE_START, ENEMY_CHANCE_MAX, ENEMY_MARGIN,
  WBC_SHARE, FAT_SHARE, WBC_R, FLOATERS, FAT_R, THIN_R, FAT_SWIM, THIN_SWIM, WBC_AMPLITUDE,
  WBC_OMEGA_START, WBC_OMEGA_MAX, PUFF_EVERY_MIN, PUFF_EVERY_RANGE, PUFF_TIME,
  OVERTAKE_GROUP, OVERTAKE_GROUP_SPEED, OVERTAKE_FAT_DELAY, OVERTAKE_FAT_SPEED, OVERTAKE_FAT_R,
  THIN_R as OVERTAKE_R,
  SHAKE_START_SCORE, SHAKE_FULL_SCORE, SHAKE_MAX, STEP_HZ, CONTROL_SHAKE_SCORE, CONTROL_NUDGE,
  CREDITS_PER_GATE, STREAK_START, STREAK_DOUBLE, REVIVE_DECIDE_TIME, REVIVE_INVULNERABLE, REVIVE_CLEAR_RADIUS,
} from './config.js';
import { buy, equip, normalizeOwned, normalizeEquipped } from './shop.js';
import {
  inRect, START_STORE_BUTTON, GEAR_BUTTON, LEADERBOARD_BUTTON, AD_HOME_BUTTON, AD_GATE_BUTTON, storeHit,
  REVIVE_WATCH, REVIVE_SKIP,
} from './ui.js';
import { adsShown, adAvailable, gateReached } from './ads.js';
import { openLeaderboard, leaderboardPress } from './leaderboard.js';
import { startLaunch, finishLaunch, updateLaunch } from './launch.js';
import { friendsPress } from './friends.js';
import { maybeSpawnBox, isProtected, updateEffects, gainHeart } from './weapons.js';
import {
  ONBOARDING_STATES, startOnboarding, onboardingPress, openSettings, settingsPress,
  RECOVERY_STATES, recoveryPress, startAgeCheck,
} from './onboarding.js';

export function newBubble(rng, x) {
  return { x, y: rng() * H, r: 1 + rng() * 3.5, s: 0.2 + rng() * 0.6 };
}

// Store results and the text key shown for each (see src/i18n.js).
export const STORE_MESSAGES = {
  bought: 'msgBought',
  'too-expensive': 'msgTooExpensive',
  equipped: 'msgEquipped',
  active: 'msgActive',
};
export const STORE_MESSAGE_TIME = 2; // seconds a store message stays visible
export const TOAST_TIME = 4; // seconds a home screen message stays visible

// A short message on the home screen, e.g. a new friend (ZR-21). While one
// is visible, later messages wait in line and follow one by one (ZR-23).
export function showToast(s, key, vars = {}) {
  const toast = { key, vars, time: TOAST_TIME };
  if (s.toast?.time > 0) (s.toastQueue ??= []).push(toast);
  else s.toast = toast;
}

// Counts the visible message down and shows the next one when it is gone.
export function updateToast(s, dt) {
  if (!s.toast) return;
  s.toast.time = Math.max(s.toast.time - dt, 0);
  if (s.toast.time === 0 && s.toastQueue?.length) s.toast = s.toastQueue.shift();
}

// Extra credits for a gate at this point of a streak (ZR-23).
export function streakBonus(streak) {
  if (streak > STREAK_DOUBLE) return 2;
  return streak > STREAK_START ? 1 : 0;
}

// `profile` holds the username and whether onboarding was done; callers pass
// the stored profile, so a fresh player starts with the onboarding screens.
export function createGame(rng, best = 0, credits = 0, owned = [], equipped = {}, lang = 'nl', profile = { name: '', onboarded: true, age: 'ok' }) {
  const s = {
    lang, name: profile.name, onboarded: profile.onboarded, age: profile.age, best, credits,
    owned: normalizeOwned(owned), store: { tab: 'skins', message: '', messageTime: 0 },
    runsPlayed: 0, // runs since the last unlock video (ZR-43)
  };
  s.equipped = normalizeEquipped(equipped, s.owned);
  reset(s, rng);
  if (!s.onboarded) startOnboarding(s);
  else if (!s.age) startAgeCheck(s);
  return s;
}

export function reset(s, rng) {
  s.state = 'start'; // start | launch | play | revive | dead
  s.cell = { x: 110, y: H / 2, vy: 0, r: 13, phase: 0 };
  s.gates = [];
  s.pickups = [];
  s.enemies = [];
  s.boxes = []; // mystery boxes
  s.bullets = [];
  s.missiles = [];
  s.bursts = []; // flashes where something was destroyed
  s.weapon = null; // the running weapon effect
  s.shieldTime = 0;
  s.doubleTime = 0;
  s.score = 0;
  s.runCredits = 0; // credits earned in this run
  s.extraCredits = 0; // of those: full-heart and enemy credits, sent to the server as p_extra (ZR-64)
  s.popups = []; // "+5" texts floating up (ZR-64)
  s.sparks = []; // impact sparks and debris (ZR-73)
  s.flashes = []; // white hit flashes (ZR-73)
  s.zaps = []; // chain-laser bolts (ZR-78)
  s.gatesPassed = 0; // gates passed in this run (sent to the server)
  s.playTime = 0; // seconds of play in this run (sent to the server)
  s.streak = 0; // gates in a row without losing a heart (ZR-23)
  s.streakBonus = 0; // extra credits from streaks in this run (sent to the server)
  s.speed = SPEED_START;
  s.hearts = START_HEARTS;
  s.invulnerable = 0;
  s.t = 0;
  s.nextGateX = W + 80;
  s.lastGateCy = null; // centre of the last opening (ZR-61)
  s.gatesSpawned = 0;
  s.ending = null;
  s.newBest = false;
  s.revive = null; // the revive question after the last heart (ZR-69)
  s.reviveUsed = false; // a revive is offered once per run
  s.bubbles = Array.from({ length: BUBBLE_COUNT }, () => newBubble(rng, rng() * W));
}

// Difficulty rises with the score: the scroll speed grows steadily until it
// reaches its maximum. Together with the narrowing opening this makes the
// endless run progressively harder.
export function speedFor(score) {
  const progress = Math.min(score / SPEED_RAMP_SCORE, 1);
  return SPEED_START + (SPEED_MAX - SPEED_START) * progress;
}

// How strong the screen shake is for a score: 0 (none) up to 1 (full).
export function shakeLevel(score) {
  if (score <= SHAKE_START_SCORE) return 0;
  return Math.min((score - SHAKE_START_SCORE) / (SHAKE_FULL_SCORE - SHAKE_START_SCORE), 1);
}

// Screen offset at time t: a side-to-side sway and an up-and-down bob in
// the rhythm of the mother's steps.
export function shakeOffset(score, t) {
  const a = shakeLevel(score) * SHAKE_MAX;
  const step = t * Math.PI * 2 * STEP_HZ;
  return { x: a * 0.6 * Math.sin(step), y: a * Math.abs(Math.sin(step / 2)) };
}

// Small push on the cell in the rhythm of the steps, only at high scores.
export function controlNudge(score, t) {
  if (score < CONTROL_SHAKE_SCORE) return 0;
  return CONTROL_NUDGE * shakeLevel(score) * Math.sin(t * Math.PI * 2 * STEP_HZ);
}

// Average gate opening for the current score: shrinks, then stays.
export function meanGap(score) {
  const progress = Math.min(score / GAP_SHRINK_SCORE, 1);
  return GAP_MEAN_START - (GAP_MEAN_START - GAP_MEAN_END) * progress;
}

// Random opening around the average, kept between GAP_MIN and GAP_MAX.
export function gateGap(score, rng) {
  const gap = meanGap(score) + (rng() * 2 - 1) * GAP_VARIATION;
  return Math.min(Math.max(gap, GAP_MIN), GAP_MAX);
}

// A heart pickup can only appear once the game has become harder, while the
// player is below the maximum number of hearts, and then only rarely.
// Heart pickups are rare below RICH_SCORE and more common after (ZR-36).
export function heartChance(score) {
  return score >= RICH_SCORE ? HEART_PICKUP_CHANCE_LATE : HEART_PICKUP_CHANCE;
}

export function canSpawnHeart(s, rng) {
  return s.score >= HEART_PICKUP_MIN_SCORE && s.hearts < MAX_HEARTS && rng() < heartChance(s.score);
}

// Chance that an enemy appears after a new gate: none at the very start,
// then more and more often as the score rises.
export function enemyChance(score) {
  if (score < ENEMY_MIN_SCORE) return 0;
  const progress = Math.min((score - ENEMY_MIN_SCORE) / ENEMY_RAMP_SCORE, 1);
  return ENEMY_CHANCE_START + (ENEMY_CHANCE_MAX - ENEMY_CHANCE_START) * progress;
}

// How fast white blood cells move up and down: faster as the score rises.
export function wbcOmega(score) {
  const progress = Math.min(score / ENEMY_RAMP_SCORE, 1);
  return WBC_OMEGA_START + (WBC_OMEGA_MAX - WBC_OMEGA_START) * progress;
}

// A new enemy at x: a white blood cell, a fat (tired) sperm cell or a thin one.
// Up-and-down floaters drift with the scroll; the others are rival sperm cells.
export const FLOATER_KINDS = ['wbc', ...FLOATERS.map((f) => f.kind)];
export const isFloater = (e) => FLOATER_KINDS.includes(e.kind);

// The floater kinds available at a score, with their weights (ZR-37).
export function floaterKinds(score) {
  return [{ kind: 'wbc', weight: 1, r: WBC_R }, ...FLOATERS.filter((f) => score >= f.minScore)];
}

// Which floater appears: a white blood cell, or from higher scores also a
// fungus, a contraceptive pill or a vaginal ring. Only draws when there is a
// choice, so the start of the game is unchanged.
export function pickFloater(score, rng) {
  const kinds = floaterKinds(score);
  if (kinds.length === 1) return kinds[0];
  let roll = rng() * kinds.reduce((sum, k) => sum + k.weight, 0);
  const last = kinds.pop();
  for (const k of kinds) {
    roll -= k.weight;
    if (roll < 0) return k;
  }
  return last;
}

export function makeEnemy(x, rng, score = 0) {
  const roll = rng();
  if (roll < WBC_SHARE) {
    const reach = ENEMY_MARGIN + WBC_AMPLITUDE;
    const baseY = reach + rng() * (H - 2 * reach);
    const { kind, r } = pickFloater(score, rng);
    return { kind, x, y: baseY, baseY, r, phase: rng() * Math.PI * 2 };
  }
  const y = ENEMY_MARGIN + rng() * (H - 2 * ENEMY_MARGIN);
  if (roll < WBC_SHARE + FAT_SHARE) {
    return {
      kind: 'fat', x, y, r: FAT_R, swim: FAT_SWIM, tail: 0,
      puff: 0, puffIn: PUFF_EVERY_MIN + rng() * PUFF_EVERY_RANGE,
    };
  }
  return { kind: 'thin', x, y, r: THIN_R, swim: THIN_SWIM, tail: 0 };
}

// Rival sperm cells swim forward too, but slower than the scroll, so they come
// from the front and drift back past the player. Fat ones puff now and then.
// White blood cells drift with the scroll and move up and down.
export function updateEnemies(s, dt, rng) {
  for (const e of s.enemies) {
    if (isFloater(e)) {
      e.x -= s.speed * dt;
      e.phase += wbcOmega(s.score) * dt;
      e.y = e.baseY + Math.sin(e.phase) * WBC_AMPLITUDE;
      continue;
    }
    e.x -= (s.speed - e.swim) * dt;
    e.tail += dt * (e.kind === 'fat' ? 8 : 16);
    if (e.kind === 'fat') {
      if (e.puff > 0) e.puff = Math.max(e.puff - dt, 0);
      e.puffIn -= dt;
      if (e.puffIn <= 0) {
        e.puff = PUFF_TIME;
        e.puffIn = PUFF_EVERY_MIN + rng() * PUFF_EVERY_RANGE;
      }
    }
  }
  s.enemies = s.enemies.filter((e) => e.x > -60);
}

// Where the centre of a new opening may go: inside the screen margins and,
// after the first gate, at most GATE_MAX_STEP from the previous opening
// (ZR-61), so the next opening can always be reached.
export function gateRange(gap, lastCy) {
  const margin = 70;
  const lo = margin + gap / 2;
  const hi = H - margin - gap / 2;
  if (lastCy === null || lastCy === undefined) return { lo, hi };
  return { lo: Math.max(lo, lastCy - GATE_MAX_STEP), hi: Math.min(hi, lastCy + GATE_MAX_STEP) };
}

export function spawnGate(s, rng) {
  const gap = gateGap(s.score, rng);
  const { lo, hi } = gateRange(gap, s.lastGateCy);
  const cy = lo + rng() * (hi - lo);
  s.lastGateCy = cy;
  s.gates.push({ x: s.nextGateX, cy, gap, passed: false, wob: rng() * 6 });
  if (canSpawnHeart(s, rng)) {
    // Floats in the middle of the opening, so it is reachable.
    s.pickups.push({ x: s.nextGateX + GATE_W / 2, y: cy, r: PICKUP_R });
  }
  const chance = enemyChance(s.score);
  if (chance > 0 && rng() < chance) {
    // In the open water halfway to the next gate, never inside a wall.
    s.enemies.push(makeEnemy(s.nextGateX + GATE_W + (GATE_SPACING - GATE_W) / 2, rng, s.score));
  }
  // A mystery box in the opening, unless a heart already floats there.
  if (s.pickups.at(-1)?.x !== s.nextGateX + GATE_W / 2) maybeSpawnBox(s, s.nextGateX + GATE_W / 2, cy, rng);
  s.nextGateX += GATE_SPACING;
  s.gatesSpawned++;
}

// Tap, click, space, arrow up or enter. A tap passes its position `point`
// in screen coordinates (keys pass none). Returns what changed, so the caller
// can save: 'purchase', 'equip', 'lang', 'name', 'onboarded' or 'focus-name'.
export function press(s, rng, point) {
  if (ONBOARDING_STATES.includes(s.state)) return onboardingPress(s, point);
  if (s.state === 'settings') return settingsPress(s, point);
  if (RECOVERY_STATES.includes(s.state)) return recoveryPress(s, point);
  if (s.state === 'leaderboard') return leaderboardPress(s, point);
  if (s.state === 'friends') return friendsPress(s, point);
  if (s.state === 'store') return storePress(s, point);
  if (s.state === 'start') {
    if (point && inRect(point, GEAR_BUTTON)) {
      openSettings(s);
      return undefined;
    }
    if (point && inRect(point, LEADERBOARD_BUTTON)) return openLeaderboard(s);
    // The ad button (ZR-14); once today's ads are used it only shows that.
    if (point && adsShown(s) && inRect(point, AD_HOME_BUTTON)) return adAvailable(s) ? 'watch-ad' : undefined;
    if (point && inRect(point, START_STORE_BUTTON)) {
      s.state = 'store';
      s.store.message = '';
      s.store.messageTime = 0;
      return undefined;
    }
    // With the runs used only the video button gives new runs; otherwise
    // the player waits until midnight (ZR-43).
    if (gateReached(s)) return point && inRect(point, AD_GATE_BUTTON) ? 'watch-gate-ad' : undefined;
    // First the start animation (ZR-38); the run begins when it ends.
    startLaunch(s, rng);
    if (!adsShown(s)) return undefined;
    s.runsPlayed += 1;
    return 'run';
  }
  if (s.state === 'launch') {
    finishLaunch(s); // a tap skips the animation
    return undefined;
  }
  if (s.state === 'revive') return revivePress(s, point);
  if (s.state === 'play') { s.cell.vy = SWIM; return undefined; }
  // After game over, a tap only restarts once the overtaking scene is over.
  if (s.ending.done) reset(s, rng);
  return undefined;
}

// A tap on the store screen: back, switch tab, buy an item, or choose an
// owned item as the active one.
export function storePress(s, point) {
  const hit = point ? storeHit(s.store.tab, point) : null;
  if (!hit) return undefined;
  if (hit.action === 'back') { s.state = 'start'; return undefined; }
  if (hit.action === 'tab') {
    s.store.tab = hit.category;
    s.store.message = '';
    s.store.messageTime = 0;
    return undefined;
  }
  s.store.lastId = hit.id; // the item the server is told about
  const result = s.owned.includes(hit.id) ? equip(s, hit.id) : buy(s, hit.id);
  s.store.message = STORE_MESSAGES[result];
  s.store.messageTime = STORE_MESSAGE_TIME;
  if (result === 'bought') return 'purchase';
  return result === 'equipped' ? 'equip' : undefined;
}

export function isPressKey(code) {
  return code === 'Space' || code === 'ArrowUp' || code === 'Enter';
}

function recordBest(s) {
  s.newBest = s.score > s.best;
  if (s.newBest) s.best = s.score;
}

export function die(s) {
  s.state = 'dead';
  s.hearts = 0;
  s.invulnerable = 0;
  s.cell.vy = 0;
  s.ending = startEnding(s.cell.y);
  s.weapon = null;
  s.bullets = [];
  s.missiles = [];
  s.shieldTime = 0;
  s.doubleTime = 0;
  recordBest(s);
  return 'dead';
}

// The overtaking scene: a fast group passes right away, close to the player's
// height; the fat one follows after OVERTAKE_FAT_DELAY.
export function startEnding(y) {
  const group = [];
  for (let i = 0; i < OVERTAKE_GROUP; i++) {
    const gy = Math.min(Math.max(y + (i - (OVERTAKE_GROUP - 1) / 2) * 34, 40), H - 40);
    group.push({ kind: 'thin', x: -30 - i * 50, y: gy, r: OVERTAKE_R, tail: i });
  }
  return { t: 0, group, fat: null, done: false };
}

export function updateEnding(e, y, dt) {
  e.t += dt;
  for (const c of e.group) { c.x += OVERTAKE_GROUP_SPEED * dt; c.tail += dt * 20; }
  if (!e.fat && e.t >= OVERTAKE_FAT_DELAY) {
    e.fat = { kind: 'fat', x: -OVERTAKE_FAT_R * 3, y, r: OVERTAKE_FAT_R, tail: 0, puff: 0 };
  }
  if (e.fat) {
    e.fat.x += OVERTAKE_FAT_SPEED * dt;
    e.fat.tail += dt * 8;
    if (e.fat.x - OVERTAKE_FAT_R * 4 > W) e.done = true;
  }
}

// A passed gate: one point and credits. A long streak earns extra credits.
export function scoreGate(s) {
  s.score += s.doubleTime > 0 ? 2 : 1; // the score doubler boost counts double
  s.gatesPassed += 1;
  s.streak += 1;
  const bonus = streakBonus(s.streak);
  s.streakBonus += bonus;
  s.runCredits += CREDITS_PER_GATE + bonus;
  s.credits += CREDITS_PER_GATE + bonus;
}

// A collision costs one heart. The last heart ends the run, unless a revive
// can be offered (ZR-69); otherwise the cell is briefly invulnerable.
// Returns 'dead' when the run ended.
export function loseHeart(s) {
  s.hearts--;
  s.streak = 0;
  if (s.hearts <= 0) {
    if (!canRevive(s)) return die(s);
    startRevive(s);
    return undefined;
  }
  s.invulnerable = INVULNERABLE_TIME;
  return undefined;
}

// Revive (ZR-69): offered once per run where ads exist (app, online, 13+)
// and no other video is loading.
export function canRevive(s) {
  return adsShown(s) && !s.reviveUsed && s.ads.status === 'idle';
}

// The run pauses on the revive question with REVIVE_DECIDE_TIME seconds.
export function startRevive(s) {
  s.state = 'revive';
  s.hearts = 0;
  s.reviveUsed = true;
  s.cell.vy = 0;
  s.revive = { time: REVIVE_DECIDE_TIME, status: 'ask' };
}

// The countdown, paused while the video loads or plays. When it runs out
// the run ends; returns 'dead' then.
export function updateRevive(s, dt) {
  if (s.revive.status !== 'ask') return undefined; // loading, or waiting for the tap (ZR-79)
  s.revive.time = Math.max(s.revive.time - dt, 0);
  if (s.revive.time > 0) return undefined;
  s.revive = null;
  return die(s);
}

// After the video: the run goes on where it ended with 1 heart, briefly
// invulnerable, without enemies close by and away from the edges.
export function applyRevive(s) {
  const { cell } = s;
  s.state = 'play';
  s.revive = null;
  s.hearts = 1;
  s.invulnerable = REVIVE_INVULNERABLE;
  cell.vy = 0;
  cell.y = Math.min(Math.max(cell.y, cell.r + 40), H - cell.r - 40);
  s.enemies = s.enemies.filter((e) => Math.hypot(e.x - cell.x, e.y - cell.y) > REVIVE_CLEAR_RADIUS);
}

// The video was watched and closed (ZR-79): the run waits for the player's
// tap, so it never goes on behind the video or before the player is ready.
export function readyRevive(s) {
  s.revive.status = 'ready';
}

// "No thanks", a skipped or failed video: the run ends in the next step.
export function declineRevive(s) {
  s.revive.status = 'ask';
  s.revive.time = 0;
}

// A tap on the revive question: watch the video or decline. Keys do nothing,
// except after the video, when anything continues the run.
export function revivePress(s, point) {
  if (s.revive.status === 'ready') { // any tap or key goes on (ZR-79)
    applyRevive(s);
    return undefined;
  }
  if (!point || s.revive.status !== 'ask') return undefined;
  if (inRect(point, REVIVE_WATCH)) {
    s.revive.status = 'loading';
    return 'watch-revive';
  }
  if (inRect(point, REVIVE_SKIP)) declineRevive(s);
  return undefined;
}

export function hitsGate(cell, g) {
  if (cell.x + cell.r > g.x && cell.x - cell.r < g.x + GATE_W) {
    return cell.y - cell.r < g.cy - g.gap / 2 || cell.y + cell.r > g.cy + g.gap / 2;
  }
  return false;
}

export function touches(cell, p) {
  return Math.hypot(cell.x - p.x, cell.y - p.y) < cell.r + p.r;
}

// Advances the game by dt seconds. Returns 'dead' when the run ends in this
// step, otherwise undefined. The run is endless: gates keep coming.
export function update(s, dt, rng) {
  const { cell } = s;
  s.t += dt;
  cell.phase += dt * (s.state === 'play' ? 18 : 9);

  for (const b of s.bubbles) {
    b.x -= s.speed * b.s * dt * (s.state === 'play' ? 1 : 0.3);
    if (b.x < -10) Object.assign(b, newBubble(rng, W + 10));
  }

  if (s.state === 'launch') {
    updateLaunch(s, dt);
    return undefined;
  }
  if (s.state === 'revive') return updateRevive(s, dt);
  if (s.state !== 'play' && s.state !== 'dead') {
    cell.y = H / 2 + Math.sin(s.t * 3) * 12;
    s.store.messageTime = Math.max(s.store.messageTime - dt, 0);
    updateToast(s, dt);
    return undefined;
  }
  if (s.state === 'dead') {
    // The cell sinks to the bottom after the run ended.
    cell.vy += GRAVITY * dt;
    cell.y = Math.min(cell.y + cell.vy * dt, H - cell.r);
    updateEnding(s.ending, Math.min(Math.max(cell.y, 60), H - 60), dt);
    return undefined;
  }

  s.playTime += dt;
  s.speed = speedFor(s.score);
  if (s.invulnerable > 0) s.invulnerable = Math.max(s.invulnerable - dt, 0);
  cell.vy += (GRAVITY + controlNudge(s.score, s.t)) * dt;
  cell.y += cell.vy * dt;

  // Gates
  while (s.nextGateX < W + 100) spawnGate(s, rng);
  for (const g of s.gates) {
    g.x -= s.speed * dt;
    // Every passed gate scores, also when it was hit or passed while invulnerable.
    if (!g.passed && g.x + GATE_W < cell.x - cell.r) { g.passed = true; scoreGate(s); }
  }
  s.nextGateX -= s.speed * dt;
  s.gates = s.gates.filter((g) => g.x > -GATE_W - 10);

  // Heart pickups
  for (const p of s.pickups) {
    p.x -= s.speed * dt;
    if (touches(cell, p)) {
      p.taken = true;
      gainHeart(s, p.x, p.y - 20); // +10 credits when the hearts are full (ZR-64)
    }
  }
  s.pickups = s.pickups.filter((p) => !p.taken && p.x > -p.r);

  updateEnemies(s, dt, rng);
  updateEffects(s, dt, rng);

  // Screen edges: a hit costs a heart (unless invulnerable); the cell is kept
  // on screen and bounces up from the bottom.
  const atTop = cell.y - cell.r < 0;
  const atBottom = cell.y + cell.r > H;
  if (atTop || atBottom) {
    if (!isProtected(s) && loseHeart(s)) return 'dead';
    if (atTop) { cell.y = cell.r; cell.vy = 0; } else { cell.y = H - cell.r; cell.vy = SWIM; }
    if (s.state === 'revive') return undefined; // the last heart: the revive question
  }

  // Gate walls and enemies
  if (!isProtected(s)
    && (s.gates.some((g) => !g.destroyed && hitsGate(cell, g)) || s.enemies.some((e) => touches(cell, e)))) {
    return loseHeart(s);
  }
  return undefined;
}
