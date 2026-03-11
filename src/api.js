/* api.js */

export const API         = '/cache_api.php';
export const AUTH_API    = '/auth_api.php';
export const KOMIK_API   = '/komik_api.php';
export const DONGHUA_API = '/donghua_api.php';

export function imgProxy(url) { return url || ''; }

// Hapus query string (hanya untuk URL yang TIDAK butuh query, misal subtitle)
export function stripQuery(url) {
  return (url || '').split('?')[0];
}

async function safeFetch(url, opts = {}) {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 12000);
  try {
    const res  = await fetch(url, { ...opts, signal: controller.signal });
    clearTimeout(tid);
    const text = await res.text();
    try { return JSON.parse(text); }
    catch { throw new Error('Non-JSON: ' + text.slice(0, 120)); }
  } finally {
    clearTimeout(tid);
  }
}

export async function fetchCategory(action, page = 1) {
  return safeFetch(`${API}?action=${encodeURIComponent(action)}&page=${page}`);
}

export async function fetchDetail(detailPath) {
  return safeFetch(`${API}?action=detail&detailPath=${encodeURIComponent(detailPath)}`);
}

export async function fetchSearch(q, page = 1) {
  return safeFetch(`${API}?action=search&q=${encodeURIComponent(q)}&page=${page}`);
}

export async function fetchStream(id, season, episode, detailPath) {
  let url = `/stream.php?id=${id}`;
  if (season && episode) url += `&season=${season}&episode=${episode}`;
  url += `&detailPath=${encodeURIComponent(detailPath)}`;
  return safeFetch(url);
}

export async function fetchKomikPopuler(page = 1) {
  return safeFetch(`${KOMIK_API}?action=populer&page=${page}`);
}

export async function fetchKomikDetail(slug) {
  return safeFetch(`${KOMIK_API}?action=detail&detailManga=${encodeURIComponent(slug)}`);
}

export async function fetchKomikSearch(q) {
  return safeFetch(`${KOMIK_API}?action=search&q=${encodeURIComponent(q)}`);
}

export async function fetchDonghuaSearch(q) {
  return safeFetch(`${DONGHUA_API}?action=search&q=${encodeURIComponent(q)}`);
}

export async function authLogin(username, password) {
  return safeFetch(`${AUTH_API}?action=login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
}

export async function authRegister(username, password) {
  return safeFetch(`${AUTH_API}?action=register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
}

export async function authVerify(token) {
  return safeFetch(`${AUTH_API}?action=verify&token=${encodeURIComponent(token)}`);
}

export async function authGetCW(token) {
  return safeFetch(`${AUTH_API}?action=getCW`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
}

export function authSaveCW(token, type, key, data) {
  fetch(`${AUTH_API}?action=saveCW`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, type, key, data }),
  }).catch(() => {});
}

export function parseFoodcashUrl(url) {
  try {
    const u = new URL(url);
    return {
      id:         u.searchParams.get('id'),
      season:     u.searchParams.get('season'),
      episode:    u.searchParams.get('episode'),
      detailPath: u.searchParams.get('detailPath'),
    };
  } catch { return {}; }
}

export function ping(page, username = '') {
  fetch(`/panel_api.php?action=ping&page=${encodeURIComponent(page)}&user=${encodeURIComponent(username)}`)
    .catch(() => {});
}

export function fmtTime(s) {
  if (!s || isNaN(s)) return '0:00';
  const h   = Math.floor(s / 3600);
  const m   = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
  return `${m}:${sec.toString().padStart(2,'0')}`;
}
