// Drawing. Every function receives the 2D context, so tests can pass a
// recording fake instead of a real canvas.
import { W, H, GATE_W, MAX_HEARTS, PUFF_TIME, VERSION, BURST_TIME, GAME_NAME, EGG_R, AD_REWARD, AD_DAILY, AD_GATE_RUNS, WEAPON_FX, POPUP_TIME, SPARK_TIME, FLASH_TIME, ZAP_TIME } from './config.js';
import { adsShown, gateReached, runsLeft, formatCountdown, formatWait } from './ads.js';
import { shakeOffset, streakBonus } from './logic.js';
import { showsOwnRow, leaderboardContentHeight, maxLeaderboardScroll, LEADERBOARD_VIEW_H } from './leaderboard.js';
import { isEquipped, equippedSkin } from './shop.js';
import { t, formatNumber } from './i18n.js';

const TAB_KEYS = { skins: 'tabSkins', boosts: 'tabBoosts', weapons: 'tabWeapons' };
import {
  START_STORE_BUTTON, STORE_BACK_BUTTON, storeTabs, storeRows,
  NAME_FIELD, NAME_CONTINUE, INTRO_SKIP, INTRO_NEXT, languageButtons,
  GEAR_BUTTON, SETTINGS_LANG, SETTINGS_NAME,
  SETTINGS_RECOVERY, SETTINGS_RESTORE, SETTINGS_PRIVACY, SETTINGS_AD_PRIVACY, AGE_YES, AGE_NO, PRIVACY_LINK, CODE_FIELD, CODE_CONFIRM,
  LEADERBOARD_BUTTON, AD_HOME_BUTTON, AD_GATE_BUTTON, leaderboardTabs, LEADERBOARD_ROW_Y, LEADERBOARD_ROW_H, LEADERBOARD_LIST_BOTTOM, LEADERBOARD_GAP,
  LEADERBOARD_BACK_LEFT, LEADERBOARD_FRIENDS_BUTTON, FRIEND_SHARE, FRIEND_FIELD, FRIEND_ADD, REVIVE_WATCH, REVIVE_SKIP,
} from './ui.js';
import { LANGUAGES } from './i18n.js';
import { INTRO_PAGES, badNameChar } from './onboarding.js';
import { groupX, eggX } from './launch.js';
import { muzzlePoint } from './weapons.js';

const FONT = '"Trebuchet MS", system-ui, sans-serif';

export function drawBackground(ctx, s) {
  const grd = ctx.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, '#163a6b');
  grd.addColorStop(1, '#0b1d3a');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(180, 215, 255, 0.18)';
  for (const b of s.bubbles) {
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
  }
}

export function wall(ctx, t, x, y, h, isTop, wob) {
  ctx.beginPath();
  const edge = isTop ? y + h : y;
  ctx.moveTo(x, isTop ? y : y + h);
  ctx.lineTo(x, edge);
  // wavy edge (cilia)
  const n = 6;
  for (let i = 0; i <= n; i++) {
    const px = x + (GATE_W / n) * i;
    const py = edge + (isTop ? 1 : -1) * (6 + Math.sin(t * 5 + i + wob) * 4);
    ctx.lineTo(px, py);
  }
  ctx.lineTo(x + GATE_W, isTop ? y : y + h);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // shine
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(x + 8, isTop ? y : edge + 10, 8, Math.max(h - 10, 0));
  ctx.fillStyle = '#e8708a';
}

export function drawGate(ctx, t, g) {
  const top = g.cy - g.gap / 2;
  const bot = g.cy + g.gap / 2;
  ctx.fillStyle = '#e8708a';
  ctx.strokeStyle = '#b8445f';
  ctx.lineWidth = 3;
  wall(ctx, t, g.x, 0, top, true, g.wob);
  wall(ctx, t, g.x, bot, H - bot, false, g.wob);
}

// Heart shape with its top centre at (x, y) and the given height.
export function drawHeart(ctx, x, y, size, filled) {
  const w = size / 2;
  ctx.beginPath();
  ctx.moveTo(x, y + size * 0.3);
  ctx.bezierCurveTo(x, y, x - w, y, x - w, y + size * 0.3);
  ctx.bezierCurveTo(x - w, y + size * 0.6, x, y + size * 0.8, x, y + size);
  ctx.bezierCurveTo(x, y + size * 0.8, x + w, y + size * 0.6, x + w, y + size * 0.3);
  ctx.bezierCurveTo(x + w, y, x, y, x, y + size * 0.3);
  ctx.closePath();
  if (filled) {
    ctx.fillStyle = '#ff5c7a';
    ctx.fill();
  }
  ctx.strokeStyle = '#ffd9e4';
  ctx.lineWidth = 2;
  ctx.stroke();
}

// Remaining hearts in the top left; lost hearts are shown as outlines.
export function drawHearts(ctx, hearts) {
  for (let i = 0; i < MAX_HEARTS; i++) drawHeart(ctx, 26 + i * 28, 14, 20, i < hearts);
}

