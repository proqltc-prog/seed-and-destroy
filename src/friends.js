// Friends (ZR-21): show your friend code, share an invite link, and add a
// friend by code. Pure game logic; the server calls are in sync.js.
import { inRect, STORE_BACK_BUTTON, FRIEND_SHARE, FRIEND_FIELD, FRIEND_ADD } from './ui.js';
import { openLeaderboard } from './leaderboard.js';

export const FRIEND_CODE_LENGTH = 8;

export function openFriends(s) {
  s.state = 'friends';
  s.friends = { draft: '', status: '', name: '' };
}

// The typed code: capitals and digits only, never longer than a code.
export function setFriendDraft(s, text) {
  s.friends.draft = text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, FRIEND_CODE_LENGTH);
  s.friends.status = '';
}

// Checks the typed code before it goes to the server.
export function confirmFriend(s) {
  if (s.friends.draft.length !== FRIEND_CODE_LENGTH) {
    s.friends.status = 'friendUnknown';
    return undefined;
  }
  s.friends.status = 'loading';
  return 'add-friend';
}

// A tap on the friends screen. Returns 'share', 'focus-friend',
// 'add-friend' or 'leaderboard' (back to the friends board, which reloads).
export function friendsPress(s, point) {
  if (!point) return undefined;
  if (inRect(point, STORE_BACK_BUTTON)) return openLeaderboard(s, 'friends');
  if (inRect(point, FRIEND_SHARE)) return 'share';
  if (inRect(point, FRIEND_FIELD)) return 'focus-friend';
  if (inRect(point, FRIEND_ADD)) return confirmFriend(s);
  return undefined;
}
