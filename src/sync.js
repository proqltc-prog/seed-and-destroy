// Game progress on the server (ZR-33). Once connected, the server is the
// source of truth for credits, owned items, active items and best score; the
// game state follows every server answer. Offline nothing here changes the
// game: every function resolves to null without a connection.
import { syncProfile } from './backend.js';
import { normalizeOwned, normalizeEquipped } from './shop.js';
import { STORE_MESSAGES, STORE_MESSAGE_TIME } from './logic.js';
import { reopenName } from './onboarding.js';
import { LEADERBOARD_SIZE } from './leaderboard.js';
import { showToast } from './logic.js';
import { t } from './i18n.js';

// Server answers about a username and the message shown for each (ZR-25).
export const NAME_PROBLEMS = { taken: 'nameTaken', blocked: 'nameBlocked' };

// Takes over the server's state. During a run the credits of that run are
// not on the server yet, so they are kept on top.
export function applyServerState(s, state) {
  s.credits = state.credits + (s.state === 'play' ? s.runCredits : 0);
  s.best = state.best;
  s.owned = normalizeOwned(state.owned);
  s.equipped = normalizeEquipped(state.equipped, s.owned);
  if (state.friend_code) s.friendCode = state.friend_code;
}

// Checks the username, registers the player, imports existing local
// progress once, and then follows the server. Returns the server state, or
// null when offline, younger than 13, or when the username is refused (the
// name screen then opens with the reason).
export async function connect(backend, s) {
  if (!s.name || s.age !== 'ok') return null;
  const status = await backend.call('username_status', { p_username: s.name });
  if (NAME_PROBLEMS[status]) {
    reopenName(s, NAME_PROBLEMS[status]);
    return null;
  }
  let state = await syncProfile(backend, s);
  if (!state) return null;
  if (!state.imported) {
    const result = await backend.call('import_progress', { p_credits: s.credits, p_owned: s.owned, p_best: s.best });
    state = result?.state ?? state;
  }
  applyServerState(s, state);
  s.online = true;
  return state;
}

// Sends a finished run. The server pays the credits (with the streak bonus,
// ZR-23), keeps the best score and pays today's challenge once it is done.
export async function submitRun(backend, s) {
  if (!s.online) return null;
  const result = await backend.call('submit_run', {
    p_score: s.score, p_gates: s.gatesPassed, p_duration_ms: Math.round(s.playTime * 1000), p_bonus: s.streakBonus, p_extra: s.extraCredits ?? 0,
  });
  if (result?.status !== 'accepted') return result;
  applyServerState(s, result.state);
  if (result.challenge) s.challenge = result.challenge;
  if (result.challenge_paid) showToast(s, 'challengePaid', { n: result.challenge.reward });
  return result;
}

// Claims the daily reward (ZR-23) once a day and says how much it was.
export async function claimDaily(backend, s) {
  if (!s.online) return null;
  const result = await backend.call('claim_daily');
  if (result?.status !== 'granted') return result;
  applyServerState(s, result.state);
  showToast(s, 'dailyReward', { day: result.day, n: result.credits });
  return result;
}

// Loads today's challenge and the progress for the home screen (ZR-23).
export async function fetchChallenge(backend, s) {
  if (!s.online) return null;
  const result = await backend.call('today_challenge');
  if (result) s.challenge = result;
  return result;
}

// Repeats a purchase on the server. When the server refuses it (not enough
// credits there) the game follows the server and says so.
export async function buyOnServer(backend, s, id) {
  if (!s.online) return null;
  const result = await backend.call('buy_item', { p_item: id });
  if (result?.state) applyServerState(s, result.state);
  if (result?.status === 'too-expensive') {
    s.store.message = STORE_MESSAGES['too-expensive'];
    s.store.messageTime = STORE_MESSAGE_TIME;
  }
  return result;
}

// Repeats choosing an active item on the server.
export async function equipOnServer(backend, s, id) {
  if (!s.online) return null;
  const result = await backend.call('equip_item', { p_item: id });
  if (result?.state) applyServerState(s, result.state);
  return result;
}

// Asks the server for a new recovery code (ZR-25) and shows it.
export async function fetchRecoveryCode(backend, s) {
  const result = s.online ? await backend.call('create_recovery_code') : null;
  s.recovery = result?.code ? { status: 'ready', code: result.code } : { status: 'offline', code: '' };
  return result;
}

// Restore results and the message shown for each.
export const RESTORE_MESSAGES = { restored: 'restoreOk', invalid: 'restoreInvalid', limit: 'restoreLimit' };

// Moves the account of a recovery code to this device and follows it.
export async function restoreAccount(backend, s) {
  const result = s.online ? await backend.call('restore_account', { p_code: s.restore.draft }) : null;
  s.restore.status = RESTORE_MESSAGES[result?.status] ?? 'offline';
  if (result?.status === 'restored') {
    applyServerState(s, result.state);
    s.name = result.state.username;
  }
  return result;
}

// Loads the rows of the open leaderboard tab (ZR-20). Players under 13 have
// no leaderboard; offline the screen says so. An answer for a tab that is no
// longer open is ignored.
export async function fetchLeaderboard(backend, s) {
  const board = s.leaderboard;
  if (s.age !== 'ok') {
    board.status = 'young';
    return null;
  }
  const result = s.online ? await backend.call('leaderboard', { p_scope: board.tab, p_limit: LEADERBOARD_SIZE }) : null;
  if (s.leaderboard !== board) return result;
  if (result) Object.assign(board, { status: 'ready', top: result.top, me: result.me });
  else board.status = 'offline';
  return result;
}

// Add-friend results and the message shown for each (ZR-21).
export const FRIEND_MESSAGES = {
  added: 'friendAdded', already: 'friendAlready', unknown: 'friendUnknown', self: 'friendSelf', limit: 'friendLimit',
};

// Adds a friend by code; the friends screen shows the result.
export async function addFriend(backend, s, code) {
  const result = s.online ? await backend.call('add_friend', { p_code: code }) : null;
  if (s.friends) {
    s.friends.status = FRIEND_MESSAGES[result?.status] ?? 'offline';
    s.friends.name = result?.username ?? '';
  }
  return result;
}

// Accepts the invite of a share link (?friend=CODE) once online, with a
// message on the home screen. Returns true when the invite is handled.
export async function acceptInvite(backend, s) {
  if (!s.pendingFriend || !s.online) return false;
  const result = await backend.call('add_friend', { p_code: s.pendingFriend });
  if (!result) return false;
  if (result.status === 'added' || result.status === 'already') showToast(s, 'friendAdded', { name: result.username });
  s.pendingFriend = null;
  return true;
}

// Shows the inviter's new referral rewards (ZR-22): a friend they invited is
// now active, and they received a skin (already in the owned items from the
// server) or credits. One message, for the first new reward.
export async function claimRewards(backend, s) {
  if (!s.online) return null;
  const rewards = await backend.call('claim_referral_rewards');
  if (!rewards?.length) return rewards ?? null;
  const { username, item, credits } = rewards[0];
  showToast(s, 'referralReward', { name: username, reward: rewardLabel(s.lang, item, credits) });
  return rewards;
}

// The reward in words: the skin's name, or the number of credits.
export function rewardLabel(lang, item, credits) {
  return item ? t(lang, item) : t(lang, 'creditsReward', { n: credits });
}
