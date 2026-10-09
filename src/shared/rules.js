/**
 * Schedule rules: validation, next-occurrence arithmetic (DST-correct through croner's IANA
 * time-zone support) and a human description. Shared by the Host and the task page.
 *
 * Stored rule shapes (always with an IANA `timeZone`):
 *   { type: 'once',    at: ISO-UTC }
 *   { type: 'every',   everyMinutes, anchor: ISO-UTC }        — fixed interval from the anchor
 *   { type: 'daily',   time: 'HH:MM' }
 *   { type: 'weekly',  time, weekdays: [1..7] }                — ISO weekdays, Monday = 1
 *   { type: 'monthly', time, days: [1..31] }                   — a day missing from a month is skipped
 *   { type: 'cron',    cron: 'm h dom mon dow' }               — standard five fields
 */
import { Cron } from 'croner';

export const MIN_INTERVAL_MS = 60_000;
export const RULE_TYPES = ['once', 'every', 'daily', 'weekly', 'monthly', 'cron'];

/** `message` is Chinese (what the agent sees); `en` is shown on an English task page. */
export class RuleError extends Error {
  constructor(message, en) { super(message); this.en = en ?? message; }
}

export function isTimeZone(zone) {
  if (typeof zone !== 'string' || zone === '') return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: zone }); return true; } catch { return false; }
}

export const hostTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

function parseTime(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? '').trim());
  if (!match) throw new RuleError(`time 必须是 24 小时制 HH:MM，收到：${value}`, `Time must be 24-hour HH:MM, got: ${value}`);
  const [h, m] = [Number(match[1]), Number(match[2])];
  if (h > 23 || m > 59) throw new RuleError(`无效的时间：${value}`, `Invalid time: ${value}`);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function intList(value, min, max, field) {
  const list = (Array.isArray(value) ? value : [value]).map(Number);
  if (list.length === 0 || list.some((n) => !Number.isInteger(n) || n < min || n > max)) throw new RuleError(`${field} 必须是 ${min}–${max} 的整数列表`, `${field} must be whole numbers from ${min} to ${max}`);
  return [...new Set(list)].sort((a, b) => a - b);
}

/** A cron pattern croner accepts, restricted to the standard five fields (no seconds, no year). */
function checkCron(expression, timeZone) {
  const text = String(expression ?? '').trim().replace(/\s+/g, ' ');
  if (text.split(' ').length !== 5) throw new RuleError('cron 必须是标准的 5 段格式：分 时 日 月 周，例如 "0 9 * * 1-5"', 'Cron must have five fields: minute hour day month weekday, e.g. "0 9 * * 1-5"');
  try { new Cron(text, { timezone: timeZone, paused: true }); } catch (error) { throw new RuleError(`无效的 cron 表达式：${error.message}`, `Invalid cron expression: ${error.message}`); }
  return text;
}

/** Parse a wall-clock "YYYY-MM-DD[ T]HH:MM[:SS]" in `timeZone`, or any ISO string with an offset. */
export function parseLocalDateTime(value, timeZone) {
  const text = String(value ?? '').trim();
  if (/(Z|[+-]\d{2}:?\d{2})$/i.test(text)) {
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) throw new RuleError(`无效的时间：${value}`, `Invalid time: ${value}`);
    return date;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(text);
  if (!match) throw new RuleError(`at 必须是 "YYYY-MM-DD HH:MM"（按 time_zone 解释）或带时区偏移的 ISO 时间，收到：${value}`, `Pick a date and time (got: ${value})`);
  const iso = `${match[1]}-${match[2]}-${match[3]}T${match[4].padStart(2, '0')}:${match[5]}:${match[6] ?? '00'}`;
  try {
    const run = new Cron(iso, { timezone: timeZone, paused: true }).nextRun(new Date(0));
    if (!run) throw new Error('empty');
    return run;
  } catch { throw new RuleError(`无效的时间：${value}`, `Invalid time: ${value}`); }
}

