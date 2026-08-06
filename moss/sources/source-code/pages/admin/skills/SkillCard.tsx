/**
 * SkillCard — 技能列表中的单张卡片。
 *
 * - 内置 dedicated：无开关，灰色锁定态
 * - 内置 general：只读展示
 * - 自定义 tenant：点击进详情
 */

import React, { useEffect, useRef, useState } from 'react';
import type { UnifiedSkillItem } from '../../../api/skillManagement';

// ── Icons ──

const LockIcon: React.FC = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0110 0v4" />
  </svg>
);

const ChevronRightIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const MoreIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
    <circle cx="5" cy="12" r="1" />
  </svg>
);

const TrashIcon: React.FC = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
  </svg>
);

const SKILL_ICON_TONES = [
  { color: 'var(--info)', background: 'var(--info-bg-soft)' },
  { color: 'var(--accent-color)', background: 'var(--accent-bg)' },
  { color: 'var(--success)', background: 'var(--success-bg-soft)' },
  { color: 'var(--warning)', background: 'var(--warning-bg-soft)' },
  { color: 'var(--danger)', background: 'var(--danger-bg-soft)' },
];

function hashText(text: string): number {
  return Array.from(text).reduce((acc, char) => (acc * 33 + char.charCodeAt(0)) >>> 0, 7);
}

type SkillIconVariant = 'book' | 'spark' | 'chart' | 'compass' | 'layers';

const SKILL_ICON_VARIANTS: SkillIconVariant[] = ['book', 'spark', 'chart', 'compass', 'layers'];

function pickSkillTone(skillRef?: string) {
  if (!skillRef) return SKILL_ICON_TONES[0];
  return SKILL_ICON_TONES[hashText(skillRef) % SKILL_ICON_TONES.length];
}

function pickSkillVariant(skillRef?: string): SkillIconVariant {
  if (!skillRef) return 'book';
  return SKILL_ICON_VARIANTS[hashText(`${skillRef}:icon`) % SKILL_ICON_VARIANTS.length];
}

