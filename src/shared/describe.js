/**
 * Human wording for rules and times, in Chinese (`zh`, also what the agent sees) or English.
 * No croner here, so the browser bundle can use it to render everything in the viewer's language.
 */
const WEEKDAY = {
  zh: ['', '一', '二', '三', '四', '五', '六', '日'],
  en: ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
};
const pick = (lang) => (lang === 'en' ? 'en' : 'zh');

/** "2026-09-29 09:00 周二" / "2026-09-29 09:00 Tue" in the given zone. */
export function formatLocal(date, timeZone, { weekday = true, seconds = false, lang = 'zh' } = {}) {
  if (!date) return '—';
  const d = new Date(date);
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short', hourCycle: 'h23',
  }).formatToParts(d).map((p) => [p.type, p.value]));
  const iso = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[parts.weekday];
  const day = pick(lang) === 'en' ? ` ${WEEKDAY.en[iso]}` : ` 周${WEEKDAY.zh[iso]}`;
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}${seconds ? ':' + parts.second : ''}${weekday ? day : ''}`;
}

function weekdaysText(days, lang) {
  const key = days.join(',');
  if (lang === 'en') {
    if (key === '1,2,3,4,5') return 'Weekdays';
    if (key === '6,7') return 'Weekends';
    if (key === '1,2,3,4,5,6,7') return 'Every day';
    return days.map((d) => WEEKDAY.en[d]).join(', ');
  }
  if (key === '1,2,3,4,5') return '工作日';
  if (key === '6,7') return '周末';
  if (key === '1,2,3,4,5,6,7') return '每天';
  return '每周' + days.map((d) => WEEKDAY.zh[d]).join('、');
}

function everyText(minutes, lang) {
  const [n, unit] = minutes % 1440 === 0 ? [minutes / 1440, 'day'] : minutes % 60 === 0 ? [minutes / 60, 'hour'] : [minutes, 'minute'];
  if (lang === 'en') return n === 1 ? `Every ${unit}` : `Every ${n} ${unit}s`;
  return `每 ${n} ${{ day: '天', hour: '小时', minute: '分钟' }[unit]}`;
}

/**
 * One line, e.g. "工作日 09:00" / "Weekdays 09:00" / "每 2 小时" / "Every 2 hours".
 * Adds the rule's zone when it differs from `viewerZone`.
 */
export function describeRule(rule, viewerZone, lang = 'zh') {
  lang = pick(lang);
  const en = lang === 'en';
  const zone = viewerZone && viewerZone !== rule.timeZone ? (en ? ` (${rule.timeZone})` : `（${rule.timeZone}）`) : '';
  switch (rule.type) {
    case 'once': return `${formatLocal(rule.at, rule.timeZone, { lang })}${en ? ' (once)' : '（一次）'}${zone}`;
    case 'every': return everyText(rule.everyMinutes, lang);
    case 'daily': return `${en ? 'Every day' : '每天'} ${rule.time}${zone}`;
    case 'weekly': return `${weekdaysText(rule.weekdays, lang)} ${rule.time}${zone}`;
    case 'monthly': return en ? `Monthly on day ${rule.days.join(', ')} at ${rule.time}${zone}` : `每月 ${rule.days.join('、')} 日 ${rule.time}${zone}`;
    case 'cron': return `cron「${rule.cron}」${zone}`;
    default: return en ? 'Unknown rule' : '未知规则';
  }
}
