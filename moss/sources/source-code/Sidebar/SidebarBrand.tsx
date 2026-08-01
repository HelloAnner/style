import React from 'react';
import { SidebarIcon } from './icons/SidebarIcon';

interface SidebarBrandProps {
  onCollapse: () => void;
}

const sidebarBrandLabels = {
  zh: {
    collapse: '收起',
  },
  en: {
    collapse: 'Collapse',
  },
} as const;

function getSidebarBrandLabels() {
  if (typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('zh')) {
    return sidebarBrandLabels.zh;
  }
  return sidebarBrandLabels.en;
}

export const SidebarBrand: React.FC<SidebarBrandProps> = ({ onCollapse }) => {
  const [isTooltipVisible, setIsTooltipVisible] = React.useState(false);
  const labels = getSidebarBrandLabels();

  return (
    <div
      data-sidebar-entry="logo"
      className="flex items-center"
      style={{
        height: 56,
        padding: '0 8px 0 16px',
        justifyContent: 'space-between',
        color: 'var(--moss-sidebar-text-primary)',
      }}
      data-testid="sidebar-brand"
    >
      <span style={{ fontSize: 18, lineHeight: '26px', fontWeight: 600 }}>
        MOSS · 谋士
      </span>
      <span
        style={{ position: 'relative', display: 'inline-flex' }}
        onMouseEnter={() => setIsTooltipVisible(true)}
        onMouseLeave={() => setIsTooltipVisible(false)}
        onFocusCapture={() => setIsTooltipVisible(true)}
        onBlurCapture={() => setIsTooltipVisible(false)}
      >
        <button
          type="button"
          aria-label={labels.collapse}
          aria-describedby={isTooltipVisible ? 'sidebar-collapse-tooltip' : undefined}
          onClick={() => {
            setIsTooltipVisible(false);
            onCollapse();
          }}
          style={{
            width: 32,
            height: 32,
            border: 'none',
            borderRadius: 8,
            background: 'transparent',
            color: 'var(--moss-sidebar-text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
          onMouseEnter={(event) => {
            event.currentTarget.style.background = 'var(--moss-sidebar-item-hover-bg)';
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.background = 'transparent';
          }}
          data-testid="sidebar-collapse-btn"
        >
          <SidebarIcon name="collapse" size={16} />
        </button>
        {isTooltipVisible && (
          <span
            id="sidebar-collapse-tooltip"
            role="tooltip"
            style={{
              position: 'absolute',
              top: 40,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1000,
              padding: '4px 8px',
              borderRadius: 6,
              background: 'var(--moss-sidebar-tooltip-bg)',
              color: 'var(--moss-sidebar-tooltip-fg)',
              boxShadow: 'var(--moss-sidebar-tooltip-shadow)',
              fontSize: 12,
              fontWeight: 500,
              lineHeight: '18px',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
            }}
          >
            {labels.collapse}
          </span>
        )}
      </span>
    </div>
  );
};

export default SidebarBrand;
