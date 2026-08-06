/**
 * AssetBindingPanel — Capabilities panel
 *
 * Two sections (Tools, Skills) all visible simultaneously.
 * 数据源走 Platform 的 /agents/{id}/skill-bindings 与 /agents/{id}/tool-bindings。
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  listAgentSkillBindings,
  listAgentToolBindings,
  type SkillBindingItem,
  type ToolBindingItem,
} from '../../api/platformAgent';

type SkillBindingPutItem = Pick<SkillBindingItem, 'skillRef' | 'skillScope' | 'bindingState'>;
type ToolBindingPutItem = Pick<ToolBindingItem, 'toolRef' | 'toolScope' | 'bindingState'>;

const toTestIdSegment = (value: string) => value.replace(/[^a-zA-Z0-9_-]+/g, '-');

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const DEFAULT_VISIBLE = 5;

type BindingState = 'enabled' | 'disabled';

const TriToggle: React.FC<{
  state: BindingState;
  locked: boolean;
  onChange: (s: BindingState) => void;
  accent: string;
  testId?: string;
}> = ({ state, locked, onChange, accent, testId }) => {
  if (locked) {
    return (
      <div
        className="asset-binding-toggle asset-binding-toggle-locked"
        data-testid={testId}
        style={{
          width: 44, height: 20, borderRadius: 10,
          background: hexToRgba(accent, 0.1), position: 'relative',
        }}
      >
        <div style={{
          width: 16, height: 16, borderRadius: 8,
          background: hexToRgba(accent, 0.45),
          position: 'absolute', top: 2, left: 2,
        }} />
      </div>
    );
  }

  const isEnabled = state === 'enabled';
  const nextState: BindingState = isEnabled ? 'disabled' : 'enabled';
  const thumbLeft = isEnabled ? 26 : 2;
  const thumbColor = isEnabled ? hexToRgba(accent, 0.55) : 'var(--studio-toggle-thumb-off)';
  const trackBg = isEnabled ? hexToRgba(accent, 0.1) : 'var(--studio-toggle-track-off)';

  return (
    <button
      className="asset-binding-toggle"
      data-testid={testId}
      onClick={(e) => { e.stopPropagation(); onChange(nextState); }}
      style={{
        width: 44, height: 20, borderRadius: 10,
        background: trackBg, position: 'relative',
        border: 'none', cursor: 'pointer',
        transition: 'background 0.2s',
        flexShrink: 0, padding: 0,
      }}
    >
      <div style={{
        width: 16, height: 16, borderRadius: 8,
        background: thumbColor,
        position: 'absolute', top: 2, left: thumbLeft,
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: isEnabled ? `0 0 8px ${hexToRgba(accent, 0.2)}` : 'none',
      }} />
    </button>
  );
};

const ChevronIcon: React.FC<{ expanded: boolean }> = ({ expanded }) => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    style={{
      transition: 'transform 0.15s',
      transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
    }}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const SkillIcon: React.FC<{ color: string }> = ({ color }) => (
  <div style={{
    width: 28, height: 28, borderRadius: 8, flexShrink: 0,
    background: hexToRgba(color, 0.12),
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color,
  }}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2zM22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
    </svg>
  </div>
);

const ToolIcon: React.FC<{ color: string }> = ({ color }) => (
  <div style={{
    width: 28, height: 28, borderRadius: 8, flexShrink: 0,
    background: hexToRgba(color, 0.12),
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color,
  }}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a4 4 0 0 0-5.4 5.9l-5.6 5.6a2 2 0 0 0 2.8 2.8l5.6-5.6a4 4 0 0 0 5.9-5.4l-3 3-2-2z" />
    </svg>
  </div>
);

const SkillRow: React.FC<{
  item: SkillBindingItem;
  state: BindingState;
  accent: string;
  onChange: (s: BindingState) => void;
}> = ({ item, state, accent, onChange }) => (
  <div
    className="asset-binding-row asset-binding-skill-row studio-card"
    data-testid={`asset-binding-skill-${toTestIdSegment(item.skillRef)}`}
    style={{
    display: 'flex', alignItems: 'center', gap: 12,
    borderRadius: 12, background: 'var(--studio-surface)',
    padding: '12px 14px', transition: 'background 0.15s',
  }}
  >
    <SkillIcon color={accent} />
    <div className="asset-binding-row-content" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div className="asset-binding-row-header" style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <span style={{
          fontSize: 13, fontWeight: 500,
          color: 'var(--studio-text-secondary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }} title={item.name || item.skillRef}>
          {item.name || item.skillRef}
        </span>
        {item.kind === 'dedicated' && (
          <span style={{
            flexShrink: 0,
            fontSize: 10, padding: '1px 6px', borderRadius: 4,
            background: hexToRgba(accent, 0.12),
            color: hexToRgba(accent, 0.9),
          }}>专用</span>
        )}
      </div>
      {item.description && (
        <div style={{
          fontSize: 11, color: 'var(--studio-text-desc)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }} title={item.description}>
          {item.description}
        </div>
      )}
    </div>
    <TriToggle
      state={state}
      locked={item.locked}
      onChange={onChange}
      accent={accent}
      testId={`asset-binding-skill-toggle-${toTestIdSegment(item.skillRef)}`}
    />
  </div>
);

const ToolRow: React.FC<{
  item: ToolBindingItem;
  state: BindingState;
  accent: string;
  onChange: (s: BindingState) => void;
}> = ({ item, state, accent, onChange }) => (
  <div
    className="asset-binding-row asset-binding-tool-row studio-card"
    data-testid={`asset-binding-tool-${toTestIdSegment(item.toolRef)}`}
    style={{
    display: 'flex', alignItems: 'center', gap: 12,
    borderRadius: 12, background: 'var(--studio-surface)',
    padding: '12px 14px', transition: 'background 0.15s',
  }}
  >
    <ToolIcon color={accent} />
    <div className="asset-binding-row-content" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div className="asset-binding-row-header" style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <span style={{
          fontSize: 13, fontWeight: 500,
          color: 'var(--studio-text-secondary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }} title={item.displayName || item.toolRef}>
          {item.displayName || item.toolRef}
        </span>
        {item.category && (
          <span style={{
            flexShrink: 0,
            fontSize: 10, padding: '1px 6px', borderRadius: 4,
            background: hexToRgba(accent, 0.12),
            color: hexToRgba(accent, 0.9),
          }}>{item.category}</span>
        )}
      </div>
      {item.description && (
        <div style={{
          fontSize: 11, color: 'var(--studio-text-desc)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }} title={item.description}>
          {item.description}
        </div>
      )}
    </div>
    <TriToggle
      state={state}
      locked={item.locked}
      onChange={onChange}
      accent={accent}
      testId={`asset-binding-tool-toggle-${toTestIdSegment(item.toolRef)}`}
    />
  </div>
);

const SkillGroup: React.FC<{
  title: string;
  count: number;
  visible: SkillBindingItem[];
  expanded: boolean;
  hasMore: boolean;
  onToggle: () => void;
  accent: string;
  skillStates: Record<string, BindingState>;
  onItemChange: (skillRef: string, newState: BindingState) => void;
  groupKey: string;
}> = ({ title, count, visible, expanded, hasMore, onToggle, accent, skillStates, onItemChange, groupKey }) => (
  <div
    className="asset-binding-group asset-binding-skill-group"
    data-testid={`asset-binding-skill-group-${groupKey}`}
    style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
  >
    <button
      className="asset-binding-group-toggle"
      data-testid={`asset-binding-skill-group-toggle-${groupKey}`}
      onClick={onToggle}
      style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '2px 2px', background: 'transparent', border: 'none',
      cursor: 'pointer', color: 'var(--studio-text-muted)',
      fontSize: 11, fontWeight: 500,
    }}
    >
      <ChevronIcon expanded={expanded || !hasMore} />
      <span>{title}</span>
      <span style={{ opacity: 0.6 }}>({count})</span>
    </button>
    {visible.map(item => (
      <SkillRow
        key={item.skillRef}
        item={item}
        state={skillStates[item.skillRef] ?? item.bindingState}
        accent={accent}
        onChange={s => onItemChange(item.skillRef, s)}
      />
    ))}
    {hasMore && !expanded && (
      <button
        className="asset-binding-group-expand"
        data-testid={`asset-binding-skill-group-expand-${groupKey}`}
        onClick={onToggle}
        style={{
        fontSize: 11, background: 'none', border: 'none', cursor: 'pointer',
        color: hexToRgba(accent, 0.6), textAlign: 'center', padding: '4px 0',
      }}
      >
        查看全部 ({count})
      </button>
    )}
  </div>
);

const ToolGroup: React.FC<{
  title: string;
  count: number;
  visible: ToolBindingItem[];
  expanded: boolean;
  hasMore: boolean;
  onToggle: () => void;
  accent: string;
  toolStates: Record<string, BindingState>;
  onItemChange: (toolRef: string, newState: BindingState) => void;
  groupKey: string;
}> = ({ title, count, visible, expanded, hasMore, onToggle, accent, toolStates, onItemChange, groupKey }) => (
  <div
    className="asset-binding-group asset-binding-tool-group"
    data-testid={`asset-binding-tool-group-${groupKey}`}
    style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
  >
    <button
      className="asset-binding-group-toggle"
      data-testid={`asset-binding-tool-group-toggle-${groupKey}`}
      onClick={onToggle}
      style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '2px 2px', background: 'transparent', border: 'none',
      cursor: 'pointer', color: 'var(--studio-text-muted)',
      fontSize: 11, fontWeight: 500,
    }}
    >
      <ChevronIcon expanded={expanded || !hasMore} />
      <span>{title}</span>
      <span style={{ opacity: 0.6 }}>({count})</span>
    </button>
    {visible.map(item => (
      <ToolRow
        key={item.toolRef}
        item={item}
        state={toolStates[item.toolRef] ?? item.bindingState}
        accent={accent}
        onChange={s => onItemChange(item.toolRef, s)}
      />
    ))}
    {hasMore && !expanded && (
      <button
        className="asset-binding-group-expand"
        data-testid={`asset-binding-tool-group-expand-${groupKey}`}
        onClick={onToggle}
        style={{
        fontSize: 11, background: 'none', border: 'none', cursor: 'pointer',
        color: hexToRgba(accent, 0.6), textAlign: 'center', padding: '4px 0',
      }}
      >
        查看全部 ({count})
      </button>
    )}
  </div>
);

export interface AssetBindingPayload {
  skillItems: SkillBindingPutItem[];
  toolItems: ToolBindingPutItem[];
}

interface AssetBindingPanelProps {
  agentId?: string;
  accentColors: { primary: string; secondary: string };
  onChange?: (payload: AssetBindingPayload) => void;
}

export const AssetBindingPanel: React.FC<AssetBindingPanelProps> = ({ agentId, accentColors, onChange }) => {
  const [skills, setSkills] = useState<SkillBindingItem[]>([]);
  const [tools, setTools] = useState<ToolBindingItem[]>([]);
  const [skillStates, setSkillStates] = useState<Record<string, BindingState>>({});
  const [toolStates, setToolStates] = useState<Record<string, BindingState>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const emitChange = useCallback((
    nextSkillStates: Record<string, BindingState>,
    nextToolStates: Record<string, BindingState>,
  ) => {
    if (!onChange) return;
    const skillItems: SkillBindingPutItem[] = skills
      .filter(s => !s.locked)
      .map(s => ({
        skillRef: s.skillRef,
        skillScope: s.skillScope,
        bindingState: nextSkillStates[s.skillRef] ?? s.bindingState,
      }));
    const toolItems: ToolBindingPutItem[] = tools
      .filter(t => !t.locked)
      .map(t => ({
        toolRef: t.toolRef,
        toolScope: t.toolScope,
        bindingState: nextToolStates[t.toolRef] ?? t.bindingState,
      }));
    onChange({ skillItems, toolItems });
  }, [onChange, skills, tools]);

  const loadBindings = useCallback(() => {
    if (!agentId) { setLoading(false); return; }
    setLoading(true);
    setLoadError(null);
    Promise.all([
      listAgentSkillBindings(agentId),
      listAgentToolBindings(agentId),
    ])
      .then(([skillRes, toolRes]) => {
        const nextSkills = skillRes.items || [];
        const nextTools = toolRes.items || [];
        setSkills(nextSkills);
        setTools(nextTools);
        const ss: Record<string, BindingState> = {};
        nextSkills.forEach(item => { ss[item.skillRef] = item.bindingState; });
        setSkillStates(ss);
        const ts: Record<string, BindingState> = {};
        nextTools.forEach(item => { ts[item.toolRef] = item.bindingState; });
        setToolStates(ts);
      })
      .catch(err => {
        console.error('[AssetBindingPanel] 加载绑定失败', err);
        setLoadError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setLoading(false));
  }, [agentId]);

  useEffect(() => {
    loadBindings();
  }, [loadBindings]);

  useEffect(() => {
    const handler = (e: Event) => {
      const type = (e as CustomEvent<{ type: string }>)?.detail?.type;
      if (type === 'skills' || type === 'tools') loadBindings();
    };
    window.addEventListener('asset-changed', handler);
    return () => window.removeEventListener('asset-changed', handler);
  }, [loadBindings]);

  const setSkillState = useCallback((skillRef: string, newState: BindingState) => {
    setSkillStates(prev => {
      const updated = { ...prev, [skillRef]: newState };
      emitChange(updated, toolStates);
      return updated;
    });
  }, [emitChange, toolStates]);

  const setToolState = useCallback((toolRef: string, newState: BindingState) => {
    setToolStates(prev => {
      const updated = { ...prev, [toolRef]: newState };
      emitChange(skillStates, updated);
      return updated;
    });
  }, [emitChange, skillStates]);

  const toggleExpand = (section: string) =>
    setExpanded(prev => ({ ...prev, [section]: !prev[section] }));

  const builtinTools = tools.filter(t => t.toolScope === 'builtin');
  const builtinSkills = skills.filter(s => s.skillScope === 'builtin');
  const tenantSkills = skills.filter(s => s.skillScope === 'tenant');
  const visibleBuiltinTools = expanded.toolBuiltin ? builtinTools : builtinTools.slice(0, DEFAULT_VISIBLE);
  const visibleBuiltinSkills = expanded.skillBuiltin ? builtinSkills : builtinSkills.slice(0, DEFAULT_VISIBLE);
  const visibleTenantSkills = expanded.skillTenant ? tenantSkills : tenantSkills.slice(0, DEFAULT_VISIBLE);
  const accent = accentColors.primary;

  if (loading) {
    return (
      <div
        className="asset-binding-panel-loading"
        data-testid="asset-binding-panel-loading"
        style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: 200, color: 'var(--studio-text-muted)', fontSize: 13,
      }}
      >
        加载中...
      </div>
    );
  }

  return (
    <div
      className="asset-binding-panel"
      data-testid="asset-binding-panel"
      style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
    >
      {loadError && (
        <div
          className="asset-binding-panel-error"
          data-testid="asset-binding-panel-error"
          style={{
          padding: 12, borderRadius: 8,
          background: 'rgba(220, 38, 38, 0.08)',
          border: '1px solid rgba(220, 38, 38, 0.3)',
          fontSize: 12, color: 'rgb(185, 28, 28)',
          lineHeight: 1.5,
        }}
        >
          加载绑定失败：{loadError}
        </div>
      )}

      {/* ─── Tools ─── */}
      <section
        className="asset-binding-section asset-binding-tools-section"
        data-testid="asset-binding-tools-section"
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <div
          className="asset-binding-section-header"
          data-testid="asset-binding-tools-header"
          style={{ fontSize: 12, fontWeight: 500, color: 'var(--studio-text-muted)' }}
        >
          工具 · {tools.length}
        </div>

        {tools.length === 0 && (
          <div
            className="asset-binding-section-empty"
            data-testid="asset-binding-tools-empty"
            style={{ padding: 32, textAlign: 'center', fontSize: 12, color: 'var(--studio-text-faint)' }}
          >
            暂无可用工具
          </div>
        )}

        {builtinTools.length > 0 && (
          <ToolGroup
            title="内置工具"
            count={builtinTools.length}
            visible={visibleBuiltinTools}
            expanded={!!expanded.toolBuiltin}
            hasMore={builtinTools.length > DEFAULT_VISIBLE}
            onToggle={() => toggleExpand('toolBuiltin')}
            accent={accent}
            toolStates={toolStates}
            onItemChange={setToolState}
            groupKey="builtin"
          />
        )}

      </section>

      {/* ─── Skills ─── */}
      <section
        className="asset-binding-section asset-binding-skills-section"
        data-testid="asset-binding-skills-section"
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <div
          className="asset-binding-section-header"
          data-testid="asset-binding-skills-header"
          style={{ fontSize: 12, fontWeight: 500, color: 'var(--studio-text-muted)' }}
        >
          技能 · {skills.length}
        </div>

        {skills.length === 0 && (
          <div
            className="asset-binding-section-empty"
            data-testid="asset-binding-skills-empty"
            style={{ padding: 32, textAlign: 'center', fontSize: 12, color: 'var(--studio-text-faint)' }}
          >
            暂无可用技能
          </div>
        )}

        {builtinSkills.length > 0 && (
          <SkillGroup
            title="内置技能"
            count={builtinSkills.length}
            visible={visibleBuiltinSkills}
            expanded={!!expanded.skillBuiltin}
            hasMore={builtinSkills.length > DEFAULT_VISIBLE}
            onToggle={() => toggleExpand('skillBuiltin')}
            accent={accent}
            skillStates={skillStates}
            onItemChange={setSkillState}
            groupKey="builtin"
          />
        )}

        {tenantSkills.length > 0 && (
          <SkillGroup
            title="自定义技能"
            count={tenantSkills.length}
            visible={visibleTenantSkills}
            expanded={!!expanded.skillTenant}
            hasMore={tenantSkills.length > DEFAULT_VISIBLE}
            onToggle={() => toggleExpand('skillTenant')}
            accent={accent}
            skillStates={skillStates}
            onItemChange={setSkillState}
            groupKey="tenant"
          />
        )}
      </section>

      <style>{`
        .studio-card:hover { background: var(--studio-surface-hover) !important; }
      `}</style>
    </div>
  );
};
