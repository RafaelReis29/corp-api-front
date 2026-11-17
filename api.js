const DEMO_KEY = 'cf_demo_0123456789abcdefghijklmnopqrstuvwxyzABCDEFG';
const PRODUCTION_API = 'https://corp-financial-api.onrender.com';
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

function idempotencyKey() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), byte =>
    byte.toString(16).padStart(2, '0')).join('');
}

function apiUrl(value) {
  const url = new URL(value.trim());
  const local = LOCAL_HOSTS.includes(url.hostname);
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) ||
      url.username || url.password || url.search || url.hash) {
    throw new Error('Use an HTTPS API URL, or HTTP on localhost.');
  }
  return url.href.replace(/\/$/, '');
}

class ApiError extends Error {
  constructor(response, problem) {
    const fields = (problem?.errors || []).map(error => `${error.field}: ${error.message}`);
    const retry = response.headers.get('Retry-After');
    super([problem?.detail || `HTTP ${response.status}`, ...fields,
      retry && `Retry in ${retry} seconds.`].filter(Boolean).join(' '));
    this.status = response.status;
  }
}

async function apiRequest(connection, path, { method = 'GET', body, key, accountId } = {}) {
  const headers = new Headers({
    'X-API-Key': connection.key,
    'X-API-Version': connection.version
  });
  if (accountId) headers.set('X-Account-Id', accountId);
  if (method === 'POST' && connection.version === '2.0.0') {
    headers.set('X-Idempotency-Key', key || idempotencyKey());
  }
  if (body !== undefined) headers.set('Content-Type', 'application/json');

  const response = await fetch(connection.base + path, {
    method, headers, signal: connection.signal, credentials: 'omit', redirect: 'error',
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response, data);
  if (data === null) throw new Error('The API response did not contain JSON.');
  return data;
}
