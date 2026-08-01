import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Session } from '../../types';
import type { Agent } from '../../types/platform';
import { getAgentDisplayName } from '../../types/platform';
import activeDotIcon from '../../assets/icons/sidebar/active-dot.svg';
import { SidebarAgentIcon } from './SidebarAgentIcon';
import { SidebarIcon } from './icons/SidebarIcon';
import { UserPopover } from './UserPopover';

export type CollapsedFlyoutKind = 'agents' | 'starred' | 'history' | 'user';

export interface CollapsedFlyoutPosition {
  left: number;
  top: number;
}

interface CollapsedSidebarFlyoutProps {
  kind: CollapsedFlyoutKind | null;
  position: CollapsedFlyoutPosition | null;
  sessions: Session[];
  currentSessionId: string | null;
  agents: Agent[];
  currentAgentId: string | null;
  switchingAgentId: string | null;
  onSelectSession: (sessionId: string) => void;
  onSelectAgent: (agent: Agent) => void;
  onOpenSettings: (tab: 'profile' | 'spaces') => void;
  onClose: () => void;
}

const panelBaseStyle: React.CSSProperties = {
  position: 'fixed',
  zIndex: 1000,
  border: '1px solid var(--border-subtle)',
  borderRadius: 8,
  background: 'var(--moss-sidebar-popover-bg)',
  boxShadow: 'var(--moss-sidebar-popover-shadow)',
  overflow: 'hidden',
};

const FLYOUT_VIEWPORT_PADDING = 12;

const titleStyle: React.CSSProperties = {
  padding: '12px 14px 6px',
  color: 'var(--text-tertiary)',
  fontSize: 14,
  lineHeight: '20px',
  fontWeight: 600,
};

function sessionTitle(session: Session): string {
  return (session.title || '未命名任务').replace(/^\[自动化\]\s*/, '').replace(/^\[项目\]\s*/, '');
}

type SessionFlyoutGroupKey = 'starred' | 'today' | 'yesterday' | 'older';

interface SessionFlyoutGroup {
  key: SessionFlyoutGroupKey;
  label: string;
  sessions: Session[];
}

const DEFAULT_COLLAPSED_GROUPS: Record<SessionFlyoutGroupKey, boolean> = {
  starred: false,
  today: false,
  yesterday: false,
  older: false,
};

function clampPanelTop(preferredTop: number, panelHeight: number): number {
  const maxTop = Math.max(
    FLYOUT_VIEWPORT_PADDING,
    window.innerHeight - panelHeight - FLYOUT_VIEWPORT_PADDING
  );
  return Math.min(Math.max(FLYOUT_VIEWPORT_PADDING, preferredTop), maxTop);
}

