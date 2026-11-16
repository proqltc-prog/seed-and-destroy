// Browser wiring: canvas scaling, input and the animation loop.
// All browser objects are passed in, so this module is unit testable too.
import { connectApp } from './app.js';
import { initAds, watchAd, watchGateAd, refreshRunsDay, refreshAdWait, openAdPrivacy, watchReviveAd } from './ads.js';
import { W, H, MAX_DPR, MAX_DT, GAME_NAME, WEB_URL, PLAY_URL } from './config.js';
import { createGame, press, update, isPressKey } from './logic.js';
import { draw } from './render.js';
import {
  getStorage, clearAll, loadBest, saveBest, loadCredits, saveCredits, loadOwned, saveOwned, loadEquipped, saveEquipped,
  loadLang, saveLang, loadProfile, saveName, saveOnboarded, saveAge, loadRuns, saveRuns, loadRunsDay, saveRunsDay,
  loadSwitch, saveSwitch, SOUND_KEY,
} from './storage.js';
import { createFeedback } from './sound.js';
import { setNameDraft, confirmName, setCodeDraft, confirmRestore, NAME_MAX } from './onboarding.js';
import { setFriendDraft, confirmFriend, FRIEND_CODE_LENGTH } from './friends.js';
import { scrollLeaderboard } from './leaderboard.js';

import { isLanguage, detectLanguage, t } from './i18n.js';
import { createBackend, syncProfile } from './backend.js';
import {
  connect, checkName, deleteAccount, submitRun, buyOnServer, equipOnServer, fetchRecoveryCode, restoreAccount, fetchLeaderboard,
  addFriend, acceptInvite, claimRewards, claimDaily, fetchChallenge,
} from './sync.js';

// Fonts stored next to index.html (ZR-35), loaded in the background. Canvas
// text uses them as soon as they are ready; until then the system font.
export const FONT_FILES = [{ family: 'Lucky', url: 'fonts/LuckiestGuy-Regular.ttf' }];

export function loadFonts(win) {
  if (!win.FontFace || !win.document?.fonts) return Promise.resolve([]);
  return Promise.all(FONT_FILES.map((f) => new win.FontFace(f.family, `url(${f.url})`).load()
    .then((face) => {
      win.document.fonts.add(face);
      return face;
    })
    .catch(() => null)));
}

// The friend code of a share link (?friend=CODE), or null (ZR-21).
export function inviteCode(win) {
  const code = new URLSearchParams(win.location?.search ?? '').get('friend')?.toUpperCase() ?? '';
  return new RegExp(`^[A-Z0-9]{${FRIEND_CODE_LENGTH}}$`).test(code) ? code : null;
}

// True inside the Android app (Capacitor), false in a browser (ZR-40).
export function isApp(win) {
  return win.Capacitor?.isNativePlatform?.() === true;
}

// The privacy page: in the app the public page, opened outside the app.
export function privacyUrl(win) {
  return isApp(win) ? `${WEB_URL}${PRIVACY_URL}` : PRIVACY_URL;
}

// Shares the invite (ZR-82): the friend code and the Google Play link,
// never the web version. In the app the phone's share sheet of the Share
// plugin; in a browser its share sheet. Without one, or when it fails, the
// text is copied; when copying is not allowed either, the panel shows the
// code to pass on by hand (ZR-86), so "Delen" never ends in only an error.
// A cancelled share sheet is not an error. The friends panel shows the result.
const cancelled = (e) => /cancel|abort/i.test(`${e?.name ?? ''} ${e?.message ?? ''}`);

// The older way of copying, for pages without clipboard permission: select
// the text in a hidden field and copy it. Returns true when it worked.
export function copyByCommand(doc, text) {
  if (!doc?.createElement || !doc.execCommand) return false;
  const field = doc.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  Object.assign(field.style, { position: 'fixed', top: '0', left: '0', opacity: '0' });
  doc.body.appendChild(field);
  let copied = false;
  try {
    field.select();
    copied = doc.execCommand('copy') === true;
  } catch (e) {
    copied = false;
  }
  field.remove();
  return copied;
}

// Copies the text: the clipboard first, then the older way. True when copied.
export async function copyText(win, text) {
  try {
    await win.navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    return copyByCommand(win.document, text);
  }
}

// Opens a share sheet when there is one. Returns 'shared', 'cancelled' or
// null (no share sheet, or it failed).
async function openShareSheet(win, s, text) {
  const plugin = win.Capacitor?.Plugins?.Share;
  try {
    if (plugin) {
      await plugin.share({ title: GAME_NAME, text, url: PLAY_URL, dialogTitle: t(s.lang, 'shareInvite') });
      return 'shared';
    }
    if (win.navigator?.share) {
      await win.navigator.share({ title: GAME_NAME, text, url: PLAY_URL });
      return 'shared';
    }
  } catch (e) {
    if (cancelled(e)) return 'cancelled';
  }
  return null;
}

