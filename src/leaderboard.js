// Leaderboards (ZR-20): the global board and the friends board, opened from
// the home screen. Pure game logic; the rows come from the server (sync.js).
import { leaderboardHit, LEADERBOARD_ROW_Y, LEADERBOARD_ROW_H, LEADERBOARD_LIST_BOTTOM, LEADERBOARD_GAP } from './ui.js';
import { openFriends } from './friends.js';

export const LEADERBOARD_SCOPES = ['global', 'weekly', 'friends'];
export const LEADERBOARD_SIZE = 25; // rows shown per board (ZR-60)

// Opens the board on the given tab and asks for its rows.
export function openLeaderboard(s, tab = 'global') {
  s.state = 'leaderboard';
  s.leaderboard = { tab, status: 'loading', top: [], me: null, scroll: 0 };
  return 'leaderboard';
}

// A tap on the leaderboard screen: back home, or switch tab (which loads
// that board). Returns 'leaderboard' when rows must be fetched.
export function leaderboardPress(s, point) {
  const hit = point ? leaderboardHit(point, s.leaderboard.tab) : null;
  if (!hit) return undefined;
  if (hit.action === 'back') {
    s.state = 'start';
    return undefined;
  }
  if (hit.action === 'friends') {
    openFriends(s);
    return undefined;
  }
  if (hit.scope === s.leaderboard.tab) return undefined;
  return openLeaderboard(s, hit.scope);
}

// True when the player's own row is shown below the top rows.
export function showsOwnRow(board) {
  return Boolean(board.me) && !board.top.some((row) => row.me);
}

// Height of the scrolling list: the rows, plus "…" and the player's own
// row when they are not in the top (ZR-60).
export function leaderboardContentHeight(board) {
  if (board.status !== 'ready') return 0;
  const own = showsOwnRow(board) ? LEADERBOARD_GAP + LEADERBOARD_ROW_H : 0;
  return board.top.length * LEADERBOARD_ROW_H + own;
}

export const LEADERBOARD_VIEW_H = LEADERBOARD_LIST_BOTTOM - LEADERBOARD_ROW_Y;

// How far the list can scroll: 0 when everything fits.
export function maxLeaderboardScroll(board) {
  return Math.max(leaderboardContentHeight(board) - LEADERBOARD_VIEW_H, 0);
}

// Scrolls the open leaderboard by dy pixels (positive = further down the
// list), kept within the list. Returns true when a leaderboard is open.
export function scrollLeaderboard(s, dy) {
  if (s.state !== 'leaderboard') return false;
  const board = s.leaderboard;
  board.scroll = Math.min(Math.max((board.scroll ?? 0) + dy, 0), maxLeaderboardScroll(board));
  return true;
}
