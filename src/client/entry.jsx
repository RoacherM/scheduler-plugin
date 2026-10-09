/**
 * Browser half: a "定时任务" entry in the left sidebar opening the task page, and a compact
 * card for scheduler_* tool calls in the conversation.
 */
import React from 'react';
import { describeRule, formatLocal } from '../shared/describe.js';
import { browserZone } from './api.js';
import { DICT, useI18n, withI18n } from './i18n.jsx';
import { Icon } from './icons.jsx';
import { makeSchedulerPage } from './page.jsx';
import { CSS } from './styles.js';

const PKG = '@local/dsh-scheduler';
const NS = 'local-scheduler';
const PANEL_ID = 'local-scheduler';
const CARD_TOOLS = ['scheduler_create', 'scheduler_update', 'scheduler_delete', 'scheduler_run_now'];

export const inject = ['slots', 'locale'];

function SchedulerIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2.5M9 2h6" />
    </svg>
  );
}

/** Parse the JSON a scheduler tool returned; null while running or for plain-text results. */
export function toolResult(block) {
  const text = (block?.content ?? []).find((c) => c?.type === 'text')?.text;
  if (!text) return null;
  try { return JSON.parse(text); } catch { return { message: text }; }
}

export function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh: { panel: DICT.zh.panel }, en: { panel: DICT.en.panel } }), 'dsh-scheduler: dictionary');
  const t = ctx.locale.bind(NS);
  ctx.effect(() => {
    const style = document.createElement('style');
    style.dataset.plugin = PKG;
    style.textContent = CSS;
    document.head.appendChild(style);
    return () => style.remove();
  }, 'dsh-scheduler: styles');

  const openPanel = () => ctx.get('layout')?.selectPanel(PANEL_ID);
  const openSession = (sessionId) => {
    const workspace = ctx.get('uiWorkspace');
    ctx.get('layout')?.selectPanel(null);
    if (workspace) workspace.openSession(sessionId);
  };
  const SchedulerPage = makeSchedulerPage({ openSession, locale: ctx.locale });

  ctx.effect(() => ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID, locale: NS }, SchedulerPage)), 'dsh-scheduler: page');
  ctx.effect(() => ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist', id: PANEL_ID, order: 14, locale: NS, label: () => t('panel'),
  }, SchedulerIcon)), 'dsh-scheduler: sidebar entry');

  const VERB = { scheduler_create: 'card_create', scheduler_update: 'card_update', scheduler_delete: 'card_delete', scheduler_run_now: 'card_run' };
  function ToolCard(props) {
    const { t, lang } = useI18n();
    const done = props.phase === 'result';
    const block = done ? props.block : undefined;
    const value = toolResult(block);
    const failed = block?.isError === true;
    const task = value?.task;
    let title = VERB[props.toolName] ? t(VERB[props.toolName]) : props.toolName;
    let sub = done ? '' : t('working');
    if (done) {
      if (failed) sub = value?.message?.split('\n')[0] ?? t('failed');
      else if (task) {
        title = task.title;
        const when = task.enabled && task.nextRunAt ? formatLocal(task.nextRunAt, task.schedule.timeZone, { lang }) : task.enabled ? t('noMore') : t('paused');
        sub = `${describeRule(task.schedule, browserZone(), lang)} · ${t('nextShort', { when })}${task.model && task.modelText ? ` · ${task.modelText}` : ''}`;
      } else if (value?.started) sub = t('startedInNew');
      else if (props.toolName === 'scheduler_delete') { const name = /「(.+?)」/.exec(value?.message ?? '')?.[1]; if (name) title = name; sub = t('deleted'); }
      else sub = value?.message?.split('\n')[0] ?? '';
    }
    return (
      <div className="sx-card">
        <span className={'sx-card-icon' + (failed ? ' err' : '')}>{failed ? <Icon.alert size={18} /> : <Icon.clock size={18} />}</span>
        <div className="sx-card-text">
          <div className="sx-card-title">{title}</div>
          <div className={'sx-card-sub' + (failed ? ' err' : '')}>{sub.slice(0, 200)}</div>
        </div>
        {done && !failed && value?.sessionId ? <button type="button" className="sx-btn sm" onClick={() => openSession(value.sessionId)}>{t('openSession')}</button> : null}
        {done && !failed && props.toolName !== 'scheduler_delete' ? <button type="button" className="sx-btn ghost sm" onClick={openPanel}>{t('view')}<Icon.chevron size={13} /></button> : null}
      </div>
    );
  }
  const LocalizedCard = withI18n(ctx.locale, ToolCard);
  for (const name of CARD_TOOLS) {
    ctx.effect(() => ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({ name: 'tool.call.toolview', key: name, locale: NS }, LocalizedCard)), 'dsh-scheduler: tool card ' + name);
  }
}
