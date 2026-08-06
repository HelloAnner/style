/**
 * DashboardLoading - 看板查询加载态
 *
 * 维护提示：这个 loading 是已确认的看板查询动效，核心体验是“放大镜轻扫看板”。
 * 后续调整请保留该视觉方向，不要无意改回普通骨架屏或高饱和警示感。
 */

import React from 'react';

const DASHBOARD_LOADING_COPY = {
  zh: {
    label: '正在查询中',
  },
  en: {
    label: 'Querying',
  },
} as const;

type DashboardLoadingLocale = keyof typeof DASHBOARD_LOADING_COPY;

function resolveDashboardLoadingLocale(): DashboardLoadingLocale {
  if (typeof navigator === 'undefined') return 'zh';
  const language = navigator.language || navigator.languages?.[0] || '';
  return language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

function useDashboardLoadingCopy() {
  const [locale, setLocale] = React.useState<DashboardLoadingLocale>(() => resolveDashboardLoadingLocale());

  React.useEffect(() => {
    const next = resolveDashboardLoadingLocale();
    if (next !== locale) setLocale(next);
  }, [locale]);

  return DASHBOARD_LOADING_COPY[locale];
}

export const DashboardLoading: React.FC = () => {
  const copy = useDashboardLoadingCopy();

  return (
    <div className="dashboard-loading" role="status" aria-live="polite" aria-label={copy.label}>
      <div className="dashboard-loading-visual" aria-hidden="true">
        <div className="dashboard-loading-board">
          <div className="dashboard-loading-board-top">
            <span />
            <span />
            <span />
          </div>
          <div className="dashboard-loading-chart">
            <span className="dashboard-loading-bar one" />
            <span className="dashboard-loading-bar two" />
            <span className="dashboard-loading-bar three" />
            <span className="dashboard-loading-bar four" />
          </div>
          <div className="dashboard-loading-lines">
            <span />
            <span />
            <span />
          </div>
          <div className="dashboard-loading-scan" />
        </div>
        <div className="dashboard-loading-magnifier">
          <div className="dashboard-loading-lens" />
          <div className="dashboard-loading-handle" />
        </div>
      </div>
      <div className="dashboard-loading-label">{copy.label}</div>
    </div>
  );
};
