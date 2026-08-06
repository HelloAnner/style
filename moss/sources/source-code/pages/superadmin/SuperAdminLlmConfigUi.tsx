import React from 'react';

export function Alert({ kind, children, testId }: { kind: 'success' | 'danger' | 'warning'; children: React.ReactNode; testId?: string }) {
  const style = kind === 'success'
    ? {
      border: '1px solid var(--success-border-soft)',
      background: 'var(--success-bg-soft)',
      color: 'var(--success)',
    }
    : kind === 'warning'
      ? {
        border: '1px solid var(--warning-border-soft)',
        background: 'var(--warning-bg-soft)',
        color: 'var(--warning)',
      }
      : {
        border: '1px solid var(--danger-border-soft)',
        background: 'var(--danger-bg-soft)',
        color: 'var(--danger)',
      };
  return (
    <div data-testid={testId} style={{ ...style, borderRadius: 8, padding: '9px 10px', fontSize: 13 }}>
      {children}
    </div>
  );
}

export function Th({
  align,
  children,
  testId,
}: {
  align?: 'left' | 'right';
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <th data-testid={testId} style={{
      padding: '10px 12px',
      fontWeight: 500,
      textAlign: align ?? 'left',
      whiteSpace: 'nowrap',
    }}>
      {children}
    </th>
  );
}

export function Td({
  align,
  children,
  testId,
}: {
  align?: 'left' | 'right';
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <td data-testid={testId} style={{
      padding: '12px',
      fontSize: 13,
      color: 'var(--text-secondary)',
      verticalAlign: 'middle',
      textAlign: align ?? 'left',
    }}>
      {children}
    </td>
  );
}
