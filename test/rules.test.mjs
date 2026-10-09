import assert from 'node:assert/strict';
import test from 'node:test';
import { cronOf, describeRule, formatLocal, nextOccurrence, nextOccurrences, normalizeRule, parseLocalDateTime } from '../src/shared/rules.js';

const NOW = new Date('2026-09-28T02:30:00Z'); // Monday 10:30 in Shanghai
const iso = (dates) => dates.map((d) => d.toISOString());

test('natural wall-clock rules resolve in the rule\'s own time zone', () => {
  const workdays = normalizeRule({ type: 'weekly', time: '9:00', weekdays: [5, 1, 2, 3, 4, 4], time_zone: 'Asia/Shanghai' }, { now: NOW });
  assert.deepEqual(workdays, { type: 'weekly', timeZone: 'Asia/Shanghai', time: '09:00', weekdays: [1, 2, 3, 4, 5] });
  assert.equal(cronOf(workdays), '0 9 * * 1,2,3,4,5');
  // Monday 10:30 → Tuesday 09:00 Shanghai = 01:00Z; Friday then skips the weekend to Monday.
  assert.deepEqual(iso(nextOccurrences(workdays, 5, NOW)), ['2026-09-29T01:00:00.000Z', '2026-09-30T01:00:00.000Z', '2026-10-01T01:00:00.000Z', '2026-10-02T01:00:00.000Z', '2026-10-05T01:00:00.000Z']);
  assert.equal(describeRule(workdays, 'Asia/Shanghai'), '工作日 09:00');
  assert.equal(describeRule(workdays, 'Europe/Berlin'), '工作日 09:00（Asia/Shanghai）');

  const sunday = normalizeRule({ type: 'weekly', time: '20:00', weekdays: [7], time_zone: 'Asia/Shanghai' }, { now: NOW });
  assert.equal(cronOf(sunday), '0 20 * * 0');
  assert.equal(nextOccurrence(sunday, NOW).toISOString(), '2026-10-04T12:00:00.000Z');
  assert.equal(describeRule(sunday), '每周日 20:00');

  const daily = normalizeRule({ type: 'daily', time: '08:05', time_zone: 'Asia/Shanghai' }, { now: NOW });
  assert.equal(nextOccurrence(daily, NOW).toISOString(), '2026-09-29T00:05:00.000Z');
});

test('daylight saving: a 09:00 daily rule stays at 09:00 local across the switch', () => {
  const rule = normalizeRule({ type: 'daily', time: '09:00', time_zone: 'America/New_York' }, { now: NOW });
  const runs = nextOccurrences(rule, 2, new Date('2026-10-31T12:00:00Z'));
  assert.deepEqual(iso(runs), ['2026-10-31T13:00:00.000Z', '2026-11-01T14:00:00.000Z']);
  assert.deepEqual(runs.map((d) => formatLocal(d, 'America/New_York', { weekday: false })), ['2026-10-31 09:00', '2026-11-01 09:00']);
});

test('monthly skips months without the day; every keeps its anchor; cron is five fields', () => {
  const monthly = normalizeRule({ type: 'monthly', time: '10:00', days: [31], time_zone: 'UTC' }, { now: NOW });
  assert.deepEqual(iso(nextOccurrences(monthly, 2, NOW)), ['2026-10-31T10:00:00.000Z', '2026-12-31T10:00:00.000Z']);
  assert.equal(describeRule(monthly), '每月 31 日 10:00');

  const every = normalizeRule({ type: 'every', every_minutes: 120 }, { now: NOW });
  assert.equal(every.anchor, NOW.toISOString());
  assert.equal(nextOccurrence(every, NOW).toISOString(), '2026-09-28T04:30:00.000Z');
  assert.equal(nextOccurrence(every, new Date('2026-09-28T09:00:00Z')).toISOString(), '2026-09-28T10:30:00.000Z');
  assert.equal(describeRule(every), '每 2 小时');
  assert.equal(describeRule({ ...every, everyMinutes: 45 }), '每 45 分钟');

  const cron = normalizeRule({ type: 'cron', cron: '0  9-18/3 * * 1-5', time_zone: 'Asia/Shanghai' }, { now: NOW });
  assert.equal(cron.cron, '0 9-18/3 * * 1-5');
  assert.equal(nextOccurrence(cron, NOW).toISOString(), '2026-09-28T04:00:00.000Z'); // 12:00 Shanghai
  assert.throws(() => normalizeRule({ type: 'cron', cron: '*/10 * * * * *' }, { now: NOW }), /5 段/);
  assert.throws(() => normalizeRule({ type: 'cron', cron: '99 * * * *' }, { now: NOW }), /无效的 cron/);
});

