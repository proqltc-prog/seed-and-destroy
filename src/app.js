// Smartphone app integration (ZR-40). In the Android app (Capacitor) the
// system back button walks back through the screens like their own back
// buttons do; on the home screen it closes the app. In a browser there is
// no native app object and nothing here runs.
import { press } from './logic.js';
import { STORE_BACK_BUTTON, LEADERBOARD_BACK_LEFT } from './ui.js';
import { ONBOARDING_STATES, RECOVERY_STATES } from './onboarding.js';

// Screens with a back button at the bottom.
export const BACK_SCREENS = ['store', 'settings', 'leaderboard', 'friends', ...RECOVERY_STATES];

const centre = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

// What the system back button does: 'exit' on the home screen, otherwise
// the same as a tap on the screen's own back button (its result is applied
// like any tap). During a run, the start animation and the first-launch
// screens it does nothing, so a mistaken press never ends a run.
export function backPress(s, rng) {
  if (s.privacyOpen) return 'close-privacy'; // the privacy page closes first (ZR-42)
  if (s.state === 'start') return 'exit';
  if (s.state === 'dead') return press(s, rng);
  const fromSettings = ONBOARDING_STATES.includes(s.state) && s.flow === 'settings';
  if (!BACK_SCREENS.includes(s.state) && !fromSettings) return undefined;
  const friendsTab = s.state === 'leaderboard' && s.leaderboard.tab === 'friends';
  return press(s, rng, centre(friendsTab ? LEADERBOARD_BACK_LEFT : STORE_BACK_BUTTON));
}

// Connects the back button of the Android app. `onResult` receives what a
// back press did (a press result such as 'leaderboard'); 'exit' closes the
// app. Returns false in a browser.
export function connectApp(win, s, rng, onResult) {
  const app = win.Capacitor?.Plugins?.App;
  if (!app) return false;
  app.addListener('backButton', () => {
    const result = backPress(s, rng);
    if (result === 'exit') app.exitApp();
    else onResult(result);
  });
  return true;
}
