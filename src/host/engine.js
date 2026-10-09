/**
 * The scheduling engine: one timer aimed at the earliest due task, a run per due task, and run
 * bookkeeping driven by the Session's `turn/end` event.
 *
 * Rules that matter:
 *   - A task is advanced *before* its run starts, so a crash or error never fires it twice.
 *   - Missed occurrences (Host asleep or closed) collapse into one catch-up run, unless the task
 *     says `misfire: 'skip'` and it is later than the grace period.
 *   - A task whose previous run is still going is skipped for that occurrence, not stacked.
 */
import { MAX_RUNS, TaskError, newId } from './store.js';
import { formatLocal, nextOccurrence } from '../shared/rules.js';

export const LATE_GRACE_MS = 15 * 60 * 1000;
const MAX_TIMER_MS = 60 * 60 * 1000;
const SUMMARY_CHARS = 600;

/** The first message of every run: context the unattended agent needs, then the user's instruction. */
export function composePrompt(task, { now, scheduledFor, trigger, lastSuccessAt, connectorsText }) {
  const zone = task.schedule.timeZone;
  const lines = [
    `【定时任务】${task.title}`,
    `本次运行：${formatLocal(now, zone)}（${zone}）${trigger === 'manual' ? '· 手动触发' : scheduledFor ? `· 计划时间 ${formatLocal(scheduledFor, zone, { weekday: false })}` : ''}`,
    `上次成功运行：${lastSuccessAt ? `${formatLocal(lastSuccessAt, zone)}（ISO: ${new Date(lastSuccessAt).toISOString()}）——只需处理这之后的新内容` : '无（这是第一次运行）'}`,
  ];
  if (connectorsText) lines.push(connectorsText);
  lines.push(
    '这是一次无人值守的自动运行：不要向用户提问或等待确认，直接完成任务；信息不足时按最合理的方式处理，并在结果里说明你的假设。最后用简洁的中文给出结论。',
    '',
    '任务：',
    task.prompt,
  );
  return lines.join('\n');
}

function lastAssistantText(session) {
  try {
    const messages = session?.deriveMessages?.() ?? [];
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message.role !== 'assistant') continue;
      const text = (message.content ?? []).filter((block) => block.type === 'text').map((block) => block.text).join('\n').trim();
      if (text) return text.length > SUMMARY_CHARS ? `${text.slice(0, SUMMARY_CHARS)}…` : text;
    }
  } catch { /* a summary is a convenience */ }
  return undefined;
}

/**
 * @param deps.startSession - creates the run's Session (see runner.js).
 * @param deps.connectorsText - (task) → a line naming the task's connectors and their tool prefix.
 */
