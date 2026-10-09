import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import * as source from '../src/host/index.js';
import { composePrompt } from '../src/host/engine.js';

/** A fake Host: routes, tools, events, a hand-driven clock and timer, and a recording session starter. */
async function mount({ plugin = source, dir, start = new Date('2026-09-28T02:30:00Z'), failStart = false, toolNames = [] } = {}) {
  dir ??= await mkdtemp(join(tmpdir(), 'dsh-scheduler-'));
  const workspace = await mkdtemp(join(tmpdir(), 'dsh-ws-'));
  const routes = new Map();
  const tools = new Map();
  const events = new Map();
  const disposers = [];
  const sessions = [];
  let clock = start.getTime();
  let pending;
  const timers = { set: (fn, ms) => { pending = { fn, at: clock + ms }; return pending; }, clear: (t) => { if (t && t === pending) pending = undefined; } };
  // Tests may take models away mid-way to see what a run falls back to.
  const llmState = {
    models: [{ provider: 'magpie', id: 'claude/claude-opus-5-5', name: 'Claude Opus 5.5' }, { provider: 'magpie', id: 'claude/claude-fable-5-1', name: 'Claude Fable 5.1' }],
    default: { provider: 'magpie', model: 'claude/claude-fable-5-1', reasoningEffort: 'high' },
  };
  const ctx = {
    logger: { warn: () => {} },
    effect: (fn) => { const dispose = fn(); disposers.push(dispose); return () => dispose?.(); },
    on: (name, fn) => { events.set(name, fn); return () => events.delete(name); },
    // A small model catalog: two models, one with reasoning efforts.
    get: (name) => (name === 'llm' ? {
      listProviders: () => [{ id: 'magpie', name: 'Magpie' }],
      listModels: async () => llmState.models,
      resolveModelInfo: async (provider, id) => ({ reasoning: id.includes('opus') ? { efforts: [{ id: 'high', name: 'High' }, { id: 'max', name: 'Max' }] } : undefined }),
    } : undefined),
    agentDefaultModel: { currentSelection: () => ({ ...llmState.default }) },
    connection: { fetch: { register: (route) => { routes.set(route.path, route); return () => routes.delete(route.path); } } },
    tools: {
      register: (tool) => { tools.set(tool.name, tool); return () => tools.delete(tool.name); },
      schemas: () => [...toolNames, ...tools.keys()].map((name) => ({ name })),
    },
    workspaceRegistry: { list: () => [{ id: 'w1', path: workspace, title: 'ws' }] },
    permissionPresets: { catalog: () => ({ options: [{ value: 'danger-full-access', name: 'Full' }], defaultPreset: 'danger-full-access' }) },
  };
  const startSession = async (request) => {
    if (failStart) throw new Error('no model configured');
    const sessionId = `s-${sessions.length + 1}`;
    sessions.push({ ...request, sessionId });
    return { sessionId };
  };
  plugin.apply(ctx, { dataDir: dir, now: () => new Date(clock), timers, startSession });
  await new Promise((r) => setTimeout(r, 20));

  const settle = () => new Promise((r) => setTimeout(r, 20));
  const host = {
    dir, workspace, tools, sessions, routes, llm: llmState,
    get clock() { return new Date(clock); },
    get pendingAt() { return pending ? new Date(pending.at) : undefined; },
    /** Move the clock forward and fire the timer if it came due. */
    async advance(ms) {
      clock += ms;
      while (pending && pending.at <= clock) { const { fn } = pending; pending = undefined; fn(); await settle(); }
      await settle();
    },
    async exec(name, args = {}, { cwd = workspace, zone = 'Asia/Shanghai' } = {}) {
      const agent = { id: 'caller-session', session: { header: { cwd }, deriveMessages: () => [{ role: 'user', source: { kind: 'user', clientTimeZone: zone } }] } };
      return tools.get(name).execute(args, { agent, signal: new AbortController().signal });
    },
    async call(method, path, body) {
      const route = routes.get(path.split('?')[0]);
      assert.ok(route, 'no route ' + path);
      const response = await route.fetch(new Request('http://dsh.internal' + path, { method, ...(body ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } } : {}) }));
      return { status: response.status, data: await response.json() };
    },
    /** Pretend the run's Session finished its first turn. */
    finish(sessionId, reason = { kind: 'completed' }, answer = '今天有 3 封新邮件：……') {
      events.get('session/event')({ id: sessionId, deriveMessages: () => [{ role: 'assistant', content: [{ type: 'text', text: answer }] }] }, { type: 'turn/end', data: { turn: 1, reason } });
      return settle();
    },
    async task(id) { return (await host.call('GET', '/api/scheduler/tasks')).data.tasks.find((t) => t.id === id); },
    async unmount() { for (const d of disposers.reverse()) await d?.(); },
  };
  return host;
}