export async function shareInvite(win, s) {
  if (!s.friendCode) {
    s.friends.status = 'offline';
    return;
  }
  const text = t(s.lang, 'shareText', { code: s.friendCode });
  if (await openShareSheet(win, s, text)) {
    s.friends.status = '';
    return;
  }
  s.friends.status = (await copyText(win, `${text} ${PLAY_URL}`)) ? 'linkCopied' : 'shareManual';
}

// The text field is shared by the name, recovery code and friend code
// screens: what typing and Enter do per screen.
const TEXT_FIELDS = {
  restore: { set: setCodeDraft, confirm: confirmRestore },
  leaderboard: { set: setFriendDraft, confirm: confirmFriend }, // friends tab (ZR-82)
};
const NAME_FIELD_MODE = { set: setNameDraft, confirm: confirmName };
export const fieldMode = (state) => TEXT_FIELDS[state] ?? NAME_FIELD_MODE;

// The text of the field per screen, after the screen cleaned it up.
const FIELD_TEXT = {
  name: (s) => s.nameDraft,
  restore: (s) => s.restore.draft,
  leaderboard: (s) => s.friends.draft,
};
// Only these screens have a text field; elsewhere the phone keyboard never
// shows (ZR-42).
export const TEXT_STATES = Object.keys(FIELD_TEXT);

// True while the screen shows a text field; on the leaderboard only the
// friends tab has one (ZR-82).
export function hasTextField(s) {
  if (s.state === 'leaderboard') return s.leaderboard.tab === 'friends';
  return TEXT_STATES.includes(s.state);
}

// The privacy policy (ZR-25), next to index.html.
export const PRIVACY_URL = 'privacy.html';

// The privacy page shown inside the game (ZR-42): a full-screen frame with
// the bundled privacy.html (Dutch or English part) and a back button. It
// works the same in the app, where opening a link did nothing, and in a browser.
export function makePrivacyView(doc, lang, onClose) {
  const view = doc.createElement('div');
  Object.assign(view.style, {
    position: 'fixed', inset: '0', zIndex: '10', display: 'flex', flexDirection: 'column',
    background: '#0b1d3a', padding: 'env(safe-area-inset-top) 0 env(safe-area-inset-bottom)',
  });
  const frame = doc.createElement('iframe');
  frame.src = `${PRIVACY_URL}#${lang === 'nl' ? 'nl' : 'en'}`;
  frame.title = t(lang, 'privacy');
  Object.assign(frame.style, { flex: '1', width: '100%', border: '0' });
  const back = doc.createElement('button');
  back.textContent = t(lang, 'back');
  Object.assign(back.style, {
    margin: '12px auto', padding: '10px 40px', border: '0', borderRadius: '10px',
    background: '#ffcc4d', color: '#0b1d3a', font: 'bold 16px system-ui, sans-serif',
  });
  back.addEventListener('click', onClose);
  view.appendChild(frame);
  view.appendChild(back);
  doc.body.appendChild(view);
  return view;
}

// The stored language, otherwise the browser's language if supported, otherwise English.
export function startLanguage(stored, win) {
  return isLanguage(stored) ? stored : detectLanguage(win.navigator?.language);
}

// The invisible text field for the username; null without a document.
export function makeNameInput(doc) {
  if (!doc) return null;
  const input = doc.createElement('input');
  input.type = 'text';
  input.maxLength = NAME_MAX;
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.inputMode = 'text';
  input.enterKeyHint = 'done';
  input.setAttribute('aria-label', 'username');
  input.setAttribute('dir', 'ltr');
  // No suggestions, autocorrect or capitals from the phone keyboard (ZR-42).
  input.setAttribute('autocapitalize', 'off');
  input.setAttribute('autocorrect', 'off');
  Object.assign(input.style, {
    // A normal-sized but invisible field: a 1 px field confuses phone keyboards.
    position: 'fixed', left: '0', top: '0', width: '100%', height: '40px', opacity: '0',
    fontSize: '16px', pointerEvents: 'none', color: 'transparent', caretColor: 'transparent', border: '0',
  });
  doc.body.appendChild(input);
  return input;
}

