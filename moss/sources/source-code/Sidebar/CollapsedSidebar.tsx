/**
 * 折叠侧边栏 — v11
 *
 * 按钮顺序：侧栏入口 → Agent 头像 → 新会话 → 收藏 → 历史 → (flex) → 案例中心 → 我的文件 → 自动化 → 用户头像
 * 删除了旧「我的 Agents」(Bot) 和「文件」(Folder) 按钮。
 */

import React, { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAgentStore } from '../../stores/agentStore';
import { usePreviewStore } from '../../stores/previewStore';
import { useAuthStore } from '../../stores/authStore';
import { useBillingStore } from '../../stores/billingStore';
import { useUiStore } from '../../stores/uiStore';
import { useAgent } from '../../hooks/useAgent';
import { Avatar } from '../common/Avatar';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { BOARD_HOME_PATH, WORKSPACE_HOME_PATH } from '../../utils/routes';
import { useAgentSwitchController } from '../Agent/useAgentSwitchController';
import { SidebarAgentIcon } from './SidebarAgentIcon';
import { SidebarIcon } from './icons/SidebarIcon';
import type { SettingsInitialTab } from '../../pages/settings/SettingsPage';
import {
  CollapsedSidebarFlyout,
  type CollapsedFlyoutKind,
  type CollapsedFlyoutPosition,
} from './CollapsedSidebarFlyout';
const SettingsPage = lazy(() => import('../../pages/settings/SettingsPage'));

const COLLAPSED_RAIL_WIDTH = 48;
const COLLAPSED_ACTION_SIZE = 32;
const COLLAPSED_TOOLTIP_OFFSET = 8;
const COLLAPSED_FLYOUT_OFFSET = 16;
const COLLAPSED_FLYOUT_VIEWPORT_PADDING = 12;
const COLLAPSED_FLYOUT_TOP_OFFSET = 8;

type TooltipPosition = {
  left: number;
  top: number;
};

