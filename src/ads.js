// Rewarded ads (ZR-14/15). In the Android app the AdMob plugin shows a
// video; when it was watched to the end the server pays the reward (at most
// AD_DAILY per day, one every AD_COOLDOWN, ZR-67). In a browser, offline, or for players under 13 there are
// no ads at all and the ad buttons are not shown.
import { AD_REWARD, AD_DAILY, AD_COOLDOWN, AD_LIVE, AD_TEST_UNIT, AD_LIVE_UNITS, AD_GATE_RUNS } from './config.js';
import { applyServerState } from './sync.js';
import { showToast, readyRevive, declineRevive } from './logic.js';

// The ad unit for a kind of video ('credits', 'gate' or 'revive'): the owner's live
// unit in the Play Store build, Google's test unit otherwise (ZR-46).
export function adUnit(kind, live = AD_LIVE) {
  return live ? AD_LIVE_UNITS[kind] : AD_TEST_UNIT;
}

// The AdMob plugin inside the Android app, or null.
export function adPlugin(win) {
  return win.Capacitor?.Plugins?.AdMob ?? null;
}

// True when an ad button may be shown at all (ads ready, 13+, online).
export function adsShown(s) {
  return Boolean(s.ads?.ready) && s.age === 'ok' && Boolean(s.online);
}

// True when an ad can be watched now: shown, ads left today, no waiting
// time (ZR-67) and none running.
export function adAvailable(s) {
  return adsShown(s) && s.ads.left > 0 && !(s.ads.wait > 0) && s.ads.status === 'idle';
}

// The waiting time until the next credit video (ZR-67), from the moment it
// becomes available; kept up to date from the clock, so it also runs on
// while the app is in the background.
export function refreshAdWait(s, now) {
  if (!s.ads?.nextAt) return;
  s.ads.wait = Math.max(s.ads.nextAt - now, 0);
}

// Starts the waiting time after a paid credit video.
export function startAdWait(s, now) {
  s.ads.nextAt = now + AD_COOLDOWN;
  s.ads.wait = AD_COOLDOWN;
}

// Asks Google's EU consent service whether the consent form is needed and
// shows it. A failure here (for example no consent message published in
// AdMob yet) must not hide the ads: the game goes on without the form
// (ZR-59). Returns whether the consent step worked and whether Google
// requires a way to change the choice later (ZR-68).
export async function askConsent(admob) {
  try {
    let consent = await admob.requestConsentInfo();
    if (consent?.isConsentFormAvailable && consent.status === 'REQUIRED') {
      consent = (await admob.showConsentForm()) ?? consent; // the answer updates the status
    }
    return { ok: true, privacy: consent?.privacyOptionsRequirementStatus === 'REQUIRED' };
  } catch {
    return { ok: false, privacy: false };
  }
}

// Opens Google's privacy options form, where the player changes the ad
// choice (personalised or not, ZR-68). Google uses the new choice for the
// next videos. Returns false when the form could not be shown.
export async function openAdPrivacy(win) {
  try {
    await adPlugin(win).showPrivacyOptionsForm();
    return true;
  } catch {
    return false;
  }
}

// Starts AdMob, then EU consent (Google's consent form, when needed), then
// the number of ads left today and the waiting time from the server.
// Players under 13 never get here. Returns true when ads are ready; only a
// failed AdMob start stops it.
export async function initAds(win, backend, s, now = Date.now()) {
  const admob = adPlugin(win);
  if (!admob || s.age !== 'ok' || !s.online) return false;
  try {
    await admob.initialize({ initializeForTesting: !AD_LIVE });
  } catch {
    return false;
  }
  const consent = await askConsent(admob);
  admob.addListener('onRewardedVideoAdReward', () => { s.ads.rewarded = true; });
  // The video is gone from the screen (ZR-79): closed, or it could not be shown.
  const closed = () => s.ads.closed?.();
  admob.addListener('onRewardedVideoAdDismissed', closed);
  admob.addListener('onRewardedVideoAdFailedToShow', closed);
  const status = await backend.call('ad_status');
  const wait = Math.max(status?.wait ?? 0, 0) * 1000; // the server counts in seconds
  s.ads = {
    ready: true, left: status?.left ?? AD_DAILY, status: 'idle', rewarded: false, userId: status?.id ?? null,
    wait, nextAt: now + wait, privacy: consent.privacy,
  };
  return true;
}

// The options for one rewarded video. In the Play Store build the player's
// id and the kind of video go to AdMob, which passes them to the server in
// its signed callback (server-side verification, ZR-51).
export function videoOptions(s, kind, live = AD_LIVE) {
  const options = { adId: adUnit(kind, live), isTesting: !live };
  // The revive pays nothing, so Google never confirms it to the server (ZR-69).
  if (live && s.ads.userId && kind !== 'revive') options.ssv = { userId: s.ads.userId, customData: kind };
  return options;
}

const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
export const SSV_TRIES = 5; // checks of the server after a watched video
export const SSV_DELAY = 1500; // ms between checks

// After a watched video in the Play Store build: Google pays through the
// server within seconds; the app checks the server a few times and follows
// the new credits. Returns the server status once paid, otherwise null
// (the credits then show up at the next start).
export async function awaitServerReward(backend, s, pause = wait) {
  const before = s.ads.left;
  for (let i = 0; i < SSV_TRIES; i++) {
    await pause(SSV_DELAY);
    const status = await backend.call('ad_status');
    if (status && status.left < before) {
      if (status.state) applyServerState(s, status.state);
      s.ads.left = status.left;
      return status;
    }
  }
  return null;
}

