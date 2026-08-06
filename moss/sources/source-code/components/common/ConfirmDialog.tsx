import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import warningIcon from '../../assets/icons/file-panel/warning.svg';

type Variant = 'default' | 'danger' | 'dark';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: Variant;
  icon?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  backdropTestId?: string;
  panelTestId?: string;
  titleTestId?: string;
  descriptionTestId?: string;
  cancelButtonTestId?: string;
  confirmButtonTestId?: string;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = '确认',
  cancelText = '取消',
  variant = 'default',
  icon,
  onConfirm,
  onCancel,
  backdropTestId,
  panelTestId,
  titleTestId,
  descriptionTestId,
  cancelButtonTestId,
  confirmButtonTestId,
}: ConfirmDialogProps) {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      else if (e.key === 'Enter') onConfirm();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel, onConfirm]);

  if (!open) return null;

  const confirmStyle: React.CSSProperties = variant === 'danger'
    ? {
        border: '1px solid var(--danger-border-soft)',
        background: 'var(--danger-bg-soft)',
        color: 'var(--danger)',
      }
    : variant === 'dark'
      ? {
          border: '1px solid var(--text-primary)',
          background: 'var(--text-primary)',
          color: 'var(--bg-primary, #fff)',
        }
    : {
        border: '1px solid transparent',
        background: 'var(--accent)',
        color: 'var(--accent-fg, #fff)',
      };

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.4)',
        animation: 'fadeIn 120ms ease-out',
      }}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      data-testid={backdropTestId ?? 'confirm-dialog-backdrop'}
    >
      <div
        style={{
          background: 'var(--modal-bg, var(--bg-secondary))',
          borderRadius: 12,
          padding: 24,
          maxWidth: 400,
          width: '90%',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--modal-shadow, 0 8px 32px rgba(0,0,0,0.18))',
        }}
        onClick={(e) => e.stopPropagation()}
        data-testid={panelTestId ?? 'confirm-dialog'}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
          {variant === 'danger' && !icon && (
            <div style={{ flexShrink: 0, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src={warningIcon} alt="" aria-hidden="true" style={{ width: 24, height: 24 }} />
            </div>
          )}
          {icon && (
            <div style={{ flexShrink: 0, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {icon}
            </div>
          )}
          <h3
            style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}
            data-testid={titleTestId ?? 'confirm-dialog-title'}
          >
            {title}
          </h3>
        </div>
        {description ? (
          <p
            style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, wordBreak: 'break-all' }}
            data-testid={descriptionTestId ?? 'confirm-dialog-description'}
          >
            {description}
          </p>
        ) : (
          <div style={{ height: 12 }} />
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 13,
              border: '1px solid var(--border-default)',
              background: 'var(--bg-tertiary)', cursor: 'pointer',
              color: 'var(--text-primary)',
            }}
            data-testid={cancelButtonTestId ?? 'confirm-dialog-cancel'}
          >
            {cancelText}
          </button>
          <button
            ref={confirmBtnRef}
            onClick={onConfirm}
            style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 13,
              cursor: 'pointer', fontWeight: 500,
              ...confirmStyle,
            }}
            data-testid={confirmButtonTestId ?? 'confirm-dialog-confirm'}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
