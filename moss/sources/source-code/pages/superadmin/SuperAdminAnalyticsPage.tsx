import React, { useState } from 'react';
import { SuperAdminLayout } from './SuperAdminLayout';
import { TrackingAnalyticsPanel } from '../../components/superadmin/TrackingAnalyticsPanel';
import { RecommendedQuestionsContent } from './SuperAdminAnalyticsRecommendedQuestionsPage';
import { trackingAnalyticsSummary } from '../../api/superadmin';
import type { SaTrackingSummaryParams, SaTrackingSummary } from '../../api/superadmin';

type TabKey = 'frontend' | 'dashboard' | 'recommended';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'frontend', label: '前端埋点' },
  { key: 'dashboard', label: '智能看板' },
  { key: 'recommended', label: '推荐问' },
];

export const SuperAdminAnalyticsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('frontend');

  const fetchFrontendSummary = async (params: SaTrackingSummaryParams): Promise<SaTrackingSummary> => {
    return trackingAnalyticsSummary({ ...params, category: 'frontend' });
  };

  const fetchDashboardSummary = async (params: SaTrackingSummaryParams): Promise<SaTrackingSummary> => {
    return trackingAnalyticsSummary({ ...params, category: 'dashboard' });
  };

  const tabStyle = (isActive: boolean): React.CSSProperties => ({
    height: 36, padding: '0 16px', border: 'none', cursor: 'pointer',
    fontSize: 13, fontWeight: 500, borderRadius: 8,
    background: isActive ? 'var(--bg-secondary)' : 'transparent',
    color: 'var(--text-primary)',
  });

  return (
    <SuperAdminLayout>
      <main style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 600, lineHeight: '28px', color: 'var(--text-primary)' }}>埋点分析</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            前端行为埋点、智能看板使用、推荐问点击分析
          </div>
        </div>

        <nav style={{ display: 'flex', gap: 6, padding: 4, borderRadius: 10, background: 'var(--bg-tertiary)', width: 'fit-content' }}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={tabStyle(activeTab === tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div style={{ display: activeTab === 'frontend' ? 'block' : 'none' }}>
          <TrackingAnalyticsPanel fetchSummary={fetchFrontendSummary} category="frontend" active={activeTab === 'frontend'} />
        </div>
        <div style={{ display: activeTab === 'dashboard' ? 'block' : 'none' }}>
          <TrackingAnalyticsPanel fetchSummary={fetchDashboardSummary} category="dashboard" active={activeTab === 'dashboard'} />
        </div>
        <div style={{ display: activeTab === 'recommended' ? 'block' : 'none' }}>
          <RecommendedQuestionsContent />
        </div>
      </main>
    </SuperAdminLayout>
  );
};

export default SuperAdminAnalyticsPage;