const SkillIconBadge: React.FC<{ skillRef?: string }> = ({ skillRef }) => {
  const tone = pickSkillTone(skillRef);
  return (
    <div style={{
      width: 32, height: 32, borderRadius: 8,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: tone.color, background: tone.background, flexShrink: 0,
    }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <SkillGlyph variant={pickSkillVariant(skillRef)} />
      </svg>
    </div>
  );
};

const SkillGlyph: React.FC<{ variant: SkillIconVariant }> = ({ variant }) => {
  if (variant === 'spark') {
    return <path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3zm6 12l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9L18 15zM6 14l1.2 2.8L10 18l-2.8 1.2L6 22l-1.2-2.8L2 18l2.8-1.2L6 14z" />;
  }
  if (variant === 'chart') {
    return <path d="M4 19h16M7 16V9M12 16V5M17 16v-3" />;
  }
  if (variant === 'compass') {
    return <><circle cx="12" cy="12" r="7" /><path d="M14.8 9.2l-2 5.6-3.6 1.2 1.2-3.6 4.4-3.2z" /></>;
  }
  if (variant === 'layers') {
    return <><path d="M12 4l8 4-8 4-8-4 8-4z" /><path d="M4 12l8 4 8-4" /><path d="M4 16l8 4 8-4" /></>;
  }
  return <path d="M4 19.5A2.5 2.5 0 016.5 17H20M4 4.5A2.5 2.5 0 016.5 2H20v20H6.5A2.5 2.5 0 014 19.5z" />;
};

// ── SkillCard ──

interface SkillCardProps {
  skill: UnifiedSkillItem;
  isSelected?: boolean;
  agentBindingState?: 'enabled' | 'disabled';
  onClick?: (skill: UnifiedSkillItem) => void;
  onDelete?: (skill: UnifiedSkillItem) => void;
}

export const SkillCard: React.FC<SkillCardProps> = ({ skill, isSelected, agentBindingState, onClick, onDelete }) => {
  const isDedicated = skill.scope === 'builtin' && skill.kind === 'dedicated';
  const isTenant = skill.scope === 'tenant';
  const skillRef = skill.id || skill.name || undefined;
  const skillTestId = skillRef || 'unknown';
  const isDeletable = isTenant && Boolean(skill.id) && Boolean(onDelete);
  const isClickable = isTenant;
  const showAgentBindingState = Boolean(agentBindingState) && !isDedicated;
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleClick = () => {
    setMenuOpen(false);
    if (isClickable && onClick) onClick(skill);
  };

  const handleDelete = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setMenuOpen(false);
    if (onDelete) onDelete(skill);
  };

  const handleMenuToggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setMenuOpen((prev) => !prev);
  };

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  return (
    <div
      className="skill-list-item skill-card"
      onClick={handleClick}
      data-testid={`skill-card-${skillTestId}`}
      style={{
        display: 'flex',
        position: 'relative',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        borderRadius: 8,
        border: `1px solid ${isSelected ? 'var(--accent-color)' : 'var(--border-subtle)'}`,
        background: isSelected ? 'var(--accent-bg)' : 'var(--bg-secondary)',
        cursor: isClickable ? 'pointer' : 'default',
        transition: 'background 0.12s, border-color 0.12s',
      }}
      onMouseEnter={(e) => {
        setHovered(true);
        if (isClickable && !isSelected) {
          e.currentTarget.style.background = 'var(--hover-bg)';
        }
      }}
      onMouseLeave={(e) => {
        setHovered(false);
        if (isClickable && !isSelected) {
          e.currentTarget.style.background = 'var(--bg-secondary)';
        }
      }}
    >
      {/* 技能信息 */}
      <SkillIconBadge skillRef={skillRef} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="skill-card__name" style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} data-testid={`skill-card-name-${skillTestId}`}>
            {skill.name || ''}
          </span>
          {isDedicated && (
            <span className="skill-card__lock" style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)', flexShrink: 0 }} data-testid={`skill-card-lock-${skillTestId}`}>
              <LockIcon />
            </span>
          )}
        </div>
        {skill.description && (
          <div className="skill-card__description" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} data-testid={`skill-card-description-${skillTestId}`}>
            {skill.description}
          </div>
        )}
        {isDedicated && skill.boundAgent && (
          <div className="skill-card__bound-agent" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }} data-testid={`skill-card-bound-agent-${skillTestId}`}>
            专属: {skill.boundAgent}
          </div>
        )}
        {showAgentBindingState && (
          <div style={{ marginTop: 6 }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              height: 20,
              padding: '0 8px',
              borderRadius: 10,
              fontSize: 11,
              fontWeight: 500,
              color: agentBindingState === 'enabled' ? 'var(--success)' : 'var(--text-muted)',
              background: agentBindingState === 'enabled' ? 'var(--success-bg-soft)' : 'var(--bg-tertiary)',
            }} className="skill-card__binding-state" data-testid={`skill-card-binding-state-${skillTestId}`}>
              {agentBindingState === 'enabled' ? '当前智能体已启用' : '当前智能体未启用'}
            </span>
          </div>
        )}
      </div>

      {/* 右侧控件 */}
      {isDeletable && (hovered || isSelected || menuOpen) && (
        <div ref={menuRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <button
            type="button"
            onClick={handleMenuToggle}
            title="更多操作"
            className="skill-card__menu-trigger"
            data-testid={`skill-card-menu-trigger-${skillTestId}`}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, borderRadius: 6,
              border: 'none',
              background: 'transparent',
              color: menuOpen ? 'var(--text-primary)' : 'var(--text-muted)',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hover-bg)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <MoreIcon />
          </button>
          {menuOpen && (
            <div style={{
              position: 'absolute',
              top: 34,
              right: 0,
              minWidth: 92,
              padding: 6,
              borderRadius: 10,
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 10px 24px rgba(15, 23, 42, 0.10)',
              zIndex: 8,
            }} className="skill-card__menu" data-testid={`skill-card-menu-${skillTestId}`}>
              <button
                type="button"
                onClick={handleDelete}
                className="skill-card__delete"
                data-testid={`skill-card-delete-${skillTestId}`}
                style={{
                  width: '100%',
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 10px', borderRadius: 8,
                  border: 'none', background: 'transparent',
                  color: 'var(--danger)', cursor: 'pointer', fontSize: 13,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--danger-bg-soft)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <TrashIcon />
                删除
              </button>
            </div>
          )}
        </div>
      )}
      {isTenant && !(isDeletable && (hovered || isSelected || menuOpen)) && (
        <span className="skill-card__open-indicator" style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }} data-testid={`skill-card-open-indicator-${skillTestId}`}>
          <ChevronRightIcon />
        </span>
      )}
    </div>
  );
};
