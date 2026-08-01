import React, { useState } from 'react';
import { track } from '../../utils/track';
import type { RightPanelType } from '../../stores/uiStore';
import showcaseColorIcon from '../../assets/icons/sidebar/showcase-color.png';
import { SidebarIcon } from './icons/SidebarIcon';

interface SidebarFooterActionsProps {
  onOpenWorkspace: () => void;
  onOpenAutomation: () => void;
  onOpenShowcase: () => void;
  activePanel: RightPanelType;
  disabledTools?: boolean;
}

interface SidebarFooterButtonProps {
  entry: 'workspace' | 'automation';
  label: string;
  testId: string;
  onClick: () => void;
  isActive: boolean;
  disabled?: boolean;
  title?: string;
  style?: React.CSSProperties;
}

export const SidebarFooterButton: React.FC<SidebarFooterButtonProps> = ({
  entry,
  label,
  testId,
  onClick,
  isActive,
  disabled = false,
  title,
  style,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const background = isActive && !disabled
    ? 'var(--moss-sidebar-item-active-bg)'
    : isHovered && !disabled
      ? 'var(--moss-sidebar-item-hover-bg)'
      : 'transparent';

  return (
    <button
      data-sidebar-entry={entry}
      data-testid={testId}
      className="sidebar-footer-action"
      aria-pressed={isActive && !disabled}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={onClick}
      title={disabled ? '看板模块下暂不可用' : title ?? label}
      style={{
        flex: 1,
        minWidth: 0,
        height: 32,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        padding: '5px 8px',
        background,
        border: 'none',
        borderRadius: 6,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 13,
        color: disabled
          ? 'var(--moss-sidebar-text-muted)'
          : isActive ? 'var(--moss-sidebar-text-primary)' : 'var(--moss-sidebar-text-secondary)',
        opacity: disabled ? 0.46 : 1,
        whiteSpace: 'nowrap',
        transition: 'background 160ms ease, color 160ms ease, opacity 160ms ease',
        ...style,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <SidebarIcon name={entry} size={16} />
      <span>{label}</span>
    </button>
  );
};

interface SidebarShowcaseButtonProps {
  onClick: () => void;
}

const SidebarShowcaseButton: React.FC<SidebarShowcaseButtonProps> = ({ onClick }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      data-sidebar-entry="showcase"
      className="sidebar-showcase-action"
      onClick={() => {
        track('case_center');
        onClick();
      }}
      style={{
        position: 'relative',
        width: '100%',
        minWidth: 0,
        height: 38,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 4,
        padding: '8px 12px',
        background: isHovered
          ? 'var(--moss-sidebar-showcase-hover-bg)'
          : 'var(--moss-sidebar-showcase-bg)',
        border: '0.5px solid var(--moss-sidebar-showcase-border)',
        borderRadius: 4,
        cursor: 'pointer',
        fontSize: 14,
        lineHeight: '22px',
        color: 'var(--moss-sidebar-showcase-fg)',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        transition: 'background 160ms ease, border-color 160ms ease',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-testid="sidebar-entry-showcase"
    >
      <SidebarIcon name="showcase" size={16} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>案例中心</span>
      <img
        src={showcaseColorIcon}
        alt=""
        aria-hidden="true"
        width={46}
        height={46}
        style={{
          position: 'absolute',
          left: 169.5,
          top: 1.5,
          width: 46,
          height: 46,
          pointerEvents: 'none',
        }}
      />
    </button>
  );
};

export const SidebarFooterActions: React.FC<SidebarFooterActionsProps> = ({
  onOpenWorkspace,
  onOpenAutomation,
  onOpenShowcase,
  activePanel,
  disabledTools = false,
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', padding: '8px 16px', gap: 8 }}>
    <SidebarShowcaseButton onClick={onOpenShowcase} />
    <div style={{ display: 'flex', gap: 8 }}>
      <SidebarFooterButton
        entry="workspace"
        label="我的文件"
        testId="sidebar-entry-workspace"
        onClick={() => {
          track('my_files', { position: 'left_bottom' });
          onOpenWorkspace();
        }}
        isActive={activePanel === 'workspace'}
        disabled={disabledTools}
      />
      <SidebarFooterButton
        entry="automation"
        label="自动化"
        testId="sidebar-entry-automation"
        onClick={() => {
          track('automation', { position: 'left_bottom' });
          onOpenAutomation();
        }}
        isActive={activePanel === 'automation'}
        disabled={disabledTools}
      />
    </div>
  </div>
);

export default SidebarFooterActions;
