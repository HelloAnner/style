/**
 * 管理后台布局壳。
 *
 * 业务含义：
 * - 承载工作区管理员级别的操作页面，使用查询参数驱动子页面切换（对应 V1 Admin.tsx 的 tab 模式）；
 * - 顶栏 56px：「← 返回工作台」+ 标题；
 * - 左侧 200px 子导航：空间管理 / 资产（灰色占位）/ 用量管理（灰色占位）/ 智能体管理（灰色占位）；
 * - 右侧内容区：当前只实现"空间管理"，其余 Tab 显示「功能开发中」。
 * - 使用查询参数 ?tab=xxx 保持与现有 App.tsx AdminEntryRoute 兼容。
 *
 * 关键逻辑来源（V1 搬运）：
 * - 整体布局：src/pages/admin/Admin.tsx
 * - 子导航 Tab 切换：searchParams 方式（V1 模式）
 * - 空间管理内容：SpaceManagement 组件
 */

import React, { Suspense, lazy, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { WORKSPACE_HOME_PATH } from '../../utils/routes';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { track } from '../../utils/track';

const SpaceManagement = lazy(() => import('./SpaceManagement'));
const AgentSupervision = lazy(() => import('./AgentSupervision'));
const AgentManagement = lazy(() => import('./AgentManagement'));
const SkillsManagement = lazy(() => import('./SkillsManagement'));

// ── 图标 ──

const ArrowLeftIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const SpaceIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const SkillNavIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14,2 14,8 20,8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);

const BarChartIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);

const AgentNavIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
  </svg>
);

// ── Tab 类型 ──

type AdminTab = 'space' | 'skills' | 'supervision' | 'agents';

const TAB_CONFIG: Array<{ key: AdminTab; label: string; icon: React.ReactNode; available: boolean }> = [
  { key: 'space', label: '空间管理', icon: <SpaceIcon />, available: true },
  { key: 'agents', label: '智能体管理', icon: <AgentNavIcon />, available: true },
  { key: 'skills', label: '技能管理', icon: <SkillNavIcon />, available: true },
  { key: 'supervision', label: '通用管理', icon: <BarChartIcon />, available: true },
];

function resolveActiveTab(tab: string | null): AdminTab {
  if (tab === 'space' || tab === 'general' || tab === 'workspace' || tab === 'members') {
    return 'space';
  }
  if (tab === 'agents') return 'agents';
  if (tab === 'skills' || tab === 'assets') return 'skills';
  if (tab === 'supervision' || tab === 'usage') return 'supervision';
  return 'space';
}

// ── 组件 ──

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = resolveActiveTab(searchParams.get('tab'));
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const [agentEditorDirty, setAgentEditorDirty] = useState(false);
  const [pendingAgentLeave, setPendingAgentLeave] = useState<(() => void) | null>(null);

  const requestAgentEditorLeave = (action: () => void) => {
    if (!agentEditorDirty) {
      action();
      return;
    }
    setPendingAgentLeave(() => action);
  };

  const handleTabChange = (tab: AdminTab) => {
    if (tab === activeTab) return;
    track('admin_tab', { sub_event: tab === 'supervision' ? 'general' : tab === 'agents' ? 'agent' : tab });
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    next.delete('agentId');
    requestAgentEditorLeave(() => setSearchParams(next, { replace: true }));
  };

  const confirmAgentLeave = () => {
    const action = pendingAgentLeave;
    setPendingAgentLeave(null);
    setAgentEditorDirty(false);
    action?.();
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: 'var(--bg-primary, #fff)',
        color: 'var(--text-primary, #18181b)',
      }}
      data-testid="admin-dashboard"
    >
      {/* 顶栏 56px */}
      <header
        style={{
          height: '56px',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '0 24px',
          borderBottom: '1px solid var(--border-subtle, #f4f4f5)',
        }}
        data-testid="admin-header"
      >
        <button
          type="button"
          onClick={() => requestAgentEditorLeave(() => navigate(WORKSPACE_HOME_PATH))}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-secondary, #71717a)',
            fontSize: '13px',
            padding: '4px 8px',
            borderRadius: '6px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--hover-bg, rgba(0,0,0,0.05))';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'none';
          }}
          data-testid="admin-back-to-workspace"
        >
          <ArrowLeftIcon />
          返回工作台
        </button>

        <div
          style={{
            width: '1px',
            height: '16px',
            background: 'var(--border-subtle, #f0f0f0)',
          }}
        />

        <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary, #18181b)' }}>
          管理后台
        </span>
      </header>

      {/* 主体区域 */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* 左侧导航 200px */}
        <nav
          style={{
            width: '200px',
            flexShrink: 0,
            borderRight: '1px solid var(--border-subtle, #f4f4f5)',
            padding: '16px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
          data-testid="admin-nav"
        >
          {TAB_CONFIG.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className="admin-nav-item"
              disabled={!tab.available}
              onClick={() => tab.available && handleTabChange(tab.key)}
              onMouseEnter={() => tab.available && activeTab !== tab.key && setHoveredTab(tab.key)}
              onMouseLeave={() => setHoveredTab(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 10px',
                border: 'none',
                borderRadius: '6px',
                background:
                  activeTab === tab.key && tab.available
                    ? 'var(--hover-bg, rgba(0,0,0,0.06))'
                    : hoveredTab === tab.key
                    ? 'var(--hover-bg, rgba(0,0,0,0.04))'
                    : 'transparent',
                color:
                  !tab.available
                    ? 'var(--text-disabled, #c4c4c7)'
                    : activeTab === tab.key || hoveredTab === tab.key
                    ? 'var(--text-primary, #18181b)'
                    : 'var(--text-secondary, #71717a)',
                fontSize: '13px',
                fontWeight: activeTab === tab.key && tab.available ? 500 : 400,
                cursor: tab.available ? 'pointer' : 'not-allowed',
                width: '100%',
                textAlign: 'left',
              }}
              data-testid={`admin-nav-${tab.key}`}
            >
              {tab.icon}
              {tab.label}
              {!tab.available && (
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: '10px',
                    color: 'var(--text-disabled, #c4c4c7)',
                  }}
                >
                  即将上线
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* 右侧内容区 */}
        <main
          style={{
            flex: 1,
            overflow: 'auto',
          }}
          data-testid="admin-main"
        >
          <Suspense
            fallback={
              <div
                style={{
                  padding: '32px',
                  color: 'var(--text-secondary, #71717a)',
                  fontSize: '14px',
                }}
                data-testid="admin-loading"
              >
                加载中...
              </div>
            }
          >
            {activeTab === 'space' && <SpaceManagement />}
            {activeTab === 'supervision' && <AgentSupervision />}
            {activeTab === 'skills' && <SkillsManagement />}
            {activeTab === 'agents' && (
              <AgentManagement
                onEditorDirtyChange={setAgentEditorDirty}
                requestEditorLeave={requestAgentEditorLeave}
              />
            )}
          </Suspense>
        </main>
      </div>
      <ConfirmDialog
        open={Boolean(pendingAgentLeave)}
        title="离开编辑"
        description="当前智能体配置尚未发布，离开后本次修改不会保存。确认离开？"
        confirmText="离开"
        cancelText="继续编辑"
        onConfirm={confirmAgentLeave}
        onCancel={() => setPendingAgentLeave(null)}
      />
    </div>
  );
};

export default AdminDashboard;
