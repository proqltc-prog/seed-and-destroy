// Screen layout of buttons and their hit testing, shared by input and drawing.
import { W } from './config.js';
import { CATEGORIES, CATALOG } from './shop.js';
import { LANGUAGES } from './i18n.js';

// Home screen: the store on the left, the leaderboard (ZR-20) on the right.
export const START_STORE_BUTTON = { x: W / 2 - 150, y: 540, w: 140, h: 40 };
export const LEADERBOARD_BUTTON = { x: W / 2 + 10, y: 540, w: 140, h: 40 };
export const STORE_BACK_BUTTON = { x: W / 2 - 70, y: 588, w: 140, h: 38 };

// Rewarded ads (ZR-14): a small button on the home screen, top left.
export const AD_HOME_BUTTON = { x: 12, y: 12, w: 176, h: 42 };
// With the runs used: the video for new runs, in place of the tap line (ZR-43).
export const AD_GATE_BUTTON = { x: 40, y: 440, w: W - 80, h: 46 };
// The revive question after the last heart (ZR-69).
export const REVIVE_WATCH = { x: 30, y: 330, w: W - 60, h: 52 };
export const REVIVE_SKIP = { x: W / 2 - 80, y: 400, w: 160, h: 40 };


// Settings (ZR-17): gear icon on the home screen and the settings screen.
export const GEAR_BUTTON = { x: W - 54, y: 12, w: 42, h: 42 };
export const SETTINGS_LANG = { x: 30, y: 150, w: W - 60, h: 52 };
export const SETTINGS_NAME = { x: 30, y: 216, w: W - 60, h: 52 };
// Privacy and recovery (ZR-25)
export const SETTINGS_RECOVERY = { x: 30, y: 282, w: W - 60, h: 52 };
export const SETTINGS_RESTORE = { x: 30, y: 348, w: W - 60, h: 52 };
export const SETTINGS_PRIVACY = { x: 30, y: 414, w: W - 60, h: 52 };
// Google's ad privacy choices (ZR-68), only where Google requires them.
export const SETTINGS_AD_PRIVACY = { x: 30, y: 480, w: W - 60, h: 52 };
export const AGE_YES = { x: 30, y: 300, w: W - 60, h: 52 };
export const AGE_NO = { x: 30, y: 370, w: W - 60, h: 52 };
export const PRIVACY_LINK = { x: W / 2 - 70, y: 580, w: 140, h: 38 };
// The recovery code entry reuses the place of the name field and button.
export const CODE_FIELD = { x: 30, y: 250, w: W - 60, h: 52 };
export const CODE_CONFIRM = { x: W / 2 - 70, y: 380, w: 140, h: 44 };

// Onboarding (ZR-16)
export const NAME_FIELD = { x: 30, y: 250, w: W - 60, h: 52 };
export const NAME_CONTINUE = { x: W / 2 - 70, y: 380, w: 140, h: 44 };
export const INTRO_SKIP = { x: 20, y: 570, w: 140, h: 44 };
export const INTRO_NEXT = { x: W - 160, y: 570, w: 140, h: 44 };

// One button per language, stacked in the middle of the screen.
export function languageButtons() {
  return LANGUAGES.map((language, i) => ({ code: language.code, name: language.name, rect: { x: W / 2 - 120, y: 116 + i * 50, w: 240, h: 42 } }));
}

export function languageHit(p) {
  return languageButtons().find((b) => inRect(p, b.rect))?.code ?? null;
}

const TAB_Y = 96;
const TAB_H = 36;
const ROW_Y = 146;
const ROW_H = 47;

export function inRect(p, r) {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

export function storeTabs() {
  const w = (W - 24 - 2 * 8) / CATEGORIES.length;
  return CATEGORIES.map((category, i) => ({
    category, rect: { x: 12 + i * (w + 8), y: TAB_Y, w, h: TAB_H },
  }));
}

// One row per item in the open tab, with a buy button on the right.
export function storeRows(tab) {
  return CATALOG[tab].map((item, i) => {
    const row = { x: 12, y: ROW_Y + i * ROW_H, w: W - 24, h: ROW_H - 6 };
    return { item, row, button: { x: row.x + row.w - 104, y: row.y + 6, w: 96, h: row.h - 12 } };
  });
}

// What a tap at point p hits on the store screen.
export function storeHit(tab, p) {
  if (inRect(p, STORE_BACK_BUTTON)) return { action: 'back' };
  const t = storeTabs().find((tb) => inRect(p, tb.rect));
  if (t) return { action: 'tab', category: t.category };
  const r = storeRows(tab).find((rw) => inRect(p, rw.button));
  if (r) return { action: 'buy', id: r.item.id };
  return null;
}

// Leaderboard (ZR-20): three tabs (ZR-23 added this week) and a list of
// rows that scrolls between LEADERBOARD_ROW_Y and LEADERBOARD_LIST_BOTTOM
// (ZR-60).
export const LEADERBOARD_ROW_Y = 150;
export const LEADERBOARD_ROW_H = 36;
export const LEADERBOARD_LIST_BOTTOM = 578; // just above the back buttons
export const LEADERBOARD_GAP = 24; // space for "…" before the player's own row

export function leaderboardTabs() {
  const w = (W - 24 - 2 * 8) / 3;
  return ['global', 'weekly', 'friends'].map((scope, i) => ({ scope, rect: { x: 12 + i * (w + 8), y: TAB_Y, w, h: TAB_H } }));
}

// On the friends tab the back button moves left to make room (ZR-21).
export const LEADERBOARD_BACK_LEFT = { x: 30, y: 588, w: 140, h: 38 };
export const LEADERBOARD_FRIENDS_BUTTON = { x: 190, y: 588, w: 140, h: 38 };

// Friends screen (ZR-21)
export const FRIEND_SHARE = { x: 30, y: 210, w: W - 60, h: 48 };
export const FRIEND_FIELD = { x: 30, y: 300, w: W - 60, h: 52 };
export const FRIEND_ADD = { x: W / 2 - 70, y: 366, w: 140, h: 44 };

// What a tap at point p hits on the leaderboard screen.
export function leaderboardHit(p, tab = 'global') {
  if (tab === 'friends') {
    if (inRect(p, LEADERBOARD_BACK_LEFT)) return { action: 'back' };
    if (inRect(p, LEADERBOARD_FRIENDS_BUTTON)) return { action: 'friends' };
  } else if (inRect(p, STORE_BACK_BUTTON)) {
    return { action: 'back' };
  }
  const hit = leaderboardTabs().find((tb) => inRect(p, tb.rect));
  return hit ? { action: 'tab', scope: hit.scope } : null;
}
