/**
 * Model-facing tools. Natural language is the model's job: the tool schema tells it how to turn
 * "每个工作日早上 9 点" into `{ type: 'weekly', time: '09:00', weekdays: [1,2,3,4,5] }`, and every
 * result echoes the rule in words plus the next run times so the model can confirm with the user.
 */
import { hostTimeZone, isTimeZone } from '../shared/rules.js';
import { viewTask } from './tasks.js';
import { TaskError } from './store.js';

const SCHEDULE_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['type'],
  description: 'When the task runs. Wall-clock rules are interpreted in time_zone.',
  properties: {
    type: {
      type: 'string', enum: ['once', 'every', 'daily', 'weekly', 'monthly', 'cron'],
      description: 'once: a single time ("明天下午3点"); every: fixed interval ("每2小时", "每30分钟"); daily: every day at `time`; weekly: on `weekdays` at `time` ("工作日早上9点" → weekdays [1,2,3,4,5]); monthly: on `days` of the month at `time`; cron: anything else, as a standard 5-field cron.',
    },
    at: { type: 'string', description: 'once: local date and time "YYYY-MM-DD HH:MM" in time_zone (resolve relative dates like 明天/下周一 yourself from the current date).' },
    every_minutes: { type: 'number', description: 'every: interval in minutes (≥ 1). 2 hours = 120.' },
    time: { type: 'string', description: 'daily/weekly/monthly: 24-hour "HH:MM".' },
    weekdays: { type: 'array', items: { type: 'integer' }, description: 'weekly: ISO weekdays, Monday = 1 … Sunday = 7.' },
    days: { type: 'array', items: { type: 'integer' }, description: 'monthly: days of month 1–31.' },
    cron: { type: 'string', description: 'cron: "minute hour day-of-month month day-of-week", e.g. "0 9-18/3 * * 1-5".' },
    time_zone: { type: 'string', description: 'IANA time zone, e.g. Asia/Shanghai. Default: the user\'s browser time zone.' },
  },
};

const TASK_FIELDS = {
  title: { type: 'string', description: 'Short name shown in the task list, e.g. "早间邮件摘要" (≤ 80 chars).' },
  prompt: {
    type: 'string',
    description: 'The complete instruction a future agent will follow on every run. It will NOT see this conversation, so make it self-contained: what to check, which connector/tools to use, how to filter (e.g. only mail since the last run), the output format, and where to deliver results (e.g. reply in the session, or send an email). Write it in the user\'s language.',
  },
  schedule: SCHEDULE_SCHEMA,
  workspace: { type: 'string', description: 'Absolute path of the workspace the runs happen in. Default: the current session\'s workspace.' },
  connectors: { type: 'array', items: { type: 'string' }, description: 'Names of connectors the task relies on (e.g. ["gmail"]); see connectors_list. They are named in each run\'s instructions.' },
  misfire: { type: 'string', enum: ['run_once', 'skip'], description: 'If the computer was asleep/closed at the scheduled time: run_once (default) catches up once when possible; skip ignores runs more than 15 minutes late.' },
  enabled: { type: 'boolean', description: 'Default true. false creates it paused.' },
  model: { type: 'string', description: 'Only when the user names a model for this task, e.g. "Opus 5.5" or "claude/claude-opus-5-5" (display names work). Omit to follow DSH\'s default model at each run; "default" switches an existing task back to that.' },
  reasoning_effort: { type: 'string', description: 'Thinking effort for the task\'s model, e.g. low / medium / high / max. Only when the user asks.' },
};

const OUTPUT = {
  schema: { type: 'object', additionalProperties: false, required: ['text'], properties: { text: { type: 'string' }, taskId: { type: 'string' } } },
  render: (_args, value) => [{ type: 'text', text: value.text }],
};

/** The zone of the browser that sent the caller's latest message, else the Host's. */
export function callerTimeZone(exec) {
  try {
    const messages = exec?.agent?.session?.deriveMessages?.() ?? [];
    for (let i = messages.length - 1; i >= 0; i--) {
      const zone = messages[i]?.role === 'user' ? messages[i].source?.clientTimeZone : undefined;
      if (isTimeZone(zone)) return zone;
    }
  } catch { /* fall back */ }
  return hostTimeZone();
}

