// Persistence of the best score and the credit balance. Every access is
// guarded: storage can be missing (private mode, blocked site data) or throw.
export const BEST_KEY = 'zzr-best';
export const CREDITS_KEY = 'zzr-credits';
export const OWNED_KEY = 'zzr-owned';
export const EQUIPPED_KEY = 'zzr-equipped';
export const LANG_KEY = 'zzr-lang';
export const NAME_KEY = 'zzr-name';
export const ONBOARDED_KEY = 'zzr-onboarded';
export const AGE_KEY = 'zzr-age'; // 'ok' (13 or older) or 'young'
export const RUNS_KEY = 'zzr-runs'; // runs since the last unlock video (ZR-43)
export const RUNS_DAY_KEY = 'zzr-runs-day'; // the day those runs belong to

export function getStorage(win) {
  try {
    return win.localStorage;
  } catch (e) {
    return null;
  }
}

// A stored whole number that is never negative; 0 when missing or invalid.
export function loadCount(storage, key) {
  try {
    const n = Math.floor(+storage.getItem(key));
    return n > 0 ? n : 0;
  } catch (e) {
    return 0;
  }
}

export function saveValue(storage, key, value) {
  try {
    storage.setItem(key, value);
  } catch (e) {
    // Ignore: the value simply is not remembered.
  }
}

export const loadBest = (storage) => loadCount(storage, BEST_KEY);
export const saveBest = (storage, value) => saveValue(storage, BEST_KEY, value);
export const loadCredits = (storage) => loadCount(storage, CREDITS_KEY);
export const saveCredits = (storage, value) => saveValue(storage, CREDITS_KEY, value);
export const loadRuns = (storage) => loadCount(storage, RUNS_KEY);
export const saveRuns = (storage, value) => saveValue(storage, RUNS_KEY, value);
export const loadRunsDay = (storage) => loadText(storage, RUNS_DAY_KEY);
export const saveRunsDay = (storage, day) => saveValue(storage, RUNS_DAY_KEY, day);

// A stored list of strings; [] when missing or invalid.
export function loadList(storage, key) {
  try {
    const list = JSON.parse(storage.getItem(key));
    return Array.isArray(list) ? list.filter((v) => typeof v === 'string') : [];
  } catch (e) {
    return [];
  }
}

export const loadOwned = (storage) => loadList(storage, OWNED_KEY);
export const saveOwned = (storage, ids) => saveValue(storage, OWNED_KEY, JSON.stringify(ids));

// A stored plain object; {} when missing or invalid.
export function loadObject(storage, key) {
  try {
    const value = JSON.parse(storage.getItem(key));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch (e) {
    return {};
  }
}

export const loadEquipped = (storage) => loadObject(storage, EQUIPPED_KEY);
export const saveEquipped = (storage, eq) => saveValue(storage, EQUIPPED_KEY, JSON.stringify(eq));

// A stored text; '' when missing.
export function loadText(storage, key) {
  try {
    return storage.getItem(key) ?? '';
  } catch (e) {
    return '';
  }
}

export const loadLang = (storage) => loadText(storage, LANG_KEY);
export const saveLang = (storage, lang) => saveValue(storage, LANG_KEY, lang);

// The player profile: username, whether the first-launch screens were done
// and the answer to the age question ('' when not asked yet).
export function loadProfile(storage) {
  const age = loadText(storage, AGE_KEY);
  return {
    name: loadText(storage, NAME_KEY),
    onboarded: loadText(storage, ONBOARDED_KEY) === '1',
    age: age === 'ok' || age === 'young' ? age : '',
  };
}
export const saveAge = (storage, age) => saveValue(storage, AGE_KEY, age);
export const saveName = (storage, name) => saveValue(storage, NAME_KEY, name);
export const saveOnboarded = (storage) => saveValue(storage, ONBOARDED_KEY, '1');
