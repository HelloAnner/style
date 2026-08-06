import React, { useState } from 'react';
import { SuperAdminLayout } from './SuperAdminLayout';
import { SuperAdminAgentList } from './SuperAdminAgentList';
import { SuperAdminAgentToolPolicy } from './SuperAdminAgentToolPolicy';
import { SuperAdminTenantAgentBatchPanel } from './SuperAdminTenantAgentBatchPanel';
import './SuperAdminAgentsPage.css';

type TabKey = 'list' | 'policy' | 'batch';

const TABS: { key: TabKey; label: string; desc: string }[] = [
  { key: 'list', label: '智能体列表', desc: '浏览和检索平台所有智能体' },
  { key: 'policy', label: '工具白名单', desc: '开关工具自动保存，运行时直接读取数据库策略' },
  { key: 'batch', label: '批量开通', desc: '批量为租户开通 / 关闭内置智能体' },
];

export const SuperAdminAgentsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('list');

  return (
    <SuperAdminLayout>
      <main
        className={`fi-superadmin-content${activeTab === 'list' ? ' fi-superadmin-list-page' : ''}`}
        data-testid="superadmin-agents-page"
        style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18, minHeight: 0 }}
      >
        {/* 页面标题 */}
        <div data-testid="superadmin-agents-header">
          <div style={{ fontSize: 20, fontWeight: 600, lineHeight: '28px', color: 'var(--text-primary)' }}>主智能体管理</div>
          <div style={{ fontSize: 12, lineHeight: '18px', color: 'var(--text-muted)', marginTop: 4 }}>
            {TABS.find((t) => t.key === activeTab)?.desc}
          </div>
        </div>

        {/* Tab 导航 */}
        <nav className="sa-agents-tabs" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              className={`sa-agents-tab${activeTab === tab.key ? ' is-active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Tab 内容 */}
        {activeTab === 'list' && <SuperAdminAgentList />}
        {activeTab === 'policy' && <SuperAdminAgentToolPolicy />}
        {activeTab === 'batch' && (
          <div className="sa-agents-card">
            <div className="sa-agents-card-header">
              <div>
                <div className="sa-agents-section-title">租户智能体批量开通</div>
                <div className="sa-agents-section-desc">
                  全量或按租户批量更新内置智能体开通状态与推荐问模式
                </div>
              </div>
            </div>
            <div className="sa-agents-batch-wrapper">
              <SuperAdminTenantAgentBatchPanel />
            </div>
          </div>
        )}
      </main>
    </SuperAdminLayout>
  );
};

export default SuperAdminAgentsPage;