const created = (result) => JSON.parse(result.text).task;

test('natural-language creation: the model\'s structured call becomes a task with a readable preview', async (t) => {
  const host = await mount({ toolNames: ['mcp__gmail__search_emails'] });
  t.after(host.unmount);
  const result = await host.exec('scheduler_create', {
    title: '早间邮件摘要',
    prompt: '检查 Gmail 自上次运行以来的新邮件，按重要程度总结。',
    schedule: { type: 'weekly', time: '09:00', weekdays: [1, 2, 3, 4, 5] },
    connectors: ['gmail'],
  });
  const task = created(result);
  assert.equal(result.taskId, task.id);
  assert.equal(task.scheduleText, '工作日 09:00');
  assert.equal(task.schedule.timeZone, 'Asia/Shanghai', 'defaults to the caller\'s browser zone');
  assert.equal(task.workspace, host.workspace, 'defaults to the caller\'s workspace');
  assert.equal(task.createdFrom, 'caller-session');
  assert.deepEqual(task.upcoming, ['2026-09-29 09:00 周二', '2026-09-30 09:00 周三', '2026-10-01 09:00 周四']);
  assert.equal(task.nextRunText, '2026-09-29 09:00 周二（Asia/Shanghai）');
  assert.equal(task.nextRunAt, '2026-09-29T01:00:00.000Z');
  assert.equal(host.pendingAt.toISOString(), '2026-09-28T03:30:00.000Z', 'the timer re-checks at least hourly (sleep, clock changes)');

  await assert.rejects(host.exec('scheduler_create', { title: 'x', prompt: 'y', schedule: { type: 'daily', time: '9点' } }), /HH:MM/);
  await assert.rejects(host.exec('scheduler_create', { title: 'x', prompt: 'y', schedule: { type: 'daily', time: '09:00' }, workspace: '/nope/nope' }), /不存在/);
  const saved = JSON.parse(await readFile(join(host.dir, 'tasks.json'), 'utf8'));
  assert.equal(saved.tasks.length, 1);
});

test('a due task starts a new session with a self-contained prompt, then records the outcome', async (t) => {
  const host = await mount({ toolNames: ['mcp__gmail__search_emails'] });
  t.after(host.unmount);
  const task = created(await host.exec('scheduler_create', {
    title: '早间邮件摘要', prompt: '总结新邮件。', schedule: { type: 'daily', time: '09:00' }, connectors: ['gmail', 'slack'],
  }));
  await host.advance(22.5 * 3600_000); // → Tuesday 09:00 Shanghai
  assert.equal(host.sessions.length, 1);
  const [run] = host.sessions;
  assert.equal(run.workspace, host.workspace);
  assert.equal(run.title, '⏰ 早间邮件摘要 · 09-29 09:00');
  assert.match(run.text, /^【定时任务】早间邮件摘要\n本次运行：2026-09-29 09:00 周二（Asia\/Shanghai）· 计划时间 2026-09-29 09:00/);
  assert.match(run.text, /上次成功运行：无（这是第一次运行）/);
  assert.match(run.text, /gmail（工具名以 mcp__gmail__ 开头）/);
  assert.match(run.text, /slack（工具名以 mcp__slack__ 开头，⚠️ 当前未连接/);
  assert.match(run.text, /无人值守/);
  assert.match(run.text, /任务：\n总结新邮件。$/);

  let view = await host.task(task.id);
  assert.equal(view.lastRun, undefined);
  assert.equal(view.nextRunText, '2026-09-30 09:00 周三（Asia/Shanghai）');
  await host.finish('s-1');
  view = await host.task(task.id);
  assert.equal(view.lastRun.status, 'completed');
  assert.equal(view.lastRun.sessionId, 's-1');
  assert.equal(view.lastRun.summary, '今天有 3 封新邮件：……');

  // The next run knows when the last successful one was, so it can look only at newer mail.
  await host.advance(24 * 3600_000);
  assert.match(host.sessions[1].text, /上次成功运行：2026-09-29 09:00 周二（ISO: 2026-09-29T01:00:00.000Z）/);
  await host.finish('s-2', { kind: 'error', error: { message: 'rate limited' } });
  const { data } = await host.call('GET', `/api/scheduler/runs?id=${task.id}`);
  assert.deepEqual(data.runs.map((r) => [r.status, r.error ?? null]), [['failed', 'rate limited'], ['completed', null]]);
});

