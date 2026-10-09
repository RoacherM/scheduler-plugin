// Design preview: the real task page and chat card against mock data, for headless-Chrome screenshots.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { makeSchedulerPage } from '../src/client/page.jsx';
import { CSS } from '../src/client/styles.js';

const now = Date.now();
const at = (h) => new Date(now + h * 3600_000).toISOString();
const TASKS = [
  { id: 't-2', title: 'GitHub 每日 Issue / PR 汇总', prompt: '汇总 GitHub 账号 RoacherM 名下仓库「今天」新增的 Issue 和 Pull Request。\n\n输出：按仓库分组，每条写类型、编号、标题、作者、状态和链接；最后单列「需要我处理」。\n\n规则：只读。', enabled: true, schedule: { type: 'daily', time: '20:00', timeZone: 'Asia/Shanghai' }, upcomingAt: [at(4.2), at(28.2), at(52.2)],
    scheduleText: '每天 20:00', nextRunAt: at(4.2), upcoming: ['2026-09-28 20:00 周一', '2026-09-29 20:00 周二', '2026-09-30 20:00 周三'], workspace: '/Users/byronwayne/Desktop/DSH', connectors: ['github'], runCount: 3, model: { provider: 'magpie', model: 'claude/claude-opus-5-5', reasoningEffort: 'max' },
    lastRun: { id: 'r3', status: 'completed', startedAt: at(-19.8) } },
  { id: 't-1', title: '早间邮件摘要', prompt: '检查 Gmail 自上次运行以来的新邮件，按「需要我回复 / 值得知道 / 其余」分类总结。', enabled: true, schedule: { type: 'weekly', time: '09:00', weekdays: [1, 2, 3, 4, 5], timeZone: 'Asia/Shanghai' }, scheduleText: '工作日 09:00',
    nextRunAt: at(17.4), upcoming: ['2026-09-29 09:00 周二', '2026-09-30 09:00 周三', '2026-10-01 09:00 周四'], workspace: '/Users/byronwayne/Desktop/DSH', connectors: ['gmail'], runCount: 5,
    lastRun: { id: 'r1', status: 'failed', startedAt: at(-7) } },
  { id: 't-3', title: '周报草稿', prompt: '汇总本周提交和关闭的 Issue，起草周报。', enabled: true, schedule: { type: 'weekly', time: '17:30', weekdays: [5], timeZone: 'Asia/Shanghai' }, scheduleText: '每周五 17:30', nextRunAt: at(98), upcoming: [], workspace: '/Users/byronwayne/work', connectors: ['github', 'gmail'], runCount: 0 },
  { id: 't-4', title: '服务器健康检查', prompt: 'curl 健康检查接口并报告。', enabled: false, schedule: { type: 'every', everyMinutes: 120, anchor: at(-100), timeZone: 'Asia/Shanghai' }, scheduleText: '每 2 小时', nextRunAt: null, workspace: '/Users/byronwayne/ops', connectors: [], runCount: 12, lastRun: { id: 'r9', status: 'skipped', startedAt: at(-50) } },
];
const RUNS = [
  { id: 'r3', status: 'completed', trigger: 'schedule', startedAt: at(-19.8), finishedAt: at(-19.78), sessionId: 's3', summary: '今天新增 2 个 Issue、1 个 PR，涉及 deepbuddy 和 dsh-plugins。\n需要我处理：deepbuddy#42 请求你 review。' },
  { id: 'r2', status: 'failed', trigger: 'schedule', startedAt: at(-43.8), finishedAt: at(-43.79), sessionId: 's2', error: '模型请求失败：rate limited', model: { provider: 'magpie', model: 'claude/claude-fable-5-1', reasoningEffort: 'high' }, fallback: { reason: 'pinned_missing', from: { provider: 'magpie', model: 'claude/claude-opus-5-5', reasoningEffort: 'max' }, to: { provider: 'magpie', model: 'claude/claude-fable-5-1', reasoningEffort: 'high' } } },
  { id: 'r1', status: 'completed', trigger: 'manual', startedAt: at(-47), finishedAt: at(-46.99), sessionId: 's1', summary: '今天没有新增 Issue 或 PR。' },
];
const params = new URLSearchParams(location.search);
window.fetch = async (url) => {
  const path = new URL(url, location.href).pathname;
  const ok = (v) => new Response(JSON.stringify(v));
  if (path.endsWith('/wait')) return new Promise(() => {});
  if (path.endsWith('/runs')) return ok({ runs: RUNS });
  if (path.endsWith('/chat')) return ok({ sessionId: 's-chat' });
  if (path.endsWith('/update')) return ok({ task: TASKS[0] });
  return ok({ tasks: params.has('empty') ? [] : TASKS, revision: 1, models: [{ provider: 'magpie', id: 'claude/claude-opus-5-5', name: 'Claude Opus 5.5', efforts: [{ id: 'high', name: 'High' }, { id: 'max', name: 'Max' }] }, { provider: 'magpie', id: 'claude/claude-fable-5-1', name: 'Claude Fable 5.1', efforts: [{ id: 'high', name: 'High' }] }], defaultModel: { provider: 'magpie', model: 'claude/claude-fable-5-1', reasoningEffort: 'high', name: 'Claude Fable 5.1' } });
};
const style = document.createElement('style');
style.textContent = CSS;
document.head.appendChild(style);
if (params.get('theme') === 'dark') document.documentElement.dataset.theme = 'dark';
const locale = { getSnapshot: () => ({ active: params.get('lang') ?? 'zh-CN' }), subscribe: () => () => {} };
const Page = makeSchedulerPage({ openSession: () => {}, locale });
createRoot(document.getElementById('root')).render(<Page />);
setTimeout(() => {
  const open = Number(params.get('open') ?? (params.has('open') ? 0 : -1));
  if (open >= 0) document.querySelectorAll('.sx-row')[open]?.click();
}, 200);
