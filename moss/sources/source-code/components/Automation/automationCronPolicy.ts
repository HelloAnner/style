export class AutomationCronPolicyError extends Error {}

export type AutomationTriggerConfig = Record<string, unknown>;

const FIXED_NUMERIC = /^\d+$/;
const CRON_FIELD = /^[\d*/?,-]+$/;

export function normalizeAutomationTriggerConfig(
  triggerConfig: AutomationTriggerConfig | undefined,
): AutomationTriggerConfig | undefined {
  if (!triggerConfig) return triggerConfig;
  if (triggerConfig.type !== 'cron') return triggerConfig;

  const normalized: AutomationTriggerConfig = { ...triggerConfig };
  const cronExpr = String(normalized.cron_expr ?? '').trim();
  if (!cronExpr) {
    throw new AutomationCronPolicyError('请填写 Cron 表达式');
  }

  const parts = splitCron(cronExpr);
  if (isSpecificDatetimeCron(cronExpr)) {
    normalized.once = true;
    return normalized;
  }

  ensureLoopCronMinInterval(parts, normalized.timezone);
  return normalized;
}

export function isSpecificDatetimeCron(cronExpr: string): boolean {
  const parts = splitCronOrEmpty(cronExpr);
  if (parts.length !== 5) return false;
  return FIXED_NUMERIC.test(parts[0])
    && FIXED_NUMERIC.test(parts[1])
    && FIXED_NUMERIC.test(parts[2])
    && FIXED_NUMERIC.test(parts[3])
    && isAnyDayOfWeek(parts[4]);
}

function splitCron(cronExpr: string): string[] {
  const parts = splitCronOrEmpty(cronExpr);
  if (parts.length !== 5) {
    throw new AutomationCronPolicyError('Cron 表达式必须是 5 位');
  }
  parts.forEach(part => {
    if (!CRON_FIELD.test(part)) {
      throw new AutomationCronPolicyError('Cron 表达式格式不正确');
    }
  });
  validateField(parts[1], 0, 23, false);
  validateField(parts[2], 1, 31, true);
  validateField(parts[3], 1, 12, true);
  validateField(parts[4], 0, 7, true);
  return parts;
}

function splitCronOrEmpty(cronExpr: string): string[] {
  return cronExpr.trim() ? cronExpr.trim().split(/\s+/) : [];
}

function ensureLoopCronMinInterval(parts: string[], timezone: unknown): void {
  resolveTimezone(timezone);
  if (parseMinuteValues(parts[0]).size > 1) {
    throw new AutomationCronPolicyError('循环 Cron 最小间隔必须为 1 小时');
  }
}

function parseMinuteValues(field: string): Set<number> {
  const values = new Set<number>();
  field.split(',').forEach(token => addMinuteToken(values, token));
  if (values.size === 0) {
    throw new AutomationCronPolicyError('Cron 分钟位格式不正确');
  }
  return values;
}

function addMinuteToken(values: Set<number>, token: string): void {
  const stepParts = token.split('/');
  if (stepParts.length > 2) {
    throw new AutomationCronPolicyError('Cron 分钟位格式不正确');
  }
  const step = stepParts.length === 2 ? parseIntInRange(stepParts[1], 1, 59) : 1;
  const rangePart = stepParts[0];
  let start = 0;
  let end = 59;
  if (rangePart !== '*') {
    if (rangePart.includes('-')) {
      const rangeParts = rangePart.split('-');
      if (rangeParts.length !== 2) {
        throw new AutomationCronPolicyError('Cron 分钟位格式不正确');
      }
      start = parseIntInRange(rangeParts[0], 0, 59);
      end = parseIntInRange(rangeParts[1], start, 59);
    } else {
      start = parseIntInRange(rangePart, 0, 59);
      end = start;
    }
  }
  for (let value = start; value <= end; value += step) {
    values.add(value);
  }
}

function parseIntInRange(value: string, min: number, max: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new AutomationCronPolicyError('Cron 分钟位格式不正确');
  }
  return parsed;
}

function validateField(field: string, min: number, max: number, allowQuestion: boolean): void {
  field.split(',').forEach(token => validateFieldToken(token, min, max, allowQuestion));
}

function validateFieldToken(token: string, min: number, max: number, allowQuestion: boolean): void {
  const stepParts = token.split('/');
  if (stepParts.length > 2) {
    throw new AutomationCronPolicyError('Cron 表达式格式不正确');
  }
  if (stepParts.length === 2) {
    parseFieldInt(stepParts[1], 1, max - min + 1);
  }
  const rangePart = stepParts[0];
  if (rangePart === '*' || (allowQuestion && rangePart === '?')) return;
  if (rangePart.includes('-')) {
    const rangeParts = rangePart.split('-');
    if (rangeParts.length !== 2) {
      throw new AutomationCronPolicyError('Cron 表达式格式不正确');
    }
    const start = parseFieldInt(rangeParts[0], min, max);
    parseFieldInt(rangeParts[1], start, max);
    return;
  }
  parseFieldInt(rangePart, min, max);
}

function parseFieldInt(value: string, min: number, max: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new AutomationCronPolicyError('Cron 表达式格式不正确');
  }
  return parsed;
}

function isAnyDayOfWeek(value: string): boolean {
  return value === '*' || value === '?';
}

function resolveTimezone(timezone: unknown): Intl.DateTimeFormat {
  const zone = typeof timezone === 'string' && timezone.trim() ? timezone : 'Asia/Shanghai';
  try {
    return new Intl.DateTimeFormat('zh-CN', { timeZone: zone });
  } catch {
    throw new AutomationCronPolicyError(`时区无效: ${String(timezone)}`);
  }
}
