import React from 'react';

export function dashboardAskDisplayContent(boardName = '智能看板'): string {
  return `智能看板·${boardName} MOSS洞察`;
}

export function dashboardDisplayParts(value: string): { boardName: string; action: string } | null {
  const normalized = value.trim();
  const match = normalized.match(/^智能看板[·・](.+?)\s+(.+)$/);
  if (match) {
    return {
      boardName: match[1].trim(),
      action: normalizeDashboardAction(match[2].trim()),
    };
  }
  const legacyPromptMatch = normalized.match(/来自智能看板「(.+?)」的自动洞察请求/);
  if (legacyPromptMatch) {
    return {
      boardName: legacyPromptMatch[1].trim(),
      action: 'MOSS洞察',
    };
  }
  return null;
}

// 维护提示：历史消息里可能仍有“自动洞察”，展示时统一收敛为新的“MOSS洞察”品牌文案。
function normalizeDashboardAction(action: string): string {
  return action === '自动洞察' ? 'MOSS洞察' : action;
}

function dashboardChipText(value: string, parts: { boardName: string; action: string } | null): string {
  if (!parts) return value;
  return dashboardAskDisplayContent(parts.boardName).replace('MOSS洞察', parts.action);
}

export function dashboardDisplayTextFromUserContent(value: string): string | null {
  const normalized = value.trim();
  if (!normalized) return null;
  const existingParts = dashboardDisplayParts(normalized);
  if (existingParts) return dashboardChipText(normalized, existingParts);

  const boardNameMatch = normalized.match(/^查看当前看板内容[（(]([^）)]+)[）)]/);
  const looksLikeDashboardPrompt =
    normalized.includes('固定附加要求') ||
    normalized.includes('get_current_dashboard_context') ||
    normalized.includes('MOSS_DASHBOARD_CONTEXT') ||
    normalized.includes('基于最新看板快照') ||
    normalized.includes('来自智能看板');
  if (boardNameMatch && looksLikeDashboardPrompt) {
    return dashboardAskDisplayContent(boardNameMatch[1].trim() || '智能看板');
  }
  return null;
}

// 维护提示：这个是轻量来源标签，不是主按钮；请避免改回高饱和蓝色胶囊样式。
export const DashboardAskChip: React.FC<{ text: string }> = ({ text }) => {
  const parts = dashboardDisplayParts(text);
  const chipText = dashboardChipText(text, parts);
  return (
    <span
      data-testid="dashboard-ask-chip"
      title={chipText}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        maxWidth: '100%',
        minHeight: 28,
        padding: '4px 10px',
        borderRadius: 999,
        border: '1px solid var(--border-subtle)',
        background: 'var(--bg-elevated)',
        color: 'var(--text-secondary)',
        boxShadow: '0 6px 18px rgba(24, 24, 27, 0.06)',
        fontSize: 13,
        lineHeight: '20px',
        fontWeight: 500,
        whiteSpace: 'nowrap',
      }}
    >
      <svg
        aria-hidden="true"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flex: '0 0 auto', color: 'var(--moss-home-title-accent)' }}
      >
        <path d="M18 20V10" />
        <path d="M12 20V4" />
        <path d="M6 20v-6" />
      </svg>
      <span
        style={{
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {parts ? (
          <>
            智能看板 · {parts.boardName} ·{' '}
            <span style={{ color: 'var(--text-primary)' }}>{parts.action}</span>
          </>
        ) : chipText}
      </span>
    </span>
  );
};