export function registerTools(ctx, { tasks, store, engine, models, now = () => new Date() }) {
  const register = (definition) => ctx.effect(() => ctx.tools.register({ output: OUTPUT, ...definition }), `dsh-scheduler: ${definition.name}`);
  const json = (value) => JSON.stringify(value, null, 2);
  const view = async (task, exec, preview = 3) => {
    const base = viewTask(task, { viewerZone: callerTimeZone(exec), preview, now: now() });
    const def = models.defaultSelection();
    return { ...base, modelText: task.model ? await models.label(task.model) : `跟随 DSH 默认模型（当前：${(await models.label(def)) ?? '未知'}）` };
  };
  /** `model` / `reasoning_effort` args → stored choice (null = follow the default); undefined when neither was passed. */
  const pickModel = async (args, current) => {
    if (args.model !== undefined) return models.resolve(args.model, args.reasoning_effort);
    if (args.reasoning_effort === undefined) return undefined;
    const base = current ?? models.defaultSelection();
    return models.resolve(base, args.reasoning_effort);
  };
  const findTask = async (id) => {
    const task = await store.get(String(id ?? ''));
    if (!task) throw new TaskError(`找不到任务 ${id}；先用 scheduler_list 查看现有任务的 id`);
    return task;
  };

  register({
    name: 'scheduler_create',
    description: [
      'Create a scheduled task that runs automatically, without the user present. At every occurrence a NEW session starts in the task\'s workspace and an agent carries out `prompt` on its own; it has the same tools as you, including connector tools (mcp__gmail__search_emails …).',
      'Use it whenever the user asks, in any wording, for something to happen later or repeatedly: "每个工作日早上 9 点检查 Gmail 新邮件并总结", "每 2 小时看一下服务器状态", "明天下午 3 点提醒我给王总回邮件", "every Monday summarize last week\'s GitHub issues".',
      'Turn the timing into `schedule` yourself (resolve 明天/下周一/今晚 from the current date; 早上 9 点 → 09:00, 晚上 8 点 → 20:00). If the timing is genuinely ambiguous, ask first. If the task needs an external system (email, GitHub…), call connectors_list first and pass the connector names.',
      'After creating, tell the user in one or two sentences what will run and when (use scheduleText and upcoming from the result), and that they can manage it in the "定时任务" page of the left sidebar.',
    ].join('\n'),
    parameters: { type: 'object', additionalProperties: false, required: ['title', 'prompt', 'schedule'], properties: TASK_FIELDS },
    async execute(args, exec) {
      const workspace = args.workspace || exec?.agent?.session?.header?.cwd;
      if (!workspace) throw new TaskError('这个会话没有工作区，请指定 workspace（绝对路径）');
      const { model: _m, reasoning_effort: _e, ...rest } = args;
      const model = await pickModel(args);
      const created = await tasks.create({ ...rest, model: model ?? undefined, workspace, defaultTimeZone: callerTimeZone(exec) }, { createdFrom: exec?.agent?.id ? String(exec.agent.id) : undefined });
      return { taskId: created.id, text: json({ created: true, task: await view(created, exec) }) };
    },
  });

  register({
    name: 'scheduler_list',
    description: 'List the user\'s scheduled tasks with their rule in words, next run, last run result and id. Use before updating/deleting, or when the user asks what is scheduled.',
    parameters: { type: 'object', additionalProperties: false, properties: { include_paused: { type: 'boolean', description: 'Include paused tasks (default true).' } } },
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const list = (await store.list()).filter((t) => args.include_paused !== false || t.enabled);
      if (list.length === 0) return { text: '还没有定时任务。' };
      return { text: json(await Promise.all(list.map(async (task) => {
        const { prompt, ...rest } = await view(task, exec, 1);
        return { ...rest, prompt: prompt.length > 300 ? `${prompt.slice(0, 300)}…` : prompt };
      }))) };
    },
  });

  register({
    name: 'scheduler_update',
    description: 'Change a scheduled task: rename it, rewrite its instruction, change when it runs or which model it uses, pause (enabled: false) or resume it. Only the fields you pass change; a new schedule or resuming recomputes the next run from now.',
    parameters: {
      type: 'object', additionalProperties: false, required: ['id'],
      properties: { id: { type: 'string', description: 'Task id from scheduler_list.' }, ...TASK_FIELDS },
    },
    async execute(args, exec) {
      const task = await findTask(args.id);
      const { id, model: _m, reasoning_effort: _e, ...fields } = args;
      if (fields.schedule && !fields.schedule.time_zone) fields.schedule = { ...fields.schedule, time_zone: task.schedule.timeZone };
      const model = await pickModel(args, task.model);
      if (model !== undefined) fields.model = model;
      const updated = await tasks.update(task.id, fields);
      return { taskId: updated.id, text: json({ updated: true, task: await view(updated, exec) }) };
    },
  });

  register({
    name: 'scheduler_delete',
    description: 'Delete a scheduled task permanently (its past run sessions stay). To stop it temporarily, use scheduler_update with enabled: false instead.',
    parameters: { type: 'object', additionalProperties: false, required: ['id'], properties: { id: { type: 'string' } } },
    async execute(args) {
      const task = await findTask(args.id);
      await tasks.remove(task.id);
      return { taskId: task.id, text: `已删除定时任务「${task.title}」。` };
    },
  });

  register({
    name: 'scheduler_run_now',
    description: 'Run a scheduled task once right now, in a new session, without changing its schedule. Useful to test a task just created. Returns immediately with the new session id; the run continues in the background.',
    parameters: { type: 'object', additionalProperties: false, required: ['id'], properties: { id: { type: 'string' } } },
    async execute(args) {
      const task = await findTask(args.id);
      const run = await engine.runNow(task.id);
      if (run.status === 'failed' || run.status === 'skipped') throw new TaskError(run.error ?? '运行失败');
      return { taskId: task.id, text: json({ started: true, runId: run.id, sessionId: run.sessionId, note: '任务已在新会话中开始运行，完成后可在「定时任务」页面查看结果。' }) };
    },
  });

  register({
    name: 'scheduler_runs',
    description: 'Show a task\'s recent runs: when, status (completed/failed/aborted/skipped/missed/interrupted/running), the session id, and the final answer summary.',
    parameters: {
      type: 'object', additionalProperties: false, required: ['id'],
      properties: { id: { type: 'string' }, limit: { type: 'integer', description: 'Most recent runs to show (default 10).' } },
    },
    isConcurrencySafe: () => true,
    async execute(args) {
      const task = await findTask(args.id);
      const limit = Math.min(50, Math.max(1, args.limit ?? 10));
      const runs = [...(task.runs ?? [])].reverse().slice(0, limit);
      return { taskId: task.id, text: runs.length ? json(runs) : `任务「${task.title}」还没有运行过。` };
    },
  });
}
