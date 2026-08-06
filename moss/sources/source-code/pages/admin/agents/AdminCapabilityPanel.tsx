import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  listAgentSkillBindings,
  type SkillBindingItem,
  type ToolBindingItem,
} from '../../../api/platformAgent';
import { MossSwitch } from '../../../components/common/MossSwitch';

type BindingState = 'enabled' | 'disabled';
type SkillBindingPutItem = Pick<SkillBindingItem, 'skillRef' | 'skillScope' | 'bindingState'>;
type ToolBindingPutItem = Pick<ToolBindingItem, 'toolRef' | 'toolScope' | 'bindingState'>;

export interface AdminCapabilityPayload {
  hasChanges: boolean;
  skillItems: SkillBindingPutItem[];
  toolItems: ToolBindingPutItem[];
}

interface AdminCapabilityPanelProps {
  agentId: string;
  disabled?: boolean;
  onChange: (payload: AdminCapabilityPayload) => void;
}

type SkillIconTone = {
  color: string;
  background: string;
};

type SkillIconVariant = 'book' | 'spark' | 'chart' | 'compass' | 'layers';

const SKILL_ICON_TONES: SkillIconTone[] = [
  { color: 'var(--info)', background: 'var(--info-bg-soft)' },
  { color: 'var(--accent-color)', background: 'var(--accent-bg)' },
  { color: 'var(--success)', background: 'var(--success-bg-soft)' },
  { color: 'var(--warning)', background: 'var(--warning-bg-soft)' },
  { color: 'var(--danger)', background: 'var(--danger-bg-soft)' },
];

const SKILL_ICON_VARIANTS: SkillIconVariant[] = ['book', 'spark', 'chart', 'compass', 'layers'];

const SearchIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

function hashText(text: string): number {
  return Array.from(text).reduce((acc, char) => (acc * 33 + char.charCodeAt(0)) >>> 0, 7);
}

function toTestIdSegment(text: string): string {
  return text.replace(/[^a-zA-Z0-9_-]+/g, '-');
}

function pickSkillTone(skillRef?: string): SkillIconTone {
  if (!skillRef) return SKILL_ICON_TONES[0];
  return SKILL_ICON_TONES[hashText(skillRef) % SKILL_ICON_TONES.length];
}

function pickSkillVariant(skillRef?: string): SkillIconVariant {
  if (!skillRef) return 'book';
  return SKILL_ICON_VARIANTS[hashText(`${skillRef}:icon`) % SKILL_ICON_VARIANTS.length];
}

type CapabilityIconKind = 'skill' | 'tool';

