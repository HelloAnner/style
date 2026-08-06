/**
 * 资产管理 → 技能 Tab。
 *
 * 两个区域：
 * 1. 系统级技能：只展示名称列表（只读）
 * 2. 自定义技能：支持 CRUD，调用 skillManagementApi
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { skillManagementApi, type UnifiedSkillItem } from '../../../api/skillManagement';
import { toast } from '../../../utils/toast';
import { ApiError } from '../../../lib/api';
import { ConfirmDialog } from '../../../components/common/ConfirmDialog';

// SkillsTab 仍使用旧的 SkillItem 接口形式，这里做本地适配
interface SkillItem {
  id: string;
  name: string;
  description: string;
  builtIn: boolean;
  createdAt: string;
  updatedAt: string;
}

function toSkillItem(s: UnifiedSkillItem): SkillItem {
  return {
    id: s.id ?? s.name ?? '',
    name: s.name || '',
    description: s.description,
    builtIn: s.scope === 'builtin',
    createdAt: '',
    updatedAt: '',
  };
}

// ── Mock 系统技能列表（后端返回 builtIn=true 的技能，暂用静态列表）──
const SYSTEM_SKILL_NAMES = [
  'deep_think',
  'web_search',
  'plan_execute',
  'code_review',
  'document_summary',
];

// ── 图标 ──

const PlusIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const EditIcon: React.FC = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const TrashIcon: React.FC = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
  </svg>
);

const CloseIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// ── 新建 / 编辑 Modal ──

interface SkillFormData {
  name: string;
  description: string;
  file: File | null;
}

interface SkillModalProps {
  mode: 'create' | 'edit';
  initial?: SkillItem;
  onClose: () => void;
  onSave: (data: SkillFormData) => Promise<void>;
}

function SkillModal({ mode, initial, onClose, onSave }: SkillModalProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('请输入技能名称'); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave({ name: name.trim(), description: description.trim(), file });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      data-testid="skill-modal-backdrop"
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'var(--modal-backdrop)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="skill-modal"
        data-testid={`skill-modal-${mode}`}
        style={{
          width: '460px',
          background: 'var(--modal-bg)',
          border: '1px solid var(--modal-border)',
          borderRadius: '12px',
          boxShadow: 'var(--modal-shadow)',
          padding: '24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }} data-testid="skill-modal-title">
            {mode === 'create' ? '新建自定义技能' : '编辑技能'}
          </span>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px' }} data-testid="skill-modal-close">
            <CloseIcon />
          </button>
        </div>

        <form onSubmit={handleSubmit} data-testid="skill-modal-form">
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              技能名称 <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入技能显示名称"
              data-testid="skill-modal-name-input"
              style={{
                width: '100%', padding: '8px 12px', borderRadius: '6px',
                border: '1px solid var(--input-border)', background: 'var(--input-bg)',
                color: 'var(--text-primary)', fontSize: '13px', boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              描述
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="简要描述技能的功能"
              rows={3}
              data-testid="skill-modal-description-input"
              style={{
                width: '100%', padding: '8px 12px', borderRadius: '6px',
                border: '1px solid var(--input-border)', background: 'var(--input-bg)',
                color: 'var(--text-primary)', fontSize: '13px', resize: 'none',
                boxSizing: 'border-box', lineHeight: 1.5,
              }}
            />
          </div>

          {mode === 'create' && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                技能文件
              </label>
              <div
                onClick={() => fileRef.current?.click()}
                data-testid="skill-modal-file-dropzone"
                style={{
                  padding: '10px 14px', borderRadius: '6px', cursor: 'pointer',
                  border: '1px dashed var(--border-default)', background: 'var(--bg-tertiary)',
                  fontSize: '13px', color: file ? 'var(--text-primary)' : 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}
              >
                {file ? file.name : '点击上传技能文件（.zip / .py）'}
              </div>
              <input ref={fileRef} type="file" accept=".zip,.py" style={{ display: 'none' }}
                data-testid="skill-modal-file-input"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
          )}

          {error && (
            <div style={{
              marginBottom: '12px', padding: '8px 12px', borderRadius: '6px',
              background: 'var(--danger-bg-soft)', border: '1px solid var(--danger-border-soft)',
              color: 'var(--danger)', fontSize: '13px',
            }} data-testid="skill-modal-error">{error}</div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button type="button" onClick={onClose}
              data-testid="skill-modal-cancel"
              style={{
                padding: '7px 16px', borderRadius: '6px', border: '1px solid var(--border-default)',
                background: 'transparent', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer',
              }}
            >取消</button>
            <button type="submit" disabled={saving}
              data-testid="skill-modal-save"
              style={{
                padding: '7px 16px', borderRadius: '6px', border: 'none',
                background: saving ? 'var(--btn-mono-disabled-bg)' : 'var(--btn-mono-bg)',
                color: saving ? 'var(--btn-mono-disabled-text)' : 'var(--btn-mono-text)',
                fontSize: '13px', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 500,
              }}
            >{saving ? '保存中...' : '保存'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── 自定义技能行 ──

interface CustomSkillRowProps {
  skill: SkillItem;
  onAiEdit: (skill: SkillItem) => void;
  onEdit: (skill: SkillItem) => void;
  onDelete: (skill: SkillItem) => void;
}

function CustomSkillRow({ skill, onAiEdit, onEdit, onDelete }: CustomSkillRowProps) {
  return (
    <div
      className="skill-list-item custom-skill-row"
      data-testid={`custom-skill-row-${skill.id}`}
      style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '10px 14px', border: '1px solid var(--border-subtle)',
        borderRadius: '8px', background: 'var(--bg-secondary)',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="custom-skill-row__name" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }} data-testid={`custom-skill-name-${skill.id}`}>{skill.name}</div>
        {skill.description && (
          <div className="custom-skill-row__description" style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} data-testid={`custom-skill-description-${skill.id}`}>
            {skill.description}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
        <button type="button" onClick={() => onAiEdit(skill)}
          title="通过对话编辑"
          className="custom-skill-row__ai-edit"
          data-testid={`custom-skill-ai-edit-${skill.id}`}
          style={{
            height: '28px', padding: '0 8px', borderRadius: '6px',
            border: '1px solid var(--border-default)', background: 'transparent',
            color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hover-bg)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >
          AI 编辑
        </button>
        <button type="button" onClick={() => onEdit(skill)}
          title="编辑"
          className="custom-skill-row__edit"
          data-testid={`custom-skill-edit-${skill.id}`}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '28px', height: '28px', borderRadius: '6px',
            border: '1px solid var(--border-default)', background: 'transparent',
            color: 'var(--text-secondary)', cursor: 'pointer',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hover-bg)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >
          <EditIcon />
        </button>
        <button type="button" onClick={() => onDelete(skill)}
          title="删除"
          className="custom-skill-row__delete"
          data-testid={`custom-skill-delete-${skill.id}`}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '28px', height: '28px', borderRadius: '6px',
            border: '1px solid var(--danger-border-soft)', background: 'transparent',
            color: 'var(--danger)', cursor: 'pointer',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--danger-bg-soft)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}

// ── Tab 主体 ──

export function SkillsTab() {
  const [customSkills, setCustomSkills] = useState<SkillItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; skill?: SkillItem } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteSkill, setPendingDeleteSkill] = useState<SkillItem | null>(null);

  const loadSkills = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await skillManagementApi.list();
      setCustomSkills(res.items.filter((s) => s.scope === 'tenant').map(toSkillItem));
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSkills(); }, [loadSkills]);

  const handleSave = async (data: SkillFormData) => {
    if (modal?.mode === 'create') {
      await skillManagementApi.create({ name: data.name, description: data.description });
    } else if (modal?.mode === 'edit' && modal.skill && modal.skill.id) {
      await skillManagementApi.update(modal.skill.id, { name: data.name, description: data.description });
    }
    await loadSkills();
  };

  const handleDelete = (skill: SkillItem) => {
    setPendingDeleteSkill(skill);
  };

  const openSkillChat = (intent: 'create-skill' | 'edit-skill', skillName?: string) => {
    const params = new URLSearchParams({ intent });
    if (skillName) params.set('skillName', skillName);
    window.location.href = `/chat?${params.toString()}`;
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteSkill?.id) {
      setPendingDeleteSkill(null);
      return;
    }
    setDeletingId(pendingDeleteSkill.id);
    try {
      await skillManagementApi.remove(pendingDeleteSkill.id);
      setPendingDeleteSkill(null);
      await loadSkills();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'SKILL_HAS_ACTIVE_BINDINGS') {
        toast.error(`技能「${pendingDeleteSkill.name || '该技能'}」仍被启用中，请先到对应智能体的能力面板中关闭该技能后再删除`);
      } else {
        toast.error(err instanceof Error ? err.message : '删除失败');
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div data-testid="skills-tab">
      {/* 系统级技能 */}
      <div style={{ marginBottom: '28px' }} data-testid="skills-tab-system-section">
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.04em' }} data-testid="skills-tab-system-title">
          系统技能
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }} data-testid="skills-tab-system-list">
          {SYSTEM_SKILL_NAMES.map((name) => (
            <span
              key={name}
              className="skills-tab-system-skill"
              data-testid={`skills-tab-system-skill-${name}`}
              style={{
                padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontFamily: 'monospace',
                background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
            >
              {name}
            </span>
          ))}
        </div>
      </div>

      {/* 自定义技能 */}
      <div data-testid="skills-tab-custom-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }} data-testid="skills-tab-custom-title">
            自定义技能
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} data-testid="skills-tab-custom-actions">
            {/* AI 创建入口(PRD §6.8 / §11):跳到对话页并预填 "创建技能" 意图,
                由 Kernel skill_draft_begin / skill_draft_ready 链路在对话中产出草稿卡片。 */}
            <button
              type="button"
              onClick={() => openSkillChat('create-skill')}
              data-testid="skills-tab-ai-create"
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '6px 12px', borderRadius: '6px',
                border: '1px solid var(--border-default)',
                background: 'transparent', color: 'var(--text-secondary)',
                fontSize: '13px', fontWeight: 500, cursor: 'pointer',
              }}
              title="通过对话让智能体帮你创建技能"
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hover-bg)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              ✨ AI 创建
            </button>
            <button
              type="button"
              onClick={() => setModal({ mode: 'create' })}
              data-testid="skills-tab-create"
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '6px 12px', borderRadius: '6px', border: 'none',
                background: 'var(--btn-mono-bg)', color: 'var(--btn-mono-text)',
                fontSize: '13px', fontWeight: 500, cursor: 'pointer',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--btn-mono-hover-bg)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--btn-mono-bg)'; }}
            >
              <PlusIcon /> 新建技能
            </button>
          </div>
        </div>

        {loading && (
          <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }} data-testid="skills-tab-loading">加载中...</div>
        )}

        {error && (
          <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'var(--danger-bg-soft)', border: '1px solid var(--danger-border-soft)', color: 'var(--danger)', fontSize: '13px', marginBottom: '12px' }} data-testid="skills-tab-error">
            {error}
          </div>
        )}

        {!loading && !error && customSkills.length === 0 && (
          <div style={{ padding: '32px', textAlign: 'center', border: '1px dashed var(--border-default)', borderRadius: '10px', color: 'var(--text-muted)', fontSize: '13px' }} data-testid="skills-tab-empty">
            暂无自定义技能，点击「新建技能」上传
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }} data-testid="skills-tab-custom-list">
          {customSkills.map((skill) => (
            <div key={skill.id} className="skill-list-item skills-tab-custom-item" style={{ opacity: deletingId === skill.id ? 0.5 : 1 }} data-testid={`skills-tab-custom-item-${skill.id}`}>
              <CustomSkillRow
                skill={skill}
                onAiEdit={(s) => openSkillChat('edit-skill', s.name)}
                onEdit={(s) => setModal({ mode: 'edit', skill: s })}
                onDelete={handleDelete}
              />
            </div>
          ))}
        </div>
      </div>

      {modal && (
        <SkillModal
          mode={modal.mode}
          initial={modal.skill}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
      <ConfirmDialog
        open={Boolean(pendingDeleteSkill)}
        title="删除技能"
        description={pendingDeleteSkill ? `确认删除技能「${pendingDeleteSkill.name}」？删除后不可恢复。` : undefined}
        confirmText="删除"
        cancelText="取消"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDeleteSkill(null)}
      />
    </div>
  );
}
