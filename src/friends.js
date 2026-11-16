// Friends (ZR-21, ZR-82): the friend code typed on the friends tab of the
// leaderboard. Pure game logic; the server calls are in sync.js.
export const FRIEND_CODE_LENGTH = 8;

// A fresh friends panel: nothing typed, no message.
export function emptyFriends() {
  return { draft: '', status: '', name: '' };
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
