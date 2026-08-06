export type AutomationTriggerConfig = Record<string, unknown>;

const INTERVAL_UNITS: Record<string, string> = {
  hour: '小时',
  day: '天',
  week: '周',
  month: '个月',
};

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function dateParts(value: unknown, timezone: string): Intl.DateTimeFormatPart[] {
  if (typeof value !== 'string' || !value.trim()) return [];
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return [];
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: timezone,
    hour: '2-digit', minute: '2-digit', day: 'numeric', weekday: 'short', hour12: false,
  }).formatToParts(date);
}

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find(item => item.type === type)?.value ?? '';
}

/**
 * The scheduler accepts numeric five-field Cron expressions. Expand every
 * supported token before describing it so ranges, steps and lists cannot be
 * mistaken for a single day or weekday.
 */
function expandCronField(field: string, minimum: number, maximum: number, allowQuestion = false): number[] | null {
  const values = new Set<number>();
  const normalized = field.trim();
  if (!normalized) return null;

  for (const token of normalized.split(',')) {
    const [rangePart, stepText, ...rest] = token.split('/');
    if (rest.length || !rangePart || (stepText !== undefined && !/^\d+$/.test(stepText))) return null;
    const step = stepText === undefined ? 1 : Number(stepText);
    if (!Number.isInteger(step) || step < 1) return null;

    if (rangePart === '?' && allowQuestion) {
      for (let value = minimum; value <= maximum; value += step) values.add(value);
      continue;
    }

    let start: number;
    let end: number;
    if (rangePart === '*') {
      start = minimum;
      end = maximum;
    } else if (/^\d+-\d+$/.test(rangePart)) {
      const [startText, endText] = rangePart.split('-');
      start = Number(startText);
      end = Number(endText);
    } else if (/^\d+$/.test(rangePart)) {
      start = Number(rangePart);
      end = stepText === undefined ? start : maximum;
    } else {
      return null;
    }
    if (start < minimum || end > maximum || start > end) return null;
    for (let value = start; value <= end; value += step) values.add(value);
  }

  return [...values].sort((left, right) => left - right);
}

function isAll(values: number[], minimum: number, maximum: number): boolean {
  return values.length === maximum - minimum + 1
    && values.every((value, index) => value === minimum + index);
}

function joinNumbers(values: Array<number | string>, suffix = ''): string {
  return values.map(value => `${value}${suffix}`).join('、');
}

function joinWeekdays(values: number[]): string {
  const normalized = [...new Set(values.map(value => value === 7 ? 0 : value))].sort((left, right) => left - right);
  if (normalized.length === 5 && normalized.every((value, index) => value === index + 1)) return '周一至周五';
  if (normalized.length === 7) return '每天';
  return normalized.map(value => WEEKDAYS[value]).join('、');
}

function regularStep(values: number[]): number | null {
  if (values.length < 2) return null;
  const step = values[1] - values[0];
  return step > 0 && values.every((value, index) => index === 0 || value - values[index - 1] === step) ? step : null;
}

function formatTimes(hours: number[], minutes: number[]): string {
  if (isAll(hours, 0, 23) && isAll(minutes, 0, 59)) return '每分钟';
  if (isAll(hours, 0, 23) && minutes.length === 1) {
    return minutes[0] === 0 ? '每小时整点' : `每小时的第 ${minutes[0]} 分钟`;
  }
  if (isAll(minutes, 0, 59)) return `${joinNumbers(hours.map(value => value.toString().padStart(2, '0')), ' 时')}内每分钟`;

  const hourStep = regularStep(hours);
  if (hourStep && minutes.length === 1) {
    const firstTime = `${hours[0].toString().padStart(2, '0')}:${minutes[0].toString().padStart(2, '0')}`;
    return hours[0] === 0 && minutes[0] === 0 ? `每 ${hourStep} 小时整点` : `从 ${firstTime} 起每 ${hourStep} 小时`;
  }

  const times = hours.flatMap(hour => minutes.map(minute => `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`));
  return times.join('、');
}

