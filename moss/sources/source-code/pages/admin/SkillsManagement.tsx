/**
 * SkillsManagement — 技能管理页（管理后台）。
 *
 * 布局：左侧技能列表（搜索 + 内置组 + 自定义组）| 右侧技能详情 / 操作面板
 * - 内置 dedicated / general：只读展示
 * - 自定义 tenant：点击进详情
 * - 当前以手动创建 / 编辑 / 上传技能包为主路径
 * - 对话创建能力先软屏蔽，保留底层代码以便后续恢复
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { skillManagementApi, type UnifiedSkillItem } from '../../api/skillManagement';
import { listAgentSkillBindings, type SkillBindingItem } from '../../api/platformAgent';
import { SkillCard } from './skills/SkillCard';
import { SkillUploadModal } from './skills/SkillUploadModal';
import { SkillStudio } from '../../components/Skills/SkillStudio';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { useAgentContextStore } from '../../stores/agentContextStore';
import { track } from '../../utils/track';
import { toast } from '../../utils/toast';
import { ApiError } from '../../lib/api';

// ── Icons ──

const SearchIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const PlusIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const UploadIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const ChevronDownIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

// ── Mock 数据（后端就绪后删除）──

const MOCK_SKILLS: UnifiedSkillItem[] = [
  { id: 'deep_think', name: '深度思考', description: '启用多步推理和复杂分析', scope: 'builtin', kind: 'general', boundAgent: null },
  { id: 'web_search', name: '网络搜索', description: '实时搜索互联网信息', scope: 'builtin', kind: 'general', boundAgent: null },
  { id: 'plan_execute', name: '计划执行', description: '将任务分解为多步骤计划逐一执行', scope: 'builtin', kind: 'general', boundAgent: null },
];

type SkillBindingState = SkillBindingItem['bindingState'];

type SkillChangedEventDetail = {
  type?: string;
  skill_id?: string | null;
  focus_skill_id?: string | null;
};

function getFocusSkillId(detail: unknown): string | null {
  if (!detail || typeof detail !== 'object') return null;
  const eventDetail = detail as SkillChangedEventDetail;
  const value = eventDetail.focus_skill_id ?? null;
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

// ── SectionLabel ──

const SectionLabel: React.FC<{ children: React.ReactNode; testId?: string }> = ({ children, testId }) => (
  <div className="skills-section-label" style={{
    fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.06em',
    padding: '12px 0 6px',
  }} data-testid={testId}>
    {children}
  </div>
);

// ── Main ──

const SkillsManagement: React.FC = () => {
  const currentAgentId = useAgentContextStore((s) => s.currentAgentId);
  const [searchParams, setSearchParams] = useSearchParams();
  const [skills, setSkills] = useState<UnifiedSkillItem[]>(MOCK_SKILLS);
  const [skillBindingStates, setSkillBindingStates] = useState<Record<string, SkillBindingState>>({});
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedSkill, setSelectedSkill] = useState<UnifiedSkillItem | null>(null);
  const [studioOpen, setStudioOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingDeleteSkill, setPendingDeleteSkill] = useState<UnifiedSkillItem | null>(null);
  const [editingSkill, setEditingSkill] = useState<{
    name: string;
    content: string;
    skillId?: string;
    preview?: boolean;
    initialFilePath?: string;
  } | null>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const consumingFocusSkillRef = useRef<string | null>(null);

  const loadSkills = useCallback(async (): Promise<UnifiedSkillItem[] | null> => {
    setLoading(true);
    try {
      const res = await skillManagementApi.list();
      // 后端返回的是直接数组或 { items: [...] } 格式
      const items = Array.isArray(res) ? res : (res.items ?? []);
      setSkills(items);
      return items;
    } catch {
      // 后端未就绪时保留 mock 数据
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCurrentAgentSkillBindings = useCallback(async (agentId: string | null): Promise<void> => {
    if (!agentId) {
      setSkillBindingStates({});
      return;
    }
    try {
      const { items } = await listAgentSkillBindings(agentId);
      setSkillBindingStates(Object.fromEntries(
        items.map((item) => [item.skillRef, item.bindingState]),
      ));
    } catch {
      setSkillBindingStates({});
    }
  }, []);

  const handleSkillClick = useCallback(async (skill: UnifiedSkillItem, initialFilePath = 'SKILL.md') => {
    if (skill.scope !== 'tenant' || !skill.id) return;
    setMenuOpen(false);
    setSelectedSkill(skill);
    try {
      const res = await skillManagementApi.getFile(skill.id, 'SKILL.md');
      setEditingSkill({
        name: skill.name || '',
        content: res.content ?? '',
        skillId: skill.id,
        initialFilePath,
      });
      setStudioOpen(true);
    } catch {
      // SKILL.md 不存在时按空内容编辑
      setEditingSkill({
        name: skill.name || '',
        content: '',
        skillId: skill.id,
        initialFilePath,
      });
      setStudioOpen(true);
    }
  }, []);

  const focusSkillById = useCallback(async (
    skillId: string,
    currentItems: UnifiedSkillItem[] = skills,
  ): Promise<boolean> => {
    const findSkill = (items: UnifiedSkillItem[]) => items.find((skill) => skill.id === skillId) ?? null;
    let target = findSkill(currentItems);
    if (!target) {
      const latest = await loadSkills();
      target = latest ? findSkill(latest) : null;
    }
    if (!target) {
      toast.error('未找到要查看的已有技能');
      return false;
    }
    if (target.scope !== 'tenant') {
      toast.error('该技能暂不支持在自定义技能详情中打开');
      return false;
    }
    setSearch('');
    await handleSkillClick(target);
    return true;
  }, [handleSkillClick, loadSkills, skills]);

  const handleCreateClick = useCallback(() => {
    setMenuOpen(false);
    setSelectedSkill(null);
    setEditingSkill(null);
    setStudioOpen(true);
  }, []);

  const handleUploadUploaded = useCallback(async (created: UnifiedSkillItem) => {
    track('custom_skill', { sub_event: 'upload' });
    await loadSkills();
    await loadCurrentAgentSkillBindings(currentAgentId);
    setSelectedSkill(created);
    setUploadOpen(false);
    setMenuOpen(false);
  }, [currentAgentId, loadCurrentAgentSkillBindings, loadSkills]);

  useEffect(() => { loadSkills(); }, [loadSkills]);

  useEffect(() => { void loadCurrentAgentSkillBindings(currentAgentId); }, [currentAgentId, loadCurrentAgentSkillBindings]);

  useEffect(() => {
    const handler = (event: Event) => {
      const focusSkillId = event instanceof CustomEvent ? getFocusSkillId(event.detail) : null;
      void (async () => {
        const nextSkills = await loadSkills();
        if (focusSkillId) {
          await focusSkillById(focusSkillId, nextSkills ?? skills);
        }
      })();
      void loadCurrentAgentSkillBindings(currentAgentId);
    };
    window.addEventListener('skill-changed', handler as EventListener);
    return () => window.removeEventListener('skill-changed', handler as EventListener);
  }, [currentAgentId, focusSkillById, loadCurrentAgentSkillBindings, loadSkills, skills]);

  useEffect(() => {
    const focusSkillId = searchParams.get('focusSkillId');
    if (!focusSkillId) return;
    if (consumingFocusSkillRef.current === focusSkillId) return;
    consumingFocusSkillRef.current = focusSkillId;
    let cancelled = false;
    void (async () => {
      await focusSkillById(focusSkillId);
      if (!cancelled) {
        const next = new URLSearchParams(searchParams);
        next.delete('focusSkillId');
        setSearchParams(next, { replace: true });
      }
      if (consumingFocusSkillRef.current === focusSkillId) {
        consumingFocusSkillRef.current = null;
      }
    })();
    return () => {
      cancelled = true;
      if (consumingFocusSkillRef.current === focusSkillId) {
        consumingFocusSkillRef.current = null;
      }
    };
  }, [focusSkillById, searchParams, setSearchParams]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!actionMenuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // 搜索过滤
  const filtered = skills.filter((s) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      (s.name || '').toLowerCase().includes(q) ||
      (s.description || '').toLowerCase().includes(q) ||
      (s.id || '').toLowerCase().includes(q)
    );
  });

  // dedicated 专属技能不在管理页展示
  const builtinGeneral = filtered.filter((s) => s.scope === 'builtin' && s.kind === 'general');
  const tenantSkills = filtered.filter((s) => s.scope === 'tenant');

  const handleStudioClose = () => {
    setStudioOpen(false);
    setEditingSkill(null);
  };

  const handleStudioSaved = async () => {
    const prevIds = new Set(skills.filter((skill) => skill.id).map((skill) => skill.id as string));
    const next = await loadSkills();
    await loadCurrentAgentSkillBindings(currentAgentId);
    if (!next) return;
    const matched = editingSkill?.skillId
      ? next.find((skill) => skill.id === editingSkill.skillId) || null
      : next.find((skill) => skill.scope === 'tenant' && skill.id && !prevIds.has(skill.id)) || null;
    setSelectedSkill(matched);
  };

  const handleDeleteSkill = async (skill: UnifiedSkillItem) => {
    if (!skill.id) return;
    setPendingDeleteSkill(skill);
  };

  const handleConfirmDeleteSkill = async () => {
    if (!pendingDeleteSkill?.id) return;
    const skillName = pendingDeleteSkill.name || '该技能';
    try {
      await skillManagementApi.remove(pendingDeleteSkill.id);
      if (selectedSkill?.id === pendingDeleteSkill.id) setSelectedSkill(null);
      if (editingSkill?.skillId === pendingDeleteSkill.id) handleStudioClose();
      setPendingDeleteSkill(null);
      await loadSkills();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'SKILL_HAS_ACTIVE_BINDINGS') {
        toast.error(`技能「${skillName}」仍被启用中，请先到对应智能体的能力面板中关闭该技能后再删除`);
        return;
      }
      toast.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  return (
    <div style={{ height: '100%', overflow: 'hidden', padding: '24px 32px', boxSizing: 'border-box' }} data-testid="skills-management">
      <SkillListPanel
        loading={loading}
        search={search}
        onSearchChange={setSearch}
        builtinGeneral={builtinGeneral}
        tenantSkills={tenantSkills}
        selectedSkill={selectedSkill}
        onSkillClick={handleSkillClick}
        onSkillDelete={handleDeleteSkill}
        skillBindingStates={skillBindingStates}
        onCreateClick={handleCreateClick}
        menuOpen={menuOpen}
        onToggleMenu={() => setMenuOpen(prev => !prev)}
        onUploadClick={() => { setMenuOpen(false); setUploadOpen(true); }}
        actionMenuRef={actionMenuRef}
      />

      <SkillStudio
        isOpen={studioOpen}
        onClose={handleStudioClose}
        onSaved={handleStudioSaved}
        editSkill={editingSkill}
        existingNames={tenantSkills.map(skill => skill.name || '').filter(Boolean)}
      />
      <SkillUploadModal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={handleUploadUploaded}
        existingNames={tenantSkills.map(skill => skill.name || '').filter(Boolean)}
      />
      <ConfirmDialog
        open={Boolean(pendingDeleteSkill)}
        title="删除技能"
        description={pendingDeleteSkill ? `确认删除技能「${pendingDeleteSkill.name || ''}」？删除后不可恢复。` : undefined}
        confirmText="删除"
        cancelText="取消"
        variant="danger"
        onConfirm={handleConfirmDeleteSkill}
        onCancel={() => setPendingDeleteSkill(null)}
      />
    </div>
  );
};

// ── SkillListPanel (抽取为子组件，保持主文件行数) ──

interface SkillListPanelProps {
  loading: boolean;
  search: string;
  onSearchChange: (v: string) => void;
  builtinGeneral: UnifiedSkillItem[];
  tenantSkills: UnifiedSkillItem[];
  selectedSkill: UnifiedSkillItem | null;
  onSkillClick: (skill: UnifiedSkillItem) => void;
  onSkillDelete: (skill: UnifiedSkillItem) => void;
  skillBindingStates: Record<string, SkillBindingState>;
  onCreateClick: () => void;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onUploadClick: () => void;
  actionMenuRef: React.RefObject<HTMLDivElement>;
}

const SkillListPanel: React.FC<SkillListPanelProps> = ({
  loading, search, onSearchChange,
  builtinGeneral, tenantSkills,
  selectedSkill, onSkillClick,
  onSkillDelete, skillBindingStates, onCreateClick, menuOpen, onToggleMenu, onUploadClick, actionMenuRef,
}) => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minWidth: 0,
    overflow: 'hidden',
  }} data-testid="skills-list-panel">
    <div style={{ padding: 0, flexShrink: 0 }} data-testid="skills-list-header">
      <div
        ref={actionMenuRef}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          position: 'relative',
        }}
        data-testid="skills-toolbar"
      >
        <h2
          style={{
            fontSize: '18px',
            fontWeight: 600,
            color: 'var(--text-primary, #18181b)',
            margin: 0,
          }}
          data-testid="skills-title"
        >
          技能管理
        </h2>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          minWidth: 0,
        }}>
          <SearchBox search={search} onSearchChange={onSearchChange} />
          <ActionButton onClick={onToggleMenu} primary testId="skills-create-menu-trigger">
            <PlusIcon />自定义技能<ChevronDownIcon />
          </ActionButton>
        </div>
        {menuOpen && (
          <div style={{
            position: 'absolute',
            top: 40,
            right: 0,
            width: 136,
            padding: 6,
            borderRadius: 10,
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-subtle)',
            boxShadow: '0 10px 24px rgba(15, 23, 42, 0.10)',
            zIndex: 5,
          }} data-testid="skills-create-menu">
            <MenuItem onClick={onCreateClick} testId="skills-create-manual"><PlusIcon />手动创建</MenuItem>
            <MenuItem onClick={onUploadClick} testId="skills-upload-package"><UploadIcon />上传技能包</MenuItem>
          </div>
        )}
      </div>
    </div>

    {/* 技能列表 */}
    <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0 20px' }} data-testid="skills-list-content">
      {loading && (
        <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }} data-testid="skills-loading">
          加载中...
        </div>
      )}

      {!loading && (
        <>
          {/* 内置技能（仅 general，dedicated 不展示） */}
          {builtinGeneral.length > 0 && (
            <div data-testid="skills-builtin-section">
              <SectionLabel testId="skills-builtin-label">内置技能</SectionLabel>
              <div style={gridStyle} data-testid="skills-builtin-grid">
                {builtinGeneral.map((s) => (
                  <SkillCard
                    key={s.name}
                    skill={s}
                    isSelected={false}
                    agentBindingState={s.id ? skillBindingStates[s.id] : undefined}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 自定义技能 */}
          <div data-testid="skills-tenant-section">
          <SectionLabel testId="skills-tenant-label">自定义技能</SectionLabel>
          {tenantSkills.length === 0 ? (
            <div style={{
              padding: '24px', textAlign: 'center',
              border: '1px dashed var(--border-default)', borderRadius: 8,
              color: 'var(--text-muted)', fontSize: 13,
            }} data-testid="skills-tenant-empty">
              暂无自定义技能
            </div>
          ) : (
            <div style={gridStyle} data-testid="skills-tenant-grid">
              {tenantSkills.map((s) => (
                <SkillCard
                  key={s.id}
                  skill={s}
                  isSelected={selectedSkill?.id === s.id}
                  onClick={onSkillClick}
                  onDelete={onSkillDelete}
                  agentBindingState={s.id ? skillBindingStates[s.id] : undefined}
                />
              ))}
            </div>
          )}
          </div>
        </>
      )}
    </div>
  </div>
);

const SearchBox: React.FC<{
  search: string;
  onSearchChange: (v: string) => void;
}> = ({ search, onSearchChange }) => (
  <div style={{
    width: 236,
    height: 36,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'var(--bg-secondary)',
    borderRadius: 8,
    padding: '0 12px',
    border: '1px solid var(--border-subtle)',
    boxSizing: 'border-box',
    flexShrink: 0,
  }} data-testid="skills-search">
    <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
      <SearchIcon />
    </span>
    <input
      type="text"
      value={search}
      onChange={(e) => onSearchChange(e.target.value)}
      placeholder="搜索名称/描述"
      data-testid="skills-search-input"
      style={{
        flex: 1,
        minWidth: 0,
        border: 'none',
        background: 'transparent',
        fontSize: 13,
        color: 'var(--text-primary)',
        outline: 'none',
      }}
    />
  </div>
);

const ActionButton: React.FC<{
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
  testId?: string;
}> = ({ children, onClick, primary = false, testId }) => (
  <button
    type="button"
    onClick={onClick}
    className={primary ? 'skills-action-button skills-action-button--primary' : 'skills-action-button'}
    data-testid={testId}
    style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      height: 36, padding: '0 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
      border: primary ? 'none' : '1px solid var(--border-subtle)',
      background: primary ? 'var(--text-primary)' : 'var(--bg-secondary)',
      color: primary ? 'var(--bg-primary)' : 'var(--text-primary)',
      cursor: 'pointer',
    }}
  >
    {children}
  </button>
);

const MenuItem: React.FC<{ children: React.ReactNode; onClick: () => void; testId?: string }> = ({ children, onClick, testId }) => (
  <button
    type="button"
    onClick={onClick}
    className="skills-menu-item"
    data-testid={testId}
    style={{
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '9px 10px',
      borderRadius: 8,
      border: 'none',
      background: 'transparent',
      color: 'var(--text-primary)',
      cursor: 'pointer',
      fontSize: 13,
      textAlign: 'left',
    }}
  >
    {children}
  </button>
);

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  gap: 12,
};

export default SkillsManagement;