const CapabilityIcon: React.FC<{ kind: CapabilityIconKind; assetRef?: string }> = ({ kind, assetRef }) => {
  const tone = kind === 'skill'
    ? pickSkillTone(assetRef)
    : { color: 'var(--accent-color)', background: 'var(--accent-bg)' };
  return (
    <div style={{
      width: 28,
      height: 28,
      borderRadius: 8,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: tone.color,
      background: tone.background,
      flexShrink: 0,
    }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {kind === 'skill' && <SkillGlyph variant={pickSkillVariant(assetRef)} />}
        {kind === 'tool' && <path d="M14.7 6.3a4 4 0 00-5.4 5.9l-5.6 5.6a2 2 0 102.8 2.8l5.6-5.6a4 4 0 005.9-5.4l-3 3-2-2z" />}
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

function matchesQuery(item: { name?: string; description?: string }, query: string): boolean {
  if (!query) return true;
  const text = `${item.name || ''} ${item.description || ''}`.toLowerCase();
  return text.includes(query.toLowerCase());
}

export const AdminCapabilityPanel: React.FC<AdminCapabilityPanelProps> = ({ agentId, disabled = false, onChange }) => {
  const [search, setSearch] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    builtinSkills: true,
    tenantSkills: true,
  });
  const [skills, setSkills] = useState<SkillBindingItem[]>([]);
  const [initialSkillStates, setInitialSkillStates] = useState<Record<string, BindingState>>({});
  const [skillStates, setSkillStates] = useState<Record<string, BindingState>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const emitChange = useCallback((
    nextSkillStates: Record<string, BindingState>,
  ) => {
    const editableSkills = skills.filter(s => !s.locked);
    const skillChanged = editableSkills.some(
      (s) => (nextSkillStates[s.skillRef] ?? s.bindingState) !== (initialSkillStates[s.skillRef] ?? s.bindingState),
    );
    onChange({
      hasChanges: skillChanged,
      skillItems: editableSkills.map(s => ({
        skillRef: s.skillRef,
        skillScope: s.skillScope,
        bindingState: nextSkillStates[s.skillRef] ?? s.bindingState,
      })),
      toolItems: [],
    });
  }, [initialSkillStates, onChange, skills]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setLoadError(null);
    listAgentSkillBindings(agentId)
      .then((skillRes) => {
        if (!alive) return;
        const nextSkills = skillRes.items || [];
        const nextSkillStates = Object.fromEntries(nextSkills.map(s => [s.skillRef, s.bindingState]));
        setSkills(nextSkills);
        setInitialSkillStates(nextSkillStates);
        setSkillStates(nextSkillStates);
      })
      .catch((err) => alive && setLoadError(err instanceof Error ? err.message : String(err)))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [agentId]);

  const filteredSkills = useMemo(
    () => skills.filter(item => matchesQuery(item, search)),
    [skills, search],
  );
  const builtinSkills = useMemo(
    () => [...filteredSkills.filter(item => item.skillScope === 'builtin')]
      .sort((left, right) => Number(right.kind === 'dedicated') - Number(left.kind === 'dedicated')),
    [filteredSkills],
  );
  const tenantSkills = filteredSkills.filter(item => item.skillScope === 'tenant');

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setSkillState = (skillRef: string, checked: boolean) => {
    if (disabled) return;
    setSkillStates((prev) => {
      const updated: Record<string, BindingState> = { ...prev, [skillRef]: checked ? 'enabled' : 'disabled' };
      emitChange(updated);
      return updated;
    });
  };

  const renderSkill = (item: SkillBindingItem) => (
    <CapabilityRow
      key={`${item.skillScope}:${item.skillRef}`}
      iconKind="skill"
      assetRef={item.skillRef}
      title={item.name || item.skillRef}
      description={item.description}
      badges={item.kind === 'dedicated' ? ['专用'] : []}
      checked={(skillStates[item.skillRef] ?? item.bindingState) === 'enabled'}
      locked={disabled || item.locked}
      onToggle={(checked) => setSkillState(item.skillRef, checked)}
    />
  );

  return (
    <aside
      data-testid="admin-capability-panel"
      style={{
      width: 400,
      flexShrink: 0,
      borderLeft: '1px solid var(--border-subtle)',
      background: 'var(--bg-secondary)',
      padding: '20px 16px',
      overflowY: 'auto',
    }}>
      <div data-testid="admin-capability-panel-header" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>能力</div>
        {disabled && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-tertiary)', borderRadius: 4, padding: '1px 6px' }}>
            只读
          </span>
        )}
      </div>
      <div data-testid="admin-capability-panel-toolbar" style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <TabButton active>技能</TabButton>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '6px 9px' }}>
          <span style={{ color: 'var(--text-muted)' }}><SearchIcon /></span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索名称/描述" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 12 }} />
        </div>
      </div>
      {loading && <PanelState text="加载中..." />}
      {!loading && loadError && <PanelState text={`加载失败：${loadError}`} danger />}
      {!loading && !loadError && (
        <div data-testid="admin-capability-panel-groups" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <CapabilityGroup
            title="内置技能"
            count={builtinSkills.length}
            expanded={expandedGroups.builtinSkills}
            onToggle={() => toggleGroup('builtinSkills')}
          >
            {builtinSkills.map(renderSkill)}
          </CapabilityGroup>
          <CapabilityGroup
            title="自定义技能"
            count={tenantSkills.length}
            expanded={expandedGroups.tenantSkills}
            onToggle={() => toggleGroup('tenantSkills')}
          >
            {tenantSkills.map(renderSkill)}
          </CapabilityGroup>
        </div>
      )}
    </aside>
  );
};

