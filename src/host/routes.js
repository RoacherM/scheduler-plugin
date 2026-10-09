/**
 * Authenticated `/api/scheduler/*` routes for the task page (through `ctx.connection.fetch`).
 * The page only switches tasks on and off, moves their time and picks their model; everything
 * else — creating a task, its instruction, connectors, workspace — happens in a chat it opens.
 */
import { hostTimeZone } from '../shared/rules.js';
import { TaskError } from './store.js';
import { viewTask } from './tasks.js';

const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

async function body(request) {
  try { return await request.json(); } catch { throw new TaskError('请求体不是有效的 JSON', 400, 'The request body is not valid JSON'); }
}

/** The task page sends `?lang=en` when DSH is in English; errors then come back in English. */
const english = (request) => new URL(request.url).searchParams.get('lang') === 'en';

/** The first message of a chat opened from the page: the agent asks, the user only answers. */
export function chatOpening({ task, text, en }) {
  if (task) {
    return en
      ? `I want to change the scheduled task “${task.title}” (id: ${task.id}). Look it up with scheduler_list, tell me its current setup in a sentence or two, then ask what I want to change; apply it with scheduler_update.`
      : `我想调整定时任务「${task.title}」（id：${task.id}）。先用 scheduler_list 查一下它现在的设置，用一两句话告诉我，然后问我想改什么；改的时候用 scheduler_update。`;
  }
  if (text) {
    return en
      ? `Set up a scheduled task: ${text}. Ask me about anything unclear first, then create it with scheduler_create.`
      : `帮我建一个定时任务：${text}。有不清楚的先问我，然后用 scheduler_create 创建。`;
  }
  return en
    ? 'I want to set up a scheduled task. Ask me what should run and when, then create it with scheduler_create.'
    : '我想新建一个定时任务。先问我要定时做什么、什么时候做，问清楚后用 scheduler_create 创建。';
}

export function registerRoutes(ctx, { store, tasks, engine, changes, models, startSession, defaultWorkspace = () => undefined, now = () => new Date() }) {
  const requireId = (input) => {
    if (typeof input?.id !== 'string' || input.id === '') throw new TaskError('缺少任务 id', 400, 'Missing task id');
    return input.id;
  };
  const views = async (viewerZone) => (await store.list())
    .map((task) => viewTask(task, { viewerZone, preview: 3, now: now() }))
    .sort((a, b) => (a.enabled === b.enabled ? (a.nextRunAt ?? '9').localeCompare(b.nextRunAt ?? '9') : a.enabled ? -1 : 1));

  const routes = [
    ['GET', '/api/scheduler/tasks', async (request, url) => json({
      tasks: await views(url.searchParams.get('tz') ?? undefined), hostTimeZone: hostTimeZone(), revision: changes.revision, ...(await models.describe()),
    })],
    ['GET', '/api/scheduler/wait', async (request, url) => {
      const since = Number(url.searchParams.get('revision') ?? -1);
      if (changes.revision === since) {
        await new Promise((resolve) => {
          const timer = setTimeout(done, 5_000);
          const unsubscribe = changes.subscribe(done);
          request.signal?.addEventListener('abort', done, { once: true });
          function done() { clearTimeout(timer); unsubscribe(); resolve(); }
        });
      }
      return json({ revision: changes.revision });
    }],
    ['GET', '/api/scheduler/runs', async (request, url) => {
      const task = await store.get(url.searchParams.get('id') ?? '');
      if (!task) throw new TaskError('任务不存在', 404, 'Task not found');
      return json({ runs: [...(task.runs ?? [])].reverse() });
    }],
    // Only the basics: the schedule (the page sends time/weekday changes of the stored rule) and the model.
    ['POST', '/api/scheduler/update', async (request) => {
      const input = await body(request);
      const fields = {};
      if (input.schedule !== undefined) fields.schedule = input.schedule;
      // { provider, model, reasoningEffort } or null (follow the default), checked against the catalog.
      if (input.model !== undefined) fields.model = input.model === null ? null : await models.resolve(input.model);
      return json({ task: viewTask(await tasks.update(requireId(input), fields), { preview: 3, now: now() }) });
    }],
    // Open a chat about a task (or a new one) and let the agent take it from there.
    ['POST', '/api/scheduler/chat', async (request) => {
      const input = await body(request);
      const task = input.id ? await store.get(input.id) : undefined;
      if (input.id && !task) throw new TaskError('任务不存在', 404, 'Task not found');
      const workspace = task?.workspace ?? defaultWorkspace();
      if (!workspace) throw new TaskError('还没有工作区：先在 DSH 里打开一个文件夹', 400, 'No workspace yet: open a folder in DSH first');
      const en = english(request);
      const title = task ? `⏰ ${task.title}` : en ? '⏰ New scheduled task' : '⏰ 新建定时任务';
      const text = chatOpening({ task, text: typeof input.text === 'string' ? input.text.trim().slice(0, 500) : undefined, en });
      return json(await startSession({ workspace, title, text, kind: 'user' }));
    }],
    ['POST', '/api/scheduler/toggle', async (request) => {
      const input = await body(request);
      return json({ task: viewTask(await tasks.update(requireId(input), { enabled: input.enabled === true }), { preview: 3, now: now() }) });
    }],
    ['POST', '/api/scheduler/run', async (request) => json({ run: await engine.runNow(requireId(await body(request))) })],
    ['POST', '/api/scheduler/delete', async (request) => json({ deleted: await tasks.remove(requireId(await body(request))) })],
  ];

  for (const [method, path, fn] of routes) {
    ctx.effect(() => ctx.connection.fetch.register({
      path, methods: [method], requestBody: 'buffered',
      fetch: async (request) => {
        try { return await fn(request, new URL(request.url)); } catch (error) {
          const message = english(request) && error?.en ? error.en : error?.message ?? String(error);
          return json({ error: message }, error instanceof TaskError ? error.status : 500);
        }
      },
    }), 'dsh-scheduler: ' + path);
  }
}
