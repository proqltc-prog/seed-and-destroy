// First launch (ZR-16): choose a language, answer the age question (ZR-25),
// choose a username, then a short intro that can be skipped. Settings (ZR-17)
// reuse the language and name screens: `s.flow` tells where they lead next.
// The settings also show and enter the recovery code (ZR-25). Pure game logic.
import {
  inRect, NAME_FIELD, NAME_CONTINUE, INTRO_SKIP, languageHit, STORE_BACK_BUTTON, SETTINGS_LANG, SETTINGS_NAME,
  SETTINGS_RECOVERY, SETTINGS_RESTORE, SETTINGS_PRIVACY, AGE_YES, AGE_NO, PRIVACY_LINK, CODE_FIELD, CODE_CONFIRM,
} from './ui.js';

export const NAME_MIN = 3;
export const NAME_MAX = 16;
export const INTRO_PAGES = 3;
export const ONBOARDING_STATES = ['lang', 'age', 'name', 'intro'];
export const RECOVERY_STATES = ['recovery', 'restore'];
// Players younger than this play without online functions (no account,
// no username on the server).
export const MIN_ONLINE_AGE = 13;
export const CODE_LENGTH = 12; // recovery code without dashes

// 3 to 16 letters (any script, including combining marks such as Hindi
// vowel signs), digits, spaces, '_' or '-'.
export function isValidName(name) {
  return new RegExp(`^[\\p{L}\\p{M}\\p{N} _-]{${NAME_MIN},${NAME_MAX}}$`, 'u').test(name.trim());
}

export function startOnboarding(s) {
  s.flow = 'onboarding';
  s.state = 'lang';
  s.nameDraft = s.name;
  s.nameError = false;
  s.introPage = 0;
}

// A returning player who never answered the age question gets it once.
export function startAgeCheck(s) {
  s.flow = 'age-check';
  s.state = 'age';
}

// The server refused the username (taken or blocked): back to the name
// screen with that message, but never in the middle of a run.
export function reopenName(s, errorKey) {
  if (s.state === 'play' || s.state === 'dead') return false;
  s.flow = s.onboarded ? 'settings' : 'onboarding';
  s.state = 'name';
  s.nameDraft = s.name;
  s.nameError = errorKey;
  return true;
}

// What the player typed so far, never longer than allowed.
export function setNameDraft(s, text) {
  s.nameDraft = text.slice(0, NAME_MAX);
  s.nameError = false;
}

export function confirmName(s) {
  const name = s.nameDraft.trim();
  if (!isValidName(name)) {
    s.nameError = true;
    return undefined;
  }
  s.name = name;
  if (s.flow === 'settings') {
    s.state = 'settings';
  } else {
    s.state = 'intro';
    s.introPage = 0;
  }
  return 'name';
}

function finish(s) {
  s.onboarded = true;
  s.state = 'start';
  return 'onboarded';
}

// A tap (with `point`) or key (without) during onboarding. Returns what
// changed: 'lang', 'name', 'onboarded', or 'focus-name' when the name field
// was tapped so the keyboard can open.
export function onboardingPress(s, point) {
  // From the settings, the language and name screens have a back button.
  if (s.flow === 'settings' && point && inRect(point, STORE_BACK_BUTTON)) {
    s.state = 'settings';
    return undefined;
  }
  if (s.state === 'lang') {
    const code = point ? languageHit(point) : null;
    if (!code) return undefined;
    s.lang = code;
    s.state = s.flow === 'settings' ? 'settings' : 'age';
    return 'lang';
  }
  if (s.state === 'age') return agePress(s, point);
  if (s.state === 'name') {
    if (!point) return undefined;
    if (inRect(point, NAME_FIELD)) return 'focus-name';
    if (inRect(point, NAME_CONTINUE)) return confirmName(s);
    return undefined;
  }
  if (point && inRect(point, INTRO_SKIP)) return finish(s);
  s.introPage++;
  return s.introPage >= INTRO_PAGES ? finish(s) : undefined;
}

// The age question: 13 or older plays online, younger plays offline only.
function agePress(s, point) {
  if (!point) return undefined;
  if (inRect(point, PRIVACY_LINK)) return 'privacy';
  const answer = (inRect(point, AGE_YES) && 'ok') || (inRect(point, AGE_NO) && 'young');
  if (!answer) return undefined;
  s.age = answer;
  if (s.flow === 'age-check') {
    s.flow = null;
    s.state = 'start';
  } else {
    s.state = 'name';
  }
  return 'age';
}

// Settings: change the language or the username later, or go back home.
export function openSettings(s) {
  s.flow = 'settings';
  s.state = 'settings';
}

export function settingsPress(s, point) {
  if (!point) return undefined;
  if (inRect(point, SETTINGS_LANG)) {
    s.state = 'lang';
  } else if (inRect(point, SETTINGS_NAME)) {
    s.nameDraft = s.name;
    s.nameError = false;
    s.state = 'name';
  } else if (inRect(point, SETTINGS_RECOVERY)) {
    s.state = 'recovery';
    s.recovery = { status: 'loading', code: '' };
    return 'recovery';
  } else if (inRect(point, SETTINGS_RESTORE)) {
    s.state = 'restore';
    s.restore = { draft: '', status: '' };
  } else if (inRect(point, SETTINGS_PRIVACY)) {
    return 'privacy';
  } else if (inRect(point, STORE_BACK_BUTTON)) {
    s.flow = null;
    s.state = 'start';
  }
  return undefined;
}

// The recovery code as typed: capitals, never longer than XXXX-XXXX-XXXX.
export function setCodeDraft(s, text) {
  s.restore.draft = text.toUpperCase().slice(0, CODE_LENGTH + 2);
  s.restore.status = '';
}

// Checks the typed code before it goes to the server.
export function confirmRestore(s) {
  if (s.restore.draft.replace(/[^A-Z0-9]/g, '').length !== CODE_LENGTH) {
    s.restore.status = 'restoreInvalid';
    return undefined;
  }
  s.restore.status = 'loading';
  return 'restore';
}

// The recovery screens: show the code, or enter a code from another device.
// Returns 'focus-code' when the code field was tapped, 'restore' to send it.
export function recoveryPress(s, point) {
  if (!point) return undefined;
  if (inRect(point, STORE_BACK_BUTTON)) {
    s.state = 'settings';
    return undefined;
  }
  if (s.state !== 'restore') return undefined;
  if (inRect(point, CODE_FIELD)) return 'focus-code';
  if (inRect(point, CODE_CONFIRM)) return confirmRestore(s);
  return undefined;
}
