/**
 * Host half of the scheduler: stored tasks, the timer that runs them (each run = a new Session
 * in the task's workspace), the scheduler_* agent tools, and the task page routes.
 * Only `ctx` services are used at runtime — no @deepseek-ai imports.
 */
import { hostTimeZone } from '../shared/rules.js';
import { createEngine } from './engine.js';
import { createModelCatalog } from './models.js';
import { registerRoutes } from './routes.js';
import { createSessionRunner } from './runner.js';
import { createStore, defaultDataDir } from './store.js';
import { createTasks } from './tasks.js';
import { registerTools } from './tools.js';

export const name = 'dsh-scheduler';
export const inject = ['connection', 'tools', 'agents', 'agentPresets', 'permissionPresets', 'workspaceRegistry', 'agentDefaultModel'];

/** Connector tools are named mcp__<name>__<tool>; list which of the task's connectors are live right now. */
function connectorsLine(ctx, task) {
  if (!task.connectors?.length) return undefined;
  const names = new Set((ctx.tools.schemas?.() ?? []).map((schema) => schema.name));
  const parts = task.connectors.map((connector) => {
    const prefix = `mcp__${connector.replace(/-/g, '_')}__`;
    const live = [...names].some((n) => n.startsWith(prefix));
    return `${connector}（工具名以 ${prefix} 开头${live ? '' : '，⚠️ 当前未连接：如果调用失败，请在结果里提醒用户到「连接器」页面重新连接'}）`;
  });
  return `本任务使用的连接器：${parts.join('；')}`;
}

export function apply(ctx, config = {}) {
  const log = (message) => ctx.logger?.warn?.(message);
  const store = createStore({ dir: config.dataDir ?? defaultDataDir() });

  // Change feed for the task page's long-poll.
  const listeners = new Set();
  const changes = {
    revision: 0,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    bump() { changes.revision++; for (const fn of listeners) fn(); },
  };

  // `now`, `timers` and `startSession` are seams for tests; the running app uses the defaults.
  const now = config.now ?? (() => new Date());
  const models = config.models ?? createModelCatalog(ctx);
  const startSession = config.startSession ?? createSessionRunner(ctx);
  const engine = createEngine({
    chooseModel: (pinned) => models.pickRunnable(pinned),
    store, log, now, onChange: () => changes.bump(),
    ...(config.timers ? { timers: config.timers } : {}),
    startSession,
    connectorsText: (task) => connectorsLine(ctx, task),
  });
  const tasks = createTasks({ store, engine, now, defaultTimeZone: hostTimeZone });

  ctx.on('session/event', (session, event) => engine.onSessionEvent(session, event));
  ctx.effect(() => () => engine.stop(), 'dsh-scheduler: timer');

  // Where a "new task" chat opens when no task names a workspace.
  const defaultWorkspace = () => ctx.workspaceRegistry.list?.()?.[0]?.path;

  registerRoutes(ctx, { store, tasks, engine, changes, models, startSession, defaultWorkspace, now });
  registerTools(ctx, { tasks, store, engine, models, now });

  engine.start().catch((error) => log(`dsh-scheduler: 启动失败：${error.message}`));
}
