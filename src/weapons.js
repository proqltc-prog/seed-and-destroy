// Mystery boxes, boost effects and weapon effects (ZR-13). Pure game logic:
// no drawing or browser code. Randomness is injected as `rng`.
import {
  W, H, GATE_W, MAX_HEARTS, MYSTERY_MIN_SCORE, MYSTERY_R, RICH_SCORE,
  BOOST_BOX_CHANCE, BOOST_BOX_CHANCE_LATE, WEAPON_BOX_CHANCE,
  SHIELD_TIME, DOUBLE_TIME, WEAPON_FX, WEAPON_MUZZLE, BULLET_SPEED, MISSILE_SPEED, BURST_TIME,
  HEART_FULL_CREDITS, KILL_CREDITS, POPUP_TIME, POPUP_RISE,
  SPARK_TIME, FLASH_TIME, SPARK_MAX, SPARK_DRAG, DEBRIS_COLORS, ZAP_TIME,
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

// The muzzle of a held weapon (ZR-72): where its shots leave.
export function muzzlePoint(cell, id) {
  const m = WEAPON_MUZZLE[id];
  return { x: cell.x + m.x + m.rx * cell.r, y: cell.y + m.y + m.ry * cell.r };
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
  s.weapon = { id, kind: fx.kind, time: fx.time, cooldown: 0, charge: fx.charge ?? 0, rockets: fx.rockets ?? 0 };
}

// Impact effects (ZR-73): `n` pieces fly out from (x, y), spread evenly over
// the angle `arc` starting at `from` (radians), with slightly different
// speeds. No randomness, so it stays testable; the spot turns the pattern a
// little so no two look the same. Never more than SPARK_MAX at once.
export function addSparks(s, { x, y, n, color, speed, size, from = 0, arc = Math.PI * 2 }) {
  const sparks = (s.sparks ??= []);
  const turn = ((x * 7 + y * 13) % 10) / 10;
  for (let i = 0; i < n && sparks.length < SPARK_MAX; i++) {
    const a = from + (arc * (i + turn)) / n;
    const v = speed * (0.6 + 0.1 * (i % 5));
    sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: SPARK_TIME, color, size });
  }
}

// A short white flash of radius r where something was hit (ZR-73).
export function addFlash(s, x, y, r) {
  (s.flashes ??= []).push({ x, y, r, t: FLASH_TIME });
}

// Pieces fly on, slow down and drift with the scroll; flashes fade.
export function updateSparks(s, dt) {
  const keep = Math.max(1 - SPARK_DRAG * dt, 0);
  for (const p of s.sparks ?? []) {
    p.x += (p.vx - s.speed) * dt;
    p.y += p.vy * dt;
    p.vx *= keep;
    p.vy *= keep;
    p.t -= dt;
  }
  s.sparks = (s.sparks ?? []).filter((p) => p.t > 0);
  for (const f of s.flashes ?? []) { f.t -= dt; f.x -= s.speed * dt; }
  s.flashes = (s.flashes ?? []).filter((f) => f.t > 0);
  for (const z of s.zaps ?? []) z.t -= dt; // chain-laser bolts fade (ZR-78)
  s.zaps = (s.zaps ?? []).filter((z) => z.t > 0);
}

// A destroyed enemy flashes white, bursts into pieces in its own colour
// (ZR-73) and pays KILL_CREDITS (ZR-64).
export function destroyEnemy(s, e) {
  e.destroyed = true;
  s.bursts.push({ x: e.x, y: e.y, t: BURST_TIME });
  addFlash(s, e.x, e.y, e.r * 1.6);
  addSparks(s, { x: e.x, y: e.y, n: 8, color: DEBRIS_COLORS[e.kind] ?? '#f4f7ff', speed: 150, size: 3 });
  earnExtra(s, KILL_CREDITS, e.x, e.y - e.r - 6);
}

// Gates and enemies ahead of the cell and on screen, nearest first.
export function targetsAhead(s) {
  const gates = s.gates.filter((g) => !g.destroyed && !g.passed && g.x + GATE_W > s.cell.x && g.x < W);
  const enemies = s.enemies.filter((e) => !e.destroyed && e.x > s.cell.x && e.x < W + e.r);
  return { gates: gates.sort((a, b) => a.x - b.x), enemies };
}

