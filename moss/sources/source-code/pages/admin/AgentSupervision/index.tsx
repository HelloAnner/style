import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { track } from '../../../utils/track';

type SupervisionTab = 'usage' | 'records' | 'automation';

const TAB_LABELS: Record<SupervisionTab, string> = {
  usage: '用量管理',
  records: '使用记录',
  automation: '自动化任务',
};

const tabBtnStyle = (active: boolean, hovered = false): React.CSSProperties => ({
  padding: '10px 8px',
  marginRight: '8px',
  border: 'none',
  borderBottom: `2px solid ${active ? 'var(--text-primary)' : 'transparent'}`,
  background: (!active && hovered) ? 'var(--bg-hover)' : 'none',
  borderRadius: '4px 4px 0 0',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: active ? 600 : 400,
  color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
  transition: 'background 0.15s',
});

// 懒加载三个子 Tab（先用 placeholder，后续 Task 3-9 实现）
const UsageTab = React.lazy(() => import('./UsageTab'));
const UsageRecordsTab = React.lazy(() => import('./UsageRecordsTab'));
const AutomationTab = React.lazy(() => import('./AutomationTab'));

function resolveSupervisionTab(subTab: string | null): SupervisionTab {
  if (subTab === 'records' || subTab === 'automation') return subTab;
  if (subTab === 'session') return 'records';
  return 'usage';
}

const AgentSupervision: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = resolveSupervisionTab(searchParams.get('subTab'));
  const [hoveredTab, setHoveredTab] = useState<SupervisionTab | null>(null);

  function handleTabChange(tab: SupervisionTab) {
    if (tab === activeTab) return;
    track('general_management', { sub_event: tab });
    const next = new URLSearchParams(searchParams);
    if (tab === 'usage') {
      next.delete('subTab');
    } else {
      next.set('subTab', tab);
    }
    next.delete('usageId');
    setSearchParams(next, { replace: true });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }} data-testid="agent-supervision-page">
      {/* 页面标题 */}
      <div style={{ padding: '28px 32px 20px', flexShrink: 0 }} data-testid="agent-supervision-header">
        <h2
          style={{
            fontSize: '18px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: 0,
          }}
        >
          通用管理
        </h2>
      </div>

      {/* Tab 导航栏 */}
      <div style={{ padding: '0 32px', flexShrink: 0 }} data-testid="agent-supervision-tabs">
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          {(Object.keys(TAB_LABELS) as SupervisionTab[]).map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={activeTab === tab}
              onMouseEnter={() => setHoveredTab(tab)}
              onMouseLeave={() => setHoveredTab(null)}
              onClick={() => handleTabChange(tab)}
              style={tabBtnStyle(activeTab === tab, hoveredTab === tab)}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>
      </div>

      {/* Tab 内容区 */}
      <div style={{ flex: 1, overflow: 'auto' }} data-testid={`agent-supervision-panel-${activeTab}`}>
        <React.Suspense fallback={<div style={{ padding: '32px', color: 'var(--text-secondary)' }}>加载中...</div>}>
          {activeTab === 'usage' && <UsageTab />}
          {activeTab === 'records' && <UsageRecordsTab />}
          {activeTab === 'automation' && <AutomationTab />}
        </React.Suspense>
      </div>
    </div>
  );
};

export default AgentSupervision;
