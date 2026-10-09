/**
 * Task validation and editing shared by the agent tools and the task page.
 */
import { stat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { RuleError, describeRule, formatLocal, nextOccurrence, nextOccurrences, normalizeRule } from '../shared/rules.js';
import { TaskError, newId } from './store.js';

const FIELD_EN = { title: 'Name', prompt: 'Instructions' };
const text = (value, field, max, required) => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (required && !trimmed) throw new TaskError(`${field} 不能为空`, 400, `${FIELD_EN[field] ?? field} is required`);
  if (trimmed.length > max) throw new TaskError(`${field} 最长 ${max} 个字符`, 400, `${FIELD_EN[field] ?? field} can be at most ${max} characters`);
  return trimmed;
};

async function checkWorkspace(path) {
  if (typeof path !== 'string' || !isAbsolute(path)) throw new TaskError('workspace 必须是绝对路径', 400, 'The workspace must be an absolute path');
  const info = await stat(path).catch(() => undefined);
  if (!info?.isDirectory()) throw new TaskError(`工作区目录不存在：${path}`, 400, `Workspace folder does not exist: ${path}`);
  return path;
}

/** Stored model choice, or undefined for "follow DSH's default model". */
const modelOf = (m) => (m?.provider && m?.model
  ? { provider: String(m.provider), model: String(m.model), ...(m.reasoningEffort ? { reasoningEffort: String(m.reasoningEffort) } : {}) }
  : undefined);

const wrapRule = (fn) => {
  try { return fn(); } catch (error) { if (error instanceof RuleError) throw new TaskError(error.message, 400, error.en); throw error; }
};

/** Public view of a task, with human-readable timing. */
export function viewTask(task, { viewerZone, preview = 0, now = new Date() } = {}) {
  const zone = task.schedule.timeZone;
  return {
    id: task.id,
    title: task.title,
    prompt: task.prompt,
    enabled: task.enabled,
    schedule: task.schedule,
    scheduleText: describeRule(task.schedule, viewerZone),
    nextRunAt: task.nextRunAt,
    nextRunText: task.enabled && task.nextRunAt ? `${formatLocal(task.nextRunAt, zone)}（${zone}）` : task.enabled ? '不会再运行' : '已暂停',
    ...(preview > 0 && task.enabled ? (() => {
      const upcoming = nextOccurrences(task.schedule, preview, now);
      return { upcoming: upcoming.map((d) => formatLocal(d, zone)), upcomingAt: upcoming.map((d) => d.toISOString()) };
    })() : {}),
    workspace: task.workspace,
    connectors: task.connectors ?? [],
    misfire: task.misfire ?? 'run_once',
    model: task.model,
    permissionPreset: task.permissionPreset,
    lastRun: task.lastRun,
    runCount: task.runs?.length ?? 0,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    createdFrom: task.createdFrom,
  };
}

export function createTasks({ store, engine, now = () => new Date(), defaultTimeZone }) {
  return {
    async list() { return store.list(); },

    async create(input, { createdFrom } = {}) {
      const at = now();
      const schedule = wrapRule(() => normalizeRule(input.schedule, { now: at, defaultTimeZone: input.defaultTimeZone ?? defaultTimeZone() }));
      const next = nextOccurrence(schedule, at);
      const task = {
        id: newId('t'),
        title: text(input.title, 'title', 80, true),
        prompt: text(input.prompt, 'prompt', 20_000, true),
        schedule,
        enabled: input.enabled !== false,
        workspace: await checkWorkspace(input.workspace),
        connectors: Array.isArray(input.connectors) ? input.connectors.map(String).filter(Boolean).slice(0, 20) : [],
        misfire: input.misfire === 'skip' ? 'skip' : 'run_once',
        ...(modelOf(input.model) ? { model: modelOf(input.model) } : {}),
        ...(input.permissionPreset ? { permissionPreset: String(input.permissionPreset) } : {}),
        ...(input.agentPreset ? { agentPreset: String(input.agentPreset) } : {}),
        nextRunAt: next ? next.toISOString() : null,
        createdAt: at.toISOString(),
        updatedAt: at.toISOString(),
        ...(createdFrom ? { createdFrom } : {}),
        runs: [],
      };
      const saved = await store.insert(task);
      await engine.reschedule();
      return saved;
    },

    /** Replace the given fields; a changed schedule (or re-enabling) recomputes the next run from now. */
    async update(id, input) {
      const at = now();
      const workspace = input.workspace === undefined ? undefined : await checkWorkspace(input.workspace);
      const saved = await store.update(id, (task) => {
        if (input.title !== undefined) task.title = text(input.title, 'title', 80, true);
        if (input.prompt !== undefined) task.prompt = text(input.prompt, 'prompt', 20_000, true);
        if (workspace !== undefined) task.workspace = workspace;
        if (input.connectors !== undefined) task.connectors = (Array.isArray(input.connectors) ? input.connectors : []).map(String).filter(Boolean).slice(0, 20);
        if (input.misfire !== undefined) task.misfire = input.misfire === 'skip' ? 'skip' : 'run_once';
        if (input.model !== undefined) {
          if (modelOf(input.model)) task.model = modelOf(input.model);
          else delete task.model;
        }
        if (input.permissionPreset !== undefined) { if (input.permissionPreset) task.permissionPreset = String(input.permissionPreset); else delete task.permissionPreset; }
        let retime = false;
        if (input.schedule !== undefined) {
          task.schedule = wrapRule(() => normalizeRule(input.schedule, { now: at, defaultTimeZone: task.schedule.timeZone }));
          retime = true;
        }
        if (input.enabled !== undefined && Boolean(input.enabled) !== task.enabled) {
          task.enabled = Boolean(input.enabled);
          retime = task.enabled;
        }
        if (retime) {
          const next = nextOccurrence(task.schedule, at);
          if (!next && task.enabled) throw new TaskError('这个时间规则以后不会再触发（一次性任务的时间已经过去），请先修改时间', 400, 'This schedule never fires again (the one-time date has passed). Change the time first.');
          task.nextRunAt = next ? next.toISOString() : null;
        }
        task.updatedAt = at.toISOString();
        return task;
      });
      await engine.reschedule();
      return saved;
    },

    async remove(id) {
      const removed = await store.remove(id);
      await engine.reschedule();
      return removed;
    },
  };
}
