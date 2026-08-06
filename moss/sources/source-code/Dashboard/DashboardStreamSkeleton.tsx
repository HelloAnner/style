import React from 'react';

interface DashboardStreamSkeletonProps {
  visible: boolean;
  variant?: 'risk' | 'default';
}

export const DASHBOARD_STREAM_SKELETON_EXIT_MS = 160;

function SkeletonLine({ width }: { width: 'short' | 'medium' | 'long' }) {
  return <span className={`dashboard-stream-skeleton-line is-${width}`} />;
}

/**
 * 二次查询期间覆盖旧快照的结构占位。
 *
 * 新看板 ready 后先保留一个短暂淡出阶段，再卸载骨架，避免大面积骨架与结果硬切换。
 */
export const DashboardStreamSkeleton: React.FC<DashboardStreamSkeletonProps> = ({
  visible,
  variant = 'default',
}) => {
  const [mounted, setMounted] = React.useState(visible);
  const [leaving, setLeaving] = React.useState(false);

  React.useEffect(() => {
    if (visible) {
      setMounted(true);
      setLeaving(false);
      return undefined;
    }
    if (!mounted) return undefined;

    setLeaving(true);
    const timer = window.setTimeout(() => {
      setMounted(false);
      setLeaving(false);
    }, DASHBOARD_STREAM_SKELETON_EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [mounted, visible]);

  if (!visible && !mounted) return null;

  return (
    <div
      className={`dashboard-stream-skeleton is-${variant}${!visible && leaving ? ' is-leaving' : ''}`}
      aria-hidden="true"
    >
      <div className="dashboard-stream-skeleton-hero">
        <div className="dashboard-stream-skeleton-copy">
          <SkeletonLine width="medium" />
          <SkeletonLine width="long" />
        </div>
        <span className="dashboard-stream-skeleton-pill" />
      </div>

      <div className="dashboard-stream-skeleton-kpis">
        {[0, 1, 2, 3].map((index) => (
          <div className="dashboard-stream-skeleton-kpi" key={index}>
            <SkeletonLine width="short" />
            <SkeletonLine width="medium" />
            <SkeletonLine width="long" />
          </div>
        ))}
      </div>

      <div className="dashboard-stream-skeleton-tabs">
        <span />
        <span />
      </div>

      <div className="dashboard-stream-skeleton-charts">
        <div className="dashboard-stream-skeleton-chart">
          <SkeletonLine width="short" />
          <div className="dashboard-stream-skeleton-bars">
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
        <div className="dashboard-stream-skeleton-chart">
          <SkeletonLine width="short" />
          <div className="dashboard-stream-skeleton-rows">
            <span />
            <span />
            <span />
          </div>
        </div>
      </div>
    </div>
  );
};
