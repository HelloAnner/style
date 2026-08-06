/**
 * 草稿详情弹窗(PRD §6.6)。
 *
 * 管理员从 SkillDraftCard 点击 "查看详情" 触发,允许调整草稿名称 / 描述 / 摘要。
 * 文件本体修改需要回到 Kernel 对话链路,本弹窗不涉及 SKILL.md / scripts 等文件级编辑。
 *
 * 按钮文案按 PRD §3 / §6.6 统一为 "保存":
 *   create 与 edit 模式按钮文案一致;
 *   元数据更新成功后立即激活草稿,与卡片快捷保存保持同一收口。
 */

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  isActivateConflict,
  localizeSkillDraftErrorMessage,
  skillDraftsApi,
  type ActivateConflict,
  type SkillDraftResponse,
} from '../../api/skillDrafts';
import { useSkillDraftStore } from '../../stores/skillDraftStore';
import { useAgentStore } from '../../stores/agentStore';
import { useUiStore, type RightPanelType } from '../../stores/uiStore';
import { ConfirmDialog } from '../common/ConfirmDialog';

interface Props {
  draftId: string | null;
  onClose: () => void;
}

type LoadState =
  | { type: 'loading' }
  | { type: 'ready'; draft: SkillDraftResponse }
  | { type: 'error'; message: string };

const EXPANDED_SIDEBAR_WIDTH = 260;
const COLLAPSED_SIDEBAR_WIDTH = 48;

function getRightPanelSelector(rightPanelType: RightPanelType) {
  if (rightPanelType === 'workspace') return '[data-testid="right-panel-workspace"]';
  if (rightPanelType === 'automation') return '[data-testid="right-panel-automation"]';
  return null;
}