function cronScheduleLabel(
  minutes: number[], hours: number[], days: number[], months: number[], weekdays: number[], once: boolean,
): string {
  const everyDay = isAll(days, 1, 31);
  const everyMonth = isAll(months, 1, 12);
  const everyWeekday = isAll(weekdays, 0, 6);
  const time = formatTimes(hours, minutes);
  const isSingleDateTime = minutes.length === 1 && hours.length === 1
    && days.length === 1 && months.length === 1 && everyWeekday;

  if (isSingleDateTime && once) {
    return `${months[0]}月${days[0]}日 ${time}（仅执行一次）`;
  }

  let date = '';
  if (everyMonth && everyDay && everyWeekday) {
    date = '每天';
  } else if (everyMonth && everyDay) {
    date = `每${joinWeekdays(weekdays)}`;
  } else if (everyMonth && everyWeekday) {
    date = `每月 ${joinNumbers(days, '日')}`;
  } else if (everyMonth) {
    date = `每月 ${joinNumbers(days, '日')}且为${joinWeekdays(weekdays)}时`;
  } else if (everyDay && everyWeekday) {
    date = `每年 ${joinNumbers(months, '月')}每天`;
  } else if (everyDay) {
    date = `每年 ${joinNumbers(months, '月')}的每${joinWeekdays(weekdays)}`;
  } else if (everyWeekday) {
    date = `每年 ${joinNumbers(months, '月')}的${joinNumbers(days, '日')}`;
  } else {
    date = `每年 ${joinNumbers(months, '月')}的${joinNumbers(days, '日')}且为${joinWeekdays(weekdays)}时`;
  }

  return `${date} ${time}${once ? '（仅执行一次）' : ''}`;
}

export function cronToHuman(expr: string | null | undefined, once = false): string {
  if (!expr) return '执行时间待设置';
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5) return '计划配置无效';
  const minutes = expandCronField(fields[0], 0, 59);
  const hours = expandCronField(fields[1], 0, 23);
  const days = expandCronField(fields[2], 1, 31, true);
  const months = expandCronField(fields[3], 1, 12, true);
  const weekdays = expandCronField(fields[4], 0, 7, true);
  if (!minutes || !hours || !days || !months || !weekdays) return '计划配置无效';

  // A concrete calendar date is normalized to one-time by all create/update paths.
  const specificDate = minutes.length === 1 && hours.length === 1 && days.length === 1 && months.length === 1
    && isAll(weekdays, 0, 7);
  const normalizedWeekdays = [...new Set(weekdays.map(value => value === 7 ? 0 : value))].sort((left, right) => left - right);
  return cronScheduleLabel(minutes, hours, days, months, normalizedWeekdays, once || specificDate);
}

export function intervalToHuman(config: AutomationTriggerConfig): string {
  const value = Number(config.interval_value);
  const unit = typeof config.interval_unit === 'string' ? config.interval_unit : '';
  const label = INTERVAL_UNITS[unit];
  if (!Number.isInteger(value) || value < 1 || !label) return '执行时间待设置';

  const timezone = typeof config.timezone === 'string' && config.timezone ? config.timezone : 'Asia/Shanghai';
  const parts = dateParts(config.first_run_at, timezone);
  const hour = part(parts, 'hour');
  const minute = part(parts, 'minute');
  const time = hour && minute ? `${hour}:${minute}` : '';
  const day = part(parts, 'day');
  const weekday = part(parts, 'weekday');

  if (unit === 'day') return `${value === 1 ? '每天' : `每 ${value} 天`}${time ? ` ${time}` : ''}`;
  if (unit === 'hour') return `每 ${value} 小时`;
  if (unit === 'week') return `${value === 1 ? '每周' : `每 ${value} 周`}${weekday ? `，${weekday}` : ''}${time ? ` ${time}` : ''}`;
  return `${value === 1 ? '每月' : `每 ${value} 个月`}${day ? `${day}日` : ''}${time ? ` ${time}` : ''}`;
}

export function triggerToHuman(config: AutomationTriggerConfig | null | undefined): string {
  const trigger = config ?? {};
  if (trigger.type === 'interval') return intervalToHuman(trigger);
  if (trigger.type === 'cron') return cronToHuman(typeof trigger.cron_expr === 'string' ? trigger.cron_expr : null, trigger.once === true);
  if (trigger.type === 'webhook') return '收到请求时执行';
  if (trigger.type === 'event') return '发生事件时执行';
  return typeof trigger.type === 'string' ? trigger.type : '';
}
