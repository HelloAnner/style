import React from 'react';

export type AdminStatusTagTone = 'success' | 'warning' | 'neutral';

interface AdminStatusTagProps {
  children: React.ReactNode;
  tone?: AdminStatusTagTone;
  'data-testid'?: string;
}

const toneStyles: Record<AdminStatusTagTone, Pick<React.CSSProperties, 'color' | 'background' | 'border'>> = {
  success: {
    color: '#16a34a',
    background: '#dcfce7',
    border: '1px solid #bbf7d0',
  },
  warning: {
    color: 'var(--warning)',
    background: 'var(--warning-bg-soft)',
    border: '1px solid var(--warning-border-soft)',
  },
  neutral: {
    color: 'var(--text-tertiary)',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border-subtle)',
  },
};

export const AdminStatusTag: React.FC<AdminStatusTagProps> = ({
  children,
  tone = 'neutral',
  'data-testid': dataTestId,
}) => (
  <span
    style={{
      fontSize: 12,
      lineHeight: '20px',
      borderRadius: 4,
      padding: '0 6px',
      fontWeight: 400,
      whiteSpace: 'nowrap',
      ...toneStyles[tone],
    }}
    data-testid={dataTestId}
  >
    {children}
  </span>
);