/**
 * Validate tool/UI input into a stored rule. Accepts snake_case (tool schema) or camelCase.
 * @param input - { type, time_zone, at, every_minutes, time, weekdays, days, cron }
 * @param now - creation time; anchors `every` rules and rejects a past `once`.
 */
export function normalizeRule(input, { now = new Date(), defaultTimeZone = hostTimeZone() } = {}) {
  if (!input || typeof input !== 'object') throw new RuleError('缺少 schedule', 'Missing schedule');
  const type = input.type;
  if (!RULE_TYPES.includes(type)) throw new RuleError(`schedule.type 必须是 ${RULE_TYPES.join(' / ')}`, `Repeat must be one of ${RULE_TYPES.join(' / ')}`);
  const timeZone = input.time_zone ?? input.timeZone ?? defaultTimeZone;
  if (!isTimeZone(timeZone)) throw new RuleError(`无效的 IANA 时区：${timeZone}`, `Unknown time zone: ${timeZone}`);
  switch (type) {
    case 'once': {
      const at = parseLocalDateTime(input.at, timeZone);
      if (at.getTime() <= now.getTime()) throw new RuleError(`时间 ${input.at} 已经过去了`, `${input.at} is in the past`);
      return { type, timeZone, at: at.toISOString() };
    }
    case 'every': {
      const minutes = Number(input.every_minutes ?? input.everyMinutes);
      if (!Number.isFinite(minutes) || minutes * 60_000 < MIN_INTERVAL_MS || minutes > 60 * 24 * 366) throw new RuleError('every_minutes 至少为 1', 'The interval must be at least 1 minute');
      const anchor = input.anchor ? new Date(input.anchor) : now;
      return { type, timeZone, everyMinutes: Math.round(minutes * 100) / 100, anchor: anchor.toISOString() };
    }
    case 'daily': return { type, timeZone, time: parseTime(input.time) };
    case 'weekly': return { type, timeZone, time: parseTime(input.time), weekdays: intList(input.weekdays, 1, 7, 'weekdays') };
    case 'monthly': return { type, timeZone, time: parseTime(input.time), days: intList(input.days, 1, 31, 'days') };
    case 'cron': {
      const cron = checkCron(input.cron, timeZone);
      const runs = new Cron(cron, { timezone: timeZone, paused: true }).nextRuns(3, now);
      if (runs.length === 0) throw new RuleError('这个 cron 表达式以后不会再触发', 'This cron expression never fires again');
      return { type, timeZone, cron };
    }
    default: throw new RuleError('未知的 schedule.type', 'Unknown repeat type');
  }
}

/** The equivalent five-field cron of a wall-clock rule. */
export function cronOf(rule) {
  if (rule.type === 'cron') return rule.cron;
  const [h, m] = rule.time.split(':').map(Number);
  if (rule.type === 'daily') return `${m} ${h} * * *`;
  if (rule.type === 'weekly') return `${m} ${h} * * ${rule.weekdays.map((d) => d % 7).join(',')}`;
  if (rule.type === 'monthly') return `${m} ${h} ${rule.days.join(',')} * *`;
  return undefined;
}

/** First occurrence strictly after `after`, or null when the rule has no future occurrence. */
export function nextOccurrence(rule, after = new Date()) {
  if (rule.type === 'once') {
    const at = new Date(rule.at);
    return at > after ? at : null;
  }
  if (rule.type === 'every') {
    const interval = rule.everyMinutes * 60_000;
    const anchor = new Date(rule.anchor).getTime();
    const steps = Math.max(1, Math.floor((after.getTime() - anchor) / interval) + 1);
    return new Date(anchor + steps * interval);
  }
  return new Cron(cronOf(rule), { timezone: rule.timeZone, paused: true }).nextRun(after) ?? null;
}

export function nextOccurrences(rule, count, after = new Date()) {
  const list = [];
  let cursor = after;
  for (let i = 0; i < count; i++) {
    const next = nextOccurrence(rule, cursor);
    if (!next) break;
    list.push(next);
    cursor = next;
  }
  return list;
}

export { describeRule, formatLocal } from './describe.js';