export const SkillDraftDetailModal: React.FC<Props> = ({ draftId, onClose }) => {
  const [load, setLoad] = useState<LoadState>({ type: 'loading' });
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [summary, setSummary] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ActivateConflict | null>(null);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [rightPanelInset, setRightPanelInset] = useState(0);

  const isSidebarOpen = useAgentStore((state) => state.isSidebarOpen);
  const rightPanelType = useUiStore((state) => state.rightPanelType);
  const workspaceMaximized = useUiStore((state) => state.workspaceMaximized);
  const upsertCard = useSkillDraftStore((state) => state.upsertDraftCard);
  const markDraftStatus = useSkillDraftStore((state) => state.markDraftStatus);

  const sidebarInset = workspaceMaximized
    ? 0
    : (isSidebarOpen ? EXPANDED_SIDEBAR_WIDTH : COLLAPSED_SIDEBAR_WIDTH);

  useEffect(() => {
    if (!draftId) return;
    let cancelled = false;
    setLoad({ type: 'loading' });
    setSaveError(null);
    setConflict(null);
    void (async () => {
      try {
        const draft = await skillDraftsApi.get(draftId);
        if (cancelled) return;
        let visibleDraft = draft;
        if (draft.status === 'superseded' && draft.skill_id) {
          markDraftStatus(draft.id, 'superseded');
          const activeVersion = await skillDraftsApi.getActiveVersion(draft.skill_id).catch(() => null);
          if (cancelled) return;
          if (activeVersion && activeVersion !== draft.id) {
            visibleDraft = await skillDraftsApi.get(activeVersion);
            if (cancelled) return;
            markDraftStatus(draft.id, 'superseded', { superseded_by_draft_id: activeVersion });
          }
        }
        setLoad({ type: 'ready', draft: visibleDraft });
        setName(visibleDraft.name ?? '');
        setDescription(visibleDraft.description ?? '');
        setSummary(visibleDraft.summary ?? '');
      } catch (e) {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : '加载失败';
        setLoad({ type: 'error', message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [draftId, markDraftStatus]);

  useEffect(() => {
    if (!draftId || workspaceMaximized) {
      setRightPanelInset(0);
      return;
    }

    const selector = getRightPanelSelector(rightPanelType);
    if (!selector) {
      setRightPanelInset(0);
      return;
    }

    const panel = document.querySelector<HTMLElement>(selector);
    if (!panel) {
      setRightPanelInset(0);
      return;
    }

    const updateInset = () => {
      const rect = panel.getBoundingClientRect();
      const nextInset = Math.max(0, window.innerWidth - rect.left);
      setRightPanelInset(nextInset);
    };

    updateInset();
    window.addEventListener('resize', updateInset);

    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(updateInset);
    resizeObserver?.observe(panel);

    return () => {
      window.removeEventListener('resize', updateInset);
      resizeObserver?.disconnect();
    };
  }, [draftId, rightPanelType, workspaceMaximized]);

  if (!draftId) return null;

  const upsertDraftCard = (
    draft: SkillDraftResponse,
    status: SkillDraftResponse['status'],
    autoBoundAgentId?: string,
  ) => {
    const existing = useSkillDraftStore.getState().draftCards.get(draft.id);
    upsertCard({
      draft_id: draft.id,
      draft_type: draft.draft_type,
      skill_id: draft.skill_id,
      name: draft.name,
      description: draft.description,
      summary: draft.summary,
      base_version: draft.base_version,
      status,
      session_id: draft.session_id ?? null,
      created_at: draft.created_at,
      auto_bound_agent_id: autoBoundAgentId,
      response_message_id: existing?.response_message_id ?? null,
      job_id: draft.job_id ?? existing?.job_id ?? null,
    });
  };

  const syncLatestTerminalDraft = async (): Promise<boolean> => {
    try {
      const latest = await skillDraftsApi.get(draftId);
      if (
        latest.status !== 'activated'
        && latest.status !== 'superseded'
        && latest.status !== 'discarded'
        && latest.status !== 'expired'
      ) {
        return false;
      }
      const autoBoundAgentId = latest.status === 'activated' ? latest.agent_id ?? undefined : undefined;
      setLoad({ type: 'ready', draft: latest });
      setName(latest.name ?? '');
      setDescription(latest.description ?? '');
      setSummary(latest.summary ?? '');
      setSaveError(null);
      setConflict(null);
      upsertDraftCard(latest, latest.status, autoBoundAgentId);
      if (latest.status === 'activated' && latest.skill_id) {
        window.dispatchEvent(new CustomEvent('skill-changed', {
          detail: { type: 'skills', skill_id: latest.skill_id, auto_bound_agent_id: autoBoundAgentId },
        }));
      }
      onClose();
      return true;
    } catch {
      return false;
    }
  };

  const handleSave = async (force: boolean = false) => {
    if (load.type !== 'ready') return;
    setSaving(true);
    setSaveError(null);
    setConflict(null);
    try {
      const updated = await skillDraftsApi.update(draftId, { name, description, summary });
      setLoad({ type: 'ready', draft: updated });
      upsertDraftCard(updated, updated.status);

      const activated = await skillDraftsApi.activate(draftId, force);
      if (isActivateConflict(activated)) {
        setConflict(activated);
        return;
      }
      upsertDraftCard(updated, 'activated', activated.auto_bound_agent_id);
      window.dispatchEvent(new CustomEvent('skill-changed', {
        detail: { type: 'skills', skill_id: activated.skill.id, auto_bound_agent_id: activated.auto_bound_agent_id },
      }));
      onClose();
    } catch (e) {
      if (await syncLatestTerminalDraft()) {
        return;
      }
      const message = e instanceof Error ? localizeSkillDraftErrorMessage(e.message) : '保存失败';
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = async () => {
    setDiscarding(true);
    setSaveError(null);
    try {
      await skillDraftsApi.discard(draftId);
      markDraftStatus(draftId, 'discarded');
      setDiscardConfirmOpen(false);
      onClose();
    } catch (e) {
      if (await syncLatestTerminalDraft()) {
        setDiscardConfirmOpen(false);
        return;
      }
      const message = e instanceof Error ? localizeSkillDraftErrorMessage(e.message) : '放弃草稿失败';
      setSaveError(message);
    } finally {
      setDiscarding(false);
    }
  };

  const renderBody = () => {
    if (load.type === 'loading') {
      return <div className="text-sm py-10 text-center" style={{ color: 'var(--text-muted)' }} data-testid="skill-draft-detail-loading">加载中…</div>;
    }
    if (load.type === 'error') {
      return <div className="text-sm py-10 text-center" style={{ color: 'var(--danger)' }} data-testid="skill-draft-detail-error">加载失败:{load.message}</div>;
    }
    const draft = load.draft;
    const isCreate = draft.draft_type === 'create';
    const editLockable = draft.status === 'editing' || draft.status === 'pending';
    const fieldStyle: React.CSSProperties = {
      border: '1px solid var(--border-subtle)',
      background: editLockable ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
      color: editLockable ? 'var(--text-primary)' : 'var(--text-muted)',
    };
    const labelStyle: React.CSSProperties = { color: 'var(--text-secondary)' };
    return (
      <div className="space-y-4">
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
          不满意?关闭后可继续在对话中让智能体优化。
        </div>
        <div data-testid="skill-draft-detail-name-field">
          <label className="block text-xs mb-1" style={labelStyle}>技能名称</label>
          <input
            type="text"
            className="w-full px-2 py-1.5 text-sm rounded"
            style={fieldStyle}
            value={name}
            disabled={!editLockable}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            data-testid="skill-draft-detail-name-input"
          />
        </div>
        <div data-testid="skill-draft-detail-description-field">
          <label className="block text-xs mb-1" style={labelStyle}>描述</label>
          <textarea
            className="w-full px-2 py-1.5 text-sm rounded"
            style={fieldStyle}
            value={description}
            disabled={!editLockable}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            data-testid="skill-draft-detail-description-input"
          />
        </div>
        <div data-testid="skill-draft-detail-summary-field">
          <label className="block text-xs mb-1" style={labelStyle}>变更摘要</label>
          <textarea
            className="w-full px-2 py-1.5 text-sm rounded"
            style={fieldStyle}
            value={summary}
            disabled={!editLockable}
            onChange={(e) => setSummary(e.target.value)}
            rows={4}
            data-testid="skill-draft-detail-summary-input"
          />
        </div>
        {!editLockable && (
          <div className="text-xs" style={{ color: 'var(--text-muted)' }} data-testid="skill-draft-detail-readonly-note">
            草稿状态为 {draft.status},不可再修改元数据。
          </div>
        )}
        <div className="text-xs" style={{ color: 'var(--text-muted)' }} data-testid="skill-draft-detail-file-note">
          技能文件 (SKILL.md / scripts / references) 的修改请回到对话中让智能体调整,
          本弹窗不支持文件级编辑。
        </div>
        {conflict && (
          <div
            className="rounded p-3 text-sm"
            data-testid="skill-draft-detail-conflict"
            style={{
              border: '1px solid var(--danger-border-soft)',
              background: 'var(--danger-bg-soft)',
              color: 'var(--danger)',
            }}
          >
            <div className="font-medium">
              {conflict.conflict_type === 'draft_overwrite' ? '草稿覆盖提醒' : '版本冲突'}
            </div>
            <div className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>
              {conflict.conflict_type === 'draft_overwrite'
                ? `该技能还有 ${conflict.overwritten_drafts?.length ?? 1} 个未发布草稿,发布后会覆盖。`
                : `当前版本 ${conflict.current_version},草稿基于版本 ${conflict.base_version}。`}
              {conflict.last_updated_by && ` 最近编辑者:${conflict.last_updated_by}。`}
            </div>
          </div>
        )}
        <div className="text-xs" style={{ color: 'var(--text-muted)' }} data-testid="skill-draft-detail-meta">
          类型:{isCreate ? '新建' : '编辑'} · 草稿 ID:{draft.id}
          {draft.skill_id && ` · 技能 ID:${draft.skill_id}`}
        </div>
        {saveError && <div className="text-xs" style={{ color: 'var(--danger)' }} data-testid="skill-draft-detail-save-error">{saveError}</div>}
      </div>
    );
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[200]"
      data-testid="skill-draft-detail-backdrop"
      style={{
        background: 'var(--modal-backdrop)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: sidebarInset,
          right: rightPanelInset,
          padding: 24,
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 0,
          pointerEvents: 'none',
        }}
        data-testid="skill-draft-detail-frame"
      >
        <div
          role="dialog"
          aria-modal="true"
          className="w-full"
          data-testid="skill-draft-detail-dialog"
          style={{
            maxWidth: 720,
            maxHeight: 'calc(100vh - 48px)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRadius: 12,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-lg)',
            pointerEvents: 'auto',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="flex items-center justify-between"
            data-testid="skill-draft-detail-header"
            style={{
              flexShrink: 0,
              padding: '18px 20px',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <div className="text-base font-semibold" data-testid="skill-draft-detail-title">
              {load.type === 'ready' ? load.draft.name || '技能草稿' : '技能草稿'}
              <span
                className="ml-2 px-1.5 py-0.5 text-xs rounded align-middle"
                data-testid="skill-draft-detail-badge"
                style={{
                  color: 'var(--info)',
                  background: 'var(--info-bg-soft)',
                  border: '1px solid var(--info-border-soft)',
                }}
              >
                草稿
              </span>
            </div>
            <button
              type="button"
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
              onClick={onClose}
              aria-label="关闭"
              data-testid="skill-draft-detail-close"
            >
              ✕
            </button>
          </div>
          <div
            data-testid="skill-draft-detail-body"
            style={{
              minHeight: 0,
              overflowY: 'auto',
              padding: 20,
            }}
          >
            {renderBody()}
          </div>
          <div
            className="flex justify-between gap-2"
            data-testid="skill-draft-detail-footer"
            style={{
              flexShrink: 0,
              padding: '14px 20px',
              borderTop: '1px solid var(--border-subtle)',
              background: 'var(--bg-secondary)',
            }}
          >
            <button
              type="button"
              className="px-3 py-1.5 text-sm rounded disabled:opacity-50"
              data-testid="skill-draft-detail-discard"
              style={{
                border: '1px solid var(--danger-border-soft)',
                color: 'var(--danger)',
                background: 'var(--danger-bg-soft)',
              }}
              onClick={() => setDiscardConfirmOpen(true)}
              disabled={
                saving
                || discarding
                || load.type !== 'ready'
                || (load.type === 'ready'
                  && load.draft.status !== 'editing'
                  && load.draft.status !== 'pending')
              }
            >
              放弃草稿
            </button>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="px-3 py-1.5 text-sm rounded"
                data-testid="skill-draft-detail-cancel"
                style={{
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-secondary)',
                }}
                onClick={onClose}
                disabled={saving}
              >
                取消
              </button>
              <button
                type="button"
                className="px-3 py-1.5 text-sm rounded disabled:opacity-50"
                data-testid="skill-draft-detail-save"
                style={{
                  border: '1px solid var(--btn-primary-bg)',
                  background: 'var(--btn-primary-bg)',
                  color: 'var(--btn-primary-text)',
                }}
                onClick={() => void handleSave(conflict !== null)}
                disabled={
                  saving
                  || load.type !== 'ready'
                  || (load.type === 'ready'
                    && load.draft.status !== 'editing'
                    && load.draft.status !== 'pending')
                }
              >
                {saving ? '保存中…' : conflict ? '覆盖保存' : '保存'}
              </button>
            </div>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={discardConfirmOpen}
        title="放弃技能草稿"
        description={`确认放弃草稿「${name || '未命名技能'}」？放弃后不能再保存这版内容。`}
        confirmText={discarding ? '放弃中...' : '放弃'}
        variant="danger"
        onConfirm={() => {
          if (!discarding) void handleDiscard();
        }}
        onCancel={() => {
          if (!discarding) setDiscardConfirmOpen(false);
        }}
      />
    </div>,
    document.body,
  );
};