test('missed runs collapse into one catch-up; misfire "skip" drops late runs; overlapping runs are skipped', async (t) => {
  const host = await mount();
  t.after(host.unmount);
  const hourly = created(await host.exec('scheduler_create', { title: '每小时', prompt: 'p', schedule: { type: 'every', every_minutes: 60 } }));
  const strict = created(await host.exec('scheduler_create', { title: '严格', prompt: 'p', schedule: { type: 'every', every_minutes: 60 }, misfire: 'skip' }));
  // The machine sleeps for 5 hours: the timer fires once, late.
  await host.advance(5 * 3600_000 + 60_000);
  assert.equal(host.sessions.length, 1, 'one catch-up run for the hourly task, none for the strict one');
  assert.equal(host.sessions[0].title.startsWith('⏰ 每小时'), true);
  const strictView = await host.task(strict.id);
  assert.equal(strictView.lastRun.status, 'missed');
  assert.equal((await host.task(hourly.id)).nextRunAt, '2026-09-28T08:30:00.000Z', 'next run is on the original grid, after now');

  // The hourly run is still going an hour later: that occurrence is skipped rather than stacked.
  await host.advance(3600_000);
  assert.equal(host.sessions.length, 2, 'only the strict task ran');
  assert.equal((await host.task(hourly.id)).lastRun.status, 'skipped');
});

test('pause, resume, edit, run now, one-shot tasks and delete', async (t) => {
  const host = await mount();
  t.after(host.unmount);
  const task = created(await host.exec('scheduler_create', { title: '提醒', prompt: '提醒我给王总回邮件', schedule: { type: 'once', at: '2026-09-28 15:00' } }));
  assert.equal(task.scheduleText, '2026-09-28 15:00 周一（一次）');
  const paused = created(await host.exec('scheduler_update', { id: task.id, enabled: false }));
  assert.equal(paused.nextRunText, '已暂停');
  assert.equal(host.pendingAt, undefined, 'no timer while nothing is enabled');
  const resumed = created(await host.exec('scheduler_update', { id: task.id, enabled: true, title: '回邮件提醒' }));
  assert.equal(resumed.title, '回邮件提醒');

  const now = JSON.parse((await host.exec('scheduler_run_now', { id: task.id })).text);
  assert.equal(now.sessionId, 's-1');
  assert.equal((await host.task(task.id)).nextRunAt, '2026-09-28T07:00:00.000Z', 'run now leaves the schedule alone');
  await host.finish('s-1');

  await host.advance(5 * 3600_000); // 15:00
  assert.equal(host.sessions.length, 2);
  const done = await host.task(task.id);
  assert.equal(done.enabled, false, 'a one-shot task switches itself off after running');
  assert.equal(done.nextRunText, '已暂停');
  await assert.rejects(host.exec('scheduler_update', { id: task.id, enabled: true }), /以后不会再触发/);

  const moved = created(await host.exec('scheduler_update', { id: task.id, schedule: { type: 'daily', time: '18:30' }, enabled: true }));
  assert.equal(moved.scheduleText, '每天 18:30');
  assert.equal(moved.schedule.timeZone, 'Asia/Shanghai', 'keeps the task\'s zone');

  const list = JSON.parse((await host.exec('scheduler_list')).text);
  assert.equal(list.length, 1);
  const runs = JSON.parse((await host.exec('scheduler_runs', { id: task.id })).text);
  assert.deepEqual(runs.map((r) => r.trigger), ['schedule', 'manual']);
  assert.match((await host.exec('scheduler_delete', { id: task.id })).text, /已删除/);
  assert.equal((await host.exec('scheduler_list')).text, '还没有定时任务。');
  await assert.rejects(host.exec('scheduler_run_now', { id: task.id }), /找不到任务/);
});