test('once takes local wall-clock or an explicit offset, and must be in the future', () => {
  assert.equal(parseLocalDateTime('2026-09-29 15:00', 'Asia/Shanghai').toISOString(), '2026-09-29T07:00:00.000Z');
  assert.equal(parseLocalDateTime('2026-09-29T15:00:00+02:00', 'Asia/Shanghai').toISOString(), '2026-09-29T13:00:00.000Z');
  const once = normalizeRule({ type: 'once', at: '2026-09-29 15:00', time_zone: 'Asia/Shanghai' }, { now: NOW });
  assert.equal(once.at, '2026-09-29T07:00:00.000Z');
  assert.equal(nextOccurrence(once, NOW).toISOString(), once.at);
  assert.equal(nextOccurrence(once, new Date('2026-09-30T00:00:00Z')), null);
  assert.equal(describeRule(once), '2026-09-29 15:00 周二（一次）');
  assert.throws(() => normalizeRule({ type: 'once', at: '2026-09-27 15:00', time_zone: 'Asia/Shanghai' }, { now: NOW }), /已经过去/);
  assert.throws(() => normalizeRule({ type: 'once', at: 'tomorrow 3pm' }, { now: NOW }), /YYYY-MM-DD/);
});

test('bad input is rejected with a message the model can act on', () => {
  assert.throws(() => normalizeRule({ type: 'hourly' }), /schedule.type/);
  assert.throws(() => normalizeRule({ type: 'daily', time: '25:00' }), /无效的时间/);
  assert.throws(() => normalizeRule({ type: 'daily', time: '9am' }), /HH:MM/);
  assert.throws(() => normalizeRule({ type: 'weekly', time: '09:00', weekdays: [0] }), /weekdays/);
  assert.throws(() => normalizeRule({ type: 'every', every_minutes: 0.5 }), /至少为 1/);
  assert.throws(() => normalizeRule({ type: 'daily', time: '09:00', time_zone: 'Mars/Olympus' }), /时区/);
});

test('rule wording in English', async () => {
  const { describeRule, formatLocal } = await import('../src/shared/describe.js');
  const z = 'Asia/Shanghai';
  assert.equal(describeRule({ type: 'weekly', time: '09:00', weekdays: [1, 2, 3, 4, 5], timeZone: z }, z, 'en'), 'Weekdays 09:00');
  assert.equal(describeRule({ type: 'weekly', time: '09:00', weekdays: [1, 3], timeZone: z }, z, 'en'), 'Mon, Wed 09:00');
  assert.equal(describeRule({ type: 'every', everyMinutes: 120, timeZone: z }, z, 'en'), 'Every 2 hours');
  assert.equal(describeRule({ type: 'every', everyMinutes: 60, timeZone: z }, z, 'en'), 'Every hour');
  assert.equal(describeRule({ type: 'daily', time: '20:00', timeZone: z }, 'UTC', 'en'), 'Every day 20:00 (Asia/Shanghai)');
  assert.equal(describeRule({ type: 'monthly', time: '08:00', days: [1, 15], timeZone: z }, z, 'en'), 'Monthly on day 1, 15 at 08:00');
  assert.equal(formatLocal('2026-09-29T01:00:00Z', z, { lang: 'en' }), '2026-09-29 09:00 Tue');
  assert.equal(describeRule({ type: 'daily', time: '20:00', timeZone: z }, z), '每天 20:00');
});
