import { type CSSProperties, type MouseEvent } from 'react';

interface MossSwitchProps {
  checked: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  testId?: string;
  style?: CSSProperties;
  onChange: (checked: boolean, event: MouseEvent<HTMLButtonElement>) => void;
}

export function MossSwitch({
  checked,
  disabled = false,
  ariaLabel,
  className,
  testId,
  style,
  onChange,
}: MossSwitchProps) {
  return (
    <button
      type="button"
      className={className}
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={(event) => onChange(!checked, event)}
      style={{
        width: 36,
        height: 20,
        padding: 2,
        borderRadius: 10,
        border: 'none',
        background: checked ? 'var(--btn-mono-bg)' : 'var(--border-default)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: checked ? 'flex-end' : 'flex-start',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.15s ease',
        flexShrink: 0,
        opacity: disabled ? 0.72 : 1,
        ...style,
      }}
      data-testid={testId}
    >
      <span
        aria-hidden="true"
        style={{
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: checked ? 'var(--btn-mono-text)' : 'var(--bg-secondary)',
          // 两主题通用的轻阴影，用来让圆点从轨道里浮出来。
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }}
      />
    </button>
  );
}