const TabButton: React.FC<React.PropsWithChildren<{ active: boolean; onClick?: () => void }>> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      border: '1px solid var(--border-subtle)',
      borderRadius: 6,
      background: active ? 'var(--accent-bg)' : 'var(--bg-primary)',
      color: active ? 'var(--accent-color)' : 'var(--text-secondary)',
      padding: '5px 11px',
      fontSize: 12,
      cursor: onClick ? 'pointer' : 'default',
      transition: 'background 0.15s, color 0.15s',
    }}
  >
    {children}
  </button>
);

const PanelState: React.FC<{ text: string; danger?: boolean }> = ({ text, danger }) => (
  <div style={{
    padding: 24,
    borderRadius: 10,
    textAlign: 'center',
    color: danger ? 'var(--danger)' : 'var(--text-muted)',
    background: 'var(--bg-primary)',
    fontSize: 12,
  }}>
    {text}
  </div>
);

const CapabilityGroup: React.FC<React.PropsWithChildren<{
  title: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  emptyText?: string;
}>> = ({ title, count, expanded, onToggle, emptyText = '暂无匹配技能', children }) => (
  <section data-testid={`admin-capability-group-${title === '内置技能' ? 'builtin-skills' : 'tenant-skills'}`}>
    <button
      type="button"
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginBottom: expanded ? 8 : 0,
        color: 'var(--text-secondary)',
        fontSize: 12,
        fontWeight: 600,
        background: 'transparent',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
      }}
    >
      <span style={{
        fontSize: 10,
        transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
        transition: 'transform 0.15s',
      }}>▾</span>
      <span>{title}</span>
      <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({count})</span>
    </button>
    {expanded && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {count ? children : <PanelState text={emptyText} />}
      </div>
    )}
  </section>
);

const CapabilityRow: React.FC<{
  iconKind: CapabilityIconKind;
  assetRef?: string;
  title: string;
  description?: string;
  badges?: string[];
  checked: boolean;
  locked: boolean;
  onToggle: (checked: boolean) => void;
}> = ({ iconKind, assetRef, title, description, badges = [], checked, locked, onToggle }) => {
  const capabilityKey = toTestIdSegment(assetRef || title);

  return (
    <div
      className="admin-capability-row"
      data-testid={`admin-capability-row-${iconKind}-${capabilityKey}`}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, background: 'var(--bg-primary)' }}
    >
      <CapabilityIcon kind={iconKind} assetRef={assetRef} />
      <div className="admin-capability-row-content" style={{ minWidth: 0, flex: 1 }}>
        <div className="admin-capability-row-header" style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span title={title} style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
          {badges.map((badge) => <CapabilityBadge key={badge}>{badge}</CapabilityBadge>)}
        </div>
        {description && <div className="admin-capability-row-description" title={description} style={{ marginTop: 2, fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{description}</div>}
      </div>
      <MossSwitch
        checked={checked}
        disabled={locked}
        onChange={onToggle}
        testId={`admin-capability-toggle-${iconKind}-${capabilityKey}`}
      />
    </div>
  );
};

const CapabilityBadge: React.FC<React.PropsWithChildren> = ({ children }) => (
  <span style={{
    flexShrink: 0,
    fontSize: 11,
    color: 'var(--info)',
    background: 'var(--info-bg-soft)',
    border: '1px solid var(--info-border-soft)',
    borderRadius: 4,
    padding: '1px 5px',
  }}>
    {children}
  </span>
);
