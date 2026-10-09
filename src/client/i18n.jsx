/**
 * Page wording in Chinese and English, following DSH's language setting live. `{name}` in a
 * string is replaced from the values passed to t(). Any non-Chinese locale falls back to English.
 */
import React from 'react';

export const DICT = {
  zh: {
    panel: '定时任务',
    title: '定时任务',
    intro: '让 Agent 按时自动干活。每次运行都会新开一个会话，可以使用你接入的连接器。新建和修改都在对话里完成，这里只调时间和模型。',
    statActive: '运行中', statNext: '距下一次',
    sayInChat: '在对话里说：',
    examples: '每个工作日早上 9 点总结新邮件|每 2 小时看看 GitHub 新 issue|明天下午 3 点提醒我回邮件',
    newTask: '新建任务', loading: '加载中…', loadFailed: '加载失败：{error}',
    emptyTitle: '还没有定时任务', emptyBody: '点「新建任务」，Agent 会在对话里问你想定时做什么。',
    today: '今天', tomorrow: '明天', yesterday: '昨天', weekdayShort: '周{d}', monthDay: '{m}月{d}日', weekdays: '一|二|三|四|五|六|日',
    soon: '即将运行', inMinutes: '{n} 分钟后', inHours: '{n} 小时后', inDays: '{n} 天后',
    minutes: '{n} 分钟', hours: '{n} 小时', days: '{n} 天',
    seconds: '{n} 秒', paused: '已暂停', noMore: '不再运行', neverRan: '未运行过',
    pause: '暂停', enable: '启用',
    status_completed: '完成', status_running: '运行中', status_starting: '启动中', status_failed: '失败', status_aborted: '已中止',
    status_skipped: '已跳过', status_missed: '已错过', status_interrupted: '中断',
    manual: '手动', session: '会话',
    nextRun: '下次运行', upcoming: '接下来', workspace: '工作区',
    runNow: '立即运行', starting: '启动中…', editInChat: '在对话里修改', opening: '打开对话…', delete: '删除', confirmDelete: '确认删除',
    runs: '运行记录', noRuns: '还没有运行过。点「立即运行」试一次。',
    err_missed: '错过了计划时间（晚了 {minutes} 分钟），按设置跳过', err_overlap: '上一次运行还没有结束，跳过本次',
    err_start_failed: '无法启动会话：{detail}', err_interrupted: '运行期间应用被关闭，结果未知（可打开会话查看）',
    err_aborted: '运行被中止', err_model_failed: '模型请求失败',
    kind_daily: '每天', monthlyOn: '每月 {days} 日', when: '时间', weekdaysGroup: '星期', time: '时间',
    changeInChat: '在对话里修改',
    card_create: '创建定时任务', card_update: '更新定时任务', card_delete: '删除定时任务', card_run: '运行定时任务',
    working: '处理中…', failed: '失败', startedInNew: '已在新会话中开始运行', nextShort: '下次 {when}',
    openSession: '打开会话', view: '查看', deleted: '已删除',
    model: '模型', modelDefault: '跟随默认（{name}）',
    fb_pinned_missing: '指定的 {from} 当时不可用，这次改用 {to}', fb_default_missing: '默认模型 {from} 当时不可用，这次改用 {to}', modelFollow: '默认模型（{name}）',
  },
  en: {
    panel: 'Scheduled',
    title: 'Scheduled',
    intro: 'Let the agent work on a timetable. Every run starts a new session and can use your connectors. Create and change schedules in chat; here you only adjust the time and model.',
    statActive: 'Active', statNext: 'Next run in',
    sayInChat: 'Say in chat:',
    examples: 'Summarize new email every weekday at 9am|Check new GitHub issues every 2 hours|Remind me to reply tomorrow at 3pm',
    newTask: 'New schedule', loading: 'Loading…', loadFailed: 'Failed to load: {error}',
    emptyTitle: 'No schedules yet', emptyBody: 'Click “New schedule” and the agent will ask in chat what you want done.',
    today: 'Today', tomorrow: 'Tomorrow', yesterday: 'Yesterday', weekdayShort: '{d}', monthDay: '{mon} {d}', weekdays: 'Mon|Tue|Wed|Thu|Fri|Sat|Sun',
    soon: 'any moment', inMinutes: 'in {n} min', inHours: 'in {n} h', inDays: 'in {n} days',
    minutes: '{n} min', hours: '{n} h', days: '{n} days',
    seconds: '{n} s', paused: 'Paused', noMore: 'No more runs', neverRan: 'Never run',
    pause: 'Pause', enable: 'Enable',
    status_completed: 'Done', status_running: 'Running', status_starting: 'Starting', status_failed: 'Failed', status_aborted: 'Stopped',
    status_skipped: 'Skipped', status_missed: 'Missed', status_interrupted: 'Interrupted',
    manual: 'manual', session: 'Session',
    nextRun: 'Next run', upcoming: 'Then', workspace: 'Workspace',
    runNow: 'Run now', starting: 'Starting…', editInChat: 'Change in chat', opening: 'Opening chat…', delete: 'Delete', confirmDelete: 'Confirm delete',
    runs: 'Runs', noRuns: 'No runs yet. Click “Run now” to try it.',
    err_missed: 'Missed the scheduled time ({minutes} min late); skipped as configured', err_overlap: 'The previous run was still going; skipped this one',
    err_start_failed: 'Could not start a session: {detail}', err_interrupted: 'The app closed during the run; result unknown (open the session to check)',
    err_aborted: 'The run was stopped', err_model_failed: 'The model request failed',
    kind_daily: 'Daily', monthlyOn: 'Monthly on day {days}', when: 'Time', weekdaysGroup: 'Days', time: 'Time',
    changeInChat: 'Change in chat',
    card_create: 'Create schedule', card_update: 'Update schedule', card_delete: 'Delete schedule', card_run: 'Run schedule',
    working: 'Working…', failed: 'Failed', startedInNew: 'Started in a new session', nextShort: 'next {when}',
    openSession: 'Open session', view: 'View', deleted: 'Deleted',
    model: 'Model', modelDefault: 'Follow default ({name})',
    fb_pinned_missing: '{from} was unavailable, so this run used {to}', fb_default_missing: 'The default model {from} was unavailable, so this run used {to}', modelFollow: 'Default model ({name})',
  },
};

export const langOf = (active) => (String(active ?? '').toLowerCase().startsWith('zh') ? 'zh' : 'en');

export function translator(lang) {
  const dict = DICT[lang] ?? DICT.en;
  return (key, values = {}) => String(dict[key] ?? DICT.zh[key] ?? key).replace(/\{(\w+)\}/g, (_, name) => (values[name] ?? ''));
}

const I18n = React.createContext({ lang: 'zh', t: translator('zh') });

/** Wrap a tree so it re-renders when DSH's language changes. `locale` is ctx.locale (may be absent in tests). */
export function withI18n(locale, Component) {
  const subscribe = (fn) => locale?.subscribe?.(fn) ?? (() => {});
  // Subscribe to the locale id itself: a string compares by value, so a new snapshot object never loops.
  const snapshot = () => (locale?.getSnapshot?.() ?? locale?.getLocale?.())?.active ?? '';
  return function Localized(props) {
    const lang = langOf(React.useSyncExternalStore(subscribe, snapshot));
    const value = React.useMemo(() => ({ lang, t: translator(lang) }), [lang]);
    return <I18n.Provider value={value}><Component {...props} /></I18n.Provider>;
  };
}

export const useI18n = () => React.useContext(I18n);
