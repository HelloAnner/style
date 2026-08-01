import React, { useEffect, useRef, useState } from 'react';
import type { Session } from '../../types';
import { SidebarSessionItem } from './SidebarSessionItem';
import { SidebarIcon } from './icons/SidebarIcon';
import { consumeBoardGeneratedSessionHighlight } from '../../pages/boards/boardSessionHighlights';

export interface SidebarGroupedSessions {
  starred: Session[];
  today: Session[];
  yesterday: Session[];
  older: Session[];
}

interface SidebarSessionGroupsProps {
  groupedSessions: SidebarGroupedSessions;
  currentSessionId: string | null;
  isOnNewTaskPage: boolean;
  generatingSessionIds: Set<string>;
  unreadSessionIds: Set<string>;
  isSessionStarred: (id: string) => boolean;
  onNavigate: (path: string) => void;
  onDelete: (session: { id: string; title: string }) => void;
  onToggleStar: (id: string) => void;
  onRename: (id: string, title: string) => Promise<boolean>;
}

interface SessionGroupConfig {
  key: keyof SidebarGroupedSessions;
  label: string;
  getStarred: (session: Session) => boolean;
}

type CollapsibleGroupKey = keyof SidebarGroupedSessions;

const DEFAULT_COLLAPSED_GROUPS: Record<CollapsibleGroupKey, boolean> = {
  starred: false,
  today: false,
  yesterday: false,
  older: false,
};

const SESSION_LIST_BOTTOM_SAFE_SPACE = 20;
const SESSION_LIST_FOOTER_GAP = 12;

const groupHeaderStyle: React.CSSProperties = {
  padding: '8px 16px 4px',
};

const groupTitleBaseStyle: React.CSSProperties = {
  height: 20,
  border: 'none',
  background: 'transparent',
  padding: 0,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  fontSize: 12,
  lineHeight: '20px',
  fontWeight: 400,
  color: 'var(--moss-sidebar-text-muted)',
};

export const SidebarSessionGroups: React.FC<SidebarSessionGroupsProps> = ({
  groupedSessions,
  currentSessionId,
  isOnNewTaskPage,
  generatingSessionIds,
  unreadSessionIds,
  isSessionStarred,
  onNavigate,
  onDelete,
  onToggleStar,
  onRename,
}) => {
  const [collapsedGroups, setCollapsedGroups] = useState<Record<CollapsibleGroupKey, boolean>>(
    DEFAULT_COLLAPSED_GROUPS
  );
  const [highlightSessionIds, setHighlightSessionIds] = useState<Set<string>>(() => new Set());
  const highlightTimersRef = useRef<Map<string, number>>(new Map());

  const groups: SessionGroupConfig[] = [
    { key: 'starred', label: '收藏', getStarred: () => true },
    { key: 'today', label: '今天', getStarred: (session) => isSessionStarred(session.id) },
    { key: 'yesterday', label: '昨天', getStarred: (session) => isSessionStarred(session.id) },
    { key: 'older', label: '更早', getStarred: (session) => isSessionStarred(session.id) },
  ];

  useEffect(() => {
    if (isOnNewTaskPage || !currentSessionId) return;

    const currentGroupKey = (Object.keys(groupedSessions) as Array<keyof SidebarGroupedSessions>).find(
      (groupKey) => groupedSessions[groupKey].some((session) => session.id === currentSessionId)
    );
    if (!currentGroupKey) return;
    const collapsibleGroupKey = currentGroupKey as CollapsibleGroupKey;

    setCollapsedGroups((prev) => {
      if (!prev[collapsibleGroupKey]) return prev;
      return { ...prev, [collapsibleGroupKey]: false };
    });
  }, [currentSessionId, groupedSessions, isOnNewTaskPage]);

  useEffect(() => {
    const nextIds: string[] = [];
    for (const sessions of Object.values(groupedSessions)) {
      for (const session of sessions) {
        if (consumeBoardGeneratedSessionHighlight(session.id)) {
          nextIds.push(session.id);
        }
      }
    }
    if (nextIds.length === 0) return undefined;
    setHighlightSessionIds((current) => {
      const next = new Set(current);
      nextIds.forEach((id) => next.add(id));
      return next;
    });
    nextIds.forEach((id) => {
      const existingTimer = highlightTimersRef.current.get(id);
      if (existingTimer) {
        window.clearTimeout(existingTimer);
      }
      const timer = window.setTimeout(() => {
        highlightTimersRef.current.delete(id);
        setHighlightSessionIds((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
      }, 3000);
      highlightTimersRef.current.set(id, timer);
    });
    return undefined;
  }, [groupedSessions]);

  useEffect(() => () => {
    highlightTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    highlightTimersRef.current.clear();
  }, []);

  return (
    <div
      data-sidebar-entry="session-list"
      className="flex-1 overflow-y-auto overflow-x-hidden"
      style={{
        minHeight: 0,
        marginBottom: SESSION_LIST_FOOTER_GAP,
        paddingTop: 2,
        scrollPaddingBottom: SESSION_LIST_BOTTOM_SAFE_SPACE,
      }}
      data-testid="sidebar-session-list"
    >
      <div style={{ paddingBottom: SESSION_LIST_BOTTOM_SAFE_SPACE }}>
        {groups.map((group) => {
          const sessions = groupedSessions[group.key];
          if (sessions.length === 0) return null;
          const isCollapsed = collapsedGroups[group.key as CollapsibleGroupKey];

          const toggleGroup = () => {
            const groupKey = group.key as CollapsibleGroupKey;
            setCollapsedGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));
          };

          return (
            <React.Fragment key={group.key}>
              <div
                className="sidebar-session-group"
                data-sidebar-session-group={group.key}
                data-sidebar-session-group-state={isCollapsed ? 'collapsed' : 'expanded'}
                style={groupHeaderStyle}
                data-testid={`sidebar-session-group-${group.key}`}
              >
                <button
                  type="button"
                  className="sidebar-session-group-toggle"
                  aria-expanded={!isCollapsed}
                  onClick={toggleGroup}
                  style={{
                    ...groupTitleBaseStyle,
                    cursor: 'pointer',
                  }}
                  data-testid={`sidebar-session-group-toggle-${group.key}`}
                >
                  <span>{group.label}</span>
                  <SidebarIcon
                    name={isCollapsed ? 'chevron-right' : 'chevron-down'}
                    size={14}
                  />
                </button>
              </div>
              {!isCollapsed && sessions.map(session => (
                  <SidebarSessionItem
                    key={session.id}
                    session={session}
                    isCurrent={!isOnNewTaskPage && session.id === currentSessionId}
                    onNavigate={(path) => {
                      const timer = highlightTimersRef.current.get(session.id);
                      if (timer) {
                        window.clearTimeout(timer);
                        highlightTimersRef.current.delete(session.id);
                      }
                      setHighlightSessionIds((current) => {
                        if (!current.has(session.id)) return current;
                        const next = new Set(current);
                        next.delete(session.id);
                        return next;
                      });
                      onNavigate(path);
                    }}
                    onDelete={onDelete}
                    onToggleStar={onToggleStar}
                    onRename={onRename}
                    isStarred={group.getStarred(session)}
                    isGenerating={generatingSessionIds.has(session.id)}
                    isUnread={unreadSessionIds.has(session.id)}
                    highlight={highlightSessionIds.has(session.id)}
                  />
                ))}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default SidebarSessionGroups;
