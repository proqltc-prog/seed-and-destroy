// Start animation before every run (ZR-38): the group sets off, the player
// breaks out ahead, and the egg shows the goal before it moves off screen.
// Pure game logic; positions follow from the time, so drawing stays simple.
import {
  H, SWIM, LAUNCH_TIME, LAUNCH_GROUP, LAUNCH_BREAKOUT, LAUNCH_EGG_LEAVE, EGG_X, THIN_R,
} from './config.js';

export const PLAYER_X = 110; // where the player swims during a run

// Where the group is: it swims in from the left, then falls back.
export function groupX(t) {
  return 20 + Math.min(t / LAUNCH_BREAKOUT, 1) * 50 - Math.max(t - LAUNCH_BREAKOUT, 0) * 160;
}

// The player swims at the front of the group, then darts ahead to its place.
export function playerX(t) {
  if (t <= LAUNCH_BREAKOUT) return groupX(t) + 10;
  const k = Math.min((t - LAUNCH_BREAKOUT) / 0.4, 1);
  const from = groupX(LAUNCH_BREAKOUT) + 10;
  return from + (PLAYER_X - from) * (1 - (1 - k) ** 2);
}

// The egg waits on the right, then moves off screen to the right.
export function eggX(t) {
  return EGG_X + Math.max(t - LAUNCH_EGG_LEAVE, 0) * 450;
}

export function startLaunch(s, rng) {
  s.state = 'launch';
  s.cell.x = playerX(0);
  s.cell.y = H / 2;
  s.cell.vy = 0;
  s.launch = {
    t: 0,
    group: Array.from({ length: LAUNCH_GROUP }, () => ({
      kind: 'thin', r: THIN_R, dx: -45 + rng() * 60, dy: (rng() - 0.5) * 120, tail: rng() * 6,
    })),
  };
}

// The run itself starts with a swim stroke, as before the animation existed.
export function finishLaunch(s) {
  s.state = 'play';
  s.cell.x = PLAYER_X;
  s.cell.vy = SWIM;
  s.launch = null;
}

// Advances the animation; returns true when the run has started.
export function updateLaunch(s, dt) {
  const l = s.launch;
  l.t += dt;
  for (const g of l.group) g.tail += dt * 16;
  s.cell.x = playerX(l.t);
  if (l.t < LAUNCH_TIME) return false;
  finishLaunch(s);
  return true;
}
