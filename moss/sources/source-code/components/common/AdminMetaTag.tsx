import React from 'react';

interface AdminMetaTagProps {
  children: React.ReactNode;
  /** Local size overrides for compact title badges; defaults stay shared across admin pages. */
  style?: React.CSSProperties;
  'data-testid'?: string;
}

export const AdminMetaTag: React.FC<AdminMetaTagProps> = ({
  children,
  style,
  'data-testid': dataTestId,
}) => (
  <span
    style={{
      flexShrink: 0,
      fontSize: 12,
      lineHeight: '20px',
      color: 'rgba(9,30,64,0.62)',
      background: '#f0f2f5',
      border: '1px solid #e6e9ef',
      borderRadius: 4,
      padding: '0 6px',
      whiteSpace: 'nowrap',
      fontWeight: 400,
      ...style,
    }}
    data-testid={dataTestId}
  >
    {children}
  </span>
);
