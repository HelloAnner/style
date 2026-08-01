/**
 * AI 技能创建器 — 草稿审核卡片。
 *
 * 触发条件：Kernel 推送 `skill_draft.ready` 运行时事件后,由对话页草稿卡片条渲染。
 * 状态机：pending → confirming → activating → activated / conflict / superseded / discarded。
 *
 * PRD 依据：
 * - §2.1 路径 A（二次确认弹窗）
 * - §2.2 + §4（create 与 edit 模式保存后启用当前智能体）
 * - §3（详情弹窗按钮文案统一为"保存"）
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  isActivateConflict,
  localizeSkillDraftErrorMessage,
  skillDraftsApi,
  type ActivateConflict,
  type SkillDraftResponse,
  type SkillDraftType,
} from '../../api/skillDrafts';
import { ConfirmDialog } from '../common/ConfirmDialog';
import {
  CheckIcon,
  ErrorIcon,
  EyeIcon,
  LoadingIcon,
  SaveIcon,
  SkillIcon,
  TrashIcon,
} from '../common/Icons';

const TERMINAL_SYNC_POLL_MS = 5000;

export interface SkillDraftCardData {
  draft_id: string;
  draft_type: SkillDraftType;
  skill_id: string | null;
  name: string;
  description: string | null;
  summary: string | null;
  base_version: number | null;
  status: SkillDraftResponse['status'];
  /** 当前草稿被新草稿替代时,指向最新草稿 ID,用于已更新卡片打开最新详情。 */
  superseded_by_draft_id?: string | null;
  /** 当前草稿被谁的新草稿替代,用于提示管理员这版已经作废。 */
  superseded_by_display_name?: string | null;
  /** 当前草稿创建者展示名。 */
  created_by_name?: string | null;
  /** 激活后 Platform 返回的自动绑定 Agent ID。 */
  auto_bound_agent_id?: string;
}

type CardState =
  | { type: 'pending' }
  | { type: 'confirming' }
  | { type: 'activating' }
  | { type: 'activated'; agentId?: string; renamedFrom?: string; finalName?: string }
  | { type: 'conflict'; conflict: ActivateConflict }
  | { type: 'superseded' }
  | { type: 'discarded' }
  | { type: 'expired' };

interface Props {
  data: SkillDraftCardData;
  /** 已恢复的卡片(刷新页面后从 listBySession 注入),跳过初始 pending 弹窗动画。 */
  restored?: boolean;
  onViewDetail?: (draftId: string) => void;
  onViewExistingSkill?: (skillId: string) => void;
  /** 状态机推进时回调,通常由消费方写入 skillDraftStore 让刷新后能正确恢复。 */
  onStatusChange?: (
    status: SkillDraftCardData['status'],
    extra?: Partial<SkillDraftCardData>,
  ) => void;
}

function deriveInitialState(data: SkillDraftCardData): CardState {
  switch (data.status) {
    case 'activated':
      return { type: 'activated', agentId: data.auto_bound_agent_id };
    case 'superseded':
      return { type: 'superseded' };
    case 'discarded':
      return { type: 'discarded' };
    case 'expired':
      return { type: 'expired' };
    case 'pending':
    default:
      return { type: 'pending' };
  }
}

function getStatusTone(type: CardState['type']): 'info' | 'success' | 'warning' | 'danger' | 'muted' {
  if (type === 'activated') return 'success';
  if (type === 'conflict') return 'danger';
  if (type === 'superseded') return 'warning';
  if (type === 'discarded' || type === 'expired') return 'muted';
  return 'info';
}

function getStatusLabel(type: CardState['type'], draftStatusLabel: string): string {
  switch (type) {
    case 'activated':
      return '已保存并启用';
    case 'conflict':
      return '待处理冲突';
    case 'superseded':
      return '已作废';
    case 'discarded':
      return '已放弃草稿';
    case 'expired':
      return '已过期';
    case 'activating':
      return '保存中';
    case 'confirming':
    case 'pending':
    default:
      return draftStatusLabel;
  }
}

