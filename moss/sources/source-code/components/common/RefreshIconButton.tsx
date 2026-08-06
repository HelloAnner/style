import React from 'react';
import { Loader2, RefreshCw } from 'lucide-react';

interface RefreshIconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  loading?: boolean;
  iconSize?: number;
}

export const refreshIconButtonStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 8,
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-secondary)',
  color: 'var(--text-primary)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

export const RefreshIconButton: React.FC<RefreshIconButtonProps> = ({
  loading = false,
  iconSize = 15,
  disabled,
  title = '刷新',
  'aria-label': ariaLabel = '刷新',
  style,
  ...rest
}) => {
  const isDisabled = disabled || loading;

  return (
    <button
      type="button"
      title={title}
      aria-label={ariaLabel}
      disabled={isDisabled}
      style={{
        ...refreshIconButtonStyle,
        opacity: isDisabled ? 0.6 : 1,
        cursor: isDisabled ? 'not-allowed' : refreshIconButtonStyle.cursor,
        ...style,
      }}
      {...rest}
    >
      {loading ? <Loader2 size={iconSize} /> : <RefreshCw size={iconSize} />}
    </button>
  );
};