// A rocket hit (ZR-77): the opening of the wall is blasted wider (the wall
// stays), with debris and a big burst; the shockwave destroys the flying
// objects around the opening. It never harms or moves the player.
// The big burst is drawn where the rocket hit the wall (ZR-81).
export function blastGate(s, g, at = { x: g.x + GATE_W / 2, y: g.cy }) {
  if (g.blasted) return;
  const fx = WEAPON_FX['weapon-missile'];
  g.blasted = true;
  g.gap *= 1 + fx.widen;
  const x = g.x + GATE_W / 2;
  s.bursts.push({ x: at.x, y: at.y, t: BURST_TIME, big: true });
  for (const y of [g.cy - g.gap / 2, g.cy + g.gap / 2]) {
    addSparks(s, { x, y, n: 8, color: '#e8708a', speed: 230, size: 4 }); // pieces of the wall
  }
  for (const e of s.enemies) {
    if (!e.destroyed && Math.hypot(e.x - x, e.y - g.cy) < fx.blast + e.r) destroyEnemy(s, e);
  }
}

// Fires one rocket at the next wall ahead within range that no rocket has
// been sent to yet. Returns true when a rocket left.
export function fireRocket(s, fx) {
  const g = targetsAhead(s).gates.find((gate) => !gate.blasted && !gate.targeted && gate.x - s.cell.x < fx.range);
  if (!g) return false;
  g.targeted = true;
  const muzzle = muzzlePoint(s.cell, 'weapon-missile'); // from the launcher (ZR-72)
  s.missiles.push({ ...muzzle, target: g, type: 'gate', side: muzzle.y <= g.cy ? -1 : 1 });
  s.weapon.rockets--;
  return true;
}

// One zap of the chain laser (ZR-78): the nearest enemy ahead, then from
// each hit enemy the nearest one within chainRange, at most `chain` enemies.
// The bolt (muzzle and hit enemies) glows for ZAP_TIME. Returns true when it
// hit something.
export function zapChain(s, fx) {
  const left = targetsAhead(s).enemies;
  const start = muzzlePoint(s.cell, 'weapon-laser');
  const points = [start];
  let from = start;
  for (let i = 0; i < fx.chain; i++) {
    const reach = i === 0 ? Infinity : fx.chainRange;
    const next = left
      .filter((e) => !e.destroyed && Math.hypot(e.x - from.x, e.y - from.y) < reach + e.r)
      .sort((a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y))[0];
    if (!next) break;
    destroyEnemy(s, next);
    points.push({ x: next.x, y: next.y });
    from = next;
  }
  if (points.length === 1) return false;
  (s.zaps ??= []).push({ points, t: ZAP_TIME });
  return true;
}

// Rockets fly to the front of the wall itself (ZR-81), never into the
// opening: to the upper half (side -1) or the lower half (side 1), the one
// nearest to the launcher when it fired, `into` px past the edge of the
// opening, kept on screen.
export function targetPoint(m) {
  const g = m.target;
  const into = WEAPON_FX['weapon-missile'].into;
  const y = g.cy + m.side * (g.gap / 2 + into);
  return { x: g.x, y: Math.min(Math.max(y, 0), H) };
}

export function updateMissiles(s, dt) {
  for (const m of s.missiles) {
    const p = targetPoint(m);
    const d = Math.hypot(p.x - m.x, p.y - m.y);
    const step = MISSILE_SPEED * dt;
    if (d <= step) {
      m.done = true;
      addSparks(s, { x: p.x, y: p.y, n: 6, color: '#ff9f43', speed: 180, size: 3 }); // explosion (ZR-73)
      blastGate(s, m.target, p);
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
    if (gate) {
      b.done = true;
      // A few yellow sparks bounce back off the wall (ZR-73).
      addSparks(s, { x: gate.x, y: b.y, n: 4, color: '#ffe066', speed: 120, size: 2, from: Math.PI * 0.7, arc: Math.PI * 0.6 });
    }
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
      const muzzle = muzzlePoint(cell, w.id); // from the end of the barrel (ZR-72)
      for (const vy of speeds) s.bullets.push({ x: muzzle.x, y: muzzle.y, vy, r: 3 });
    }
  } else if (w.kind === 'missile') {
    // One rocket at a time at the next wall in range, until all are used (ZR-77).
    w.cooldown -= dt;
    if (w.cooldown <= 0 && fireRocket(s, fx)) w.cooldown = fx.every;
    if (w.rockets <= 0) w.time = 0;
  } else if (w.kind === 'laser' && w.charge > 0) {
    // First the laser charges up; nothing is destroyed yet (ZR-71).
    w.charge = Math.max(w.charge - dt, 0);
  } else if (w.kind === 'laser') {
    // Then a chain zap every fx.every seconds; walls stay standing (ZR-76, ZR-78).
    w.cooldown -= dt;
    if (w.cooldown <= 0 && zapChain(s, fx)) w.cooldown = fx.every;
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
  updateSparks(s, dt);
  updatePopups(s, dt);
}
