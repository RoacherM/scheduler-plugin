import React from 'react';
import { describeRule, formatLocal } from '../shared/describe.js';
import { api, browserZone, setApiLang } from './api.js';
import { useI18n, withI18n } from './i18n.jsx';
import { Icon, Logo, logoKind } from './icons.jsx';

const RUN_TONE = { completed: 'ok', running: 'warn', starting: 'warn', failed: 'err', aborted: 'err', skipped: '', missed: '', interrupted: 'warn' };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** Rules whose time of day the page can move in place; the rest are changed in chat. */
const WALL_CLOCK = ['daily', 'weekly', 'monthly'];

const pad = (n) => String(n).padStart(2, '0');
const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** "今天" / "Tomorrow" / "周三" / "Wed" (within a week) / "10月5日" / "Oct 5", in the browser's zone. */
export function dayLabel(date, t, now = new Date()) {
  const diff = Math.round((dayStart(date) - dayStart(now)) / 86_400_000);
  if (diff === 0) return t('today');
  if (diff === 1) return t('tomorrow');
  if (diff === -1) return t('yesterday');
  if (diff > 1 && diff < 7) return t('weekdayShort', { d: t('weekdays').split('|')[(date.getDay() + 6) % 7] });
  return t('monthDay', { m: date.getMonth() + 1, mon: MONTHS[date.getMonth()], d: date.getDate() });
}
const clock = (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;
export function relative(iso, t, now = new Date()) {
  const ms = new Date(iso) - now;
  if (ms < 60_000) return t('soon');
  const m = Math.round(ms / 60_000);
  if (m < 60) return t('inMinutes', { n: m });
  const h = Math.round(m / 60);
  if (h < 48) return t('inHours', { n: h });
  return t('inDays', { n: Math.round(h / 24) });
}
/** The bare distance ("4 小时" / "4 h") for the header stat. */
function distance(iso, t, now = new Date()) {
  const m = Math.max(1, Math.round((new Date(iso) - now) / 60_000));
  if (m < 60) return t('minutes', { n: m });
  const h = Math.round(m / 60);
  return h < 48 ? t('hours', { n: h }) : t('days', { n: Math.round(h / 24) });
}
const stamp = (iso, t) => { const d = new Date(iso); return `${dayLabel(d, t)} ${clock(d)}`; };
const duration = (run, t) => {
  if (!run.finishedAt || !run.startedAt) return '';
  const s = Math.round((new Date(run.finishedAt) - new Date(run.startedAt)) / 1000);
  return s < 60 ? t('seconds', { n: s }) : t('minutes', { n: Math.round(s / 60) });
};
/** Known run failures are stored with a code, so they read in the viewer's language. */
export const runError = (run, t) => (run.code ? t('err_' + run.code, { minutes: run.minutes, detail: run.detail ?? '' }) : run.error);
const folderName = (path) => path.split(/[\\/]/).filter(Boolean).pop() ?? path;
const scheduleText = (rule, lang) => describeRule(rule, browserZone(), lang);
const modelKey = (m) => (m ? `${m.provider}/${m.model ?? m.id}` : '');
/** "Claude Opus 5.5 · max" from a stored choice and the catalog. */
export function modelName(selection, catalog = []) {
  if (!selection) return '';
  const name = catalog.find((m) => modelKey(m) === modelKey(selection))?.name ?? selection.name ?? selection.model;
  return selection.reasoningEffort ? `${name} · ${selection.reasoningEffort}` : name;
}

function useTasks() {
  const [state, setState] = React.useState({ loading: true, error: null, data: null });
  const reload = React.useCallback(async () => {
    try { setState({ loading: false, error: null, data: await api.tasks() }); } catch (error) { setState((s) => ({ ...s, loading: false, error: error.message })); }
  }, []);
  React.useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    (async () => {
      await reload();
      let revision = -1;
      while (alive) {
        try {
          const next = await api.wait(revision, controller.signal);
          if (!alive) return;
          if (next.revision !== revision) { revision = next.revision; await reload(); }
        } catch {
          if (!alive) return;
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
    })();
    // Relative times ("3 小时后") drift even when nothing changes.
    const tick = setInterval(() => { if (alive) reload(); }, 60_000);
    return () => { alive = false; controller.abort(); clearInterval(tick); };
  }, [reload]);
  return [state, reload];
}

function Switch({ on, onChange, label, disabled }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} title={label} disabled={disabled} className={'sx-switch' + (on ? ' on' : '')}
    onClick={(e) => { e.stopPropagation(); onChange(!on); }} />;
}

