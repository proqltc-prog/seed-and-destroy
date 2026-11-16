// Leaderboards (ZR-20): the global board and the friends board, opened from
// the home screen. Pure game logic; the rows come from the server (sync.js).
import { leaderboardHit, listTop, LEADERBOARD_ROW_H, LEADERBOARD_LIST_BOTTOM, LEADERBOARD_GAP } from './ui.js';
import { emptyFriends, confirmFriend } from './friends.js';

export const LEADERBOARD_SCOPES = ['global', 'weekly', 'friends'];
export const LEADERBOARD_SIZE = 25; // rows shown per board (ZR-60)

// Opens the board on the given tab and asks for its rows.
// The friends tab starts with an empty friends panel (ZR-82).
export function openLeaderboard(s, tab = 'global') {
  s.state = 'leaderboard';
  s.leaderboard = { tab, status: 'loading', top: [], me: null, scroll: 0 };
  if (tab === 'friends') s.friends = emptyFriends();
  return 'leaderboard';
}

// A tap on the leaderboard screen: back home, switch tab (which loads that
// board) or, on the friends tab, share the code, type a code or add the
// friend (ZR-82). Returns 'leaderboard' when rows must be fetched, or
// 'share', 'focus-friend' or 'add-friend'.
const FRIEND_ACTIONS = { share: () => 'share', field: () => 'focus-friend', add: confirmFriend };

export function leaderboardPress(s, point) {
  const hit = point ? leaderboardHit(point, s.leaderboard.tab) : null;
  if (!hit) return undefined;
  if (hit.action === 'back') {
    s.state = 'start';
    return undefined;
  }
  if (FRIEND_ACTIONS[hit.action]) return FRIEND_ACTIONS[hit.action](s);
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

// Height of the visible list: shorter on the friends tab, below the
// friends panel (ZR-82).
export function leaderboardViewHeight(board) {
  return LEADERBOARD_LIST_BOTTOM - listTop(board.tab);
}

// How far the list can scroll: 0 when everything fits.
export function maxLeaderboardScroll(board) {
  return Math.max(leaderboardContentHeight(board) - leaderboardViewHeight(board), 0);
}

// Scrolls the open leaderboard by dy pixels (positive = further down the
// list), kept within the list. Returns true when a leaderboard is open.
export function scrollLeaderboard(s, dy) {
  if (s.state !== 'leaderboard') return false;
  const board = s.leaderboard;
  board.scroll = Math.min(Math.max((board.scroll ?? 0) + dy, 0), maxLeaderboardScroll(board));
  return true;
}
