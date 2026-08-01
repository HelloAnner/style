import React, { useEffect, useState } from 'react';
import type { Session } from '../../types';
import { DropdownMenu } from '../common/DropdownMenu';
import { SidebarIcon } from './icons/SidebarIcon';

interface SidebarSessionItemProps {
  session: Session;
  isCurrent: boolean;
  isStarred: boolean;
  isGenerating?: boolean;
  isUnread?: boolean;
  highlight?: boolean;
  onNavigate: (path: string) => void;
  onDelete: (session: { id: string; title: string }) => void;
  onToggleStar: (id: string) => void;
  onRename: (id: string, title: string) => Promise<boolean>;
}

export const SidebarSessionItem: React.FC<SidebarSessionItemProps> = ({
  session,
  isCurrent,
  isStarred,
  isGenerating,
  isUnread,
  highlight = false,
  onNavigate,
  onDelete,
  onToggleStar,
  onRename,
}) => {
  const isAuto = session.is_automation || session.title?.startsWith('[自动化]');
  const displayTitle = (session.title || '未命名任务').replace(/^\[自动化\]\s*/, '').replace(/^\[项目\]\s*/, '');
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(displayTitle);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const showMenuTrigger = isHovered || isMenuOpen;
  const statusState = isGenerating ? 'generating' : isUnread ? 'unread' : null;
  const showStatus = !isEditing && statusState !== null && !showMenuTrigger;
  const itemBackground = highlight
    ? 'color-mix(in srgb, var(--moss-home-title-accent) 13%, transparent)'
    : isCurrent ? 'var(--moss-sidebar-item-active-bg)' : 'transparent';

  useEffect(() => {
    if (!isEditing) setDraftTitle(displayTitle);
  }, [displayTitle, isEditing]);

  const commitRename = async () => {
    const next = draftTitle.trim();
    if (!next) {
      setDraftTitle(displayTitle);
      setIsEditing(false);
      return;
    }
    if (next === displayTitle) {
      setIsEditing(false);
      return;
    }
    const ok = await onRename(session.id, next);
    if (!ok) {
      setDraftTitle(displayTitle);
    }
    setIsEditing(false);
  };

  const startRename = () => {
    setDraftTitle(displayTitle);
    setIsEditing(true);
  };

  const menuItems = [
    {
      key: 'rename',
      label: '重命名',
      icon: <SidebarIcon name="rename" size={15} />,
      onClick: startRename,
    },
    {
      key: 'toggle-star',
      label: isStarred ? '取消收藏' : '收藏',
      icon: <SidebarIcon name={isStarred ? 'star-off' : 'star'} size={15} />,
      onClick: () => onToggleStar(session.id),
    },
    {
      key: 'delete',
      label: '删除',
      icon: <SidebarIcon name="delete" size={15} />,
      danger: true,
      onClick: () => onDelete({ id: session.id, title: displayTitle }),
    },
  ];

  return (
    <div
      onClick={() => {
        if (isEditing) return;
        onNavigate(`/s/${session.id}`);
      }}
      className="sidebar-session-item group"
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        minHeight: 36,
        padding: '7px 36px 7px 12px', cursor: 'pointer', borderRadius: 8, margin: '0 12px',
        background: itemBackground,
        boxShadow: highlight
          ? 'inset 0 0 0 1px color-mix(in srgb, var(--moss-home-title-accent) 30%, transparent), 0 6px 16px color-mix(in srgb, var(--moss-home-title-accent) 10%, transparent)'
          : 'none',
        transition: 'background 0.32s ease, box-shadow 0.32s ease',
        position: 'relative',
      }}
      onMouseEnter={e => {
        setIsHovered(true);
        if (!isCurrent && !highlight) {
          e.currentTarget.style.background = 'var(--moss-sidebar-item-hover-bg)';
        }
      }}
      onMouseLeave={e => {
        setIsHovered(false);
        if (!isCurrent && !highlight) e.currentTarget.style.background = 'transparent';
      }}
      data-testid={`sidebar-session-item-${session.id}`}
    >
      {showStatus && statusState && (
        <SessionStatusIndicator state={statusState} />
      )}
      <span style={{
        flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 4,
        fontSize: 14,
        lineHeight: '22px',
        color: isCurrent ? 'var(--moss-sidebar-text-primary)' : 'var(--moss-sidebar-text-secondary)',
        fontWeight: isCurrent ? 500 : 400,
      }}>
        {isEditing ? (
          <input
            className="sidebar-session-rename-input"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            onBlur={() => { void commitRename(); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void commitRename();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setDraftTitle(displayTitle);
                setIsEditing(false);
              }
            }}
            autoFocus
            style={{
              width: '100%',
              minWidth: 0,
              background: 'transparent',
              border: '1px solid var(--border-subtle)',
              borderRadius: 6,
              padding: '2px 6px',
              color: 'var(--moss-sidebar-text-primary)',
              outline: 'none',
              fontSize: 14,
              lineHeight: '20px',
            }}
            data-testid={`sidebar-session-rename-input-${session.id}`}
          />
        ) : (
          <span
            style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}
          >
            {displayTitle}
          </span>
        )}
        {isAuto && (
          <SidebarIcon name="automation" size={10} style={{ opacity: 0.35 }} />
        )}
      </span>
      {!isEditing && (
        <div
          style={{
            position: 'absolute',
            right: 6,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 24,
            height: 24,
            opacity: showMenuTrigger ? 1 : 0,
            pointerEvents: showMenuTrigger ? 'auto' : 'none',
            transition: 'opacity 0.15s',
          }}
        >
          <DropdownMenu
            items={menuItems}
            open={isMenuOpen}
            onOpenChange={setIsMenuOpen}
            placement="bottom-end"
            trigger={(
              <button
                className="sidebar-session-menu-trigger"
                aria-label="会话操作"
                title="会话操作"
                style={{
                  width: 24,
                  height: 24,
                  border: 'none',
                  padding: 0,
                  borderRadius: 6,
                  background: isMenuOpen ? 'var(--moss-sidebar-item-hover-bg)' : 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--moss-sidebar-text-muted)',
                  transition: 'background 0.15s, color 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--moss-sidebar-item-hover-bg)';
                  e.currentTarget.style.color = 'var(--moss-sidebar-text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isMenuOpen ? 'var(--moss-sidebar-item-hover-bg)' : 'transparent';
                  e.currentTarget.style.color = 'var(--moss-sidebar-text-muted)';
                }}
                data-testid={`sidebar-session-menu-trigger-${session.id}`}
              >
                <SidebarIcon name="more" size={16} />
              </button>
            )}
          />
        </div>
      )}
    </div>
  );
};

type SessionStatusState = 'generating' | 'unread';

const SessionStatusIndicator: React.FC<{ state: SessionStatusState }> = ({ state }) => {
  if (state === 'generating') {
    return (
      <span
        data-sidebar-session-status="generating"
        role="status"
        aria-label="结果生成中"
        style={{
          position: 'absolute',
          right: 16,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 16,
          height: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--moss-sidebar-text-muted)',
        }}
      >
        <span
          aria-hidden
          style={{
            width: 13,
            height: 13,
            border: '1.5px solid currentColor',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'ch-spin 0.8s linear infinite',
            opacity: 0.8,
          }}
        />
      </span>
    );
  }

  return (
    <span
      data-sidebar-session-status="unread"
      role="status"
      aria-label="结果已生成，未读"
      style={{
        position: 'absolute',
        right: 18,
        top: '50%',
        transform: 'translateY(-50%)',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: 'var(--danger)',
      }}
    />
  );
};

export default SidebarSessionItem;
