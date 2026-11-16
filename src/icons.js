// Small icons for buttons (ZR-102): the settings rows and the store and
// leaderboard buttons on the home screen. Each icon is drawn with paths on a
// 24 x 24 grid, so it stays sharp at any size, like the gear (ZR-87). No icon
// fonts or image files.

const TAU = Math.PI * 2;

function line(ctx, ...points) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.stroke();
}

function shape(ctx, ...points) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  ctx.fill();
}

// Each icon draws itself on the 24 x 24 grid. `crossed`: switched off, so
// the parts that show "on" (the sound waves) are left out.
export const ICONS = {
  // Language: a globe.
  globe(ctx) {
    ctx.beginPath(); ctx.arc(12, 12, 9, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(12, 12, 4, 9, 0, 0, TAU); ctx.stroke();
    line(ctx, [3, 12], [21, 12]);
    line(ctx, [5, 7.5], [19, 7.5]);
    line(ctx, [5, 16.5], [19, 16.5]);
  },
  // Sound: a loudspeaker with two waves.
  speaker(ctx, crossed) {
    shape(ctx, [3, 9], [7, 9], [12, 5], [12, 19], [7, 15], [3, 15]);
    if (crossed) return;
    ctx.beginPath(); ctx.arc(12, 12, 4, -0.8, 0.8); ctx.stroke();
    ctx.beginPath(); ctx.arc(12, 12, 8, -0.8, 0.8); ctx.stroke();
  },
  // Recovery code: a key.
  key(ctx) {
    ctx.beginPath(); ctx.arc(7, 12, 4, 0, TAU); ctx.stroke();
    line(ctx, [11, 12], [21, 12]);
    line(ctx, [17, 12], [17, 15.5]);
    line(ctx, [20, 12], [20, 14.5]);
  },
  // Enter a code from another device: an arrow into a tray.
  restore(ctx) {
    line(ctx, [12, 3], [12, 14]);
    line(ctx, [8, 10], [12, 14], [16, 10]);
    line(ctx, [4, 15], [4, 20], [20, 20], [20, 15]);
  },
  // Privacy: a padlock.
  lock(ctx) {
    ctx.beginPath(); ctx.roundRect(5, 11, 14, 10, 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(7.5, 11); ctx.lineTo(7.5, 8); ctx.arc(12, 8, 4.5, Math.PI, 0); ctx.lineTo(16.5, 11); ctx.stroke();
  },
  // Ad settings: a megaphone.
  megaphone(ctx) {
    shape(ctx, [3, 10], [7, 10], [17, 5], [17, 19], [7, 14], [3, 14]);
    line(ctx, [7, 14], [9, 20]);
    line(ctx, [20, 10], [20, 14]);
  },
  // Delete the account: a bin.
  trash(ctx) {
    line(ctx, [4, 6], [20, 6]);
    line(ctx, [9, 6], [9, 3.5], [15, 3.5], [15, 6]);
    line(ctx, [6, 6], [7, 21], [17, 21], [18, 6]);
    line(ctx, [10, 10], [10, 17]);
    line(ctx, [14, 10], [14, 17]);
  },
  // Store: a shopping cart (a bag looked like a suitcase).
  cart(ctx) {
    line(ctx, [1.5, 4], [5, 4], [7.5, 15.5], [19, 15.5]);
    shape(ctx, [5.8, 7], [21.5, 7], [19.5, 13], [7, 13]);
    ctx.beginPath(); ctx.arc(9, 19.5, 2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(17.5, 19.5, 2, 0, TAU); ctx.fill();
  },
  // Leaderboard: a cup.
  trophy(ctx) {
    ctx.beginPath(); ctx.moveTo(7, 3); ctx.lineTo(17, 3); ctx.lineTo(17, 9); ctx.arc(12, 9, 5, 0, Math.PI); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(7, 7.5, 3, Math.PI / 2, Math.PI * 1.5); ctx.stroke();
    ctx.beginPath(); ctx.arc(17, 7.5, 3, -Math.PI / 2, Math.PI / 2); ctx.stroke();
    ctx.fillRect(11, 14, 2, 4);
    ctx.fillRect(8, 18, 8, 3);
  },
};

// Draws icon `name` centred on (cx, cy), `size` pixels wide, in `color`.
// `crossed` adds a diagonal stroke: the switch is off.
export function drawIcon(ctx, name, cx, cy, size, color, crossed = false) {
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(size / 24, size / 24);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ICONS[name](ctx, crossed);
  if (crossed) line(ctx, [3, 3], [21, 21]);
  ctx.restore();
}
