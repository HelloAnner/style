/**
 * DashboardTabBar — 顶部独立的看板切换栏
 *
 * 从原 DashboardToolbar 抽出。只负责"看板间切换"，不混合任何查询条件。
 *
 * 视觉规则：
 *   - ≥ 2 个看板时显示为 tab 横条
 *   - 1 个看板时降级为静态标签（避免单 tab 视觉冗余）
 *   - 0 个看板时不渲染（父容器一般也不会渲染本组件）
 *   - 自定义看板带紫色小圆点提示（与原来的 .is-custom 一致）
 */
import React from 'react';
import { ChevronDown } from 'lucide-react';
import { useDashboardStore } from '../../stores/dashboardStore';
import { DropdownMenu, type DropdownMenuItem } from '../common/DropdownMenu';
import { FineDesignTooltip } from '../common/FineDesignTooltip';

const DASHBOARD_TAB_ICONS: Record<string, string> = {
  'enterprise-360': '/icons/dashboard/enterprise-360.svg',
  'bidding-query': '/icons/dashboard/bidding-query.svg',
  'company-filter': '/icons/dashboard/company-filter.svg',
  'industry-chain': '/icons/dashboard/industry-chain.svg',
  'batch-query': '/icons/dashboard/batch-query.svg',
};

interface DashboardTabBarProps {
  variant?: 'line' | 'segment';
  compact?: boolean;
  collapseToDropdownWhenCompact?: boolean;
}

export const DashboardTabBar: React.FC<DashboardTabBarProps> = ({
  variant = 'line',
  compact = false,
  collapseToDropdownWhenCompact = false,
}) => {
  const dashboards = useDashboardStore((s) => s.dashboards);
  const currentKey = useDashboardStore((s) => s.currentKey);
  const setCurrentKey = useDashboardStore((s) => s.setCurrentKey);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const measureRef = React.useRef<HTMLDivElement | null>(null);
  const [useDropdown, setUseDropdown] = React.useState(false);

  const shouldAutoCollapse = compact && collapseToDropdownWhenCompact;

  React.useLayoutEffect(() => {
    if (!shouldAutoCollapse) {
      setUseDropdown(false);
      return;
    }

    const updateOverflowState = () => {
      const root = rootRef.current;
      const measure = measureRef.current;
      if (!root || !measure) return;
      const requiredWidth = Math.max(measure.scrollWidth, root.scrollWidth);
      setUseDropdown(requiredWidth > root.clientWidth + 1);
    };

    updateOverflowState();
    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(updateOverflowState);
    if (rootRef.current) observer.observe(rootRef.current);
    if (measureRef.current) observer.observe(measureRef.current);
    return () => observer.disconnect();
  }, [dashboards, currentKey, shouldAutoCollapse]);

  if (dashboards.length === 0) return null;

  if (dashboards.length === 1) {
    return (
      <div className={`dashboard-tabbar dashboard-tabbar-${variant} dashboard-tabbar-single`}>
        <span className="dashboard-tabbar-label">
          {dashboards[0].name}
        </span>
      </div>
    );
  }

  const renderDashboardIcon = (key: string) => {
    const tabIcon = DASHBOARD_TAB_ICONS[key];
    if (!tabIcon) return null;
    return (
      <span
        className="dashboard-tabbar-icon"
        style={{
          WebkitMaskImage: `url(${tabIcon})`,
          maskImage: `url(${tabIcon})`,
        }}
        aria-hidden="true"
      />
    );
  };

  const activeDashboard = dashboards.find((d) => d.key === currentKey) ?? dashboards[0];
  const dropdownItems: DropdownMenuItem[] = dashboards.map((d) => ({
    key: d.key,
    label: d.name,
    icon: renderDashboardIcon(d.key),
    selected: d.key === currentKey,
    onClick: () => {
      if (d.key !== currentKey) setCurrentKey(d.key);
    },
  }));

  if (shouldAutoCollapse && useDropdown) {
    return (
      <div
        ref={rootRef}
        className={`dashboard-tabbar dashboard-tabbar-${variant} is-compact is-dropdown`}
        role="tablist"
      >
        <DropdownMenu
          items={dropdownItems}
          placement="bottom-start"
          menuMinWidth={188}
          trigger={(
            <button
              role="tab"
              type="button"
              aria-selected="true"
              aria-label={activeDashboard.name}
              className="dashboard-tabbar-tab is-active has-text is-dropdown-trigger"
            >
              {renderDashboardIcon(activeDashboard.key)}
              <span className="dashboard-tabbar-text">{activeDashboard.name}</span>
              <ChevronDown size={14} className="dashboard-tabbar-chevron" aria-hidden="true" />
            </button>
          )}
        />
        <div
          ref={measureRef}
          className={`dashboard-tabbar dashboard-tabbar-${variant} dashboard-tabbar-measure`}
          aria-hidden="true"
        >
          {dashboards.map((d) => (
            <button
              key={d.key}
              type="button"
              className="dashboard-tabbar-tab has-text"
              tabIndex={-1}
            >
              {renderDashboardIcon(d.key)}
              <span className="dashboard-tabbar-text">{d.name}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className={
        `dashboard-tabbar dashboard-tabbar-${variant}` +
        (compact ? ' is-compact' : '') +
        (shouldAutoCollapse ? ' can-auto-collapse' : '')
      }
      role="tablist"
    >
      {dashboards.map((d) => {
        const active = d.key === currentKey;
        const tabIcon = DASHBOARD_TAB_ICONS[d.key];
        const showText = !compact || !tabIcon || shouldAutoCollapse;
        const button = (
          <button
            role="tab"
            type="button"
            aria-selected={active}
            aria-label={d.name}
            title={compact ? undefined : d.description || d.name}
            className={
              'dashboard-tabbar-tab' +
              (active ? ' is-active' : '') +
              (showText ? ' has-text' : '') +
              (d.source === 'custom' ? ' is-custom' : '')
            }
            onClick={() => {
              if (d.key !== currentKey) setCurrentKey(d.key);
            }}
          >
            {tabIcon && (
              renderDashboardIcon(d.key)
            )}
            {showText && (
              <span className="dashboard-tabbar-text">{d.name}</span>
            )}
          </button>
        );

        if (showText) {
          return React.cloneElement(button, { key: d.key });
        }

        return (
          <FineDesignTooltip
            key={d.key}
            content={d.name}
            placement="bottom"
            tooltipId={`dashboard-tab-${d.key}-tooltip`}
            testId={`dashboard-tab-${d.key}`}
            wrapperStyle={{ height: '100%' }}
          >
            {button}
          </FineDesignTooltip>
        );
      })}
      {shouldAutoCollapse && (
        <div
          ref={measureRef}
          className={`dashboard-tabbar dashboard-tabbar-${variant} dashboard-tabbar-measure`}
          aria-hidden="true"
        >
          {dashboards.map((d) => (
            <button
              key={d.key}
              type="button"
              className="dashboard-tabbar-tab has-text"
              tabIndex={-1}
            >
              {renderDashboardIcon(d.key)}
              <span className="dashboard-tabbar-text">{d.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