// A heart pickup with a soft pulsing glow.
export function drawPickup(ctx, p, t) {
  const glowR = p.r * (1.8 + Math.sin(t * 6) * 0.2);
  const glow = ctx.createRadialGradient(p.x, p.y, p.r * 0.3, p.x, p.y, glowR);
  glow.addColorStop(0, 'rgba(255, 92, 122, 0.55)');
  glow.addColorStop(1, 'rgba(255, 92, 122, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2); ctx.fill();
  drawHeart(ctx, p.x, p.y - p.r, p.r * 2, true);
}

// A rival sperm cell facing right. Fat ones look tired: a heavy eyelid and,
// now and then, a little puff of breath.
export function drawRivalSperm(ctx, e) {
  const fat = e.kind === 'fat';
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.strokeStyle = fat ? '#cfd8ea' : '#b9c9e6';
  ctx.lineCap = 'round';
  ctx.lineWidth = fat ? 4 : 2.5;
  ctx.beginPath();
  ctx.moveTo(-e.r + 2, 0);
  for (let i = 1; i <= 12; i++) {
    ctx.lineTo(-e.r - i * (fat ? 3.4 : 2.6), Math.sin(e.tail - i * 0.6) * (i * (fat ? 0.45 : 0.5)));
  }
  ctx.stroke();
  ctx.fillStyle = fat ? '#dfe6f5' : '#c9d6ee';
  ctx.beginPath();
  ctx.ellipse(0, 0, e.r * 1.2, e.r * 0.95, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0b1d3a';
  ctx.beginPath(); ctx.arc(e.r * 0.45, -e.r * 0.2, fat ? 3 : 2, 0, Math.PI * 2); ctx.fill();
  if (fat) {
    // Heavy, tired eyelid
    ctx.fillStyle = '#dfe6f5';
    ctx.fillRect(e.r * 0.45 - 4, -e.r * 0.2 - 4, 8, 4);
    // Cheeks
    ctx.fillStyle = 'rgba(255, 150, 170, 0.35)';
    ctx.beginPath(); ctx.arc(e.r * 0.2, e.r * 0.35, 3.5, 0, Math.PI * 2); ctx.fill();
    if (e.puff > 0) drawPuff(ctx, e.r, e.puff / PUFF_TIME);
  }
  ctx.restore();
}

// A small cloud of breath in front of a tired fat cell; fades as it rises.
export function drawPuff(ctx, r, life) {
  const rise = (1 - life) * 12;
  ctx.fillStyle = `rgba(230, 236, 248, ${(0.75 * life).toFixed(3)})`;
  for (const [dx, dy, pr] of [[r * 1.4, -r * 0.6, 3], [r * 1.9, -r, 4], [r * 2.5, -r * 1.3, 3]]) {
    ctx.beginPath(); ctx.arc(dx, dy - rise, pr, 0, Math.PI * 2); ctx.fill();
  }
}

// A white blood cell: a lumpy, wobbling blob with a lobed nucleus.
export function drawWbc(ctx, e, t) {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.fillStyle = '#f3eefc';
  ctx.strokeStyle = '#c8b8e8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  const n = 32;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = e.r * (1 + 0.12 * Math.sin(a * 5 + t * 2) + 0.05 * Math.sin(a * 3 - t * 3));
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#9b7fd1';
  for (const [dx, dy] of [[-4, -3], [3, -4], [1, 4]]) {
    ctx.beginPath(); ctx.arc(dx, dy, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// A fungus (ZR-37): a lumpy green cluster with spots and grumpy eyes.
export function drawFungus(ctx, e, t) {
  ctx.save();
  ctx.translate(e.x, e.y);
  const lumps = [[0, 0, 1], [-0.72, -0.5, 0.62], [0.72, -0.45, 0.64], [-0.65, 0.58, 0.58], [0.68, 0.55, 0.58]];
  ctx.fillStyle = '#8bc34a';
  ctx.strokeStyle = '#4e7a1e';
  ctx.lineWidth = 2;
  for (const [dx, dy, k] of lumps) {
    const wob = 1 + 0.06 * Math.sin(t * 3 + dx * 5);
    ctx.beginPath(); ctx.arc(dx * e.r, dy * e.r, e.r * 0.8 * k * wob, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = '#cddc39';
  for (const [dx, dy] of [[-0.9, -0.6], [0.85, 0.65], [0.2, -0.95]]) {
    ctx.beginPath(); ctx.arc(dx * e.r, dy * e.r, 2.5, 0, Math.PI * 2); ctx.fill();
  }
  // Grumpy face
  ctx.fillStyle = '#1b2a0a';
  ctx.beginPath(); ctx.arc(-4, -1, 2.2, 0, Math.PI * 2); ctx.arc(4, -1, 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#1b2a0a';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-7, -6); ctx.lineTo(-2, -4);
  ctx.moveTo(7, -6); ctx.lineTo(2, -4);
  ctx.moveTo(-3, 5); ctx.quadraticCurveTo(0, 3, 3, 5);
  ctx.stroke();
  ctx.restore();
}

// A contraceptive pill (ZR-37): a two-coloured capsule that slowly tumbles.
export function drawPill(ctx, e) {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.phase * 0.5);
  const len = e.r * 2.6;
  const h = e.r * 1.2;
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#a3375c';
  ctx.fillStyle = '#ff8fb1';
  ctx.beginPath(); ctx.roundRect(-len / 2, -h / 2, len / 2, h, [h / 2, 0, 0, h / 2]); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.roundRect(0, -h / 2, len / 2, h, [0, h / 2, h / 2, 0]); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath(); ctx.roundRect(-len / 2 + 4, -h / 2 + 3, len - 8, 3, 2); ctx.fill();
  ctx.restore();
}

// A vaginal ring (ZR-37): a flexible ring that spins in 3D.
export function drawRing(ctx, e) {
  ctx.save();
  ctx.translate(e.x, e.y);
  const squash = 0.35 + 0.65 * Math.abs(Math.cos(e.phase * 0.8));
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#b07cff';
  ctx.beginPath(); ctx.ellipse(0, 0, e.r, e.r * squash, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#ead9ff';
  ctx.beginPath(); ctx.ellipse(0, 0, e.r - 1, (e.r - 1) * squash, 0, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke();
  ctx.restore();
}

const DRAW_FLOATER = { wbc: drawWbc, fungus: drawFungus, pill: drawPill, ring: drawRing };

export function drawEnemy(ctx, e, t) {
  const drawFloater = DRAW_FLOATER[e.kind];
  if (drawFloater) drawFloater(ctx, e, t);
  else drawRivalSperm(ctx, e);
}

// The egg (ZR-38): a soft glowing cell with a ring around it.
export function drawEgg(ctx, x, y, t) {
  const pulse = 1 + Math.sin(t * 3) * 0.03;
  const r = EGG_R * pulse;
  const glow = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 1.8);
  glow.addColorStop(0, 'rgba(255, 196, 214, 0.55)');
  glow.addColorStop(1, 'rgba(255, 196, 214, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(x, y, r * 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffd9e4';
  ctx.strokeStyle = '#ff9ebd';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255, 158, 189, 0.55)';
  ctx.beginPath(); ctx.arc(x - r * 0.2, y - r * 0.1, r * 0.35, 0, Math.PI * 2); ctx.fill();
}

// The start animation (ZR-38): the egg as the goal and the group the player
// breaks out of. The player itself is drawn as usual.
export function drawLaunch(ctx, s) {
  const { t, group } = s.launch;
  drawEgg(ctx, eggX(t), H / 2, s.t);
  const x = groupX(t);
  for (const g of group) drawRivalSperm(ctx, { ...g, x: x + g.dx, y: H / 2 + g.dy });
}

// Game over: the group overtakes, the fat one passes last, then the end screen.
export function drawEnding(ctx, s) {
  const e = s.ending;
  for (const c of e.group) drawRivalSperm(ctx, c);
  if (e.fat) drawRivalSperm(ctx, e.fat);
  if (!e.done) return;
  text(ctx, t(s.lang, 'noHearts'), 260, 32, '#ffcc4d');
  text(ctx, t(s.lang, 'scoreLine', { score: s.score, best: s.best }), 300, 18);
  text(ctx, t(s.lang, 'runCreditsTotal', { n: s.runCredits, total: formatNumber(s.lang, s.credits) }), 330, 16, '#ffcc4d', 'normal');
  // With the runs used the tap goes back home, where the video is (ZR-43).
  const retry = t(s.lang, gateReached(s) ? 'runsUsedEnd' : 'retry');
  text(ctx, retry, 380, fitSize(ctx, retry, 18), gateReached(s) ? '#c9a8ff' : '#f4f7ff', 'normal');
  const counter = runsCounter(s);
  if (counter) text(ctx, counter, 410, 15, '#c9a8ff', 'normal');
}

// A purple ad button with a play icon, a label and a small second line
// (ZR-14). `dim` shows it greyed out once today's ads are used.
export function drawAdButton(ctx, r, label, sub, dim = false) {
  const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
  g.addColorStop(0, '#b07cff');
  g.addColorStop(1, '#7a4dff');
  ctx.save();
  ctx.globalAlpha = dim ? 0.45 : 1;
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 10); ctx.fill();
  const cx = r.x + 22;
  const cy = r.y + r.h / 2;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#7a4dff';
  ctx.beginPath(); ctx.moveTo(cx - 4, cy - 6); ctx.lineTo(cx + 7, cy); ctx.lineTo(cx - 4, cy + 6); ctx.closePath(); ctx.fill();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 15px ${FONT}`;
  ctx.fillText(label, r.x + 42, cy - 2);
  // The second line shrinks to fit the button (long languages).
  const room = r.w - 50;
  ctx.font = `12px ${FONT}`;
  const width = ctx.measureText(sub)?.width ?? 0;
  if (width > room) ctx.font = `${Math.max(Math.floor((12 * room) / width), 9)}px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(sub, r.x + 42, cy + 14);
  ctx.restore();
}

// The ad button on the home screen: ads left today, the countdown to the
// next video (ZR-67), or back tomorrow. Dimmed while it cannot be tapped.
export function drawAdHome(ctx, s) {
  if (!adsShown(s)) return;
  const { left, status, wait } = s.ads;
  const vars = { n: AD_REWARD, left, max: AD_DAILY };
  const waiting = left > 0 && wait > 0;
  let sub = t(s.lang, 'adHomeSub', vars);
  if (status === 'loading') sub = t(s.lang, 'adLoading');
  else if (left <= 0) sub = t(s.lang, 'adHomeDone', vars);
  else if (waiting) sub = t(s.lang, 'adHomeWait', { time: formatWait(wait) });
  drawAdButton(ctx, AD_HOME_BUTTON, t(s.lang, 'adHome', vars), sub, left <= 0 || waiting);
}

// "Pogingen: 7/10" while the 10-run rule applies; with the runs used the
// countdown to midnight, when everybody gets 10 new runs (ZR-43).
export function runsCounter(s) {
  if (!adsShown(s)) return '';
  if (gateReached(s)) return t(s.lang, 'runsWait', { time: formatCountdown(s.untilMidnight) });
  return t(s.lang, 'runsLeft', { left: runsLeft(s), max: AD_GATE_RUNS });
}

// The video button on the home screen once the runs are used.
export function drawGateButton(ctx, s) {
  const sub = s.ads.status === 'loading' ? t(s.lang, 'adLoading') : t(s.lang, 'adGateSub', { n: AD_GATE_RUNS });
  drawAdButton(ctx, AD_GATE_BUTTON, t(s.lang, 'adGateButton'), sub);
}

// The revive question (ZR-69): the run behind a dark veil, the countdown,
// the video button (or "loading") and "No thanks".
export function drawRevive(ctx, s) {
  ctx.fillStyle = 'rgba(5, 12, 30, 0.65)';
  ctx.fillRect(0, 0, W, H);
  if (s.revive.status === 'ready') { // after the video (ZR-79)
    const ready = t(s.lang, 'reviveReady');
    text(ctx, ready, 300, fitSize(ctx, ready, 26), '#ffcc4d');
    return;
  }
  text(ctx, t(s.lang, 'reviveTitle'), 200, 30, '#ffcc4d');
  text(ctx, String(Math.ceil(s.revive.time)), 270, 48);
  const label = s.revive.status === 'loading' ? t(s.lang, 'adLoading') : t(s.lang, 'reviveWatch');
  drawButton(ctx, REVIVE_WATCH, label, '#ffcc4d', '#0b1d3a', fitSize(ctx, label, 17));
  drawButton(ctx, REVIVE_SKIP, t(s.lang, 'reviveSkip'), 'rgba(255,255,255,0.14)', '#f4f7ff', 15);
}

// A gold, glowing mystery box with a question mark.
// Box colours per kind (ZR-36): green for a boost, red for a weapon.
export const BOX_STYLE = {
  boost: { glow: 'rgba(94, 224, 138, 0.6)', glowEnd: 'rgba(94, 224, 138, 0)', fill: '#5ee08a', edge: '#1f9e55', icon: '#0b4d26' },
  weapon: { glow: 'rgba(255, 106, 77, 0.6)', glowEnd: 'rgba(255, 106, 77, 0)', fill: '#ff7a59', edge: '#c23b1d', icon: '#5c1405' },
};

// A glowing mystery box. A boost box shows an arrow up (power-up), a weapon
// box a crosshair, so the kind is clear at a glance, also without colour.
export function drawBox(ctx, box, t) {
  const style = BOX_STYLE[box.kind];
  const pulse = 1 + Math.sin(t * 5) * 0.08;
  const glow = ctx.createRadialGradient(box.x, box.y, box.r * 0.5, box.x, box.y, box.r * 2.2 * pulse);
  glow.addColorStop(0, style.glow);
  glow.addColorStop(1, style.glowEnd);
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(box.x, box.y, box.r * 2.2 * pulse, 0, Math.PI * 2); ctx.fill();
  const size = box.r * 2 * pulse;
  ctx.fillStyle = style.fill;
  ctx.strokeStyle = style.edge;
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(box.x - size / 2, box.y - size / 2, size, size, 6); ctx.fill(); ctx.stroke();
  const u = box.r * 0.55 * pulse;
  if (box.kind === 'boost') {
    ctx.fillStyle = style.icon;
    ctx.beginPath();
    ctx.moveTo(box.x, box.y - u);
    ctx.lineTo(box.x + u, box.y);
    ctx.lineTo(box.x + u * 0.4, box.y);
    ctx.lineTo(box.x + u * 0.4, box.y + u);
    ctx.lineTo(box.x - u * 0.4, box.y + u);
    ctx.lineTo(box.x - u * 0.4, box.y);
    ctx.lineTo(box.x - u, box.y);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.strokeStyle = style.icon;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(box.x, box.y, u * 0.75, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(box.x - u * 1.2, box.y); ctx.lineTo(box.x + u * 1.2, box.y);
    ctx.moveTo(box.x, box.y - u * 1.2); ctx.lineTo(box.x, box.y + u * 1.2);
    ctx.stroke();
  }
}

export function drawBullets(ctx, bullets) {
  ctx.fillStyle = '#ffe066';
  for (const b of bullets) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); }
}

// Small rockets with a flame, pointing where they fly.
export function drawMissiles(ctx, missiles) {
  for (const m of missiles) {
    const tx = m.target.x + GATE_W / 2; // the middle of the opening (ZR-77)
    const ty = m.target.cy;
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(Math.atan2(ty - m.y, tx - m.x));
    ctx.fillStyle = '#ff9f43';
    ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-8, -3); ctx.lineTo(-8, 3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e8eef9';
    ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-8, -4); ctx.lineTo(-8, 4); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

// Expanding, fading rings where something was destroyed.
export function drawBursts(ctx, bursts) {
  for (const b of bursts) {
    const life = b.t / BURST_TIME;
    if (b.big) { // a rocket's shockwave grows to its full radius (ZR-77)
      ctx.strokeStyle = `rgba(255, 159, 67, ${life.toFixed(3)})`;
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(b.x, b.y, 10 + (1 - life) * WEAPON_FX['weapon-missile'].blast, 0, Math.PI * 2); ctx.stroke();
      continue;
    }
    ctx.strokeStyle = `rgba(255, 224, 102, ${life.toFixed(3)})`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(b.x, b.y, 6 + (1 - life) * 26, 0, Math.PI * 2); ctx.stroke();
  }
}

// Impact effects (ZR-73): white flashes that grow and fade, and sparks and
// debris that fade as they fly.
export function drawSparks(ctx, s) {
  for (const f of s.flashes ?? []) {
    const life = f.t / FLASH_TIME;
    ctx.fillStyle = `rgba(255, 255, 255, ${(life * 0.9).toFixed(3)})`;
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1.4 - life * 0.4), 0, Math.PI * 2); ctx.fill();
  }
  for (const p of s.sparks ?? []) {
    ctx.globalAlpha = Math.min((p.t / SPARK_TIME) * 1.5, 1);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

// The jagged path of a lightning bolt through `points`: each part is split
// in four with small sideways kinks that flicker with time (no randomness).
export function boltPath(points, t) {
  const path = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    for (let k = 1; k <= 4; k++) {
      const f = k / 4;
      const kink = k === 4 ? 0 : Math.sin(t * 60 + i * 2.3 + k * 1.7) * 9;
      path.push({ x: a.x + (b.x - a.x) * f - ((b.y - a.y) / len) * kink, y: a.y + (b.y - a.y) * f + ((b.x - a.x) / len) * kink });
    }
  }
  return path;
}

// Chain-laser bolts (ZR-78): a wide pink glow, a bright pink layer and a
// white-hot core along the jagged path, fading out.
export function drawZaps(ctx, s) {
  for (const z of s.zaps ?? []) {
    const life = z.t / ZAP_TIME;
    const path = boltPath(z.points, s.t);
    for (const [width, color] of [[12, `rgba(255, 80, 140, ${(life * 0.3).toFixed(3)})`],
      [5, `rgba(255, 120, 180, ${(life * 0.8).toFixed(3)})`], [2, `rgba(255, 255, 255, ${life.toFixed(3)})`]]) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (const p of path.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
  }
}

// "+5" / "+10" credits floating up where they were earned (ZR-64).
export function drawPopups(ctx, popups) {
  for (const p of popups ?? []) {
    ctx.globalAlpha = Math.min(p.t / POPUP_TIME * 2, 1);
    textAt(ctx, p.text, p.x, p.y, 14, '#ffcc4d', 'bold', 'center');
  }
  ctx.globalAlpha = 1;
}

// Effects around the cell: shield bubble and laser beams.
export function drawCellEffects(ctx, s) {
  const { cell } = s;
  if (s.shieldTime > 0) {
    ctx.strokeStyle = 'rgba(126, 224, 255, 0.85)';
    ctx.fillStyle = 'rgba(126, 224, 255, 0.15)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cell.x, cell.y, cell.r * 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  if (s.weapon?.kind === 'laser' && s.weapon.charge > 0) {
    // Charging (ZR-71): a thin beam builds up straight ahead.
    const power = 1 - s.weapon.charge / WEAPON_FX[s.weapon.id].charge;
    const tip = muzzlePoint(cell, 'weapon-laser'); // from the laser gun (ZR-72)
    const end = tip.x + power * (W - tip.x);
    // A glowing beam with a hot core builds up (ZR-78: more intense).
    for (const [width, color] of [[6 + power * 6, `rgba(255, 80, 140, ${(0.15 + power * 0.25).toFixed(3)})`],
      [1 + power * 2, `rgba(255, 80, 140, ${(0.2 + power * 0.6).toFixed(3)})`]]) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.lineTo(end, tip.y); ctx.stroke();
    }
  } else if (s.weapon?.kind === 'laser') {
    // Ready to zap: a hot pink glow at the tip of the laser gun (ZR-78).
    const tip = muzzlePoint(cell, 'weapon-laser');
    const pulse = 0.6 + 0.4 * Math.sin(s.t * 20);
    ctx.fillStyle = `rgba(255, 80, 140, ${(0.35 * pulse).toFixed(3)})`;
    ctx.beginPath(); ctx.arc(tip.x, tip.y, 10, 0, Math.PI * 2); ctx.fill();
  }
}

// How long the muzzle flash shows after a shot (seconds).
export const MUZZLE_TIME = 0.08;

// True right after a shot of a gun, while its muzzle flash shows.
export function justFired(weapon) {
  return weapon.cooldown > WEAPON_FX[weapon.id].fireEvery - MUZZLE_TIME;
}

// A yellow muzzle flash pointing right from (x, y), only right after a shot.
export function drawMuzzleFlash(ctx, weapon, x, y) {
  if (!justFired(weapon)) return;
  ctx.fillStyle = '#ffe066';
  ctx.beginPath(); ctx.moveTo(x, y - 7); ctx.lineTo(x + 14, y); ctx.lineTo(x, y + 7); ctx.lineTo(x + 4, y); ctx.closePath(); ctx.fill();
}

// A short pump-action shotgun held in front of the cell (ZR-54): dark barrel
// and magazine tube, a wooden pump and stock, and a flash right after a shot.
export function drawShotgun(ctx, cell, weapon) {
  const x = cell.x + cell.r - 4;
  const y = cell.y + 6;
  ctx.fillStyle = '#7a4a24'; // stock
  ctx.beginPath(); ctx.moveTo(x - 10, y - 2); ctx.lineTo(x + 2, y - 3); ctx.lineTo(x + 2, y + 3); ctx.lineTo(x - 12, y + 6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#3b4252'; // barrel and magazine tube
  ctx.fillRect(x, y - 4, 26, 4);
  ctx.fillRect(x + 4, y, 18, 3);
  ctx.fillStyle = '#a0683a'; // pump
  ctx.fillRect(x + 9, y - 1, 9, 5);
  const muzzle = muzzlePoint(cell, 'weapon-standard'); // where the pellets leave (ZR-72)
  drawMuzzleFlash(ctx, weapon, muzzle.x, muzzle.y);
}

// A small pistol (ZR-57): grey slide, dark grip, flash after each shot.
export function drawPistol(ctx, cell, weapon) {
  const x = cell.x + cell.r - 2;
  const y = cell.y + 5;
  ctx.fillStyle = '#2b2f3a'; // grip
  ctx.fillRect(x, y, 4, 7);
  ctx.fillStyle = '#9aa4b5'; // slide
  ctx.fillRect(x, y - 4, 15, 5);
  const muzzle = muzzlePoint(cell, 'weapon-handgun'); // where the bullets leave (ZR-72)
  drawMuzzleFlash(ctx, weapon, muzzle.x, muzzle.y);
}

// A minigun (ZR-57): a body with three barrels whose shine turns around.
export function drawMinigun(ctx, cell, weapon, t) {
  const x = cell.x + cell.r - 6;
  const y = cell.y + 6;
  ctx.fillStyle = '#4a5263'; // body
  ctx.fillRect(x, y - 5, 10, 10);
  ctx.fillStyle = '#2b2f3a'; // barrels
  for (let i = 0; i < 3; i++) ctx.fillRect(x + 10, y - 5 + i * 3.5, 18, 2.5);
  ctx.fillStyle = '#c9d1de'; // the shine moves from barrel to barrel
  ctx.fillRect(x + 10, y - 5 + (Math.floor(t * 30) % 3) * 3.5, 18, 1);
  const muzzle = muzzlePoint(cell, 'weapon-minigun'); // where the bullets leave (ZR-72)
  drawMuzzleFlash(ctx, weapon, muzzle.x, muzzle.y);
}

// A rocket launcher on the cell's shoulder (ZR-57) with a red rocket tip.
export function drawLauncher(ctx, cell) {
  const x = cell.x - 10;
  const y = cell.y - cell.r - 2;
  ctx.fillStyle = '#2b2f3a'; // back ring
  ctx.fillRect(x - 2, y - 5, 3, 9);
  ctx.fillStyle = '#5b6b3a'; // tube
  ctx.fillRect(x, y - 4, 30, 7);
  ctx.fillStyle = '#ff5a5a'; // rocket tip
  ctx.beginPath(); ctx.moveTo(x + 30, y - 4); ctx.lineTo(x + 37, y - 0.5); ctx.lineTo(x + 30, y + 3); ctx.closePath(); ctx.fill();
}

// A laser gun (ZR-57): white body, pink grip and a pulsing pink glow.
export function drawLaserGun(ctx, cell, t, charge = 0) {
  const x = cell.x + cell.r - 3;
  const y = cell.y + 5;
  ctx.fillStyle = '#ff7ab6'; // grip
  ctx.fillRect(x + 2, y + 2, 4, 6);
  ctx.fillStyle = '#f4f7ff'; // body
  ctx.fillRect(x, y - 4, 18, 6);
  const glow = 0.5 + 0.5 * Math.sin(t * 12);
  ctx.fillStyle = `rgba(255, 80, 140, ${glow.toFixed(3)})`;
  ctx.beginPath(); ctx.arc(x + 20, y - 1, 4 + charge * 8, 0, Math.PI * 2); ctx.fill(); // bigger while charging (ZR-71)
}

// The sword's angle: it swings up and down in front of the cell (ZR-53).
export const SWORD_SWING = 0.7; // radians up and down
export function swordAngle(t) {
  return Math.sin(t * 12) * SWORD_SWING;
}

// A small sword held at the front of the cell (ZR-53): wooden grip, golden
// crossguard and a pointed steel blade with a shine.
export function drawSword(ctx, cell, t) {
  ctx.save();
  ctx.translate(cell.x + cell.r + 4, cell.y + 3);
  ctx.rotate(swordAngle(t));
  ctx.fillStyle = '#7a4a24'; // grip
  ctx.fillRect(-9, -2, 9, 4);
  ctx.fillStyle = '#ffcc4d'; // pommel and crossguard
  ctx.beginPath(); ctx.arc(-10, 0, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(0, -7, 3, 14);
  ctx.fillStyle = '#dfe7f2'; // blade
  ctx.beginPath(); ctx.moveTo(3, -3); ctx.lineTo(40, -3); ctx.lineTo(48, 0); ctx.lineTo(40, 3); ctx.lineTo(3, 3); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#ffffff'; // shine along the blade
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(5, -1); ctx.lineTo(40, -1); ctx.stroke();
  ctx.restore();
}

// The small weapon the cell holds while a weapon runs (ZR-53, ZR-54, ZR-57).
export const HELD_WEAPONS = {
  'weapon-sword': (ctx, s) => drawSword(ctx, s.cell, s.t),
  'weapon-handgun': (ctx, s) => drawPistol(ctx, s.cell, s.weapon),
  'weapon-standard': (ctx, s) => drawShotgun(ctx, s.cell, s.weapon),
  'weapon-minigun': (ctx, s) => drawMinigun(ctx, s.cell, s.weapon, s.t),
  'weapon-missile': (ctx, s) => drawLauncher(ctx, s.cell),
  'weapon-laser': (ctx, s) => drawLaserGun(ctx, s.cell, s.t, s.weapon.charge),
};

// The weapon the cell holds, drawn in front of it.
export function drawHeldWeapon(ctx, s) {
  if (s.weapon) HELD_WEAPONS[s.weapon.id](ctx, s);
}

// What is running, with seconds left, under the hearts.
export function effectLabels(s) {
  const labels = [];
  const label = (key, time) => t(s.lang, 'effect', { name: t(s.lang, key), n: Math.ceil(time) });
  if (s.weapon) labels.push(label(s.weapon.id, s.weapon.time));
  if (s.shieldTime > 0) labels.push(label('boost-shield', s.shieldTime));
  if (s.doubleTime > 0) labels.push(label('boost-double-short', s.doubleTime));
  return labels;
}

export function drawEffectLabels(ctx, s) {
  const labels = effectLabels(s);
  labels.forEach((label, i) => textAt(ctx, label, 14, 56 + i * 18, 13, '#ffe066', 'bold', 'left'));
  if (s.weapon?.kind === 'missile') drawRocketIcons(ctx, s.weapon.rockets, 56 + labels.length * 18 - 6);
}

// The rockets left (ZR-77): small white rockets with a red tip in a row.
export function drawRocketIcons(ctx, rockets, y) {
  for (let i = 0; i < rockets; i++) {
    const x = 16 + i * 16;
    ctx.fillStyle = '#e8eef9';
    ctx.fillRect(x, y - 2, 9, 4);
    ctx.fillStyle = '#ff5a5a';
    ctx.beginPath(); ctx.moveTo(x + 9, y - 2); ctx.lineTo(x + 13, y); ctx.lineTo(x + 9, y + 2); ctx.closePath(); ctx.fill();
  }
}

// The cell blinks while it is invulnerable after a hit.
export function cellVisible(invulnerable) {
  return invulnerable <= 0 || Math.floor(invulnerable * 10) % 2 === 0;
}

export function cellTilt(state, vy) {
  return state === 'start' ? 0 : Math.max(-0.5, Math.min(vy / 700, 0.9));
}

export function drawCell(ctx, s) {
  const { cell } = s;
  const skin = equippedSkin(s);
  ctx.save();
  ctx.translate(cell.x, cell.y);
  ctx.rotate(cellTilt(s.state, cell.vy));
  // Tail
  ctx.strokeStyle = skin.tail;
  ctx.lineCap = 'round';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(-cell.r + 2, 0);
  for (let i = 1; i <= 14; i++) {
    const x = -cell.r - i * 3.2;
    const y = Math.sin(cell.phase - i * 0.6) * (i * 0.55);
    ctx.lineWidth = Math.max(3.5 - i * 0.2, 1);
    ctx.lineTo(x, y);
  }
  ctx.stroke();
  // Head
  ctx.fillStyle = skin.head;
  ctx.beginPath();
  ctx.ellipse(0, 0, cell.r * 1.15, cell.r * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();
  // Eye
  ctx.fillStyle = '#0b1d3a';
  ctx.beginPath(); ctx.arc(cell.r * 0.45, -cell.r * 0.2, 2.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function textAt(ctx, str, x, y, size, color = '#f4f7ff', weight = 'bold', align = 'center') {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.lineJoin = 'round'; // no spikes on sharp letters
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(11, 29, 58, 0.85)';
  ctx.strokeText(str, x, y);
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

export function text(ctx, str, y, size, color = '#f4f7ff', weight = 'bold') {
  textAt(ctx, str, W / 2, y, size, color, weight);
}

// A rounded button with a centred label.
export function drawButton(ctx, r, label, fill = '#ffcc4d', color = '#0b1d3a', size = 16) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, 10);
  ctx.fill();
  // Plain label without outline, so dark text on a light button stays crisp.
  // A label wider than the button is made smaller (long names, ZR-70).
  ctx.font = `bold ${fitTo(ctx, label, size, r.w - 16)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + size * 0.35);
}

// The largest bold font size, at most `size`, at which `str` fits in `room`
// pixels (never below 9). Leaves that font set on the context.
export function fitTo(ctx, str, size, room) {
  ctx.font = `bold ${size}px ${FONT}`;
  const width = ctx.measureText(str)?.width ?? 0;
  if (width <= room) return size;
  const smaller = Math.max(Math.floor((size * room) / width), 9);
  ctx.font = `bold ${smaller}px ${FONT}`;
  return smaller;
}

// The store: balance, three tabs, one row per item, a toast and a back button.
export function drawStore(ctx, s) {
  ctx.fillStyle = 'rgba(11, 29, 58, 0.6)';
  ctx.fillRect(0, 0, W, H);
  text(ctx, t(s.lang, 'store'), 50, 30, '#ffcc4d');
  // A message briefly takes the place of the balance, away from the rows.
  if (s.store.messageTime > 0) {
    drawButton(ctx, { x: 20, y: 61, w: W - 40, h: 28 }, t(s.lang, s.store.message), '#f4f7ff', '#0b1d3a', 14);
  } else {
    text(ctx, t(s.lang, 'credits', { n: formatNumber(s.lang, s.credits) }), 80, 16, '#ffcc4d', 'normal');
  }
  for (const { category, rect } of storeTabs()) {
    const active = category === s.store.tab;
    drawButton(ctx, rect, t(s.lang, TAB_KEYS[category]), active ? '#ffcc4d' : 'rgba(255,255,255,0.14)', active ? '#0b1d3a' : '#f4f7ff', 14);
  }
  for (const { item, row, button } of storeRows(s.store.tab)) {
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath(); ctx.roundRect(row.x, row.y, row.w, row.h, 8); ctx.fill();
    let nameX = row.x + 14;
    if (item.head) {
      ctx.fillStyle = item.head;
      ctx.strokeStyle = item.tail;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(row.x + 22, row.y + row.h / 2, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      nameX = row.x + 42;
    }
    textAt(ctx, t(s.lang, item.id), nameX, row.y + row.h / 2 + 5, 15, '#f4f7ff', 'bold', 'left');
    if (isEquipped(s, item.id)) {
      drawButton(ctx, button, t(s.lang, 'active'), '#7ee0a8', '#0b1d3a', 13);
    } else if (s.owned.includes(item.id)) {
      drawButton(ctx, button, t(s.lang, 'choose'), 'rgba(255,255,255,0.22)', '#f4f7ff', 14);
    } else {
      const affordable = s.credits >= item.price;
      drawButton(ctx, button, formatNumber(s.lang, item.price), affordable ? '#ffcc4d' : 'rgba(255,204,77,0.35)', '#0b1d3a', 14);
    }
  }
  drawButton(ctx, STORE_BACK_BUTTON, t(s.lang, 'back'));
}

// A gear icon: a ring with eight teeth.
export function drawGear(ctx, r) {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 10); ctx.fill();
  ctx.strokeStyle = '#f4f7ff';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 9, cy + Math.sin(a) * 9);
    ctx.lineTo(cx + Math.cos(a) * 14, cy + Math.sin(a) * 14);
    ctx.stroke();
  }
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.stroke();
}

// Settings: change language or username, or go back.
export function drawSettings(ctx, s) {
  text(ctx, t(s.lang, 'settings'), 120, 30, '#ffcc4d');
  const languageName = LANGUAGES.find((l) => l.code === s.lang).name;
  drawButton(ctx, SETTINGS_LANG, `${t(s.lang, 'language')}: ${languageName}`, 'rgba(255,255,255,0.14)', '#f4f7ff', 17);
  drawButton(ctx, SETTINGS_NAME, `${t(s.lang, 'username')}: ${s.name}`, 'rgba(255,255,255,0.14)', '#f4f7ff', 17);
  drawButton(ctx, SETTINGS_RECOVERY, t(s.lang, 'recoveryShow'), 'rgba(255,255,255,0.14)', '#f4f7ff', 17);
  drawButton(ctx, SETTINGS_RESTORE, t(s.lang, 'recoveryEnter'), 'rgba(255,255,255,0.14)', '#f4f7ff', 17);
  drawButton(ctx, SETTINGS_PRIVACY, t(s.lang, 'privacy'), 'rgba(255,255,255,0.14)', '#f4f7ff', 17);
  if (s.ads?.privacy) drawButton(ctx, SETTINGS_AD_PRIVACY, t(s.lang, 'adPrivacy'), 'rgba(255,255,255,0.14)', '#f4f7ff', 17);
  drawButton(ctx, STORE_BACK_BUTTON, t(s.lang, 'back'));
}

// Several centred lines of text, split on '\n'.
export function lines(ctx, str, y, size, color = '#f4f7ff') {
  str.split('\n').forEach((line, i) => text(ctx, line, y + i * (size + 8), size, color, 'normal'));
}

// The age question (ZR-25), with a link to the privacy policy.
export function drawAge(ctx, s) {
  text(ctx, GAME_NAME, 120, 30, '#ffcc4d');
  text(ctx, t(s.lang, 'ageQuestion'), 230, 22);
  drawButton(ctx, AGE_YES, t(s.lang, 'ageYes'));
  drawButton(ctx, AGE_NO, t(s.lang, 'ageNo'), 'rgba(255,255,255,0.14)', '#f4f7ff');
  lines(ctx, t(s.lang, 'ageNote'), 470, 15);
  drawButton(ctx, PRIVACY_LINK, t(s.lang, 'privacy'), 'rgba(255,255,255,0.14)', '#f4f7ff', 14);
}

// The player's recovery code (ZR-25), or why it cannot be shown.
export function drawRecovery(ctx, s) {
  text(ctx, t(s.lang, 'recoveryTitle'), 120, 26, '#ffcc4d');
  if (s.recovery.status === 'ready') {
    text(ctx, s.recovery.code, 290, 30, '#ffcc4d');
    lines(ctx, t(s.lang, 'recoveryHint'), 370, 14);
  } else {
    text(ctx, t(s.lang, s.recovery.status === 'offline' ? 'offline' : 'loading'), 290, 17, '#f4f7ff', 'normal');
  }
  drawButton(ctx, STORE_BACK_BUTTON, t(s.lang, 'back'));
}

// Entering a recovery code from another device (ZR-25).
const RESTORE_COLORS = { restoreOk: '#7ee0a8', restoreInvalid: '#ff8a8a', restoreLimit: '#ff8a8a', offline: '#ff8a8a' };
export function drawRestore(ctx, s) {
  text(ctx, t(s.lang, 'restoreTitle'), 120, 26, '#ffcc4d');
  lines(ctx, t(s.lang, 'restoreHint'), 165, 15);
  ctx.fillStyle = '#f4f7ff';
  ctx.beginPath(); ctx.roundRect(CODE_FIELD.x, CODE_FIELD.y, CODE_FIELD.w, CODE_FIELD.h, 10); ctx.fill();
  const typed = s.restore.draft.length > 0;
  ctx.font = `bold 20px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = typed ? '#0b1d3a' : 'rgba(11,29,58,0.45)';
  ctx.fillText(typed ? s.restore.draft : t(s.lang, 'tapToType'), W / 2, CODE_FIELD.y + 33);
  if (s.restore.status) {
    text(ctx, t(s.lang, s.restore.status), 338, 15, RESTORE_COLORS[s.restore.status] ?? '#f4f7ff', 'normal');
  }
  drawButton(ctx, CODE_CONFIRM, t(s.lang, 'restoreButton'));
  drawButton(ctx, STORE_BACK_BUTTON, t(s.lang, 'back'));
}

// The back button on the language and name screens, only when they were
// opened from the settings.
export function drawSettingsBack(ctx, s) {
  if (s.flow === 'settings') drawButton(ctx, STORE_BACK_BUTTON, t(s.lang, 'back'));
}

// First launch: one button per language, each in its own language.
export function drawLanguagePicker(ctx, s) {
  text(ctx, GAME_NAME, 60, 30, '#ffcc4d');
  text(ctx, t(s.lang, 'chooseLanguage'), 98, 18, '#f4f7ff', 'normal');
  for (const b of languageButtons()) {
    const current = b.code === s.lang;
    drawButton(ctx, b.rect, b.name, current ? '#ffcc4d' : 'rgba(255,255,255,0.14)', current ? '#0b1d3a' : '#f4f7ff', 17);
  }
}

// Username entry: a field showing what was typed (or a hint), a blinking
// cursor, the rules, an error if needed and a continue button.
export function drawNameEntry(ctx, s) {
  text(ctx, t(s.lang, 'yourName'), 200, 22, '#ffcc4d');
  ctx.fillStyle = '#f4f7ff';
  ctx.beginPath(); ctx.roundRect(NAME_FIELD.x, NAME_FIELD.y, NAME_FIELD.w, NAME_FIELD.h, 10); ctx.fill();
  const typed = s.nameDraft.length > 0;
  const cursor = Math.floor(s.t * 2) % 2 === 0 ? '|' : '';
  const shown = typed ? s.nameDraft + cursor : t(s.lang, 'tapToType');
  fitTo(ctx, `${s.nameDraft}|`, 20, NAME_FIELD.w - 20); // a long name gets smaller (ZR-70)
  ctx.textAlign = 'center';
  ctx.fillStyle = typed ? '#0b1d3a' : 'rgba(11,29,58,0.45)';
  ctx.fillText(shown, W / 2, NAME_FIELD.y + 33);
  // nameError is a message key: what to fix (ZR-74) or the server's answer;
  // `true` (older state) means a generic invalid name.
  const error = s.nameError === true ? 'nameInvalid' : s.nameError;
  const message = error ? t(s.lang, error, { char: `“${badNameChar(s.nameDraft) ?? ''}”` }) : t(s.lang, 'nameHint');
  if (error) { // a red border around the field
    ctx.strokeStyle = '#ff8a8a';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(NAME_FIELD.x, NAME_FIELD.y, NAME_FIELD.w, NAME_FIELD.h, 10); ctx.stroke();
  }
  text(ctx, message, 338, fitTo(ctx, message, 15, W - 24), error ? '#ff8a8a' : '#f4f7ff', 'normal');
  drawButton(ctx, NAME_CONTINUE, t(s.lang, 'continue'));
}

// Short intro of three pages; it can be skipped.
export function drawIntro(ctx, s) {
  text(ctx, t(s.lang, 'hello', { name: s.name }), 120, 26, '#ffcc4d');
  const lines = t(s.lang, `intro${s.introPage + 1}`).split('\n');
  lines.forEach((line, i) => text(ctx, line, 420 + i * 28, 19));
  for (let i = 0; i < INTRO_PAGES; i++) {
    ctx.fillStyle = i === s.introPage ? '#ffcc4d' : 'rgba(255,255,255,0.3)';
    ctx.beginPath(); ctx.arc(W / 2 + (i - 1) * 18, 530, 5, 0, Math.PI * 2); ctx.fill();
  }
  drawButton(ctx, INTRO_SKIP, t(s.lang, 'skip'), 'rgba(255,255,255,0.14)', '#f4f7ff');
  drawButton(ctx, INTRO_NEXT, t(s.lang, s.introPage === INTRO_PAGES - 1 ? 'play' : 'continue'));
}

// One leaderboard row: rank, username and best score; the player's own row
// is highlighted.
export function drawLeaderboardRow(ctx, s, row, y) {
  ctx.fillStyle = row.me ? 'rgba(255,204,77,0.28)' : 'rgba(255,255,255,0.08)';
  ctx.beginPath(); ctx.roundRect(12, y, W - 24, LEADERBOARD_ROW_H - 4, 8); ctx.fill();
  const base = y + LEADERBOARD_ROW_H / 2 + 3;
  textAt(ctx, `${row.rank}.`, 46, base, 15, '#ffcc4d', 'bold', 'right');
  const best = formatNumber(s.lang, row.best);
  const bestWidth = ctx.measureText(best)?.width ?? 0;
  // A long name gets smaller so it never runs into the score (ZR-70).
  textAt(ctx, row.username, 58, base, fitTo(ctx, row.username, 15, W - 24 - bestWidth - 12 - 58), '#f4f7ff', 'bold', 'left');
  textAt(ctx, best, W - 24, base, 15, '#f4f7ff', 'bold', 'right');
}

// The rows of the board, scrolled and cut off at the edges of the list
// area, with a thin scroll bar when the list is longer than the screen
// (ZR-60).
export function drawLeaderboardList(ctx, s, board) {
  const scroll = board.scroll ?? 0;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, LEADERBOARD_ROW_Y - 2, W, LEADERBOARD_VIEW_H + 2); ctx.clip();
  ctx.translate(0, -scroll);
  board.top.forEach((row, i) => drawLeaderboardRow(ctx, s, row, LEADERBOARD_ROW_Y + i * LEADERBOARD_ROW_H));
  if (showsOwnRow(board)) {
    const y = LEADERBOARD_ROW_Y + board.top.length * LEADERBOARD_ROW_H;
    text(ctx, '…', y + 16, 16, 'rgba(244,247,255,0.6)', 'normal');
    drawLeaderboardRow(ctx, s, board.me, y + LEADERBOARD_GAP);
  }
  ctx.restore();
  const max = maxLeaderboardScroll(board);
  if (max > 0) {
    const thumb = Math.max((LEADERBOARD_VIEW_H * LEADERBOARD_VIEW_H) / leaderboardContentHeight(board), 30);
    const y = LEADERBOARD_ROW_Y + (scroll / max) * (LEADERBOARD_VIEW_H - thumb);
    ctx.fillStyle = 'rgba(244,247,255,0.45)';
    ctx.beginPath(); ctx.roundRect(W - 9, y, 4, thumb, 2); ctx.fill();
  }
}

const LEADERBOARD_MESSAGES = { loading: 'loading', offline: 'offline', young: 'leaderboardAge' };
const EMPTY_KEYS = { global: 'noScores', weekly: 'noScores', friends: 'noFriends' };
const SCOPE_KEYS = { global: 'tabGlobal', weekly: 'tabWeekly', friends: 'tabFriends' };

// The leaderboard (ZR-20): three tabs (all time, this week, friends), the top rows and, when the player is
// not in the top, their own row below a gap.
export function drawLeaderboard(ctx, s) {
  ctx.fillStyle = 'rgba(11, 29, 58, 0.6)';
  ctx.fillRect(0, 0, W, H);
  text(ctx, t(s.lang, 'leaderboard'), 50, 30, '#ffcc4d');
  const board = s.leaderboard;
  for (const { scope, rect } of leaderboardTabs()) {
    const active = scope === board.tab;
    drawButton(ctx, rect, t(s.lang, SCOPE_KEYS[scope]),
      active ? '#ffcc4d' : 'rgba(255,255,255,0.14)', active ? '#0b1d3a' : '#f4f7ff', 14);
  }
  if (board.status !== 'ready') {
    text(ctx, t(s.lang, LEADERBOARD_MESSAGES[board.status]), 300, 17, '#f4f7ff', 'normal');
  } else if (board.top.length === 0) {
    text(ctx, t(s.lang, EMPTY_KEYS[board.tab]), 300, 17, '#f4f7ff', 'normal');
  } else {
    drawLeaderboardList(ctx, s, board);
  }
  if (board.tab === 'friends') {
    drawButton(ctx, LEADERBOARD_BACK_LEFT, t(s.lang, 'back'));
    drawButton(ctx, LEADERBOARD_FRIENDS_BUTTON, t(s.lang, 'addFriends'), '#7ee0a8', '#0b1d3a', 15);
  } else {
    drawButton(ctx, STORE_BACK_BUTTON, t(s.lang, 'back'));
  }
}

// Messages on the friends screen and their colours (ZR-21).
const FRIEND_COLORS = {
  friendAdded: '#7ee0a8', friendAlready: '#7ee0a8', linkCopied: '#7ee0a8',
  friendUnknown: '#ff8a8a', friendSelf: '#ff8a8a', friendLimit: '#ff8a8a', shareFailed: '#ff8a8a', offline: '#ff8a8a',
};

// Friends (ZR-21): your code, share an invite, add a friend by code.
export function drawFriends(ctx, s) {
  ctx.fillStyle = 'rgba(11, 29, 58, 0.6)';
  ctx.fillRect(0, 0, W, H);
  text(ctx, t(s.lang, 'friends'), 60, 30, '#ffcc4d');
  text(ctx, t(s.lang, 'yourCode'), 130, 16, '#f4f7ff', 'normal');
  text(ctx, s.friendCode ?? '—', 180, 34, '#ffcc4d');
  drawButton(ctx, FRIEND_SHARE, t(s.lang, 'shareInvite'), '#7ee0a8', '#0b1d3a', 17);
  text(ctx, t(s.lang, 'friendCodeHint'), 288, 15, '#f4f7ff', 'normal');
  ctx.fillStyle = '#f4f7ff';
  ctx.beginPath(); ctx.roundRect(FRIEND_FIELD.x, FRIEND_FIELD.y, FRIEND_FIELD.w, FRIEND_FIELD.h, 10); ctx.fill();
  const typed = s.friends.draft.length > 0;
  ctx.font = `bold 22px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = typed ? '#0b1d3a' : 'rgba(11,29,58,0.45)';
  ctx.fillText(typed ? s.friends.draft : t(s.lang, 'tapToType'), W / 2, FRIEND_FIELD.y + 34);
  drawButton(ctx, FRIEND_ADD, t(s.lang, 'addButton'));
  if (s.friends.status) {
    text(ctx, t(s.lang, s.friends.status, { name: s.friends.name }), 440, 15, FRIEND_COLORS[s.friends.status] ?? '#f4f7ff', 'normal');
  }
  drawButton(ctx, STORE_BACK_BUTTON, t(s.lang, 'back'));
}

// A short message on the home screen (ZR-21), fading out at the end.
export function drawToast(ctx, s) {
  if (!s.toast || s.toast.time <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(s.toast.time, 1);
  drawButton(ctx, { x: 20, y: 64, w: W - 40, h: 34 }, t(s.lang, s.toast.key, s.toast.vars), '#7ee0a8', '#0b1d3a', 15);
  ctx.restore();
}

// The title font (ZR-35): Luckiest Guy, stored in fonts/ and loaded by
// main.js; until it is loaded the system font is used.
export const TITLE_FONT = '"Lucky", "Trebuchet MS", system-ui, sans-serif';

// One title line: tilted, with a vertical gradient, a thick outline and a
// hard drop shadow.
export function drawTitleLine(ctx, str, y, size, top, bottom) {
  ctx.save();
  ctx.translate(W / 2, y);
  ctx.rotate(-0.06);
  ctx.font = `${size}px ${TITLE_FONT}`;
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowOffsetY = 5;
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#0b1d3a';
  ctx.strokeText(str, 0, 0);
  ctx.shadowColor = 'transparent';
  const fill = ctx.createLinearGradient(0, -size * 0.85, 0, 0);
  fill.addColorStop(0, top);
  fill.addColorStop(1, bottom);
  ctx.fillStyle = fill;
  ctx.fillText(str, 0, 0);
  ctx.restore();
}

// The home screen title (ZR-35): "SEED &" in gold over "DESTROY" in pink.
// The brand name is the same in every language.
export function drawTitle(ctx) {
  const [first, second] = GAME_NAME.toUpperCase().split(' & ');
  drawTitleLine(ctx, `${first} &`, 150, 52, '#fff38a', '#ffb02e');
  drawTitleLine(ctx, second, 205, 60, '#ff9ebd', '#ff4f8b');
}

// Colourful soft glows behind the home screen (ZR-34).
export const GLOWS = [
  [40, 120, 140, 'rgba(255, 79, 139, 0.22)'],
  [330, 300, 150, 'rgba(0, 229, 255, 0.16)'],
  [80, 470, 130, 'rgba(176, 124, 255, 0.2)'],
  [300, 80, 90, 'rgba(255, 224, 102, 0.14)'],
];

export function drawGlows(ctx, t) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  GLOWS.forEach(([x, y, r, color], i) => {
    const rr = r * (1 + 0.06 * Math.sin(t * 0.8 + i * 1.7));
    const glow = ctx.createRadialGradient(x, y, 0, x, y, rr);
    glow.addColorStop(0, color);
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.fill();
  });
  ctx.restore();
}

// A cartoon sperm cell with a face and a weapon (ZR-34). Moods: happy,
// laugh, serious, angry. Weapons: gun (with a muzzle flash) or sword.
export function drawFighter(ctx, f, t) {
  const size = f.size;
  ctx.save();
  ctx.translate(f.x, f.y);
  if (f.flip) ctx.scale(-1, 1);
  ctx.strokeStyle = f.tail;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-size, 0);
  for (let i = 1; i <= 12; i++) ctx.lineTo(-size - i * 3, Math.sin(i * 0.7 + t * 14) * i * 0.45);
  ctx.stroke();
  ctx.fillStyle = f.head;
  ctx.strokeStyle = 'rgba(11, 29, 58, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(0, 0, size * 1.25, size, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#0b1d3a';
  ctx.beginPath(); ctx.arc(size * 0.35, -size * 0.25, 2.4, 0, Math.PI * 2); ctx.arc(size * 0.8, -size * 0.2, 2.4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#0b1d3a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (f.mood === 'laugh') {
    ctx.fillStyle = '#7a2e3a';
    ctx.arc(size * 0.6, size * 0.2, size * 0.38, 0, Math.PI);
    ctx.fill();
  } else if (f.mood === 'serious' || f.mood === 'angry') {
    const brow = f.mood === 'angry' ? 0.7 : 0.6;
    ctx.moveTo(size * 0.15, -size * brow); ctx.lineTo(size * 0.55, -size * 0.45);
    ctx.moveTo(size * 1.0, -size * brow); ctx.lineTo(size * 0.65, -size * 0.45);
    ctx.moveTo(size * 0.35, size * 0.4);
    if (f.mood === 'angry') ctx.quadraticCurveTo(size * 0.6, size * 0.2, size * 0.9, size * 0.45);
    else ctx.lineTo(size * 0.85, size * 0.4);
    ctx.stroke();
  } else {
    ctx.arc(size * 0.6, size * 0.15, size * 0.35, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }
  if (f.weapon === 'gun') {
    ctx.fillStyle = '#2b2f45';
    ctx.beginPath(); ctx.roundRect(size * 0.9, size * 0.35, size * 1.2, 5, 2); ctx.fill();
    if (Math.sin(t * 9 + f.x) > 0.3) drawStar(ctx, size * 2.25, size * 0.45, 6, '#ffe066');
  } else {
    const swing = Math.sin(t * 7 + f.y) * 0.5;
    ctx.save();
    ctx.translate(size * 0.9, size * 0.5);
    ctx.rotate(swing);
    ctx.strokeStyle = '#dfe7f2';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(size * 1.4, -size * 1.4); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

// A spiky star burst, used for flashes, sparks and comic bursts.
export function drawStar(ctx, x, y, r, color, points = 8) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

// The fighters around the cloud, relative to its centre (ZR-34).
export const BRAWL_FIGHTERS = [
  { dx: -52, dy: -30, head: '#ffc2d6', tail: '#ff9ebd', mood: 'laugh', weapon: 'sword', flip: true },
  { dx: 58, dy: -25, head: '#c4f5df', tail: '#8de8c0', mood: 'angry', weapon: 'gun', flip: false },
  { dx: -55, dy: 35, head: '#fff3a8', tail: '#ffe066', mood: 'serious', weapon: 'gun', flip: true },
  { dx: 0, dy: -42, head: '#ffffff', tail: '#ffffff', mood: 'happy', weapon: 'sword', flip: false },
];
const PUFFS = [[0, 0, 38], [-30, -15, 26], [30, -20, 28], [-35, 20, 24], [38, 25, 26], [0, -30, 22], [0, 35, 22]];

// The home screen brawl (option C, chosen by the owner): a comic dust cloud
// with fighters, weapons and foes sticking out, sparks and POW / ZAP bursts.
// Everything moves with the time t.
export function drawBrawl(ctx, s, cx, cy) {
  const time = s.t;
  ctx.fillStyle = 'rgba(244, 247, 255, 0.9)';
  PUFFS.forEach(([dx, dy, r], i) => {
    const wob = 1 + 0.08 * Math.sin(time * 6 + i * 1.3);
    ctx.beginPath(); ctx.arc(cx + dx + Math.sin(time * 3 + i) * 3, cy + dy, r * wob, 0, Math.PI * 2); ctx.fill();
  });
  drawWbc(ctx, { x: cx + 56 + Math.sin(time * 4) * 4, y: cy + 37, r: 14 }, time);
  drawPill(ctx, { x: cx + 32, y: cy - 50, r: 10, phase: time * 3 });
  for (const f of BRAWL_FIGHTERS) {
    const jiggle = Math.sin(time * 8 + f.dx) * 4;
    drawFighter(ctx, { ...f, x: cx + f.dx + jiggle, y: cy + f.dy + Math.cos(time * 7 + f.dy) * 2, size: 12 }, time);
  }
  [[-68, -45], [75, 5], [-30, 60]].forEach(([dx, dy], i) => {
    const pop = Math.max(Math.sin(time * 5 + i * 2.1), 0);
    if (pop > 0) drawStar(ctx, cx + dx, cy + dy, 7 * pop, '#ffe066');
  });
  // POW and ZAP take turns.
  const phase = (time % 2.4) / 2.4;
  const word = phase < 0.5 ? 'pow' : 'zap';
  const k = Math.sin((phase % 0.5) * 2 * Math.PI);
  if (k > 0) {
    const pow = word === 'pow';
    ctx.save();
    ctx.translate(cx + (pow ? 105 : -110), cy + (pow ? -40 : 5));
    ctx.rotate(pow ? 0.15 : -0.2);
    ctx.scale(k, k);
    drawStar(ctx, 0, 0, 26, pow ? '#ff4f8b' : '#ffe066', 8);
    ctx.font = `15px ${TITLE_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = pow ? '#ffffff' : '#0b1d3a';
    ctx.fillText(t(s.lang, word), 0, 5);
    ctx.restore();
  }
}

// The greeting is split in two lines, with the name on a line of its own,
// when it does not fit on one line (long usernames, ZR-42).
export function greetingLines(template, name) {
  const at = template.indexOf('{name}');
  const before = template.slice(0, at).trim();
  const after = template.slice(at + '{name}'.length);
  if (before) return [before, name + after];
  return [name + after[0], after.slice(1).trim()];
}

export const GREETING_MAX = W - 32; // widest greeting on one line, in px

// The largest font size up to `size` at which the text fits the screen.
export function fitSize(ctx, str, size) {
  ctx.font = `bold ${size}px ${FONT}`;
  const width = ctx.measureText(str)?.width ?? 0;
  return width <= GREETING_MAX ? size : Math.max(Math.floor((size * GREETING_MAX) / width), 12);
}

export function drawGreeting(ctx, s) {
  const line = t(s.lang, 'greeting', { name: s.name });
  if (fitSize(ctx, line, 20) === 20) {
    text(ctx, line, 250, 20);
    return;
  }
  const [first, second] = greetingLines(t(s.lang, 'greeting'), s.name);
  text(ctx, first, 240, fitSize(ctx, first, 18));
  text(ctx, second, 262, fitSize(ctx, second, 18), '#ffcc4d');
}

// Credits earned in this run, top right while playing, with the streak
// multiplier below it once a streak pays extra (ZR-23).
export function drawRunCredits(ctx, s) {
  textAt(ctx, t(s.lang, 'runCredits', { n: s.runCredits }), W - 14, 30, 14, '#ffcc4d', 'bold', 'right');
  const bonus = streakBonus(s.streak);
  if (bonus) textAt(ctx, t(s.lang, 'streak', { n: bonus + 1 }), W - 14, 50, 14, '#ff7ab6', 'bold', 'right');
}

const CHALLENGE_KEYS = { gates_run: 'challengeGatesRun', gates_day: 'challengeGatesDay', runs_day: 'challengeRunsDay' };

// Today's challenge on the home screen (ZR-23), in place of the subtitles.
export function drawChallenge(ctx, s) {
  const c = s.challenge;
  text(ctx, t(s.lang, CHALLENGE_KEYS[c.kind], { n: c.target }), 410, 16, '#f4f7ff', 'normal');
  const line = c.done
    ? t(s.lang, 'challengeDone', { r: c.reward })
    : t(s.lang, 'challengeProgress', { p: Math.min(c.progress, c.target), n: c.target, r: c.reward });
  text(ctx, line, 432, 16, c.done ? '#7ee0a8' : '#ffcc4d', 'normal');
}

export function draw(ctx, s) {
  drawBackground(ctx, s);
  if (s.state === 'start') drawGlows(ctx, s.t);
  if (s.state === 'store') {
    drawStore(ctx, s);
    return;
  }
  if (s.state === 'settings') {
    drawSettings(ctx, s);
    return;
  }
  if (s.state === 'age') {
    drawAge(ctx, s);
    return;
  }
  if (s.state === 'leaderboard') {
    drawLeaderboard(ctx, s);
    return;
  }
  if (s.state === 'friends') {
    drawFriends(ctx, s);
    return;
  }
  if (s.state === 'recovery') {
    drawRecovery(ctx, s);
    return;
  }
  if (s.state === 'restore') {
    drawRestore(ctx, s);
    return;
  }
  if (s.state === 'lang') {
    drawLanguagePicker(ctx, s);
    drawSettingsBack(ctx, s);
    return;
  }
  if (s.state === 'name') {
    drawNameEntry(ctx, s);
    drawSettingsBack(ctx, s);
    return;
  }
  // The playing field shakes at high scores; the score and hearts stay still.
  const shake = s.state === 'play' ? shakeOffset(s.score, s.t) : { x: 0, y: 0 };
  ctx.save();
  ctx.translate(shake.x, shake.y);
  // Enemies swim behind the gate walls; pickups and the player are in front.
  for (const e of s.enemies) drawEnemy(ctx, e, s.t);
  for (const g of s.gates) if (!g.destroyed) drawGate(ctx, s.t, g);
  for (const p of s.pickups) drawPickup(ctx, p, s.t);
  for (const b of s.boxes) drawBox(ctx, b, s.t);
  drawBullets(ctx, s.bullets);
  drawMissiles(ctx, s.missiles);
  drawBursts(ctx, s.bursts);
  drawSparks(ctx, s);
  drawZaps(ctx, s);
  drawPopups(ctx, s.popups);
  if (s.state === 'launch') drawLaunch(ctx, s);
  drawCellEffects(ctx, s);
  // On the home screen the brawl takes the place of the player cell (ZR-34).
  if (s.state !== 'start' && cellVisible(s.invulnerable)) drawCell(ctx, s);
  if (s.state === 'play') drawHeldWeapon(ctx, s);
  ctx.restore();

  if (s.state === 'play' || s.state === 'dead' || s.state === 'revive') {
    text(ctx, String(s.score), 80, 44);
    drawHearts(ctx, s.hearts);
    drawRunCredits(ctx, s);
    drawEffectLabels(ctx, s);
  }
  if (s.state === 'revive') drawRevive(ctx, s);
  if (s.state === 'intro') drawIntro(ctx, s);
  if (s.state === 'start') {
    drawTitle(ctx);
    if (s.name) drawGreeting(ctx, s);
    drawBrawl(ctx, s, W / 2, 330);
    if (s.challenge) {
      drawChallenge(ctx, s);
    } else {
      text(ctx, t(s.lang, 'subtitle1'), 410, 16, '#f4f7ff', 'normal');
      text(ctx, t(s.lang, 'subtitle2'), 432, 16, '#f4f7ff', 'normal');
    }
    if (gateReached(s)) drawGateButton(ctx, s);
    else text(ctx, t(s.lang, 'tapToStart'), 470, 20);
    // Best score and the runs counter share one line (ZR-43).
    const scoreLine = [s.best ? t(s.lang, 'best', { n: s.best }) : '', runsCounter(s)].filter(Boolean).join('   ·   ');
    if (scoreLine) text(ctx, scoreLine, 504, fitSize(ctx, scoreLine, 16), '#ffd9e4', 'normal');
    text(ctx, t(s.lang, 'credits', { n: formatNumber(s.lang, s.credits) }), 528, 16, '#ffcc4d', 'normal');
    drawButton(ctx, START_STORE_BUTTON, t(s.lang, 'store'));
    drawButton(ctx, LEADERBOARD_BUTTON, t(s.lang, 'leaderboard'));
    drawGear(ctx, GEAR_BUTTON);
    drawAdHome(ctx, s);
    drawToast(ctx, s);
    text(ctx, `v${VERSION}`, 620, 12, 'rgba(244,247,255,0.5)', 'normal');
  }
  if (s.state === 'dead') drawEnding(ctx, s);
}
