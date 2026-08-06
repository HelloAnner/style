import {
  AutomationCronPolicyError,
  normalizeAutomationTriggerConfig,
} from './automationCronPolicy';

const INVALID_CRON_MESSAGE = 'Cron 表达式格式不正确';
const DECIMAL_STEP_PATTERN = /\/\d*\.\d+/;

export function validateCronExpr(expr: string): string | null {
  if (DECIMAL_STEP_PATTERN.test(expr)) {
    return 'Cron 表达式不支持小数步长，请使用每小时或更长间隔';
  }

  try {
    normalizeAutomationTriggerConfig({
      type: 'cron',
      cron_expr: expr,
    });
    return null;
  } catch (error) {
    if (error instanceof AutomationCronPolicyError) {
      return error.message;
    }
    return INVALID_CRON_MESSAGE;
  }
}