function sortSessionsByUpdatedAt(sessions: Session[]): Session[] {
  return [...sessions].sort(
    (a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
  );
}

function buildHistoryGroups(sessions: Session[]): SessionFlyoutGroup[] {
  const today: Session[] = [];
  const yesterday: Session[] = [];
  const older: Session[] = [];
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  for (const session of sortSessionsByUpdatedAt(sessions.filter(item => !item.starred))) {
    const updatedAt = new Date(session.updated_at || session.created_at);
    if (updatedAt >= todayStart) today.push(session);
    else if (updatedAt >= yesterdayStart) yesterday.push(session);
    else older.push(session);
  }

  const groups: SessionFlyoutGroup[] = [
    { key: 'today', label: '今天', sessions: today },
    { key: 'yesterday', label: '昨天', sessions: yesterday },
    { key: 'older', label: '更早', sessions: older },
  ];
  return groups.filter(group => group.sessions.length > 0);
}

function buildSessionGroups(kind: CollapsedFlyoutKind, sessions: Session[]): SessionFlyoutGroup[] {
  if (kind === 'starred') {
    return [{ key: 'starred', label: '收藏', sessions: sortSessionsByUpdatedAt(sessions) }];
  }
  if (kind === 'history') {
    return buildHistoryGroups(sessions);
  }
  return [];
}

export const CollapsedSidebarFlyout: React.FC<CollapsedSidebarFlyoutProps> = ({
  kind,
  position,
  sessions,
  currentSessionId,
  agents,
  currentAgentId,
  switchingAgentId,
  onSelectSession,
  onSelectAgent,
  onOpenSettings,
  onClose,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<SessionFlyoutGroupKey, boolean>>(
    DEFAULT_COLLAPSED_GROUPS
  );
  const [adjustedTop, setAdjustedTop] = useState<number | null>(null);

  useEffect(() => {
    if (!kind) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if ((target as Element | null)?.closest?.('[data-collapsed-entry]')) return;
      onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [kind, onClose]);

  const sessionGroups = useMemo(() => kind ? buildSessionGroups(kind, sessions) : [], [kind, sessions]);

  useLayoutEffect(() => {
    if (!kind || !position) {
      setAdjustedTop(null);
      return;
    }
    const panelHeight = panelRef.current?.getBoundingClientRect().height ?? 0;
    setAdjustedTop(clampPanelTop(position.top, panelHeight));
  }, [kind, position, sessionGroups, collapsedGroups]);

  useEffect(() => {
    if (!currentSessionId || (kind !== 'history' && kind !== 'starred')) return;
    const currentGroup = sessionGroups.find(group => (
      group.sessions.some(session => session.id === currentSessionId)
    ));
    if (!currentGroup) return;
    setCollapsedGroups((prev) => {
      if (!prev[currentGroup.key]) return prev;
      return { ...prev, [currentGroup.key]: false };
    });
  }, [currentSessionId, kind, sessionGroups]);

  if (!kind || !position || typeof document === 'undefined') return null;

  if (kind === 'user') {
    return createPortal(
      <div
        ref={panelRef}
        role="dialog"
        aria-label="账号菜单"
        data-collapsed-flyout={kind}
        style={{
          position: 'fixed',
          left: position.left,
          top: adjustedTop ?? position.top,
          zIndex: 1000,
        }}
        data-testid="collapsed-flyout-user"
      >
        <UserPopover
          onOpenSettings={onOpenSettings}
          onClose={onClose}
        />
      </div>,
      document.body,
    );
  }

  const isAgentFlyout = kind === 'agents';
  const panelWidth = isAgentFlyout ? 220 : 360;
  const title = kind === 'agents'
    ? '我的 Agent'
    : kind === 'starred'
      ? '收藏'
      : '历史会话';

  return createPortal(
    <div
      ref={panelRef}
      className="collapsed-sidebar-flyout"
      role="dialog"
      aria-label={title}
      data-collapsed-flyout={kind}
      style={{
        ...panelBaseStyle,
        left: position.left,
        top: adjustedTop ?? position.top,
        width: `min(${panelWidth}px, calc(100vw - ${position.left + 12}px))`,
        maxHeight: 'min(360px, calc(100vh - 24px))',
      }}
      data-testid={`collapsed-flyout-${kind}`}
    >
      <div style={titleStyle}>{title}</div>
      {isAgentFlyout ? (
        <div role="listbox" aria-label="我的 Agent" style={{ padding: '0 6px 8px', display: 'grid', gap: 2 }} data-testid="collapsed-agent-listbox">
          {agents.map((agent) => {
            const isSelected = agent.id === currentAgentId;
            const isSwitching = agent.id === switchingAgentId;
            return (
              <button
                key={agent.id}
                className="collapsed-agent-item"
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={isSwitching}
                onClick={() => onSelectAgent(agent)}
                style={{
                  position: 'relative',
                  minHeight: 32,
                  width: '100%',
                  border: 'none',
                  borderRadius: 8,
                  padding: '5px 28px 5px 10px',
                  background: isSelected ? 'var(--moss-sidebar-item-active-bg)' : 'transparent',
                  color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: isSwitching ? 'wait' : 'pointer',
                  font: 'inherit',
                  fontSize: 14,
                  lineHeight: '20px',
                  textAlign: 'left',
                  opacity: isSwitching ? 0.7 : 1,
                }}
                onMouseEnter={(event) => {
                  if (!isSelected) event.currentTarget.style.background = 'var(--hover-bg)';
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.background = isSelected
                    ? 'var(--moss-sidebar-item-active-bg)'
                    : 'transparent';
                }}
                data-testid={`collapsed-agent-item-${agent.id}`}
              >
                <SidebarAgentIcon agent={agent} />
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {getAgentDisplayName(agent)}
                </span>
                {isSelected && (
                  <img
                    src={activeDotIcon}
                    alt=""
                    aria-hidden="true"
                    width={8}
                    height={8}
                    style={{
                      position: 'absolute',
                      right: 12,
                      top: '50%',
                      width: 8,
                      height: 8,
                      transform: 'translateY(-50%)',
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div style={{ padding: '2px 6px 8px', overflowY: 'auto', maxHeight: 300 }}>
          {sessionGroups.map((group) => (
            <div
              key={group.key}
              className="collapsed-session-group"
              data-collapsed-session-group={group.key}
              data-collapsed-session-group-state={collapsedGroups[group.key] ? 'collapsed' : 'expanded'}
              data-testid={`collapsed-session-group-${group.key}`}
            >
              <div
                style={{
                  height: 24,
                  padding: '2px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  color: 'var(--moss-sidebar-text-muted)',
                  fontSize: 12,
                  lineHeight: '20px',
                  fontWeight: 400,
                }}
              >
                <button
                  type="button"
                  className="collapsed-session-group-toggle"
                  aria-expanded={!collapsedGroups[group.key]}
                  onClick={() => {
                    setCollapsedGroups((prev) => ({ ...prev, [group.key]: !prev[group.key] }));
                  }}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    padding: 0,
                    color: 'inherit',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    cursor: 'pointer',
                    font: 'inherit',
                  }}
                  data-testid={`collapsed-session-group-toggle-${group.key}`}
                >
                  <span>{group.label}</span>
                  <SidebarIcon
                    name={collapsedGroups[group.key] ? 'chevron-right' : 'chevron-down'}
                    size={14}
                  />
                </button>
              </div>
              {!collapsedGroups[group.key] && group.sessions.map((session) => {
                const isCurrent = session.id === currentSessionId;
                return (
                  <button
                    key={session.id}
                    className="collapsed-session-item"
                    type="button"
                    onClick={() => onSelectSession(session.id)}
                    style={{
                      width: '100%',
                      minHeight: 34,
                      border: 'none',
                      borderRadius: 8,
                      padding: '6px 28px 6px 10px',
                      background: isCurrent ? 'var(--moss-sidebar-item-active-bg)' : 'transparent',
                      color: isCurrent ? 'var(--moss-sidebar-text-primary)' : 'var(--moss-sidebar-text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      cursor: 'pointer',
                      font: 'inherit',
                      fontSize: 14,
                      lineHeight: '22px',
                      fontWeight: isCurrent ? 500 : 400,
                      textAlign: 'left',
                      position: 'relative',
                    }}
                    onMouseEnter={(event) => {
                      if (!isCurrent) event.currentTarget.style.background = 'var(--moss-sidebar-item-hover-bg)';
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.background = isCurrent
                        ? 'var(--moss-sidebar-item-active-bg)'
                        : 'transparent';
                    }}
                    data-testid={`collapsed-session-item-${session.id}`}
                  >
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {sessionTitle(session)}
                    </span>
                    {session.is_automation && (
                      <SidebarIcon name="automation" size={10} style={{ opacity: 0.35 }} />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
};

export default CollapsedSidebarFlyout;