test('a session that cannot start is recorded as failed and the schedule still advances', async (t) => {
  const host = await mount({ failStart: true });
  t.after(host.unmount);
  const task = created(await host.exec('scheduler_create', { title: 'x', prompt: 'p', schedule: { type: 'every', every_minutes: 30 } }));
  await host.advance(30 * 60_000);
  const view = await host.task(task.id);
  assert.equal(view.lastRun.status, 'failed');
  assert.match(view.lastRun.error, /无法启动会话：no model configured/);
  assert.equal(view.nextRunAt, '2026-09-28T03:30:00.000Z');
});

test('a restart marks runs that were in flight as interrupted and catches up a missed run', async (t) => {
  const first = await mount();
  const task = created(await first.exec('scheduler_create', { title: 'x', prompt: 'p', schedule: { type: 'every', every_minutes: 60 } }));
  await first.advance(3600_000);
  assert.equal((await first.task(task.id)).runCount, 1);
  await first.unmount();

  const second = await mount({ dir: first.dir, start: new Date('2026-09-28T06:00:00Z') });
  t.after(second.unmount);
  const view = await second.task(task.id);
  const { data } = await second.call('GET', `/api/scheduler/runs?id=${task.id}`);
  assert.equal(data.runs.at(-1).status, 'interrupted');
  assert.equal(second.sessions.length, 1, 'the overdue occurrence ran once at start-up');
  assert.equal(view.nextRunAt, '2026-09-28T06:30:00.000Z');
});

test('task page routes: move the time, toggle, run, delete, long-poll — nothing else', async (t) => {
  const host = await mount();
  t.after(host.unmount);
  const { data: first } = await host.call('GET', '/api/scheduler/tasks');
  const waiting = host.call('GET', `/api/scheduler/wait?revision=${first.revision}`);
  const task = created(await host.exec('scheduler_create', { title: '周报', prompt: '写周报', connectors: ['github'], schedule: { type: 'weekly', time: '17:00', weekdays: [5] } }));
  assert.ok((await waiting).data.revision > first.revision);
  const id = task.id;

  const moved = await host.call('POST', '/api/scheduler/update', { id, schedule: { ...task.schedule, time: '18:30', weekdays: [4, 5] } });
  assert.equal(moved.status, 200, JSON.stringify(moved.data));
  assert.equal(moved.data.task.scheduleText, '每周四、五 18:30');
  // Only the schedule and model pass through; the instruction and the rest stay the agent's job.
  const sneaky = await host.call('POST', '/api/scheduler/update', { id, prompt: 'rm -rf', title: 'x', connectors: [] });
  assert.equal(sneaky.data.task.prompt, '写周报');
  assert.deepEqual(sneaky.data.task.connectors, ['github']);
  assert.equal((await host.call('POST', '/api/scheduler/update', { id, schedule: { ...task.schedule, time: 'x' } })).status, 400);
  assert.equal((await host.call('POST', '/api/scheduler/update', { schedule: task.schedule })).status, 400, 'an id is required');
  for (const gone of ['/api/scheduler/save', '/api/scheduler/options', '/api/scheduler/preview']) assert.equal(host.routes.has(gone), false, gone);

  assert.equal((await host.call('POST', '/api/scheduler/toggle', { id, enabled: false })).data.task.enabled, false);
  assert.equal((await host.call('POST', '/api/scheduler/run', { id })).data.run.sessionId, 's-1');
  assert.equal((await host.call('POST', '/api/scheduler/delete', { id })).data.deleted, true);
});

