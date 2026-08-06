export function NoPermission() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', gap: '12px', color: 'var(--text-muted, #7A7A7A)',
    }} role="status" aria-live="polite" data-testid="no-permission">
      <div style={{ fontSize: '48px' }} aria-hidden="true" data-testid="no-permission-icon">
        &#128274;
      </div>
      <div style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text-primary, #1A1A1A)' }} data-testid="no-permission-title">
        没有访问权限
      </div>
      <div style={{ fontSize: '14px' }} data-testid="no-permission-description">
        你没有权限访问此页面，请联系工作区管理员
      </div>
    </div>
  );
}