export function createEngine({ store, startSession, connectorsText = () => undefined, now = () => new Date(), log = () => {}, onChange = () => {}, lateGraceMs = LATE_GRACE_MS, timers = { set: setTimeout, clear: clearTimeout }, chooseModel = async (pinned) => ({ selection: pinned }) }) {
  let timer;
  let stopped = false;
  let ticking = Promise.resolve();
  const bySession = new Map();

  function arm(tasks) {
    timers.clear(timer);
    timer = undefined;
    if (stopped) return;
    const due = tasks.filter((t) => t.enabled && t.nextRunAt).map((t) => new Date(t.nextRunAt).getTime());
    if (due.length === 0) return;
    const delay = Math.min(MAX_TIMER_MS, Math.max(0, Math.min(...due) - now().getTime()));
    timer = timers.set(() => { tick().catch((error) => log(`定时任务调度出错：${error.message}`)); }, delay);
    timer?.unref?.();
  }

  async function reschedule() {
    arm(await store.list());
    onChange();
  }

  async function record(taskId, runId, fields) {
    await store.update(taskId, (task) => {
      const run = task.runs.find((r) => r.id === runId);
      if (!run) return undefined;
      Object.assign(run, fields);
      if (fields.status && fields.status !== 'running') task.lastRun = { ...run };
      return task;
    }).catch((error) => log(`更新运行记录失败：${error.message}`));
    onChange();
  }

  /** Start one run of `taskId`. Scheduled runs advance the task first; manual runs leave its timing alone. */
  async function fire(taskId, trigger) {
    const at = now();
    let run;
    let snapshot;
    await store.update(taskId, (task) => {
      const scheduledFor = trigger === 'schedule' ? task.nextRunAt : undefined;
      if (trigger === 'schedule') {
        // Every missed occurrence collapses into this one; the next is the first strictly after now.
        const next = nextOccurrence(task.schedule, at);
        task.nextRunAt = next ? next.toISOString() : null;
        if (!next) task.enabled = false;
      }
      run = { id: newId('r'), trigger, scheduledFor, startedAt: at.toISOString(), status: 'starting' };
      const late = scheduledFor ? at.getTime() - new Date(scheduledFor).getTime() : 0;
      if (trigger === 'schedule' && late > lateGraceMs && task.misfire === 'skip') {
        Object.assign(run, { status: 'missed', finishedAt: at.toISOString(), error: `错过了计划时间（晚了 ${Math.round(late / 60000)} 分钟），按设置跳过`, code: 'missed', minutes: Math.round(late / 60000) });
      } else if (task.runs.some((r) => r.status === 'running' || r.status === 'starting')) {
        Object.assign(run, { status: 'skipped', finishedAt: at.toISOString(), error: '上一次运行还没有结束，跳过本次', code: 'overlap' });
      }
      if (run.status !== 'starting') task.lastRun = { ...run };
      task.runs.push(run);
      if (task.runs.length > MAX_RUNS) task.runs = task.runs.slice(-MAX_RUNS);
      snapshot = task;
      return task;
    });
    if (run.status !== 'starting') { onChange(); return run; }

    const lastSuccess = [...snapshot.runs].reverse().find((r) => r.status === 'completed');
    const text = composePrompt(snapshot, {
      now: at, scheduledFor: run.scheduledFor, trigger, lastSuccessAt: lastSuccess?.startedAt,
      connectorsText: await connectorsText(snapshot),
    });
    try {
      // Check the model now, not at creation: providers and the default can change in between.
      const { selection, fallback } = await chooseModel(snapshot.model);
      const { sessionId } = await startSession({
        workspace: snapshot.workspace,
        title: `⏰ ${snapshot.title} · ${formatLocal(at, snapshot.schedule.timeZone, { weekday: false }).slice(5)}`,
        text, model: selection, agentPreset: snapshot.agentPreset, permissionPreset: snapshot.permissionPreset,
      });
      bySession.set(sessionId, { taskId, runId: run.id });
      const used = { ...(selection ? { model: selection } : {}), ...(fallback ? { fallback } : {}) };
      if (fallback) log(`定时任务 ${snapshot.title}：${fallback.from?.model ?? '默认模型'} 不可用，本次改用 ${fallback.to.model}`);
      run = { ...run, status: 'running', sessionId, ...used };
      await record(taskId, run.id, { status: 'running', sessionId, ...used });
    } catch (error) {
      run = { ...run, status: 'failed', error: `无法启动会话：${error.message}`, code: 'start_failed', detail: error.message };
      await record(taskId, run.id, { status: 'failed', finishedAt: now().toISOString(), error: run.error, code: run.code, detail: run.detail });
    }
    return run;
  }

  async function tick() {
    ticking = ticking.then(async () => {
      const at = now().getTime();
      const due = (await store.list()).filter((t) => t.enabled && t.nextRunAt && new Date(t.nextRunAt).getTime() <= at);
      for (const task of due) {
        await fire(task.id, 'schedule').catch((error) => log(`定时任务 ${task.title} 运行失败：${error.message}`));
      }
      await reschedule();
    });
    return ticking;
  }

  return {
    async start() {
      stopped = false;
      // A run that was going when the Host stopped can no longer report back.
      for (const task of await store.list()) {
        if (!task.runs?.some((r) => r.status === 'running' || r.status === 'starting')) continue;
        await store.update(task.id, (t) => {
          for (const r of t.runs) {
            if (r.status === 'running' || r.status === 'starting') Object.assign(r, { status: 'interrupted', finishedAt: now().toISOString(), error: '运行期间应用被关闭，结果未知（可打开会话查看）', code: 'interrupted' });
          }
          t.lastRun = { ...t.runs.at(-1) };
          return t;
        });
      }
      await tick();
    },
    stop() { stopped = true; timers.clear(timer); },
    reschedule,
    tick,
    runNow: async (taskId) => {
      if (!(await store.get(taskId))) throw new TaskError('任务不存在', 404, 'Task not found');
      const run = await fire(taskId, 'manual');
      await reschedule();
      return run;
    },
    /** Feed of `session/event`: the first `turn/end` of a run's Session settles the run. */
    onSessionEvent(session, event) {
      if (event?.type !== 'turn/end') return;
      const entry = bySession.get(session?.id);
      if (!entry) return;
      bySession.delete(session.id);
      const reason = event.data?.reason ?? {};
      const status = reason.kind === 'completed' || reason.kind === 'max-tokens' ? 'completed' : reason.kind === 'aborted' || reason.kind === 'interrupted' ? 'aborted' : reason.kind === 'error' ? 'failed' : 'completed';
      const error = reason.kind === 'error' ? reason.error?.message ?? '模型请求失败' : reason.kind === 'aborted' ? '运行被中止' : undefined;
      const code = reason.kind === 'aborted' ? 'aborted' : reason.kind === 'error' && !reason.error?.message ? 'model_failed' : undefined;
      record(entry.taskId, entry.runId, { status, finishedAt: now().toISOString(), summary: lastAssistantText(session), ...(error ? { error } : {}), ...(code ? { code } : {}) });
    },
    get activeSessions() { return new Map(bySession); },
  };
}
