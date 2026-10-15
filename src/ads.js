// Rewarded ads (ZR-14/15). In the Android app the AdMob plugin shows a
// video; when it was watched to the end the server pays the reward (at most
// AD_DAILY per day). In a browser, offline, or for players under 13 there are
// no ads at all and the ad buttons are not shown.
import { AD_REWARD, AD_DAILY, AD_LIVE, AD_TEST_UNIT, AD_LIVE_UNITS, AD_GATE_RUNS } from './config.js';
import { applyServerState } from './sync.js';
import { showToast } from './logic.js';

// The ad unit for a kind of video ('credits' or 'gate'): the owner's live
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

// True when an ad can be watched now: shown, ads left today, none running.
export function adAvailable(s) {
  return adsShown(s) && s.ads.left > 0 && s.ads.status === 'idle';
}

// Asks Google's EU consent service whether the consent form is needed and
// shows it. A failure here (for example no consent message published in
// AdMob yet) must not hide the ads: the game goes on without the form
// (ZR-59). Returns false when the consent step failed.
export async function askConsent(admob) {
  try {
    const consent = await admob.requestConsentInfo();
    if (consent?.isConsentFormAvailable && consent.status === 'REQUIRED') await admob.showConsentForm();
    return true;
  } catch {
    return false;
  }
}

// Starts AdMob, then EU consent (Google's consent form, when needed), then
// the number of ads left today from the server. Players under 13 never get
// here. Returns true when ads are ready; only a failed AdMob start stops it.
export async function initAds(win, backend, s) {
  const admob = adPlugin(win);
  if (!admob || s.age !== 'ok' || !s.online) return false;
  try {
    await admob.initialize({ initializeForTesting: !AD_LIVE });
  } catch {
    return false;
  }
  await askConsent(admob);
  admob.addListener('onRewardedVideoAdReward', () => { s.ads.rewarded = true; });
  const status = await backend.call('ad_status');
  s.ads = { ready: true, left: status?.left ?? AD_DAILY, status: 'idle', rewarded: false, userId: status?.id ?? null };
  return true;
}

// The options for one rewarded video. In the Play Store build the player's
// id and the kind of video go to AdMob, which passes them to the server in
// its signed callback (server-side verification, ZR-51).
export function videoOptions(s, kind, live = AD_LIVE) {
  const options = { adId: adUnit(kind, live), isTesting: !live };
  if (live && s.ads.userId) options.ssv = { userId: s.ads.userId, customData: kind };
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
export async function watchAd(win, backend, s, { live = AD_LIVE, pause = wait } = {}) {
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