test('chats opened from the page: the agent speaks first, in the task\'s workspace', async (t) => {
  const host = await mount();
  t.after(host.unmount);
  const task = created(await host.exec('scheduler_create', { title: '周报', prompt: '写周报', schedule: { type: 'daily', time: '09:00' } }));

  const edit = await host.call('POST', '/api/scheduler/chat', { id: task.id });
  assert.equal(edit.data.sessionId, 's-1');
  const opened = host.sessions.at(-1);
  assert.equal(opened.kind, 'user', 'reads like the user wrote it, not like a scheduled run');
  assert.equal(opened.workspace, host.workspace);
  assert.equal(opened.title, '⏰ 周报');
  assert.match(opened.text, new RegExp(`周报.*${task.id}.*scheduler_list.*scheduler_update`));
  assert.equal(opened.model, undefined, 'the chat uses DSH\'s default model');

  await host.call('POST', '/api/scheduler/chat', { text: '每天早上 9 点总结新邮件' });
  assert.match(host.sessions.at(-1).text, /每天早上 9 点总结新邮件.*scheduler_create/);
  await host.call('POST', '/api/scheduler/chat?lang=en', {});
  assert.match(host.sessions.at(-1).text, /^I want to set up a scheduled task/);
  assert.equal(host.sessions.at(-1).title, '⏰ New scheduled task');
  assert.equal((await host.call('POST', '/api/scheduler/chat', { id: 'nope' })).status, 404);
});

test('composePrompt is stable for a manual run', () => {
  const text = composePrompt({ title: 'T', prompt: 'do it', schedule: { type: 'daily', time: '09:00', timeZone: 'UTC' } }, { now: new Date('2026-01-01T00:00:00Z'), trigger: 'manual' });
  assert.equal(text.split('\n')[1], '本次运行：2026-01-01 00:00 周四（UTC）· 手动触发');
});

test('the bundled dist/host.js loads', async (t) => {
  const bundle = await import('../dist/host.js');
  assert.equal(bundle.name, 'dsh-scheduler');
  const host = await mount({ plugin: bundle });
  t.after(host.unmount);
  assert.deepEqual([...host.tools.keys()].sort(), ['scheduler_create', 'scheduler_delete', 'scheduler_list', 'scheduler_run_now', 'scheduler_runs', 'scheduler_update']);
  const task = created(await host.exec('scheduler_create', { title: 'b', prompt: 'p', schedule: { type: 'daily', time: '09:00' } }));
  assert.equal(task.scheduleText, '每天 09:00');
});

test('the task page gets English errors with ?lang=en; the agent keeps Chinese', async (t) => {
  const host = await mount();
  t.after(host.unmount);
  const task = created(await host.exec('scheduler_create', { title: 'x', prompt: 'y', schedule: { type: 'daily', time: '09:00' } }));
  const bad = await host.call('POST', '/api/scheduler/update?lang=en', { id: task.id, schedule: { type: 'daily', time: 'x' } });
  assert.equal(bad.data.error, 'Time must be 24-hour HH:MM, got: x');
  assert.equal((await host.call('GET', '/api/scheduler/runs?id=nope&lang=en')).data.error, 'Task not found');
  await assert.rejects(host.exec('scheduler_create', { title: 'x', prompt: 'y', schedule: { type: 'daily', time: 'x' } }), /24 小时制/);
});

