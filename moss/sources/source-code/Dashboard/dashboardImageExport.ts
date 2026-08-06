function parseCssAlpha(value: string): number | null {
  const normalized = value.trim().toLowerCase();
  const functionalColor = normalized.match(/^rgba?\((.*)\)$/);
  if (!functionalColor) return null;

  const body = functionalColor[1];
  const slashParts = body.split('/');
  const alpha = slashParts.length > 1
    ? slashParts[slashParts.length - 1]
    : normalized.startsWith('rgba(')
      ? body.split(',').at(-1)
      : null;
  if (!alpha) return null;

  const trimmed = alpha.trim();
  const number = Number.parseFloat(trimmed);
  if (!Number.isFinite(number)) return null;
  return trimmed.endsWith('%') ? number / 100 : number;
}

export function isTransparentDashboardExportColor(value: string | null | undefined): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized || normalized === 'transparent') return true;
  if (/^#[0-9a-f]{4}$/.test(normalized)) return normalized.endsWith('0');
  if (/^#[0-9a-f]{8}$/.test(normalized)) return normalized.endsWith('00');
  return parseCssAlpha(normalized) === 0;
}

function isOpaqueDashboardExportColor(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === 'transparent') return false;
  if (/^#[0-9a-f]{4}$/.test(normalized)) return normalized.endsWith('f');
  if (/^#[0-9a-f]{8}$/.test(normalized)) return normalized.endsWith('ff');
  const alpha = parseCssAlpha(normalized);
  return alpha === null || alpha >= 1;
}

/**
 * 选择用户在页面上实际看到的第一层不透明底色。
 *
 * 调用方按 body → documentElement → iframe → 主题 token 的顺序传入。
 * 没有可用底色时宁可中止导出，也不要再次生成难以察觉的透明 PNG。
 */
export function resolveDashboardExportBackground(
  candidates: Array<string | null | undefined>,
): string {
  for (const candidate of candidates) {
    const color = String(candidate || '').trim();
    if (isOpaqueDashboardExportColor(color)) return color;
  }
  throw new Error('看板导出背景色未就绪');
}