export const SkillDraftCard: React.FC<Props> = ({
  data,
  onViewDetail,
  onViewExistingSkill,
  onStatusChange,
}) => {
  const [state, setState] = useState<CardState>(() => deriveInitialState(data));
  const [error, setError] = useState<string | null>(null);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const onStatusChangeRef = useRef(onStatusChange);

  useEffect(() => {
    setState(deriveInitialState(data));
  }, [data.status, data.auto_bound_agent_id]);

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  const isCreate = data.draft_type === 'create';
  const draftStatusLabel = isCreate ? '新建审核中' : '编辑审核中';

  const handlePrimary = () => {
    setError(null);
    setState({ type: 'confirming' });
  };

  const handleConfirmCancel = () => setState({ type: 'pending' });

  const resolveLatestDraftId = async (latest: SkillDraftResponse): Promise<string | null> => {
    if (latest.status === 'activated') {
      return latest.id;
    }
    if (latest.status !== 'superseded' || !latest.skill_id) {
      return null;
    }
    try {
      const activeVersion = await skillDraftsApi.getActiveVersion(latest.skill_id);
      return activeVersion && activeVersion !== latest.id ? activeVersion : null;
    } catch {
      return null;
    }
  };

  const applyLatestTerminalStatus = async (latest: SkillDraftResponse): Promise<boolean> => {
    if (
      latest.status !== 'activated'
      && latest.status !== 'superseded'
      && latest.status !== 'discarded'
      && latest.status !== 'expired'
    ) {
      return false;
    }
    const agentId = latest.status === 'activated' ? latest.agent_id ?? undefined : undefined;
    const supersededByDraftId = latest.status === 'superseded'
      ? await resolveLatestDraftId(latest)
      : data.superseded_by_draft_id ?? null;
    setError(null);
    setState(deriveInitialState({
      ...data,
      status: latest.status,
      auto_bound_agent_id: agentId,
      superseded_by_draft_id: supersededByDraftId ?? data.superseded_by_draft_id ?? null,
    }));
    const extra: Partial<SkillDraftCardData> = { auto_bound_agent_id: agentId };
    if (latest.status === 'superseded') {
      extra.superseded_by_draft_id = supersededByDraftId ?? data.superseded_by_draft_id ?? null;
    }
    onStatusChangeRef.current?.(latest.status, extra);
    return true;
  };

  const syncLatestTerminalStatus = async (): Promise<boolean> => {
    try {
      const latest = await skillDraftsApi.get(data.draft_id);
      return await applyLatestTerminalStatus(latest);
    } catch {
      return false;
    }
  };

  useEffect(() => {
    if (data.status !== 'pending' && data.status !== 'editing') return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const syncOnce = async () => {
      if (cancelled) return;
      const terminal = await syncLatestTerminalStatus();
      if (!cancelled && !terminal) {
        timer = setTimeout(syncOnce, TERMINAL_SYNC_POLL_MS);
      }
    };

    void syncOnce();

    return () => {
      cancelled = true;
      if (timer !== null) {
        clearTimeout(timer);
      }
    };
  }, [
    data.draft_id,
    data.skill_id,
    data.status,
    data.superseded_by_draft_id,
  ]);

  const handleViewLatest = async () => {
    if (data.superseded_by_draft_id || !data.skill_id) {
      onViewDetail?.(data.superseded_by_draft_id ?? data.draft_id);
      return;
    }
    try {
      const activeVersion = await skillDraftsApi.getActiveVersion(data.skill_id);
      onViewDetail?.(activeVersion && activeVersion !== data.draft_id ? activeVersion : data.draft_id);
    } catch {
      onViewDetail?.(data.draft_id);
    }
  };

  const handleConfirm = async (force: boolean = false) => {
    setError(null);
    setState({ type: 'activating' });
    try {
      const result = await skillDraftsApi.activate(data.draft_id, force);
      if (isActivateConflict(result)) {
        setState({ type: 'conflict', conflict: result });
        return;
      }
      const agentId = result.auto_bound_agent_id;
      setState({
        type: 'activated',
        agentId,
        renamedFrom: result.auto_renamed_from,
        finalName: result.skill.name,
      });
      onStatusChange?.('activated', { auto_bound_agent_id: agentId });
      window.dispatchEvent(new CustomEvent('skill-changed', {
        detail: { type: 'skills', skill_id: result.skill.id, auto_bound_agent_id: agentId },
      }));
    } catch (e) {
      if (await syncLatestTerminalStatus()) {
        return;
      }
      const message = e instanceof Error ? localizeSkillDraftErrorMessage(e.message) : '激活失败';
      setError(message);
      setState({ type: 'pending' });
    }
  };

  const handleDiscard = async () => {
    setDiscarding(true);
    setError(null);
    try {
      await skillDraftsApi.discard(data.draft_id);
      setState({ type: 'discarded' });
      onStatusChange?.('discarded');
      setDiscardConfirmOpen(false);
    } catch (e) {
      if (await syncLatestTerminalStatus()) {
        setDiscardConfirmOpen(false);
        return;
      }
      const message = e instanceof Error ? localizeSkillDraftErrorMessage(e.message) : '放弃草稿失败';
      setError(message);
    } finally {
      setDiscarding(false);
    }
  };

  // ── 公共头部:技能名称 + 摘要 ──
  const renderSummary = () => (
    <div className="skill-draft-card__header" data-testid={`skill-draft-card-header-${data.draft_id}`}>
      <div className="skill-draft-card__icon" aria-hidden="true">
        <SkillIcon size={16} />
      </div>
      <div className="skill-draft-card__titleBlock">
        <div className="skill-draft-card__titleRow">
          <span className="skill-draft-card__title" data-testid={`skill-draft-card-title-${data.draft_id}`}>{data.name || '未命名技能'}</span>
          <span className="skill-draft-card__status" data-tone={getStatusTone(state.type)} data-testid={`skill-draft-card-status-${data.draft_id}`}>
            {getStatusLabel(state.type, draftStatusLabel)}
          </span>
        </div>
        {data.summary && (
          <div className="skill-draft-card__summary" data-testid={`skill-draft-card-summary-${data.draft_id}`}>{data.summary}</div>
        )}
      </div>
    </div>
  );

  // ── 各状态渲染 ──
  const renderPending = () => (
    <div className="skill-draft-card__body" data-testid={`skill-draft-card-body-pending-${data.draft_id}`}>
      {renderSummary()}
      {error && <div className="skill-draft-card__message" data-tone="danger" data-testid={`skill-draft-card-error-${data.draft_id}`}>{error}</div>}
      <div className="skill-draft-card__actions" data-testid={`skill-draft-card-actions-${data.draft_id}`}>
        <button
          type="button"
          className="skill-draft-card__button"
          onClick={() => onViewDetail?.(data.draft_id)}
          disabled={discarding}
          data-testid={`skill-draft-card-view-detail-${data.draft_id}`}
        >
          <EyeIcon size={14} />
          查看详情
        </button>
        <button
          type="button"
          className="skill-draft-card__button skill-draft-card__button--danger"
          onClick={() => setDiscardConfirmOpen(true)}
          disabled={discarding}
          data-testid={`skill-draft-card-discard-${data.draft_id}`}
        >
          <TrashIcon size={14} />
          放弃草稿
        </button>
        <button
          type="button"
          className="skill-draft-card__button skill-draft-card__button--primary"
          onClick={handlePrimary}
          disabled={discarding}
          data-testid={`skill-draft-card-save-enable-${data.draft_id}`}
        >
          <SaveIcon size={14} />
          保存并启用
        </button>
      </div>
    </div>
  );

  const renderConfirming = () => {
    const confirmCopy = isCreate
      ? '技能将保存并在当前智能体启用。'
      : '技能将更新并在当前智能体启用,所有已启用该技能的智能体也将使用新内容。';
    return (
      <div className="skill-draft-card__body" data-testid={`skill-draft-card-body-confirming-${data.draft_id}`}>
        {renderSummary()}
        <div className="skill-draft-card__notice" data-tone="warning" data-testid={`skill-draft-card-confirm-notice-${data.draft_id}`}>
          <div className="skill-draft-card__noticeTitle" data-testid={`skill-draft-card-confirm-title-${data.draft_id}`}>确认保存技能</div>
          <div className="skill-draft-card__noticeText">{confirmCopy}</div>
          <div className="skill-draft-card__actions skill-draft-card__actions--end">
            <button
              type="button"
              className="skill-draft-card__button"
              onClick={handleConfirmCancel}
              data-testid={`skill-draft-card-confirm-cancel-${data.draft_id}`}
            >
              取消
            </button>
            <button
              type="button"
              className="skill-draft-card__button skill-draft-card__button--primary"
              onClick={() => handleConfirm(false)}
              data-testid={`skill-draft-card-confirm-save-${data.draft_id}`}
            >
              <SaveIcon size={14} />
              确认 →
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderActivating = () => (
    <div className="skill-draft-card__body" data-testid={`skill-draft-card-body-activating-${data.draft_id}`}>
      {renderSummary()}
      <div className="skill-draft-card__message" data-testid={`skill-draft-card-message-${data.draft_id}`}>
        <LoadingIcon size={14} />
        保存中…
      </div>
    </div>
  );

  const renderActivated = (agentId?: string, renamedFrom?: string, finalName?: string) => {
    const copy = renamedFrom && finalName
      ? `原名「${renamedFrom}」已被占用，已保存为「${finalName}」并启用${agentId ? '到当前智能体' : ''}`
      : agentId ? '已保存并启用到当前智能体' : '已保存并启用';
    return (
      <div className="skill-draft-card__body" data-testid={`skill-draft-card-body-activated-${data.draft_id}`}>
        {renderSummary()}
        <div className="skill-draft-card__message" data-tone="success" data-testid={`skill-draft-card-message-${data.draft_id}`}>
          <CheckIcon size={14} />
          {copy}
        </div>
      </div>
    );
  };

  const renderConflict = (conflict: ActivateConflict) => {
    if (conflict.conflict_type === 'name_duplicate') {
      const existingName = conflict.existing_skill_name || data.name || '同名技能';
      const suggestedName = conflict.suggested_name || `${data.name || '新技能'}-2`;
      return (
        <div className="skill-draft-card__body" data-testid={`skill-draft-card-body-conflict-${data.draft_id}`}>
          {renderSummary()}
          <div className="skill-draft-card__notice" data-tone="warning" data-testid={`skill-draft-card-conflict-notice-${data.draft_id}`}>
            <div className="skill-draft-card__noticeTitle" data-testid={`skill-draft-card-conflict-title-${data.draft_id}`}>
              <ErrorIcon size={14} />
              名称重复
            </div>
            <div className="skill-draft-card__noticeText">
              已存在技能 <strong>「{existingName}」</strong>。可查看已有技能、修改当前草稿名称,
              或确认创建新技能；确认后系统将保存为 <strong>「{suggestedName}」</strong>。
            </div>
            <div className="skill-draft-card__actions skill-draft-card__actions--end">
              <button
                type="button"
                className="skill-draft-card__button"
                onClick={() => {
                  if (conflict.existing_skill_id) {
                    onViewExistingSkill?.(conflict.existing_skill_id);
                  }
                  window.dispatchEvent(new CustomEvent('skill-changed', {
                    detail: {
                      type: 'skills',
                      skill_id: conflict.existing_skill_id,
                      focus_skill_id: conflict.existing_skill_id,
                    },
                  }));
                }}
                data-testid={`skill-draft-card-view-existing-${data.draft_id}`}
              >
                查看已有技能
              </button>
              <button
                type="button"
                className="skill-draft-card__button"
                onClick={() => onViewDetail?.(data.draft_id)}
                data-testid={`skill-draft-card-edit-name-${data.draft_id}`}
              >
                修改名称
              </button>
              <button
                type="button"
                className="skill-draft-card__button skill-draft-card__button--primary"
                onClick={() => handleConfirm(true)}
                data-testid={`skill-draft-card-use-suggested-name-${data.draft_id}`}
              >
                使用建议名称创建
              </button>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="skill-draft-card__body" data-testid={`skill-draft-card-body-conflict-${data.draft_id}`}>
        {renderSummary()}
        <div className="skill-draft-card__notice" data-tone="danger" data-testid={`skill-draft-card-conflict-notice-${data.draft_id}`}>
          <div className="skill-draft-card__noticeTitle" data-testid={`skill-draft-card-conflict-title-${data.draft_id}`}>
            <ErrorIcon size={14} />
            {conflict.conflict_type === 'draft_overwrite' ? '草稿覆盖提醒' : '版本冲突'}
          </div>
          <div className="skill-draft-card__noticeText">
            {conflict.conflict_type === 'draft_overwrite' ? (
              <>
                该技能还有 <strong>{conflict.overwritten_drafts?.length ?? 1}</strong> 个未发布草稿,
                发布后会覆盖这些草稿。最近编辑者:
                <strong>{conflict.last_updated_by || '其他人'}</strong>。
              </>
            ) : (
              <>
                技能已被 <strong>{conflict.last_updated_by || '其他人'}</strong> 更新
                (当前版本 {conflict.current_version},你基于版本 {conflict.base_version})。
              </>
            )}
          </div>
          <div className="skill-draft-card__actions skill-draft-card__actions--end">
            <button
              type="button"
              className="skill-draft-card__button"
              onClick={() => setState({ type: 'pending' })}
              data-testid={`skill-draft-card-conflict-cancel-${data.draft_id}`}
            >
              取消
            </button>
            <button
              type="button"
              className="skill-draft-card__button skill-draft-card__button--dangerPrimary"
              onClick={() => handleConfirm(true)}
              data-testid={`skill-draft-card-conflict-overwrite-${data.draft_id}`}
            >
              覆盖
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderSuperseded = () => (
    <div className="skill-draft-card__body is-muted" data-testid={`skill-draft-card-body-superseded-${data.draft_id}`}>
      {renderSummary()}
      <div className="skill-draft-card__message" data-tone="warning" data-testid={`skill-draft-card-message-${data.draft_id}`}>
        {data.superseded_by_display_name
          ? `此技能已被${data.superseded_by_display_name}更新，此草稿已经作废`
          : '此技能已被其他管理员更新，此草稿已经作废'}
      </div>
      <div className="skill-draft-card__actions">
        <button
          type="button"
          className="skill-draft-card__button"
          onClick={() => void handleViewLatest()}
          data-testid={`skill-draft-card-view-latest-${data.draft_id}`}
        >
          <EyeIcon size={14} />
          查看详情
        </button>
      </div>
    </div>
  );

  const renderDiscarded = () => (
    <div className="skill-draft-card__body is-muted" data-testid={`skill-draft-card-body-discarded-${data.draft_id}`}>
      {renderSummary()}
      <div className="skill-draft-card__message" data-testid={`skill-draft-card-message-${data.draft_id}`}>已放弃</div>
    </div>
  );

  const renderExpired = () => (
    <div className="skill-draft-card__body is-muted" data-testid={`skill-draft-card-body-expired-${data.draft_id}`}>
      {renderSummary()}
      <div className="skill-draft-card__message" data-testid={`skill-draft-card-message-${data.draft_id}`}>草稿已过期</div>
    </div>
  );

  // ── 状态分发 ──
  let body: React.ReactNode;
  switch (state.type) {
    case 'pending':
      body = renderPending();
      break;
    case 'confirming':
      body = renderConfirming();
      break;
    case 'activating':
      body = renderActivating();
      break;
    case 'activated':
      body = renderActivated(state.agentId, state.renamedFrom, state.finalName);
      break;
    case 'conflict':
      body = renderConflict(state.conflict);
      break;
    case 'superseded':
      body = renderSuperseded();
      break;
    case 'discarded':
      body = renderDiscarded();
      break;
    case 'expired':
      body = renderExpired();
      break;
  }

  return (
    <>
      <div className="skill-draft-card" data-testid={`skill-draft-card-${data.draft_id}`}>{body}</div>
      <ConfirmDialog
        open={discardConfirmOpen}
        title="放弃技能草稿"
        description={`确认放弃草稿「${data.name || '未命名技能'}」？放弃后不能再保存这版内容。`}
        confirmText={discarding ? '放弃中...' : '放弃'}
        variant="danger"
        onConfirm={() => {
          if (!discarding) void handleDiscard();
        }}
        onCancel={() => {
          if (!discarding) setDiscardConfirmOpen(false);
        }}
      />
      <style>{`
        .skill-draft-card {
          width: 100%;
          overflow: hidden;
          border-radius: 8px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-subtle);
        }
        .skill-draft-card__body {
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .skill-draft-card__body.is-muted {
          opacity: 0.72;
        }
        .skill-draft-card__header {
          display: flex;
          gap: 10px;
          min-width: 0;
        }
        .skill-draft-card__icon {
          width: 30px;
          height: 30px;
          border-radius: 8px;
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: var(--questionnaire-element-text);
          background: var(--questionnaire-element-bg);
        }
        .skill-draft-card__titleBlock {
          min-width: 0;
          flex: 1;
        }
        .skill-draft-card__titleRow {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
          flex-wrap: wrap;
        }
        .skill-draft-card__title {
          font-size: 14px;
          line-height: 20px;
          font-weight: 600;
          color: var(--text-primary);
          overflow-wrap: anywhere;
        }
        .skill-draft-card__status {
          display: inline-flex;
          align-items: center;
          min-height: 22px;
          padding: 0 8px;
          border-radius: 999px;
          font-size: 12px;
          line-height: 18px;
          font-weight: 500;
          border: 1px solid var(--info-border-soft);
          color: var(--text-secondary);
          background: var(--info-bg-soft);
        }
        .skill-draft-card__status[data-tone="success"] {
          color: var(--success);
          background: var(--success-bg-soft);
          border-color: var(--success-border-soft);
        }
        .skill-draft-card__status[data-tone="warning"] {
          color: var(--warning);
          background: var(--warning-bg-soft);
          border-color: var(--warning-border-soft);
        }
        .skill-draft-card__status[data-tone="danger"] {
          color: var(--danger);
          background: var(--danger-bg-soft);
          border-color: var(--danger-border-soft);
        }
        .skill-draft-card__status[data-tone="muted"] {
          color: var(--text-muted);
          background: var(--bg-secondary);
          border-color: var(--border-subtle);
        }
        .skill-draft-card__summary {
          margin-top: 6px;
          font-size: 13px;
          line-height: 20px;
          color: var(--text-secondary);
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }
        .skill-draft-card__actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .skill-draft-card__actions--end {
          justify-content: flex-end;
        }
        .skill-draft-card__button {
          min-height: 32px;
          padding: 0 12px;
          border-radius: 8px;
          border: 1px solid var(--border-subtle);
          background: var(--bg-secondary);
          color: var(--text-secondary);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 120ms ease, color 120ms ease, border-color 120ms ease, opacity 120ms ease;
        }
        .skill-draft-card__button:hover:not(:disabled) {
          background: var(--hover-bg);
          color: var(--text-primary);
        }
        .skill-draft-card__button:disabled {
          cursor: default;
          opacity: 0.55;
        }
        .skill-draft-card__button--primary {
          background: var(--btn-mono-bg);
          color: var(--btn-mono-text);
          border-color: var(--btn-mono-bg);
        }
        .skill-draft-card__button--primary:hover:not(:disabled) {
          background: var(--btn-mono-hover-bg);
          color: var(--btn-mono-text);
        }
        .skill-draft-card__button--danger {
          color: var(--danger);
        }
        .skill-draft-card__button--dangerPrimary {
          color: var(--danger);
          background: var(--danger-bg-soft);
          border-color: var(--danger-border-soft);
        }
        .skill-draft-card__notice {
          border-radius: 8px;
          border: 1px solid var(--warning-border-soft);
          background: var(--warning-bg-soft);
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .skill-draft-card__notice[data-tone="danger"] {
          border-color: var(--danger-border-soft);
          background: var(--danger-bg-soft);
        }
        .skill-draft-card__noticeTitle {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          line-height: 18px;
          font-weight: 600;
          color: var(--text-primary);
        }
        .skill-draft-card__noticeText {
          font-size: 13px;
          line-height: 20px;
          color: var(--text-secondary);
        }
        .skill-draft-card__message {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          line-height: 20px;
          color: var(--text-muted);
        }
        .skill-draft-card__message[data-tone="success"] {
          color: var(--success);
        }
        .skill-draft-card__message[data-tone="warning"] {
          color: var(--warning);
        }
        .skill-draft-card__message[data-tone="danger"] {
          color: var(--danger);
        }
      `}</style>
    </>
  );
};