test('a task can pin its own model and effort; without one it follows DSH\'s default', async (t) => {
  const host = await mount();
  t.after(host.unmount);
  const base = { title: 'm', prompt: 'p', schedule: { type: 'daily', time: '09:00' } };
  const plain = JSON.parse((await host.exec('scheduler_create', base)).text).task;
  assert.equal(plain.model, undefined);
  assert.equal(plain.modelText, '跟随 DSH 默认模型（当前：Claude Fable 5.1 · high）');

  const pinned = JSON.parse((await host.exec('scheduler_create', { ...base, title: 'n', model: 'Opus 5.5', reasoning_effort: 'max' })).text).task;
  assert.deepEqual(pinned.model, { provider: 'magpie', model: 'claude/claude-opus-5-5', reasoningEffort: 'max' });
  assert.equal(pinned.modelText, 'Claude Opus 5.5 · max');
  await host.exec('scheduler_run_now', { id: pinned.id });
  assert.deepEqual(host.sessions.at(-1).model, pinned.model, 'the run starts on the pinned model');

  await assert.rejects(host.exec('scheduler_update', { id: pinned.id, reasoning_effort: 'turbo' }), /不支持思考强度 turbo/);
  await assert.rejects(host.exec('scheduler_update', { id: pinned.id, model: 'gpt-9' }), /找不到模型 gpt-9.*Claude Opus 5.5/);
  const back = JSON.parse((await host.exec('scheduler_update', { id: pinned.id, model: 'default' })).text).task;
  assert.equal(back.model, undefined);
  await host.exec('scheduler_run_now', { id: plain.id });
  assert.deepEqual(host.sessions.at(-1).model, { provider: 'magpie', model: 'claude/claude-fable-5-1', reasoningEffort: 'high' }, 'no model → DSH\'s default at run time');

  // The page gets the catalog with the task list and switches the model through the same validation.
  const listed = (await host.call('GET', '/api/scheduler/tasks')).data;
  assert.deepEqual(listed.models.map((m) => [m.name, m.efforts?.map((e) => e.id) ?? []]), [['Claude Opus 5.5', ['high', 'max']], ['Claude Fable 5.1', []]]);
  assert.equal(listed.defaultModel.name, 'Claude Fable 5.1');
  const saved = await host.call('POST', '/api/scheduler/update', { id: plain.id, model: { provider: 'magpie', model: 'claude/claude-opus-5-5', reasoningEffort: 'high' } });
  assert.deepEqual(saved.data.task.model, { provider: 'magpie', model: 'claude/claude-opus-5-5', reasoningEffort: 'high' });
  assert.equal((await host.call('POST', '/api/scheduler/update', { id: plain.id, model: { provider: 'magpie', model: 'gpt-9' } })).status, 400);
  const cleared = await host.call('POST', '/api/scheduler/update', { id: plain.id, model: null });
  assert.equal(cleared.data.task.model, undefined);
});

test('a run never starts on a model that is gone: pinned → DSH default → any available model', async (t) => {
  const host = await mount();
  t.after(host.unmount);
  const base = { prompt: 'p', schedule: { type: 'daily', time: '09:00' } };
  const pinned = JSON.parse((await host.exec('scheduler_create', { ...base, title: 'a', model: 'Opus 5.5', reasoning_effort: 'max' })).text).task;
  const plain = JSON.parse((await host.exec('scheduler_create', { ...base, title: 'b' })).text).task;
  const lastRun = async (id) => (await host.call('GET', '/api/scheduler/runs?id=' + id)).data.runs[0];

  // Opus is taken away: the pinned task runs on DSH's default and the run says so.
  host.llm.models = host.llm.models.filter((m) => !m.id.includes('opus'));
  await host.exec('scheduler_run_now', { id: pinned.id });
  assert.deepEqual(host.sessions.at(-1).model, { provider: 'magpie', model: 'claude/claude-fable-5-1', reasoningEffort: 'high' });
  const r1 = await lastRun(pinned.id);
  assert.equal(r1.status, 'running');
  assert.equal(r1.fallback.reason, 'pinned_missing');
  assert.equal(r1.fallback.from.model, 'claude/claude-opus-5-5');

  // The default is gone too (only GPT left): the unpinned task takes what is there.
  host.llm.models = [{ provider: 'magpie', id: 'codex/gpt-6-luna', name: 'GPT-6-Luna' }];
  await host.exec('scheduler_run_now', { id: plain.id });
  assert.deepEqual(host.sessions.at(-1).model, { provider: 'magpie', model: 'codex/gpt-6-luna' });
  assert.equal((await lastRun(plain.id)).fallback.reason, 'default_missing');

  // Nothing at all: the run is recorded as failed with a message that says what to do.
  host.llm.models = [];
  host.llm.default = { provider: 'gone', model: 'x' };
  const fresh = JSON.parse((await host.exec('scheduler_create', { ...base, title: 'c' })).text).task;
  const before = host.sessions.length;
  await assert.rejects(host.exec('scheduler_run_now', { id: fresh.id }), /没有可用的模型/);
  const r3 = await lastRun(fresh.id);
  assert.equal(host.sessions.length, before, 'no session is started');
  assert.equal(r3.status, 'failed');
  assert.match(r3.error, /没有可用的模型/);
});
