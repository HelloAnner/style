/**
 * AI 技能创建器 — 删除确认卡片。
 *
 * 触发条件:Kernel skill_delete_prepare Tool 推送 `skill_delete.confirm_request` 事件后,
 * 在 ActionFeed 中渲染。用户点击 "确认删除" 后,前端直接调 Platform delete-with-unbind API。
 */

import React, { useState } from 'react';
import { skillDeleteApi, skillDeleteConfirmationsApi } from '../../api/skillDrafts';
import { CheckIcon, ErrorIcon, LoadingIcon, SkillIcon, TrashIcon } from '../common/Icons';

export interface SkillDeleteCardData {
  skill_id: string;
  skill_name: string;
  has_active_bindings: boolean;
  bindings: Array<{ agent_id: string; agent_name: string; binding_state: string }>;
  status?: 'confirm' | 'completed' | 'cancelled';
  /**
   * Platform 持久化的删除确认记录 id;前端「确认删除」/「取消」后调
   * {@link skillDeleteConfirmationsApi.resolve} 写回终态,避免 RuntimeEvent
   * 历史重放在刷新后把卡片复活为待确认。
   */
  confirmation_id?: string;
}

interface Props {
  data: SkillDeleteCardData;
  /** 终态回调,由消费方同步 store 中的删除卡片状态。 */
  onTerminated?: (state: 'completed' | 'cancelled') => void;
}

type CardState = 'confirm' | 'deleting' | 'completed' | 'cancelled';

/**
 * resolve 失败不影响主流程,仅打 warn;后续刷新时若仍残留 pending 卡片,
 * 前端 bridge 会基于 skill 已被软删的事实再做兜底。
 */
async function resolveConfirmationStatus(
  confirmationId: string | undefined,
  status: 'completed' | 'cancelled',
): Promise<void> {
  if (!confirmationId) return;
  try {
    await skillDeleteConfirmationsApi.resolve(confirmationId, status);
  } catch (err) {
    console.warn('[SkillDeleteCard] resolve confirmation failed', {
      confirmationId,
      status,
      err,
    });
  }
}

