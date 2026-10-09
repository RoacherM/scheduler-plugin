import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);

/** Load the built client.js the way DSH's module loader does, against a fake Client ctx. */
async function loadClient(fetchImpl) {
  const dom = new JSDOM('<!doctype html><html><head></head><body><div id="root"></div></body></html>', { url: 'http://127.0.0.1:19387/', pretendToBeVisual: true });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
  globalThis.fetch = fetchImpl;
  window.fetch = fetchImpl;
  let loaded;
  window.__ModuleLoader__ = { load: ({ factory }) => { loaded = factory((name) => require(name)); } };
  new Function(await readFile(new URL('../client.js', import.meta.url), 'utf8'))();
  const registrations = [];
  const calls = [];
  // A switchable stand-in for ctx.locale: getSnapshot/subscribe drive the page's language.
  const listeners = new Set();
  let snap = { active: 'zh-CN', revision: 0 };
  const locale = {
    register: () => () => {}, bind: () => (key) => ({ panel: '定时任务' })[key] ?? key,
    getSnapshot: () => snap, subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    set(active) { snap = { active, revision: snap.revision + 1 }; for (const fn of listeners) fn(); },
  };
  const ctx = {
    effect: (fn) => fn(),
    get: (name) => ({
      layout: { selectPanel: (id) => calls.push(['selectPanel', id]) },
      uiWorkspace: { openSession: (id) => calls.push(['openSession', id]), startSession: () => calls.push(['startSession']) },
    })[name],
    locale,
    slots: { inject: (name, cb) => cb(), register: (meta, Component) => { registrations.push({ meta, Component }); return () => {}; } },
  };
  loaded.apply(ctx);
  return { dom, registrations, calls, locale, inject: loaded.inject };
}

const TASK = {
  id: 't-1', title: '早间邮件摘要', prompt: '检查 Gmail 新邮件并总结', enabled: true,
  schedule: { type: 'weekly', time: '09:00', weekdays: [1, 2, 3, 4, 5], timeZone: 'Asia/Shanghai' },
  scheduleText: '工作日 09:00', nextRunAt: '2026-09-29T01:00:00.000Z', nextRunText: '2026-09-29 09:00 周二（Asia/Shanghai）',
  workspace: '/Users/me/work', connectors: ['gmail'], misfire: 'run_once', runCount: 1,
  lastRun: { id: 'r-1', status: 'completed', startedAt: '2026-09-28T01:00:00.000Z', finishedAt: '2026-09-28T01:01:30.000Z', sessionId: 's-9', summary: '3 封新邮件' },
};

