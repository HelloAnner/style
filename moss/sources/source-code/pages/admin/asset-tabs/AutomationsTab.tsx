/**
 * 资产管理 → 自动化 Tab — 占位 UI。
 *
 * TODO: 等后端自动化管理接口就绪后实施完整功能。
 */

export function AutomationsTab() {
  return (
    <div
      data-testid="automations-tab"
      style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: 12,
        padding: '48px 32px',
        textAlign: 'center',
        background: 'var(--bg-secondary)',
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 500,
          color: 'var(--text-primary)',
          marginBottom: 10,
        }}
      >
        自动化管理功能开发中
      </div>
      <p
        style={{
          fontSize: 13,
          color: 'var(--text-muted)',
          lineHeight: 1.7,
          maxWidth: 480,
          margin: '0 auto',
        }}
      >
        租户级自动化管理等交互设计稿落地后实施。当前 V1 无对应 admin 侧页面。
        {/* TODO: 接入后端自动化管理接口 */}
      </p>
    </div>
  );
}
