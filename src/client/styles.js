import { baseCss } from './base.js';

const fg = 'var(--dsw-alias-label-primary)', fg2 = 'var(--dsw-alias-label-secondary)', fg3 = 'var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary))';
const l1 = 'var(--dsw-alias-bg-layer-1)', l2 = 'var(--dsw-alias-bg-layer-2)', base = 'var(--dsw-alias-bg-base)';
const line = 'var(--dsw-alias-border-l1)', line2 = 'var(--dsw-alias-border-l2)';
const ok = 'var(--dsw-alias-state-success-primary)', warn = 'var(--dsw-alias-state-warn-primary)', err = 'var(--dsw-alias-state-error-primary)';
const mix = (c, p, into = 'transparent') => `color-mix(in srgb, ${c} ${p}%, ${into})`;

/** Task list reads like an alarm clock: the next run time leads each row, big and tabular. */
export const CSS = baseCss('sx') + `
.sx-stats { display:flex; gap:28px; }
.sx-stat b { display:block; font-size:24px; font-weight:600; letter-spacing:-.03em; line-height:1.1; font-variant-numeric:tabular-nums; }
.sx-stat span { font-size:12px; color:${fg3}; }
.sx-actions { display:flex; gap:8px; }

.sx-examples { display:flex; flex-wrap:wrap; align-items:center; gap:6px; }
.sx-examples > span { margin-right:4px; font-size:12px; color:${fg3}; }
.sx-example { display:inline-flex; align-items:center; gap:6px; height:28px; padding:0 11px; border:none; border-radius:999px; background:${l2}; color:${fg2}; font:inherit; font-size:12.5px; cursor:pointer; transition:background .12s, color .12s; }
.sx-example:hover { background:${mix(fg, 10, l2)}; color:${fg}; }

.sx-list { border-radius:14px; background:${l1}; box-shadow:0 0 0 1px ${line}, 0 1px 2px rgba(0,0,0,.03); overflow:hidden; }
.sx-task + .sx-task { border-top:1px solid ${line}; }
.sx-row { display:grid; grid-template-columns:124px 1fr auto; align-items:center; gap:18px; padding:16px 18px 16px 20px; cursor:pointer; transition:background .12s; }
.sx-row:hover { background:${mix(l2, 55)}; }
.sx-task.open .sx-row { background:${mix(l2, 40)}; }
.sx-when { display:flex; flex-direction:column; gap:1px; }
.sx-when b { font-size:22px; font-weight:600; letter-spacing:-.03em; line-height:1.1; font-variant-numeric:tabular-nums; }
.sx-when span { font-size:12px; color:${fg3}; white-space:nowrap; }
.sx-task.is-off .sx-when b, .sx-task.is-off .sx-title { color:${fg3}; }
.sx-main { min-width:0; display:flex; flex-direction:column; gap:5px; }
.sx-title { overflow:hidden; font-size:14px; font-weight:600; letter-spacing:-.01em; text-overflow:ellipsis; white-space:nowrap; }
/* One line, always: rows stay the same height; the workspace and model give way first. */
.sx-meta { display:flex; flex-wrap:nowrap; overflow:hidden; height:18px; align-items:center; gap:10px; font-size:12px; color:${fg2}; }
.sx-meta > span { display:inline-flex; align-items:center; gap:5px; white-space:nowrap; }
.sx-logos { display:inline-flex; }
.sx-logos .ui-logo + .ui-logo { margin-left:-4px; }
.sx-logos .ui-logo { box-shadow:0 0 0 1.5px ${l1}, inset 0 0 0 1px rgba(0,0,0,.08); }
.sx-meta > span:nth-child(n+3) { flex-shrink:1; min-width:0; overflow:hidden; text-overflow:ellipsis; }
.sx-run-note { display:flex; align-items:center; gap:5px; margin-top:3px; font-size:12px; color:${warn}; }
.sx-model { padding:0 7px; height:18px; line-height:18px; border-radius:999px; background:${l2}; color:${fg2}; font-size:11.5px; }
.sx-right { display:flex; align-items:center; gap:14px; }
.sx-pill { display:inline-flex; align-items:center; gap:5px; height:22px; padding:0 8px; border-radius:999px; font-size:11.5px; font-weight:500; white-space:nowrap; background:${l2}; color:${fg2}; }
.sx-pill.ok { background:${mix(ok, 12)}; color:${ok}; }
.sx-pill.err { background:${mix(err, 10)}; color:${err}; }
.sx-pill.warn { background:${mix(warn, 14)}; color:${mix(warn, 80, fg)}; }
.sx-pill .sx-dot { width:6px; height:6px; box-shadow:none; }

.sx-detail { display:flex; flex-direction:column; gap:16px; padding:2px 20px 18px 162px; animation:sx-fade .15s ease-out; }
.sx-prompt { margin:0; padding:12px 14px; border-radius:10px; background:${l2}; color:${fg}; font-size:12.5px; line-height:1.65; white-space:pre-wrap; max-height:220px; overflow:auto; }
.sx-facts { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:10px 20px; }
.sx-fact { min-width:0; }
.sx-fact dt { font-size:11.5px; color:${fg3}; }
.sx-fact dd { margin:2px 0 0; overflow:hidden; font-size:12.5px; text-overflow:ellipsis; white-space:nowrap; font-variant-numeric:tabular-nums; }
.sx-toolbar { display:flex; align-items:center; gap:4px; margin-left:-8px; }

.sx-runs h3 { margin:0 0 6px; font-size:12px; font-weight:600; color:${fg2}; }
.sx-timeline { position:relative; display:flex; flex-direction:column; }
.sx-run { position:relative; display:grid; grid-template-columns:14px 1fr auto; gap:12px; padding:7px 0; }
.sx-run::before { content:''; position:absolute; left:6px; top:0; bottom:0; width:1px; background:${line2}; }
.sx-run:first-child::before { top:14px; }
.sx-run:last-child::before { bottom:calc(100% - 14px); }
.sx-run:only-child::before { display:none; }
.sx-run-dot { position:relative; z-index:1; margin-top:4px; width:13px; height:13px; border-radius:50%; background:${l1}; box-shadow:inset 0 0 0 2px ${fg3}; }
.sx-run-dot.ok { box-shadow:inset 0 0 0 2px ${ok}; background:${ok}; }
.sx-run-dot.err { box-shadow:inset 0 0 0 2px ${err}; background:${err}; }
.sx-run-dot.warn { box-shadow:inset 0 0 0 2px ${warn}; animation:sx-pulse 1.1s ease-in-out infinite; }
.sx-run-body { min-width:0; }
.sx-run-head { display:flex; align-items:baseline; gap:8px; font-size:12.5px; }
.sx-run-head b { font-weight:500; font-variant-numeric:tabular-nums; }
.sx-run-head span { font-size:12px; color:${fg3}; }
.sx-run-summary { margin-top:3px; color:${fg2}; font-size:12.5px; line-height:1.55; white-space:pre-wrap; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; }
.sx-run-error { margin-top:3px; color:${err}; font-size:12.5px; line-height:1.5; }

.sx-empty { display:flex; flex-direction:column; align-items:center; gap:6px; padding:56px 24px; border-radius:14px; box-shadow:inset 0 0 0 1px ${line}; text-align:center; color:${fg2}; }
.sx-empty-icon { display:flex; align-items:center; justify-content:center; width:44px; height:44px; margin-bottom:6px; border-radius:12px; background:${l2}; color:${fg2}; }
.sx-empty b { color:${fg}; font-size:14px; }

/* The page's whole control surface: time (and days) and model, each a single labelled line. */
.sx-basics { display:flex; flex-direction:column; gap:8px; }
.sx-basic { display:grid; grid-template-columns:44px 1fr; align-items:center; gap:12px; min-height:32px; }
.sx-basic-label { font-size:12px; color:${fg3}; }
.sx-basic-control { display:flex; flex-wrap:wrap; align-items:center; gap:8px; min-width:0; font-size:12.5px; }
.sx-basic-text { color:${fg}; }
.sx-time { height:30px; width:96px; font-variant-numeric:tabular-nums; }
.sx-model-select { height:30px; max-width:320px; }
.sx-days { display:flex; gap:3px; }
.sx-day { width:28px; height:28px; padding:0; border:none; border-radius:50%; box-shadow:inset 0 0 0 1px ${line2}; background:${base}; color:${fg2}; font:inherit; font-size:12px; font-weight:500; cursor:pointer; transition:background .12s, color .12s, box-shadow .12s; }
.sx-day:hover:not(:disabled) { box-shadow:inset 0 0 0 1px ${mix(fg, 35)}; }
.sx-day.on { background:${fg}; color:${base}; box-shadow:none; }
.sx-day:disabled { cursor:default; }
.sx-example:disabled { opacity:.6; cursor:default; }

.sx-card { display:flex; align-items:center; gap:12px; max-width:560px; margin:2px 0; padding:12px 14px; border-radius:12px; background:${l1}; box-shadow:0 0 0 1px ${line}; }
.sx-card-icon { display:flex; flex:none; align-items:center; justify-content:center; width:36px; height:36px; border-radius:10px; background:${fg}; color:${base}; }
.sx-card-icon.err { background:${mix(err, 12)}; color:${err}; }
.sx-card-text { flex:1; min-width:0; }
.sx-card-title { overflow:hidden; font-size:13.5px; font-weight:600; text-overflow:ellipsis; white-space:nowrap; }
.sx-card-sub { margin-top:1px; overflow:hidden; font-size:12px; color:${fg2}; text-overflow:ellipsis; white-space:nowrap; font-variant-numeric:tabular-nums; }
.sx-card-sub.err { color:${err}; white-space:normal; }
@media (max-width:640px) { .sx-row { grid-template-columns:72px 1fr; } .sx-right { grid-column:1 / -1; } .sx-detail { padding-left:20px; } }
`;
