// Mystery boxes, boost effects and weapon effects (ZR-13). Pure game logic:
// no drawing or browser code. Randomness is injected as `rng`.
import {
  W, GATE_W, MAX_HEARTS, MYSTERY_MIN_SCORE, MYSTERY_R, RICH_SCORE,
  BOOST_BOX_CHANCE, BOOST_BOX_CHANCE_LATE, WEAPON_BOX_CHANCE,
  SHIELD_TIME, DOUBLE_TIME, WEAPON_FX, BULLET_SPEED, MISSILE_SPEED, BURST_TIME,
  HEART_FULL_CREDITS, KILL_CREDITS, POPUP_TIME, POPUP_RISE,
} from './config.js';

const overlaps = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r;

// Chance per new gate of a boost box and of a weapon box (ZR-36): both rare
// below RICH_SCORE; from there on boost boxes come more often.
export function boxChances(score) {
  return { boost: score >= RICH_SCORE ? BOOST_BOX_CHANCE_LATE : BOOST_BOX_CHANCE, weapon: WEAPON_BOX_CHANCE };
}

// A box may appear in a new gate opening once the run is under way, and
// only one at a time. One draw decides: boost box, weapon box or nothing.
export function maybeSpawnBox(s, x, y, rng) {
  if (s.score < MYSTERY_MIN_SCORE || s.boxes.length > 0) return;
  const chance = boxChances(s.score);
  const draw = rng();
  if (draw < chance.boost) s.boxes.push({ kind: 'boost', x, y, r: MYSTERY_R });
  else if (draw < chance.boost + chance.weapon) s.boxes.push({ kind: 'weapon', x, y, r: MYSTERY_R });
}

// Damage is ignored while invulnerable after a hit or shielded by a boost.
export function isProtected(s) {
  return s.invulnerable > 0 || s.shieldTime > 0;
}

// Extra credits earned in a run (ZR-64), with a small "+n" where it happened.
// They count as run credits and go to the server as p_extra.
export function earnExtra(s, n, x, y) {
  s.extraCredits = (s.extraCredits ?? 0) + n;
  s.runCredits += n;
  s.credits += n;
  (s.popups ??= []).push({ x, y, text: `+${n}`, t: POPUP_TIME });
}

// A heart: one more, or +10 credits when all hearts are already full (ZR-64).
export function gainHeart(s, x, y) {
  if (s.hearts >= MAX_HEARTS) earnExtra(s, HEART_FULL_CREDITS, x, y);
  else s.hearts += 1;
}

// Popups float up and fade; they drift with the scroll.
export function updatePopups(s, dt) {
  for (const p of s.popups ?? []) {
    p.t -= dt;
    p.y -= (POPUP_RISE / POPUP_TIME) * dt;
    p.x -= s.speed * dt;
  }
  s.popups = (s.popups ?? []).filter((p) => p.t > 0);
}

// Starts the effect of the active boost.
export function applyBoost(s) {
  const id = s.equipped.boost;
  if (id === 'boost-heart') gainHeart(s, s.cell.x, s.cell.y - 24);
  else if (id === 'boost-shield') s.shieldTime = SHIELD_TIME;
  else s.doubleTime = DOUBLE_TIME;
}

// Starts the effect of the active weapon; a new box restarts it.
export function startWeapon(s) {
  const id = s.equipped.weapon;
  const fx = WEAPON_FX[id];
  s.weapon = { id, kind: fx.kind, time: fx.time, gatesLeft: fx.gates, cooldown: 0 };
  if (fx.kind === 'missile') {
    launchMissiles(s, fx);
    s.weapon.cooldown = fx.every; // next salvo (ZR-65)
  }
}

// A destroyed enemy flashes and pays KILL_CREDITS (ZR-64).
export function destroyEnemy(s, e) {
  e.destroyed = true;
  s.bursts.push({ x: e.x, y: e.y, t: BURST_TIME });
  earnExtra(s, KILL_CREDITS, e.x, e.y - e.r - 6);
}

// Destroys a gate if the weapon has gates left. A destroyed gate has no
// walls any more but still scores when passed.
// Without an active weapon (it ran out while missiles were still flying) the
// wall just stops them (ZR-48).
export function destroyGate(s, g) {
  if (g.destroyed || !s.weapon || s.weapon.gatesLeft <= 0) return false;
  g.destroyed = true;
  s.weapon.gatesLeft--;
  s.bursts.push({ x: g.x + GATE_W / 2, y: g.cy, t: BURST_TIME });
  return true;
}

// Gates and enemies ahead of the cell and on screen, nearest first.
export function targetsAhead(s) {
  const gates = s.gates.filter((g) => !g.destroyed && !g.passed && g.x + GATE_W > s.cell.x && g.x < W);
  const enemies = s.enemies.filter((e) => !e.destroyed && e.x > s.cell.x && e.x < W + e.r);
  return { gates: gates.sort((a, b) => a.x - b.x), enemies };
}