const CollapsedAction: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick?: (button: HTMLButtonElement) => void;
  isActive?: boolean;
  disabled?: boolean;
  color?: string;
  hoverBackground?: string;
  'data-collapsed-entry'?: string;
}> = ({
  icon,
  label,
  onClick,
  isActive = false,
  disabled = false,
  color,
  hoverBackground,
  'data-collapsed-entry': entry,
}) => {
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipId = entry ? `collapsed-tooltip-${entry}` : undefined;
  const background = isActive && !disabled
    ? 'var(--moss-sidebar-item-active-bg)'
    : isTooltipVisible && !disabled
      ? hoverBackground ?? 'var(--moss-sidebar-item-hover-bg)'
      : 'transparent';

  const updateTooltipPosition = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltipPosition({
      left: rect.right + COLLAPSED_TOOLTIP_OFFSET,
      top: rect.top + rect.height / 2,
    });
  }, []);

  useEffect(() => {
    if (!isTooltipVisible) return undefined;
    updateTooltipPosition();
    window.addEventListener('resize', updateTooltipPosition);
    window.addEventListener('scroll', updateTooltipPosition, true);
    return () => {
      window.removeEventListener('resize', updateTooltipPosition);
      window.removeEventListener('scroll', updateTooltipPosition, true);
    };
  }, [isTooltipVisible, updateTooltipPosition]);

  const tooltip = isTooltipVisible && tooltipPosition && typeof document !== 'undefined'
    ? createPortal(
        <span
          id={tooltipId}
          role="tooltip"
          data-collapsed-tooltip={entry}
          style={{
            position: 'fixed',
            left: tooltipPosition.left,
            top: tooltipPosition.top,
            transform: 'translateY(-50%)',
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
          {label}
        </span>,
        document.body,
      )
    : null;

  return (
    <div
      data-collapsed-tooltip-wrapper={entry}
      onMouseEnter={() => setIsTooltipVisible(true)}
      onMouseLeave={() => setIsTooltipVisible(false)}
      onFocusCapture={() => setIsTooltipVisible(true)}
      onBlurCapture={() => setIsTooltipVisible(false)}
      style={{
        position: 'relative',
        width: COLLAPSED_ACTION_SIZE,
        height: COLLAPSED_ACTION_SIZE,
        flex: '0 0 auto',
      }}
    >
      <button
        ref={buttonRef}
        className="collapsed-sidebar-entry"
        data-collapsed-entry={entry}
        type="button"
        aria-label={label}
        aria-describedby={isTooltipVisible ? tooltipId : undefined}
        aria-pressed={isActive || undefined}
        onClick={() => {
          setIsTooltipVisible(false);
          if (buttonRef.current) onClick?.(buttonRef.current);
        }}
        disabled={disabled}
        style={{
          width: COLLAPSED_ACTION_SIZE,
          height: COLLAPSED_ACTION_SIZE,
          borderRadius: 8,
          border: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          background,
          color: disabled ? 'var(--moss-sidebar-item-disabled-fg)' : color ?? 'inherit',
          opacity: disabled ? 0.6 : 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          transition: 'background 160ms ease, color 160ms ease, opacity 160ms ease',
        }}
        data-testid={entry ? `collapsed-entry-${entry}` : undefined}
      >
        {icon}
      </button>
      {tooltip}
    </div>
  );
};

interface CollapsedSidebarProps {
  onExpandWithTab?: (tab: 'agents' | 'tasks') => void;
}

export const CollapsedSidebar: React.FC<CollapsedSidebarProps> = ({ onExpandWithTab: _onExpandWithTab }) => {
  const { openSidebar, startNewSession, sessions, currentSessionId } = useAgentStore();
  const { closeSessionTabs } = usePreviewStore();
  const { user, isAuthenticated } = useAuthStore();
  const openWorkspace = useUiStore((s) => s.openWorkspace);
  const openAutomation = useUiStore((s) => s.openAutomation);
  const rightPanelType = useUiStore((s) => s.rightPanelType);
  const navigate = useNavigate();
  const location = useLocation();
  const { updateSessionReadState } = useAgent();
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsInitialTab>('profile');
  const [flyoutKind, setFlyoutKind] = useState<CollapsedFlyoutKind | null>(null);
  const [flyoutPosition, setFlyoutPosition] = useState<CollapsedFlyoutPosition | null>(null);
  const {
    selectableAgents,
    currentAgent,
    currentAgentId,
    pendingSwitchAgent,
    switchingAgentId,
    selectAgent,
    confirmPendingSwitch,
    cancelPendingSwitch,
  } = useAgentSwitchController();
  const isBillingBlocked = useBillingStore((s) => {
    const { billingStatus, lastStatusErrorCode } = s;
    if (!billingStatus) return false;
    if (!billingStatus.provisioned) return true;
    if (billingStatus.planStatus === 'expired' || billingStatus.planStatus === 'exhausted') return true;
    if (billingStatus.insufficientForNextJob) return true;
    if (billingStatus.dailyLimitBreached) return true;
    if (lastStatusErrorCode === '7001' || lastStatusErrorCode === '7002' || lastStatusErrorCode === '7003' || lastStatusErrorCode === '7008') return true;
    return false;
  });

  const starredSessions = useMemo(() => sessions.filter((session) => session.starred), [sessions]);
  const hasStarredSessions = starredSessions.length > 0;
  const hasHistorySessions = sessions.length > 0;
  const isShowcaseActive = location.pathname === '/showcase';
  const isOnBoardPage = location.pathname === BOARD_HOME_PATH;

  const openFlyout = useCallback((kind: CollapsedFlyoutKind, button: HTMLButtonElement) => {
    const rect = button.getBoundingClientRect();
    const top = Math.max(COLLAPSED_FLYOUT_VIEWPORT_PADDING, rect.top - COLLAPSED_FLYOUT_TOP_OFFSET);
    setFlyoutKind((current) => current === kind ? null : kind);
    setFlyoutPosition({
      left: rect.right + COLLAPSED_FLYOUT_OFFSET,
      top,
    });
  }, []);

  const closeFlyout = useCallback(() => {
    setFlyoutKind(null);
    setFlyoutPosition(null);
  }, []);

  const handleNewSession = () => {
    closeFlyout();
    closeSessionTabs();
    startNewSession();
    navigate(WORKSPACE_HOME_PATH);
  };

  const handleSelectSession = useCallback((sessionId: string) => {
    const session = sessions.find(item => item.id === sessionId);
    if (session?.is_unread) {
      useAgentStore.getState().setSessionUnread(sessionId, false);
      void updateSessionReadState(sessionId, false);
    }
    closeFlyout();
    navigate(`/s/${sessionId}`);
  }, [closeFlyout, navigate, sessions, updateSessionReadState]);

  const openShowcase = useCallback(() => {
    closeFlyout();
    navigate('/showcase');
  }, [closeFlyout, navigate]);

  const handleOpenWorkspace = useCallback(() => {
    closeFlyout();
    openWorkspace();
  }, [closeFlyout, openWorkspace]);

  const handleOpenAutomation = useCallback(() => {
    closeFlyout();
    openAutomation();
  }, [closeFlyout, openAutomation]);

  const handleOpenSettings = useCallback((tab: SettingsInitialTab = 'profile') => {
    closeFlyout();
    setSettingsTab(tab);
    setShowSettings(true);
  }, [closeFlyout]);

  const displayName = user?.nickname || user?.passport_username || user?.email?.split('@')[0] || '用户';
  const agentLabel = currentAgent?.name ?? '切换 Agent';

  return (
    <>
      <div
        className="h-full flex flex-col items-center"
        style={{
          width: COLLAPSED_RAIL_WIDTH,
          padding: '8px 0',
          background: 'var(--moss-sidebar-bg)',
          borderRight: '1px solid var(--moss-sidebar-border)',
          boxShadow: 'var(--moss-sidebar-edge-shadow)',
          color: 'var(--moss-sidebar-text-secondary)',
          overflow: 'visible',
          position: 'relative',
        }}
        data-testid="collapsed-sidebar"
      >
        <CollapsedAction
          data-collapsed-entry="expand"
          label="展开"
          onClick={() => {
            closeFlyout();
            openSidebar();
          }}
          icon={<SidebarIcon name="collapse" size={16} />}
        />

        <div style={{ height: 16 }} />

        {/* Agent 头像 — 首字，点击打开右侧切换浮层 */}
        <CollapsedAction
          data-collapsed-entry="agent-avatar"
          label={agentLabel}
          onClick={(button) => openFlyout('agents', button)}
          isActive={flyoutKind === 'agents'}
          color="var(--moss-sidebar-text-primary)"
          icon={currentAgent ? <SidebarAgentIcon agent={currentAgent} /> : null}
        />

        <div style={{ height: 14 }} />

        {/* 新会话 */}
        <CollapsedAction
          data-collapsed-entry="new-session"
          icon={<SidebarIcon name="new-session" size={18} />}
          label={isBillingBlocked ? '额度不足，无法新建会话' : '新会话'}
          onClick={handleNewSession}
          disabled={isBillingBlocked}
          color="var(--moss-sidebar-new-session-fg)"
          hoverBackground="var(--moss-sidebar-new-session-hover-bg)"
        />

        <div style={{ height: 14 }} />

        {/* 收藏会话 */}
        <CollapsedAction
          data-collapsed-entry="starred"
          icon={<SidebarIcon name="star" size={16} />}
          label={hasStarredSessions ? '收藏会话' : '暂无收藏会话'}
          onClick={(button) => openFlyout('starred', button)}
          isActive={flyoutKind === 'starred'}
          disabled={!hasStarredSessions}
        />

        <div style={{ height: 14 }} />

        {/* 历史会话 */}
        <CollapsedAction
          data-collapsed-entry="history"
          icon={<SidebarIcon name="history" size={16} />}
          label={hasHistorySessions ? '历史会话' : '暂无历史会话'}
          onClick={(button) => openFlyout('history', button)}
          isActive={flyoutKind === 'history'}
          disabled={!hasHistorySessions}
        />

        <div style={{ height: 14 }} />

        {/* 弹性空间 */}
        <div className="flex-1" />

        {/* 案例中心 */}
        <CollapsedAction
          data-collapsed-entry="showcase"
          icon={<SidebarIcon name="showcase" size={16} />}
          label="案例中心"
          onClick={openShowcase}
          isActive={isShowcaseActive}
          color="var(--moss-sidebar-showcase-fg)"
          hoverBackground="var(--moss-sidebar-showcase-hover-bg)"
        />

        <div style={{ height: 8 }} />

        {/* 工作室 */}
        <CollapsedAction
          data-collapsed-entry="workspace"
          icon={<SidebarIcon name="workspace" size={18} />}
          label="我的文件"
          onClick={handleOpenWorkspace}
          isActive={rightPanelType === 'workspace'}
          disabled={isOnBoardPage}
        />

        <div style={{ height: 14 }} />

        {/* 自动化 */}
        <CollapsedAction
          data-collapsed-entry="automation"
          icon={<SidebarIcon name="automation" size={18} />}
          label="自动化"
          onClick={handleOpenAutomation}
          isActive={rightPanelType === 'automation'}
          disabled={isOnBoardPage}
        />

        <div style={{ height: 12 }} />

        {/* 用户头像 */}
        <CollapsedAction
          data-collapsed-entry="user"
          label={isAuthenticated ? displayName : '登录'}
          onClick={(button) => {
            if (!isAuthenticated) {
              closeFlyout();
              navigate('/auth');
              return;
            }
            openFlyout('user', button);
          }}
          isActive={flyoutKind === 'user'}
          icon={<Avatar type="user" size="sm" name={displayName} />}
        />
      </div>

      <CollapsedSidebarFlyout
        kind={flyoutKind}
        position={flyoutPosition}
        sessions={flyoutKind === 'starred' ? starredSessions : sessions}
        currentSessionId={currentSessionId}
        agents={selectableAgents}
        currentAgentId={currentAgentId}
        switchingAgentId={switchingAgentId}
        onSelectSession={handleSelectSession}
        onSelectAgent={selectAgent}
        onOpenSettings={handleOpenSettings}
        onClose={closeFlyout}
      />

      <ConfirmDialog
        open={Boolean(pendingSwitchAgent)}
        title="切换智能体会中断当前任务"
        description="当前任务将停止，切换后会使用新的智能体继续。"
        confirmText="切换"
        cancelText="取消"
        variant="danger"
        onConfirm={confirmPendingSwitch}
        onCancel={cancelPendingSwitch}
      />

      <Suspense fallback={null}>
        <SettingsPage
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          initialTab={settingsTab}
        />
      </Suspense>
    </>
  );
};

export default CollapsedSidebar;