function Pill({ status }) {
  const { t } = useI18n();
  const tone = RUN_TONE[status] ?? '';
  return <span className={'sx-pill ' + tone}><span className={'sx-dot ' + (tone === 'warn' ? 'busy' : tone)} />{t('status_' + status)}</span>;
}

function ConfirmDelete({ onConfirm, disabled }) {
  const { t } = useI18n();
  const [armed, setArmed] = React.useState(false);
  React.useEffect(() => {
    if (!armed) return undefined;
    const timer = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [armed]);
  if (armed) return <button type="button" className="sx-btn sm danger-solid" disabled={disabled} onClick={() => { setArmed(false); onConfirm(); }}>{t('confirmDelete')}</button>;
  return <button type="button" className="sx-btn ghost sm danger" disabled={disabled} onClick={() => setArmed(true)}><Icon.trash size={14} />{t('delete')}</button>;
}

/**
 * The only settings the page changes itself: the time of day (and the days, for a weekly rule)
 * and the model. Each change saves at once; anything else is done by talking to the agent.
 */
function BasicSettings({ task, catalog = [], defaultModel, onSaved }) {
  const { t, lang } = useI18n();
  const rule = task.schedule;
  const [time, setTime] = React.useState(rule.time ?? '');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(null);
  React.useEffect(() => setTime(rule.time ?? ''), [rule.time]);
  const save = async (fields) => {
    setBusy(true); setError(null);
    try { await api.update(task.id, fields); await onSaved(); } catch (e) { setError(e.message); setTime(rule.time ?? ''); } finally { setBusy(false); }
  };
  const commitTime = () => { if (/^\d{2}:\d{2}$/.test(time) && time !== rule.time) save({ schedule: { ...rule, time } }); };
  const pickModel = (value) => {
    const m = catalog.find((x) => modelKey(x) === value);
    // Keep the effort only when the new model offers it; changing it is a chat matter.
    const effort = m?.efforts?.some((e) => e.id === task.model?.reasoningEffort) ? task.model.reasoningEffort : undefined;
    save({ model: m ? { provider: m.provider, model: m.id, ...(effort ? { reasoningEffort: effort } : {}) } : null });
  };
  const names = t('weekdays').split('|');
  const otherZone = rule.timeZone && rule.timeZone !== browserZone();
  return (
    <div className="sx-basics">
      <div className="sx-basic">
        <span className="sx-basic-label">{t('when')}</span>
        {WALL_CLOCK.includes(rule.type) ? (
          <div className="sx-basic-control">
            {rule.type === 'weekly' ? (
              <div className="sx-days" role="group" aria-label={t('weekdaysGroup')}>
                {names.map((name, i) => {
                  const day = i + 1;
                  const on = rule.weekdays.includes(day);
                  return <button key={day} type="button" aria-pressed={on} title={name} disabled={busy || (on && rule.weekdays.length === 1)} className={'sx-day' + (on ? ' on' : '')}
                    onClick={() => save({ schedule: { ...rule, weekdays: on ? rule.weekdays.filter((d) => d !== day) : [...rule.weekdays, day].sort() } })}>{lang === 'en' ? name.slice(0, 2) : name}</button>;
                })}
              </div>
            ) : <span className="sx-basic-text">{rule.type === 'daily' ? t('kind_daily') : t('monthlyOn', { days: rule.days.join(lang === 'en' ? ', ' : '、') })}</span>}
            <input className="sx-input sx-time" type="time" aria-label={t('time')} value={time} disabled={busy} required
              onChange={(e) => setTime(e.target.value)} onBlur={commitTime} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
            {otherZone ? <span className="sx-hint">{rule.timeZone}</span> : null}
          </div>
        ) : <div className="sx-basic-control"><span className="sx-basic-text">{scheduleText(rule, lang)}</span><span className="sx-hint">{t('changeInChat')}</span></div>}
      </div>
      {catalog.length ? (
        <div className="sx-basic">
          <span className="sx-basic-label">{t('model')}</span>
          <div className="sx-basic-control">
            <select className="sx-input sx-model-select" aria-label={t('model')} value={modelKey(task.model)} disabled={busy} onChange={(e) => pickModel(e.target.value)}>
              <option value="">{t('modelDefault', { name: modelName(defaultModel, catalog) || '—' })}</option>
              {catalog.map((m) => <option key={modelKey(m)} value={modelKey(m)}>{modelKey(m) === modelKey(task.model) ? modelName(task.model, catalog) : m.name}</option>)}
            </select>
          </div>
        </div>
      ) : null}
      {error ? <div className="sx-note err"><Icon.alert size={14} /><span>{error}</span></div> : null}
    </div>
  );
}

function RunItem({ run, openSession, catalog }) {
  const { t } = useI18n();
  const fallback = run.fallback ? t('fb_' + run.fallback.reason, { from: modelName(run.fallback.from, catalog) || '—', to: modelName(run.fallback.to, catalog) }) : null;
  const tone = RUN_TONE[run.status] ?? '';
  const error = runError(run, t);
  return (
    <div className="sx-run">
      <span className={'sx-run-dot ' + tone} />
      <div className="sx-run-body">
        <div className="sx-run-head"><b>{stamp(run.startedAt, t)}</b><span>{t('status_' + run.status)}{run.trigger === 'manual' ? ` · ${t('manual')}` : ''}{duration(run, t) ? ` · ${duration(run, t)}` : ''}{run.model ? ` · ${modelName(run.model, catalog)}` : ''}</span></div>
        {fallback ? <div className="sx-run-note"><Icon.alert size={12} />{fallback}</div> : null}
        {error ? <div className="sx-run-error">{error}</div> : null}
        {run.summary ? <div className="sx-run-summary">{run.summary}</div> : null}
      </div>
      {run.sessionId ? <button type="button" className="sx-btn ghost sm" onClick={() => openSession(run.sessionId)}>{t('session')}<Icon.arrowUpRight size={13} /></button> : null}
    </div>
  );
}

function TaskRow({ task, open, onToggleOpen, openSession, chat, onChanged, catalog, defaultModel }) {
  const { t, lang } = useI18n();
  const [busy, setBusy] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [runs, setRuns] = React.useState(null);
  const act = (name, fn) => async () => {
    setBusy(name); setError(null);
    try { await fn(); await onChanged(); } catch (e) { setError(e.message); } finally { setBusy(null); }
  };
  React.useEffect(() => {
    if (!open) return;
    api.runs(task.id).then((r) => setRuns(r.runs), (e) => setError(e.message));
  }, [open, task.lastRun?.status, task.runCount]);
  const next = task.enabled && task.nextRunAt ? new Date(task.nextRunAt) : null;
  const last = task.lastRun;
  const rule = scheduleText(task.schedule, lang);
  const later = (task.upcomingAt ? task.upcomingAt.map((iso) => formatLocal(iso, task.schedule.timeZone, { lang })) : task.upcoming ?? []).slice(1).map((u) => u.slice(5)).join(lang === 'en' ? ', ' : '、');
  return (
    <div className={'sx-task' + (task.enabled ? '' : ' is-off') + (open ? ' open' : '')}>
      <div className="sx-row" role="button" tabIndex={0} aria-expanded={open} onClick={onToggleOpen}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleOpen(); } }}>
        <div className="sx-when">
          <b>{next ? clock(next) : '––:––'}</b>
          <span>{next ? `${dayLabel(next, t)} · ${relative(task.nextRunAt, t)}` : task.enabled ? t('noMore') : t('paused')}</span>
        </div>
        <div className="sx-main">
          <div className="sx-title">{task.title}</div>
          <div className="sx-meta">
            <span><Icon.repeat size={13} />{rule}</span>
            {task.connectors.length ? <span className="sx-logos" title={task.connectors.join(', ')}>{task.connectors.map((c) => <Logo key={c} kind={logoKind(c)} size={18} />)}</span> : null}
            <span title={task.workspace}><Icon.folder size={13} />{folderName(task.workspace)}</span>
            {task.model ? <span className="sx-model" title={t('model')}><Icon.spark size={12} />{modelName(task.model, catalog)}</span> : null}
          </div>
        </div>
        <div className="sx-right">
          {last ? <Pill status={last.status} /> : <span className="sx-hint">{t('neverRan')}</span>}
          <Switch on={task.enabled} label={task.enabled ? t('pause') : t('enable')} disabled={busy !== null} onChange={(on) => act('toggle', () => api.toggle(task.id, on))()} />
        </div>
      </div>
      {open ? (
        <div className="sx-detail">
          <BasicSettings task={task} catalog={catalog} defaultModel={defaultModel} onSaved={onChanged} />
          <pre className="sx-prompt">{task.prompt}</pre>
          <dl className="sx-facts">
            <div className="sx-fact"><dt>{t('nextRun')}</dt><dd>{next ? `${dayLabel(next, t)} ${clock(next)}` : '—'}</dd></div>
            <div className="sx-fact"><dt>{t('upcoming')}</dt><dd title={later}>{later || '—'}</dd></div>
            <div className="sx-fact"><dt>{t('workspace')}</dt><dd title={task.workspace}>{task.workspace}</dd></div>
          </dl>
          {error ? <div className="sx-note err"><Icon.alert size={14} /><span>{error}</span></div> : null}
          <div className="sx-toolbar">
            <button type="button" className="sx-btn sm" disabled={busy !== null} onClick={act('run', async () => { const { run } = await api.run(task.id); if (run.sessionId) openSession(run.sessionId); })}>
              <Icon.play size={13} />{busy === 'run' ? t('starting') : t('runNow')}
            </button>
            <button type="button" className="sx-btn ghost sm" disabled={busy !== null} onClick={act('chat', () => chat({ id: task.id }))}>
              <Icon.chat size={14} />{busy === 'chat' ? t('opening') : t('editInChat')}
            </button>
            <span className="sx-grow" />
            <ConfirmDelete disabled={busy !== null} onConfirm={act('delete', () => api.remove(task.id))} />
          </div>
          <div className="sx-runs">
            <h3>{t('runs')}</h3>
            {runs === null ? <span className="sx-hint">{t('loading')}</span> : runs.length === 0 ? <span className="sx-hint">{t('noRuns')}</span> : (
              <div className="sx-timeline">{runs.slice(0, 12).map((run) => <RunItem key={run.id} run={run} openSession={openSession} catalog={catalog} />)}</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function makeSchedulerPage({ openSession, locale }) {
  function SchedulerPage() {
    const { t, lang } = useI18n();
    setApiLang(lang);
    const [{ loading, error, data }, reload] = useTasks();
    const [openId, setOpenId] = React.useState(null);
    const [opening, setOpening] = React.useState(null);
    const [chatError, setChatError] = React.useState(null);
    /** New task, a task's changes, or one of the example phrases: all happen in a chat the agent opens with a question. */
    const chat = React.useCallback(async (input = {}) => {
      const { sessionId } = await api.chat(input);
      openSession(sessionId);
    }, []);
    const startNew = async (key, input) => {
      setOpening(key); setChatError(null);
      try { await chat(input); } catch (e) { setChatError(e.message); } finally { setOpening(null); }
    };
    const tasks = data?.tasks ?? [];
    const active = tasks.filter((task) => task.enabled && task.nextRunAt);
    const soonest = active[0];
    return (
      <div className="sx-page" lang={lang === 'en' ? 'en' : 'zh-CN'}>
        <div className="sx-inner">
          <header className="sx-head">
            <div>
              <h1>{t('title')}</h1>
              <p>{t('intro')}</p>
            </div>
            {tasks.length ? (
              <div className="sx-stats">
                <div className="sx-stat"><b>{active.length}</b><span>{t('statActive')}</span></div>
                <div className="sx-stat"><b>{soonest ? distance(soonest.nextRunAt, t) : '—'}</b><span>{t('statNext')}</span></div>
              </div>
            ) : null}
          </header>

          <div className="sx-examples">
            <span>{t('sayInChat')}</span>
            {t('examples').split('|').map((text) => (
              <button key={text} type="button" className="sx-example" disabled={opening !== null} onClick={() => startNew(text, { text })}><Icon.chat size={13} />{text}</button>
            ))}
            <span className="sx-grow" />
            <div className="sx-actions">
              <button type="button" className="sx-btn primary" disabled={opening !== null} onClick={() => startNew('new', {})}><Icon.plus size={15} />{opening === 'new' ? t('opening') : t('newTask')}</button>
            </div>
          </div>

          {chatError ? <div className="sx-note err"><Icon.alert size={14} /><span>{chatError}</span></div> : null}
          {error ? <div className="sx-note err"><Icon.alert size={14} /><span>{t('loadFailed', { error })}</span></div> : null}
          {loading ? <div className="sx-empty">{t('loading')}</div> : tasks.length === 0 ? (
            <div className="sx-empty">
              <span className="sx-empty-icon"><Icon.clock size={22} /></span>
              <b>{t('emptyTitle')}</b>
              <span>{t('emptyBody')}</span>
            </div>
          ) : (
            <div className="sx-list">
              {tasks.map((task) => (
                <TaskRow key={task.id} task={task} open={openId === task.id} onToggleOpen={() => setOpenId((id) => (id === task.id ? null : task.id))}
                  openSession={openSession} chat={chat} onChanged={reload} catalog={data?.models} defaultModel={data?.defaultModel} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }
  return withI18n(locale, SchedulerPage);
}
