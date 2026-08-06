export type DateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

const DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const formatterCache = new Map<string, Intl.DateTimeFormat>();

export function parseLocalDateTime(value: string): DateTimeParts | null {
  const match = value.match(DATE_TIME_PATTERN);
  if (!match) return null;
  const parts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]), hour: Number(match[4]), minute: Number(match[5]) };
  if (parts.month < 1 || parts.month > 12 || parts.day < 1 || parts.day > new Date(parts.year, parts.month, 0).getDate() || parts.hour > 23 || parts.minute > 59) return null;
  return parts;
}

export function formatLocalDateTime(parts: DateTimeParts): string {
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function isCompleteLocalDateTime(value: string): boolean {
  return parseLocalDateTime(value) !== null;
}

export function getDateTimePartsInTimezone(value: Date, timezone: string): DateTimeParts {
  const values = Object.fromEntries(getFormatter(timezone).formatToParts(value)
    .filter(part => part.type !== 'literal')
    .map(part => [part.type, Number(part.value)]));
  return { year: values.year, month: values.month, day: values.day, hour: values.hour, minute: values.minute };
}

export function formatPickerDateTime(value: unknown, timezone: string): string {
  if (!value) return '';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  return formatLocalDateTime(getDateTimePartsInTimezone(date, timezone));
}

export function localDateTimeToIso(value: string, timezone: string): string {
  const target = parseLocalDateTime(value);
  if (!target) throw new Error('请选择完整的日期和时间');
  const targetUtc = Date.UTC(target.year, target.month - 1, target.day, target.hour, target.minute);
  const offsets = new Set<number>();
  for (const hours of [-36, -24, -12, 0, 12, 24, 36]) {
    const sample = new Date(targetUtc + hours * 60 * 60 * 1000);
    const local = getDateTimePartsInTimezone(sample, timezone);
    offsets.add(Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute) - sample.getTime());
  }
  const candidates = [...offsets].map(offset => new Date(targetUtc - offset))
    .filter(candidate => formatLocalDateTime(getDateTimePartsInTimezone(candidate, timezone)) === value)
    .sort((left, right) => left.getTime() - right.getTime());
  if (!candidates.length) throw new Error('所选时区在该日期时间不存在，请调整执行时间');
  return candidates[0].toISOString();
}

function getFormatter(timezone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    formatterCache.set(timezone, formatter);
  }
  return formatter;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
