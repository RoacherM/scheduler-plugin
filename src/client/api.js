/** Language for Host error messages; set by the page from DSH's locale. */
let lang = 'zh';
export const setApiLang = (value) => { lang = value; };

const url = (path, query = {}) => {
  const target = new URL('api/scheduler' + path, document.baseURI);
  if (lang === 'en') target.searchParams.set('lang', 'en');
  for (const [key, value] of Object.entries(query)) if (value !== undefined) target.searchParams.set(key, value);
  return target;
};

async function call(method, path, { body, query, signal } = {}) {
  const init = { method, credentials: 'same-origin', signal, headers: {} };
  if (body !== undefined) { init.body = JSON.stringify(body); init.headers['Content-Type'] = 'application/json'; }
  const response = await fetch(url(path, query), init);
  let data;
  try { data = await response.json(); } catch { data = undefined; }
  if (!response.ok) throw new Error(data?.error ?? `HTTP ${response.status}`);
  return data;
}

export const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export const api = {
  tasks: () => call('GET', '/tasks', { query: { tz: browserZone() } }),
  wait: (revision, signal) => call('GET', '/wait', { query: { revision }, signal }),
  runs: (id) => call('GET', '/runs', { query: { id } }),
  /** { schedule?, model? } — the only settings the page changes itself. */
  update: (id, fields) => call('POST', '/update', { body: { id, ...fields } }),
  /** Open a chat about a task, or a new one (optionally seeded with what the user wants): → { sessionId }. */
  chat: ({ id, text } = {}) => call('POST', '/chat', { body: { id, text } }),
  toggle: (id, enabled) => call('POST', '/toggle', { body: { id, enabled } }),
  run: (id) => call('POST', '/run', { body: { id } }),
  remove: (id) => call('POST', '/delete', { body: { id } }),
};
