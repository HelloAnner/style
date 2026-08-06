import React from 'react';

export type OpsTabKey = 'infrastructure' | 'external-services';

const OPS_TABS: Array<{ key: OpsTabKey; label: string }> = [
  { key: 'infrastructure', label: '基础信息' },
  { key: 'external-services', label: '外部服务监控' },
];

export const SuperAdminOpsHeader: React.FC<{
  activeTab: OpsTabKey;
  onTabChange: (tab: OpsTabKey) => void;
}> = ({ activeTab, onTabChange }) => {
  return (
    <div data-testid="superadmin-ops-header" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 600, lineHeight: '28px', color: 'var(--text-primary)' }}>运维中心</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
          统一查看服务健康、作业状态与外部服务监控
        </div>
      </div>
      <div
        className="sa-segmented-tabs"
        data-testid="superadmin-ops-tabs"
      >
        {OPS_TABS.map((tab) => {
          const active = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                if (!active) {
                  onTabChange(tab.key);
                }
              }}
              className={active ? 'is-active' : undefined}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