test('scheduler client registers its page, sidebar entry and tool cards, and renders tasks', async () => {
  const requests = [];
    const MODELS = { models: [{ provider: 'magpie', id: 'claude/claude-opus-5-5', name: 'Claude Opus 5.5', efforts: [{ id: 'high', name: 'High' }, { id: 'max', name: 'Max' }] }, { provider: 'magpie', id: 'claude/claude-fable-5-1', name: 'Claude Fable 5.1', efforts: [] }],
    defaultModel: { provider: 'magpie', model: 'claude/claude-fable-5-1', reasoningEffort: 'high', name: 'Claude Fable 5.1' } };
  const fetchImpl = async (url, init = {}) => {
    const path = new URL(url).pathname;
    requests.push([init.method ?? 'GET', path, init.body ? JSON.parse(init.body) : undefined]);
    const ok = (value) => new Response(JSON.stringify(value), { status: 200 });
    if (path.endsWith('/tasks')) return ok({ tasks: [TASK], revision: 1, ...MODELS });
    if (path.endsWith('/update')) return ok({ task: TASK });
    if (path.endsWith('/chat')) return ok({ sessionId: 's-chat' });
    if (path.endsWith('/wait')) return new Promise(() => {});
    if (path.endsWith('/runs')) return ok({ runs: [{ ...TASK.lastRun, model: { provider: 'magpie', model: 'claude/claude-fable-5-1', reasoningEffort: 'high' }, fallback: { reason: 'pinned_missing', from: { provider: 'magpie', model: 'claude/claude-opus-5-5' }, to: { provider: 'magpie', model: 'claude/claude-fable-5-1', reasoningEffort: 'high' } } }] });
    if (path.endsWith('/run')) return ok({ run: { id: 'r-2', status: 'running', sessionId: 's-10' } });
    return new Response('{}', { status: 404 });
  };
  const { registrations, calls, locale, inject } = await loadClient(fetchImpl);
  assert.deepEqual(inject, ['slots', 'locale']);
  const byName = (name) => registrations.filter((r) => r.meta.name === name);
  assert.equal(byName('main')[0].meta.key, 'local-scheduler');
  assert.equal(byName('sidebar.panellist')[0].meta.id, 'local-scheduler');
  assert.equal(byName('sidebar.panellist')[0].meta.label(), '定时任务');
  assert.deepEqual(byName('tool.call.toolview').map((r) => r.meta.key), ['scheduler_create', 'scheduler_update', 'scheduler_delete', 'scheduler_run_now']);

  const React = require('react');
  const { createRoot } = require('react-dom/client');
  const { act } = React;
  const root = createRoot(document.getElementById('root'));
  const Page = byName('main')[0].Component;
  await act(async () => { root.render(React.createElement(Page)); });
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  const text = document.body.textContent;
  assert.match(text, /早间邮件摘要/);
  assert.match(text, /工作日 09:00/);
  assert.equal(document.querySelector('.sx-logos').title, 'gmail');
  assert.equal(document.querySelector('.sx-pill').textContent, '完成');
  // The row leads with the next run time in the browser's clock.
  const next = new Date(TASK.nextRunAt);
  assert.equal(document.querySelector('.sx-when b').textContent, `${String(next.getHours()).padStart(2, '0')}:${String(next.getMinutes()).padStart(2, '0')}`);

  // Clicking the row opens its details and run timeline; the switch does not.
  const button = (label) => [...document.querySelectorAll('button')].find((b) => b.textContent.includes(label));
  await act(async () => { document.querySelector('.sx-row').click(); await new Promise((r) => setTimeout(r, 10)); });
  assert.ok(document.querySelector('.sx-detail'));
  assert.match(document.querySelector('.sx-timeline').textContent, /3 封新邮件/);
  assert.match(document.querySelector('.sx-run-head').textContent, /Claude Fable 5\.1 · high$/, 'each run shows the model it actually used');
  assert.equal(document.querySelector('.sx-run-note').textContent, '指定的 Claude Opus 5.5 当时不可用，这次改用 Claude Fable 5.1 · high');
  await act(async () => { button('立即运行').click(); await new Promise((r) => setTimeout(r, 10)); });
  assert.deepEqual(requests.find(([m, p]) => m === 'POST' && p.endsWith('/run'))[2], { id: 't-1' });
  assert.deepEqual(calls.slice(-2), [['selectPanel', null], ['openSession', 's-10']]);

  // No form dialog anywhere: the page's only controls are the time, the days and the model.
  assert.equal(document.querySelector('[role="dialog"]'), null);
  assert.equal(document.querySelectorAll('.sx-detail input, .sx-detail select, .sx-detail textarea').length, 2, 'one time input and one model select');
  const updates = () => requests.filter(([, p]) => p.endsWith('/update')).map(([, , b]) => b);
  assert.equal([...document.querySelectorAll('.sx-day.on')].map((b) => b.textContent).join(''), '一二三四五');
  await act(async () => { [...document.querySelectorAll('.sx-day')][5].click(); await new Promise((r) => setTimeout(r, 10)); });
  assert.deepEqual(updates().at(-1), { id: 't-1', schedule: { ...TASK.schedule, weekdays: [1, 2, 3, 4, 5, 6] } }, 'a weekday click saves at once');
  const setValue = (el, value, proto) => { Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, value); el.dispatchEvent(new window.Event(proto === window.HTMLSelectElement ? 'change' : 'input', { bubbles: true })); };
  const time = document.querySelector('.sx-time');
  await act(async () => { setValue(time, '08:30', window.HTMLInputElement); });
  assert.equal(updates().length, 1, 'typing alone does not save');
  await act(async () => { time.dispatchEvent(new window.FocusEvent('focusout', { bubbles: true })); await new Promise((r) => setTimeout(r, 10)); });
  assert.deepEqual(updates().at(-1), { id: 't-1', schedule: { ...TASK.schedule, time: '08:30' } }, 'the time saves when the field is left');
  const select = document.querySelector('.sx-model-select');
  assert.equal(select.options[0].textContent, '跟随默认（Claude Fable 5.1 · high）');
  await act(async () => { setValue(select, 'magpie/claude/claude-opus-5-5', window.HTMLSelectElement); await new Promise((r) => setTimeout(r, 10)); });
  assert.deepEqual(updates().at(-1), { id: 't-1', model: { provider: 'magpie', model: 'claude/claude-opus-5-5' } });

  // Everything else is a conversation: the agent opens it with a question in a new session.
  await act(async () => { button('在对话里修改').click(); await new Promise((r) => setTimeout(r, 10)); });
  assert.deepEqual(requests.filter(([, p]) => p.endsWith('/chat')).at(-1)[2], { id: 't-1' });
  assert.deepEqual(calls.at(-1), ['openSession', 's-chat']);
  await act(async () => { button('新建任务').click(); await new Promise((r) => setTimeout(r, 10)); });
  assert.deepEqual(requests.filter(([, p]) => p.endsWith('/chat')).at(-1)[2], {});
  await act(async () => { document.querySelector('.sx-example').click(); await new Promise((r) => setTimeout(r, 10)); });
  assert.deepEqual(requests.filter(([, p]) => p.endsWith('/chat')).at(-1)[2], { text: '每个工作日早上 9 点总结新邮件' });

  // Switching DSH to English re-renders the page in English, rule wording included.
  await act(async () => { locale.set('en-US'); await new Promise((r) => setTimeout(r, 10)); });
  assert.equal(document.querySelector('.sx-head h1').textContent, 'Scheduled');
  assert.equal(document.querySelector('.sx-meta span').textContent, 'Weekdays 09:00');
  assert.equal(document.querySelector('.sx-pill').textContent, 'Done');
  assert.match(document.querySelector('.sx-timeline').textContent, /Done · manual|Done/);
  assert.ok(button('Run now'));
  await act(async () => { locale.set('zh-CN'); });

  // Tool card for a finished scheduler_create call.
  const Card = byName('tool.call.toolview')[0].Component;
  const cardRoot = createRoot(document.body.appendChild(document.createElement('div')));
  const block = { content: [{ type: 'text', text: JSON.stringify({ created: true, task: TASK }) }] };
  await act(async () => { cardRoot.render(React.createElement(Card, { toolName: 'scheduler_create', phase: 'result', block })); });
  const card = document.querySelector('.sx-card');
  assert.equal(card.querySelector('.sx-card-title').textContent, '早间邮件摘要');
  assert.equal(card.querySelector('.sx-card-sub').textContent, '工作日 09:00 · 下次 2026-09-29 09:00 周二');
  await act(async () => { root.unmount(); cardRoot.unmount(); });
});
