type Props = {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function LogoutConfirmDialog({ open, onConfirm, onCancel }: Props) {
  if (!open) return null;

  return (
    <div
      data-testid="logout-confirm-dialog-backdrop"
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.4)',
      }}
      onClick={onCancel}
    >
      <div
        data-testid="logout-confirm-dialog"
        style={{
          background: 'var(--modal-bg, var(--bg-secondary))', borderRadius: '12px',
          padding: '24px', maxWidth: '360px', width: '90%',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--modal-shadow, 0 8px 32px rgba(0,0,0,0.12))',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          data-testid="logout-confirm-dialog-title"
          style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}
        >
          确认退出登录？
        </h3>
        <p
          data-testid="logout-confirm-dialog-description"
          style={{ margin: '0 0 20px', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5 }}
        >
          退出后需要重新登录才能继续使用
        </p>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            data-testid="logout-confirm-dialog-cancel"
            onClick={onCancel}
            style={{
              padding: '8px 16px', borderRadius: '8px', fontSize: '14px',
              border: '1px solid var(--border-default)',
              background: 'var(--bg-tertiary)', cursor: 'pointer', color: 'var(--text-primary)',
            }}
          >
            取消
          </button>
          <button
            data-testid="logout-confirm-dialog-confirm"
            onClick={onConfirm}
            style={{
              padding: '8px 16px', borderRadius: '8px', fontSize: '14px',
              border: '1px solid var(--danger-border-soft)',
              background: 'var(--danger-bg-soft)', color: 'var(--danger)',
              cursor: 'pointer', fontWeight: 500,
            }}
          >
            退出登录
          </button>
        </div>
      </div>
    </div>
  );
}