// A salvo of missiles: one homing missile per gate ahead and one per enemy
// around the player, skipping targets a missile is already chasing. All
// salvos together aim at no more gates than the weapon has left (ZR-65).
export function launchMissiles(s, fx) {
  const chased = new Set(s.missiles.map((m) => m.target));
  const flyingToGates = s.missiles.filter((m) => m.type === 'gate').length;
  const room = Math.max((s.weapon?.gatesLeft ?? fx.gates) - flyingToGates, 0);
  const gates = targetsAhead(s).gates.filter((g) => !chased.has(g));
  for (const g of gates.slice(0, room)) s.missiles.push({ x: s.cell.x, y: s.cell.y, target: g, type: 'gate' });
  for (const e of s.enemies) {
    if (!e.destroyed && !chased.has(e) && Math.hypot(e.x - s.cell.x, e.y - s.cell.y) < fx.radius) {
      s.missiles.push({ x: s.cell.x, y: s.cell.y, target: e, type: 'enemy' });
    }
  }
}

function targetPoint(m) {
  return m.type === 'gate' ? { x: m.target.x + GATE_W / 2, y: m.target.cy } : { x: m.target.x, y: m.target.y };
}

export function updateMissiles(s, dt) {
  for (const m of s.missiles) {
    const p = targetPoint(m);
    const d = Math.hypot(p.x - m.x, p.y - m.y);
    const step = MISSILE_SPEED * dt;
    if (d <= step) {
      m.done = true;
      if (m.type === 'gate') destroyGate(s, m.target);
      else if (!m.target.destroyed) destroyEnemy(s, m.target);
    } else {
      m.x += ((p.x - m.x) / d) * step;
      m.y += ((p.y - m.y) / d) * step;
    }
  }
  s.missiles = s.missiles.filter((m) => !m.done);
}

// Bullets fly to the right and destroy the first enemy they hit. A gate wall
// stops them: guns never destroy walls (ZR-55).
export function updateBullets(s, dt) {
  for (const b of s.bullets) {
    b.x += BULLET_SPEED * dt;
    b.y += b.vy * dt;
    const enemy = s.enemies.find((e) => !e.destroyed && overlaps(b, e));
    if (enemy) {
      destroyEnemy(s, enemy);
      b.done = true;
      continue;
    }
    const gate = s.gates.find((g) => !g.destroyed && b.x > g.x && b.x < g.x + GATE_W
      && (b.y < g.cy - g.gap / 2 || b.y > g.cy + g.gap / 2));
    if (gate) b.done = true;
  }
  s.bullets = s.bullets.filter((b) => !b.done && b.x < W + 10);
}

// Vertical speeds of the shotgun pellets: evenly spread from up to down.
export function shotgunFan(fx) {
  return Array.from({ length: fx.pellets }, (_, i) => fx.fan * ((2 * i) / (fx.pellets - 1) - 1));
}

// Runs the active weapon for one step.
export function updateWeapon(s, dt, rng) {
  const w = s.weapon;
  const fx = WEAPON_FX[w.id];
  const { cell } = s;
  if (w.kind === 'melee') {
    // The sword cuts the enemies right in front of the cell; never gates.
    for (const e of s.enemies) {
      if (!e.destroyed && e.x > cell.x && e.x - cell.x < fx.reach + e.r && Math.abs(e.y - cell.y) < 35) {
        destroyEnemy(s, e);
      }
    }
  } else if (w.kind === 'gun') {
    w.cooldown -= dt;
    if (w.cooldown <= 0) {
      w.cooldown = fx.fireEvery;
      // The shotgun fires a fan of pellets (ZR-54); other guns one bullet.
      const speeds = fx.pellets ? shotgunFan(fx) : [(rng() * 2 - 1) * fx.spread];
      for (const vy of speeds) s.bullets.push({ x: cell.x + cell.r, y: cell.y, vy, r: 3 });
    }
  } else if (w.kind === 'missile') {
    // A new salvo every fx.every seconds while the weapon runs (ZR-65).
    w.cooldown -= dt;
    if (w.cooldown <= 0) {
      w.cooldown = fx.every;
      launchMissiles(s, fx);
    }
  } else if (w.kind === 'laser') {
    // The laser criss-crosses everything ahead on screen.
    const { gates, enemies } = targetsAhead(s);
    for (const g of gates) destroyGate(s, g);
    for (const e of enemies) destroyEnemy(s, e);
  }
  w.time -= dt;
  if (w.time <= 0) s.weapon = null;
}

// One step of boxes and all effects; called while playing.
export function updateEffects(s, dt, rng) {
  s.shieldTime = Math.max(s.shieldTime - dt, 0);
  s.doubleTime = Math.max(s.doubleTime - dt, 0);
  for (const box of s.boxes) {
    box.x -= s.speed * dt;
    if (overlaps(s.cell, box)) {
      box.taken = true;
      if (box.kind === 'boost') applyBoost(s);
      else startWeapon(s);
    }
  }
  s.boxes = s.boxes.filter((b) => !b.taken && b.x > -b.r);
  if (s.weapon) updateWeapon(s, dt, rng);
  updateBullets(s, dt);
  updateMissiles(s, dt);
  s.enemies = s.enemies.filter((e) => !e.destroyed);
  for (const b of s.bursts) { b.t -= dt; b.x -= s.speed * dt; }
  s.bursts = s.bursts.filter((b) => b.t > 0);
  updatePopups(s, dt);
}