export const SkillDeleteCard: React.FC<Props> = ({ data, onTerminated }) => {
  const [state, setState] = useState<CardState>(data.status ?? 'confirm');
  const [error, setError] = useState<string | null>(null);
  const activeBindings = data.bindings.filter((binding) => binding.binding_state === 'enabled');

  const handleConfirm = async () => {
    setError(null);
    setState('deleting');
    try {
      await skillDeleteApi.deleteWithUnbind(data.skill_id);
      await resolveConfirmationStatus(data.confirmation_id, 'completed');
      setState('completed');
      window.dispatchEvent(new CustomEvent('skill-changed', {
        detail: { type: 'skills', skill_id: data.skill_id },
      }));
      onTerminated?.('completed');
    } catch (e) {
      const message = e instanceof Error ? e.message : '删除失败';
      setError(message);
      setState('confirm');
    }
  };

  const handleCancel = () => {
    void resolveConfirmationStatus(data.confirmation_id, 'cancelled');
    setState('cancelled');
    onTerminated?.('cancelled');
  };

  const renderHeader = () => (
    <div className="skill-delete-card__header" data-testid={`skill-delete-card-header-${data.skill_id}`}>
      <div className="skill-delete-card__icon" aria-hidden="true">
        <SkillIcon size={16} />
      </div>
      <div className="skill-delete-card__titleBlock">
        <div className="skill-delete-card__title" data-testid={`skill-delete-card-title-${data.skill_id}`}>删除技能:{data.skill_name}</div>
      </div>
    </div>
  );

  const renderBindings = () => {
    if (activeBindings.length === 0) {
      return <div className="skill-delete-card__text" data-testid={`skill-delete-card-no-bindings-${data.skill_id}`}>该技能未绑定任何智能体。</div>;
    }
    return (
      <div className="skill-delete-card__text" data-testid={`skill-delete-card-bindings-${data.skill_id}`}>
        <div>删除后将自动解绑以下 {activeBindings.length} 个智能体:</div>
        <ul className="skill-delete-card__list">
          {activeBindings.map((b) => (
            <li
              key={b.agent_id}
              className="skill-delete-card__binding"
              data-testid={`skill-delete-card-binding-${data.skill_id}-${b.agent_id}`}
            >
              {b.agent_name || b.agent_id}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  if (state === 'completed') {
    return (
      <div className="skill-delete-card" data-testid={`skill-delete-card-${data.skill_id}`}>
        {renderHeader()}
        <div className="skill-delete-card__message" data-tone="success" data-testid={`skill-delete-card-message-${data.skill_id}`}>
          <CheckIcon size={14} />
          已删除
        </div>
        <SkillDeleteCardStyles />
      </div>
    );
  }

  if (state === 'cancelled') {
    return (
      <div className="skill-delete-card is-muted" data-testid={`skill-delete-card-${data.skill_id}`}>
        {renderHeader()}
        <div className="skill-delete-card__message" data-testid={`skill-delete-card-message-${data.skill_id}`}>已取消操作</div>
        <SkillDeleteCardStyles />
      </div>
    );
  }

  return (
    <div className="skill-delete-card" data-testid={`skill-delete-card-${data.skill_id}`}>
      {renderHeader()}
      {renderBindings()}
      <div className="skill-delete-card__notice" data-testid={`skill-delete-card-notice-${data.skill_id}`}>
        <ErrorIcon size={14} />
        此操作不可恢复,删除后技能将从所有智能体解除绑定。
      </div>
      {error && <div className="skill-delete-card__message" data-tone="danger" data-testid={`skill-delete-card-error-${data.skill_id}`}>{error}</div>}
      <div className="skill-delete-card__actions" data-testid={`skill-delete-card-actions-${data.skill_id}`}>
        <button
          type="button"
          disabled={state === 'deleting'}
          className="skill-delete-card__button"
          onClick={handleCancel}
          data-testid={`skill-delete-card-cancel-${data.skill_id}`}
        >
          取消
        </button>
        <button
          type="button"
          disabled={state === 'deleting'}
          className="skill-delete-card__button skill-delete-card__button--danger"
          onClick={handleConfirm}
          data-testid={`skill-delete-card-confirm-${data.skill_id}`}
        >
          {state === 'deleting' ? <LoadingIcon size={14} /> : <TrashIcon size={14} />}
          {state === 'deleting' ? '删除中…' : '确认删除'}
        </button>
      </div>
      <SkillDeleteCardStyles />
    </div>
  );
};

const SkillDeleteCardStyles: React.FC = () => (
  <style>{`
    .skill-delete-card {
      width: 100%;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      overflow: hidden;
      border-radius: 8px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-subtle);
    }
    .skill-delete-card.is-muted {
      opacity: 0.72;
    }
    .skill-delete-card__header {
      display: flex;
      gap: 10px;
      min-width: 0;
    }
    .skill-delete-card__icon {
      width: 30px;
      height: 30px;
      border-radius: 8px;
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--danger);
      background: var(--danger-bg-soft);
    }
    .skill-delete-card__titleBlock {
      min-width: 0;
      flex: 1;
    }
    .skill-delete-card__title {
      font-size: 14px;
      line-height: 20px;
      font-weight: 600;
      color: var(--text-primary);
      overflow-wrap: anywhere;
    }
    .skill-delete-card__text {
      font-size: 13px;
      line-height: 20px;
      color: var(--text-secondary);
    }
    .skill-delete-card__list {
      margin: 6px 0 0;
      padding-left: 18px;
      color: var(--text-secondary);
    }
    .skill-delete-card__muted {
      margin-left: 4px;
      font-size: 12px;
      color: var(--text-muted);
    }
    .skill-delete-card__notice {
      display: flex;
      align-items: center;
      gap: 6px;
      border-radius: 8px;
      padding: 10px 12px;
      font-size: 13px;
      line-height: 20px;
      color: var(--danger);
      background: var(--danger-bg-soft);
      border: 1px solid var(--danger-border-soft);
    }
    .skill-delete-card__message {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      line-height: 20px;
      color: var(--text-muted);
    }
    .skill-delete-card__message[data-tone="success"] {
      color: var(--success);
    }
    .skill-delete-card__message[data-tone="danger"] {
      color: var(--danger);
    }
    .skill-delete-card__actions {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .skill-delete-card__button {
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
    .skill-delete-card__button:hover:not(:disabled) {
      background: var(--hover-bg);
      color: var(--text-primary);
    }
    .skill-delete-card__button:disabled {
      cursor: default;
      opacity: 0.55;
    }
    .skill-delete-card__button--danger {
      color: var(--danger);
      background: var(--danger-bg-soft);
      border-color: var(--danger-border-soft);
    }
  `}</style>
);