export function start({
  canvas, win, storage = getStorage(win), rng = Math.random,
  backend = createBackend({ fetch: win.fetch?.bind(win), storage }), clock = () => new Date(),
}) {
  const ctx = canvas.getContext('2d');

  // Support high-resolution screens
  function fitDPR() {
    const dpr = Math.min(win.devicePixelRatio || 1, MAX_DPR);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  fitDPR();
  win.addEventListener('resize', fitDPR);
  const fonts = loadFonts(win);

  const s = createGame(
    rng, loadBest(storage), loadCredits(storage), loadOwned(storage), loadEquipped(storage),
    startLanguage(loadLang(storage), win), loadProfile(storage),
  );
  s.pendingFriend = inviteCode(win);
  s.runsPlayed = loadRuns(storage); // runs since the last unlock video (ZR-43)
  s.runsDay = loadRunsDay(storage);
  // Sound effects (ZR-102), as switched in the settings.
  s.sound = loadSwitch(storage, SOUND_KEY);
  const feedback = createFeedback(win, rng);
  // At midnight the count starts again; the countdowns follow the clock.
  function followClock() {
    const date = clock();
    refreshAdWait(s, date.getTime()); // until the next credit video (ZR-67)
    if (!refreshRunsDay(s, date)) return;
    saveRuns(storage, s.runsPlayed);
    saveRunsDay(storage, s.runsDay);
  }
  followClock();

  // Keeps the local copy of the progress in line with the game state.
  function saveProgress() {
    saveCredits(storage, s.credits);
    saveBest(storage, s.best);
    saveOwned(storage, s.owned);
    saveEquipped(storage, s.equipped);
  }

  // Connects to the server in the background; the game never waits. Once
  // connected the server's progress is used and saved locally.
  function goOnline() {
    return connect(backend, s).then(async (state) => {
      if (!state) return;
      saveProgress();
      // An invite link adds the friend once online; then the link is cleaned up.
      if (await acceptInvite(backend, s)) win.history?.replaceState(null, '', win.location.pathname);
      // Rewards for friends who became active (ZR-22).
      const rewards = await claimRewards(backend, s);
      if (rewards?.length) await connect(backend, s).then((fresh) => fresh && saveProgress());
      // Daily reward and today's challenge (ZR-23).
      followServer(await claimDaily(backend, s));
      await fetchChallenge(backend, s);
      // Rewarded ads in the Android app (ZR-14).
      if (!s.ads) await initAds(win, backend, s, clock().getTime());
    });
  }
  const ready = goOnline();

  // Saves the progress locally when the server sent its new state.
  function followServer(result) {
    if (result?.state) saveProgress();
  }

  // A hidden text field, so phones open their keyboard for the username.
  const input = makeNameInput(win.document);
  // The same field is used for the recovery code on the restore screen.
  // Puts the cursor at the end of the field, where the screen shows it.
  function cursorToEnd() {
    const end = input.value.length;
    input.setSelectionRange?.(end, end);
  }
  // Typing: the screen takes the text. While the phone keyboard is still
  // composing a word the field is left alone; changing it then would move the
  // cursor to the start, so letters came out right to left (ZR-42). Only when
  // the screen cleaned the text up (e.g. capitals in a code) the field
  // follows, with the cursor at the end.
  function onType(e) {
    fieldMode(s.state).set(s, input.value);
    if (e?.isComposing) return;
    const shown = FIELD_TEXT[s.state]?.(s);
    if (shown === undefined || shown === input.value) return;
    input.value = shown;
    cursorToEnd();
  }
  input?.addEventListener('input', onType);
  input?.addEventListener('compositionend', onType);
  // The privacy page in the game; without a document (tests) in a new tab.
  let privacyView = null;
  function showPrivacy() {
    if (!win.document) {
      win.open?.(privacyUrl(win), '_blank', 'noopener');
      return;
    }
    privacyView = makePrivacyView(win.document, s.lang, closePrivacy);
    s.privacyOpen = true;
  }
  function closePrivacy() {
    privacyView?.remove();
    privacyView = null;
    s.privacyOpen = false;
  }
  // Opens the phone keyboard on the field with the screen's text.
  function focusField(text) {
    input.value = text;
    input.focus();
    cursorToEnd();
  }
  // Hides the phone keyboard once the screen has no text field (ZR-42).
  function hideKeyboard() {
    if (input && win.document.activeElement === input && !hasTextField(s)) input.blur();
  }
  input?.addEventListener('keydown', (e) => {
    // Keys typed in the text field never reach the game itself.
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      apply(fieldMode(s.state).confirm(s));
    }
  });

  // Saves or reacts to whatever a tap or key changed.
  function apply(changed) {
    if (changed === 'purchase') {
      saveCredits(storage, s.credits);
      saveOwned(storage, s.owned);
      buyOnServer(backend, s, s.store.lastId).then(followServer);
    }
    if (changed === 'equip') {
      saveEquipped(storage, s.equipped);
      equipOnServer(backend, s, s.store.lastId).then(followServer);
    }
    if (changed === 'lang') {
      saveLang(storage, s.lang);
      syncProfile(backend, s);
    }
    if (changed === 'name') {
      saveName(storage, s.name);
      input?.blur();
      goOnline();
    }
    // Deleting the account (ZR-89): when the server removed it, everything
    // on the device is forgotten too and the game starts as new.
    if (changed === 'delete-account') {
      deleteAccount(backend, s).then((result) => {
        if (result !== 'deleted') {
          s.deletion.status = 'deleteFailed';
          return;
        }
        clearAll(storage);
        win.location.reload();
      });
    }
    // The name is checked on the server before the screen moves on (ZR-83).
    if (changed === 'check-name') checkName(backend, s).then(apply);
    if (changed === 'swim') feedback.stroke(s); // a soft splash per tap (ZR-102)
    // Switching the sound on gives a sample right away (ZR-102).
    if (changed === 'sound') {
      saveSwitch(storage, SOUND_KEY, s.sound);
      if (s.sound) feedback.splash('hit');
    }
    if (changed === 'onboarded') saveOnboarded(storage);
    if (changed === 'focus-name' && input) focusField(s.nameDraft);
    if (changed === 'focus-code' && input) focusField(s.restore.draft);
    if (changed === 'focus-friend' && input) focusField(s.friends.draft);
    if (changed === 'share') shareInvite(win, s);
    if (changed === 'add-friend') {
      input?.blur();
      // A new friend shows up on the friends board right away (ZR-82).
      addFriend(backend, s, s.friends.draft).then((result) => {
        if (result?.status === 'added' && s.state === 'leaderboard' && s.leaderboard.tab === 'friends') {
          fetchLeaderboard(backend, s);
        }
      });
    }
    if (changed === 'age') {
      saveAge(storage, s.age);
      goOnline();
    }
    if (changed === 'watch-ad') watchAd(win, backend, s, { now: () => clock().getTime() }).then(followServer);
    if (changed === 'watch-revive') watchReviveAd(win, s);
    if (changed === 'run') saveRuns(storage, s.runsPlayed);
    if (changed === 'watch-gate-ad') watchGateAd(win, s).then((done) => done && saveRuns(storage, s.runsPlayed));
    if (changed === 'privacy') showPrivacy();
    if (changed === 'ad-privacy') openAdPrivacy(win);
    if (changed === 'close-privacy') closePrivacy();
    if (changed === 'recovery') fetchRecoveryCode(backend, s);
    if (changed === 'leaderboard') fetchLeaderboard(backend, s);
    if (changed === 'restore') {
      input?.blur();
      restoreAccount(backend, s).then((result) => {
        if (result?.status !== 'restored') return;
        saveName(storage, s.name);
        saveProgress();
      });
    }
  }

  // Screen position of a pointer event in game coordinates.
  function toGame(e) {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * W) / r.width, y: ((e.clientY - r.top) * H) / r.height };
  }

  // A finger or mouse held down on the leaderboard drags the list (ZR-60).
  let dragY = null;
  function onPointerDown(e) {
    e.preventDefault();
    feedback.unlock(); // sound is only allowed after a tap (ZR-102)
    const point = toGame(e);
    dragY = s.state === 'leaderboard' ? point.y : null;
    apply(press(s, rng, point));
  }
  function onPointerMove(e) {
    if (dragY === null) return;
    const { y } = toGame(e);
    if (scrollLeaderboard(s, dragY - y)) dragY = y;
    else dragY = null;
  }
  function onPointerUp() {
    dragY = null;
  }
  function onWheel(e) {
    if (scrollLeaderboard(s, e.deltaY)) e.preventDefault();
  }
  function onKeyDown(e) {
    // While typing a username the keys belong to the text field.
    if (s.state !== 'name' && isPressKey(e.code)) {
      e.preventDefault();
      feedback.unlock();
      apply(press(s, rng));
    }
  }
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  win.addEventListener('keydown', onKeyDown);
  // In the Android app the system back button walks back (ZR-40).
  const app = connectApp(win, s, rng, apply);

  let last = win.performance.now();
  function frame(now) {
    const dt = Math.min((now - last) / 1000, MAX_DT);
    last = now;
    const ended = update(s, dt, rng);
    if (s.impact) {
      feedback.impact(s, s.impact);
      s.impact = null;
    }
    if (ended) {
      saveCredits(storage, s.credits);
      if (s.newBest) saveBest(storage, s.best);
      submitRun(backend, s).then(followServer);
    }
    hideKeyboard();
    followClock();
    draw(ctx, s);
    win.requestAnimationFrame(frame);
  }
  win.requestAnimationFrame(frame);

  return { state: s, frame, fitDPR, onPointerDown, onKeyDown, input, backend, ready, fonts, app, feedback };
}