// Shows one rewarded ad and, when it was watched to the end, gets the
// reward from the server: in the Play Store build Google confirms it to the
// server (ZR-51); in test builds the app claims it itself. A failed or
// skipped ad pays nothing; the game says so.
export async function watchAd(win, backend, s, { live = AD_LIVE, pause = wait, now = () => Date.now() } = {}) {
  if (!adAvailable(s)) return null;
  const admob = adPlugin(win);
  s.ads.status = 'loading';
  s.ads.rewarded = false;
  let item = null;
  try {
    await admob.prepareRewardVideoAd(videoOptions(s, 'credits', live));
    item = await admob.showRewardVideoAd();
  } catch {
    s.ads.status = 'idle';
    showToast(s, 'adFailed');
    return null;
  }
  s.ads.status = 'idle';
  if (!s.ads.rewarded && !item?.amount) return null;
  // The waiting time starts once the video was watched, paid or not (ZR-67).
  startAdWait(s, now());
  if (live) {
    const paid = await awaitServerReward(backend, s, pause);
    showToast(s, paid ? 'adReward' : 'adPending', { n: AD_REWARD });
    return paid;
  }
  const result = await backend.call('claim_ad_reward');
  if (result?.state) applyServerState(s, result.state);
  if (typeof result?.left === 'number') s.ads.left = result.left;
  showToast(s, result?.status === 'granted' ? 'adReward' : 'adFailed', { n: AD_REWARD });
  return result;
}

// Every AD_GATE_RUNS runs a video unlocks the next ones (ZR-43), only where
// ads exist (app, online, 13+). True when the next run needs that video.
export function gateReached(s) {
  return adsShown(s) && s.runsPlayed >= AD_GATE_RUNS;
}

// The local calendar day of a date, e.g. '2026-10-11'.
export function dayKey(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Milliseconds from a date until the next local midnight.
export function msUntilMidnight(date) {
  const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return midnight - date;
}

// A countdown such as 3:07:45.
export function formatCountdown(ms) {
  const total = Math.max(Math.ceil(ms / 1000), 0);
  const pad = (n) => String(n).padStart(2, '0');
  return `${Math.floor(total / 3600)}:${pad(Math.floor(total / 60) % 60)}:${pad(total % 60)}`;
}

// A short countdown such as 24:13 (minutes and seconds), for the waiting
// time before the next credit video (ZR-67).
export function formatWait(ms) {
  const total = Math.max(Math.ceil(ms / 1000), 0);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

// At midnight everybody gets 10 new runs: on a new day the count starts
// again, and the time left until the next midnight is kept for the
// countdown. Returns true when the count was reset (to be saved).
export function refreshRunsDay(s, date) {
  s.untilMidnight = msUntilMidnight(date);
  const today = dayKey(date);
  if (s.runsDay === today) return false;
  s.runsDay = today;
  s.runsPlayed = 0;
  return true;
}

// Runs left before the next video, for the counter on screen.
export function runsLeft(s) {
  return Math.max(AD_GATE_RUNS - s.runsPlayed, 0);
}

// The video on the home screen once the runs are used (ZR-43). Watched to
// the end: AD_GATE_RUNS new runs. Closed early: nothing; the player can try
// again or wait until midnight. No video available: the
// player is never blocked and gets the runs anyway. No credits are paid and
// the daily credit videos are not used. Returns 'unlocked' or null.
export async function watchGateAd(win, s, live = AD_LIVE) {
  if (s.ads.status !== 'idle') return null;
  const admob = adPlugin(win);
  s.ads.status = 'loading';
  s.ads.rewarded = false;
  let item = null;
  let failed = false;
  try {
    await admob.prepareRewardVideoAd(videoOptions(s, 'gate', live));
    item = await admob.showRewardVideoAd();
  } catch {
    failed = true;
  }
  s.ads.status = 'idle';
  if (!failed && !s.ads.rewarded && !item?.amount) return null;
  s.runsPlayed = 0;
  s.state = 'start';
  showToast(s, failed ? 'adGateFree' : 'adGateUnlocked', { n: AD_GATE_RUNS });
  return 'unlocked';
}

// Shows a prepared video and waits until it is gone from the screen (ZR-79).
// The plugin answers showRewardVideoAd() as soon as the reward is earned,
// while the video is still on screen, and never when it is closed early;
// only the Dismissed (or FailedToShow) event says the game is visible again.
// Resolves with true when the reward was earned.
export function playUntilClosed(admob, s) {
  return new Promise((resolve) => {
    const done = () => {
      s.ads.closed = null;
      resolve(s.ads.rewarded);
    };
    s.ads.closed = done;
    admob.showRewardVideoAd().then((item) => { if (item?.amount) s.ads.rewarded = true; }, done);
  });
}

// The revive video (ZR-69). Watched to the end: once the video is closed the
// question waits for a tap, then the run goes on with 1 heart (ZR-79).
// Closed early or not available: the run ends. Pays no credits and does not
// count towards the daily credit videos or their waiting time.
// Returns 'revived' or null.
export async function watchReviveAd(win, s, live = AD_LIVE) {
  const admob = adPlugin(win);
  s.ads.status = 'loading';
  s.ads.rewarded = false;
  let rewarded = false;
  try {
    await admob.prepareRewardVideoAd(videoOptions(s, 'revive', live));
    rewarded = await playUntilClosed(admob, s);
  } catch {
    rewarded = false;
  }
  s.ads.status = 'idle';
  if (!rewarded) {
    declineRevive(s);
    return null;
  }
  readyRevive(s);
  return 'revived';
}
