// Connection to the Supabase backend (ZR-24): anonymous per-device login and
// calls to the server functions. `fetch` and storage are passed in so this
// module is unit testable. The game never waits for the backend and keeps
// working offline: every failure resolves to null.
import { BACKEND_URL, BACKEND_KEY } from './config.js';
import { loadObject, saveValue } from './storage.js';

export const SESSION_KEY = 'zzr-session';
// Renew the login this many milliseconds before it expires.
export const REFRESH_MARGIN = 60000;

// A backend that does nothing, for browsers without fetch.
export const OFFLINE = Object.freeze({ signIn: async () => null, call: async () => null });

// The stored session from a login response, with an absolute expiry in ms.
export function toSession(data, nowMs) {
  if (!data?.access_token || !data.refresh_token) return null;
  const expiresAt = data.expires_at ? data.expires_at * 1000 : nowMs + (data.expires_in ?? 0) * 1000;
  return { access_token: data.access_token, refresh_token: data.refresh_token, expires_at: expiresAt };
}

export function createBackend({ fetch, storage, url = BACKEND_URL, key = BACKEND_KEY, now = Date.now }) {
  if (typeof fetch !== 'function') return OFFLINE;

  let session = loadObject(storage, SESSION_KEY);
  let pending = null;

  function store(next) {
    session = next ?? {};
    saveValue(storage, SESSION_KEY, JSON.stringify(session));
    return next;
  }

  // POST to the backend; the publishable key always, the login when known.
  async function post(path, body, token) {
    const headers = { apikey: key, 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${url}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  }

  async function login() {
    if (session.access_token && session.expires_at - REFRESH_MARGIN > now()) return session;
    if (session.refresh_token) {
      const res = await post('/auth/v1/token?grant_type=refresh_token', { refresh_token: session.refresh_token });
      const renewed = res.ok ? toSession(res.data, now()) : null;
      if (renewed) return store(renewed);
    }
    // A new anonymous player for this device.
    const res = await post('/auth/v1/signup', {});
    return store(res.ok ? toSession(res.data, now()) : null);
  }

  // Signs in once, also when several calls ask at the same time.
  function signIn() {
    pending ??= login()
      .catch(() => null)
      .finally(() => { pending = null; });
    return pending;
  }

  // Calls a server function; null when offline, not signed in or refused.
  async function call(name, args = {}, retried = false) {
    try {
      const current = await signIn();
      if (!current) return null;
      const res = await post(`/rest/v1/rpc/${name}`, args, current.access_token);
      if (res.status === 401 && !retried) {
        // The login was revoked or expired early: forget it and try once more.
        store({ refresh_token: current.refresh_token });
        return call(name, args, true);
      }
      return res.ok ? res.data : null;
    } catch (e) {
      return null;
    }
  }

  return { signIn, call };
}

// Tells the server the player's username and language (creates the player
// on the first call). Nothing happens before a username was chosen, and
// never for players younger than 13 (ZR-25): they play offline only.
export function syncProfile(backend, s) {
  if (!s.name || s.age !== 'ok') return Promise.resolve(null);
  return backend.call('register_player', { p_username: s.name, p_lang: s.lang });
}
