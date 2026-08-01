import React, { memo } from 'react';
import { ChatAgentMark } from './ChatAgentMark';
import type { ChatAgentDisplay } from './chatDisplayContext';

interface AssistantMessageFrameProps {
  agentDisplay: ChatAgentDisplay;
  timestamp: Date;
  wide?: boolean;
  dataTestId?: string;
  bodyTestId?: string;
  children: React.ReactNode;
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;

  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

export const AssistantMessageFrame = memo(function AssistantMessageFrame({
  agentDisplay,
  timestamp,
  wide = false,
  dataTestId,
  bodyTestId,
  children,
}: AssistantMessageFrameProps) {
  return (
    <div
      className="flex flex-col"
      data-testid={dataTestId}
      style={{ width: '100%', maxWidth: '100%', minWidth: 0, ...(wide ? { width: '100%' } : {}) }}
    >
      <div
        className="flex items-center"
        style={{ gap: 8, marginBottom: 6, minHeight: 24 }}
      >
        <ChatAgentMark size={24} agent={agentDisplay} />
        <span style={{ fontSize: 14, lineHeight: '22px', fontWeight: 600, color: 'var(--text-primary)' }}>
          {agentDisplay.name}
        </span>
        <span style={{ fontSize: 12, lineHeight: '20px', color: 'var(--text-muted)' }}>
          {formatRelativeTime(timestamp)}
        </span>
      </div>

      <div
        className="flex flex-col items-start"
        data-testid={bodyTestId}
        style={{ width: '100%', maxWidth: '100%', minWidth: 0 }}
      >
        {children}
      </div>
    </div>
  );
});
