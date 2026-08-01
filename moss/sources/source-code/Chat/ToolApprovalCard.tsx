/**
 * ToolApprovalCard — 工具操作审批卡片（升级版）
 *
 * 顶部：skill 卡片（名称 + 操作徽标 + 描述 + 查看详情按钮）
 * 中部：三选一 radio（保存 / 取消 / 继续修改），继续修改时展开 textarea
 * 底部：提交按钮
 * 已决议态：禁用 radio，展示最终决议文字
 */

import React, { useState } from 'react';
import type { ToolUsePendingPayload, ToolApprovalDecision } from '../../types';
import { DiffPreview } from './ActionFeed/DiffPreview';

// ─── Icons ────────────────────────────────────────────────────────────────────

const FileIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
    <polyline points="14,2 14,8 20,8"/>
  </svg>
);

const ChevronIcon: React.FC<{ expanded: boolean }> = ({ expanded }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'none' }}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const CheckIcon: React.FC = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const XIcon: React.FC = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const RefineIcon: React.FC = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

// ─── Types ────────────────────────────────────────────────────────────────────

type RadioChoice = 'save' | 'cancel' | 'refine';

interface ApprovalDecision {
  approved: boolean | 'refine';
  refine_comment?: string;
}

interface ToolApprovalCardProps {
  /** 来自后端的审批请求数据 */
  data: ToolUsePendingPayload;
  /**
   * 用户提交决议后触发，父组件负责发送 tool_use_approval WS 消息
   */
  onResolve: (requestId: string, decision: ApprovalDecision) => void;
  /** 打开详情预览（SkillStudio preview 模式） */
  onViewDetail?: (payload: ToolUsePendingPayload) => void;
  /** 当前是否是最后一条消息（非 isLast 时禁用交互）*/
  isLast?: boolean;
  /** 已决议信息（用于只读态展示） */
  decided?: ToolApprovalDecision;
  testId?: string;
}

// ─── 主组件 ───────────────────────────────────────────────────────────────────

export const ToolApprovalCard: React.FC<ToolApprovalCardProps> = ({
  data,
  onResolve,
  onViewDetail,
  isLast = true,
  decided,
  testId,
}) => {
  const [choice, setChoice] = useState<RadioChoice | null>(null);
  const [refineText, setRefineText] = useState('');
  const [diffExpanded, setDiffExpanded] = useState(false);

  const isModify = data.action_type === 'modify';
  const accentColor = isModify ? 'var(--accent, #3b82f6)' : 'var(--error, #ef4444)';

  // 已决议：有 decided 对象 或 非 isLast 都进入只读态
  const isDecided = !!decided || !isLast;

  const canSubmit =
    choice !== null &&
    (choice !== 'refine' || refineText.trim().length > 0);

  const handleSubmit = () => {
    if (!canSubmit || isDecided) return;
    let decision: ApprovalDecision;
    if (choice === 'save') {
      decision = { approved: true };
    } else if (choice === 'cancel') {
      decision = { approved: false };
    } else {
      decision = { approved: 'refine', refine_comment: refineText.trim() };
    }
    onResolve(data.request_id, decision);
  };

  // ── 决议态标签 ────────────────────────────────────────────────────────────

  const decidedLabel = (): React.ReactNode => {
    if (!decided) return null;
    if (decided.decision === true) {
      return (
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--success, #22c55e)' }}>
          <CheckIcon /> 已保存
        </span>
      );
    }
    if (decided.decision === false) {
      return (
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-muted)' }}>
          <XIcon /> 已取消
        </span>
      );
    }
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--accent, #3b82f6)' }}>
        <RefineIcon /> 已继续修改{decided.comment ? `：${decided.comment}` : ''}
      </span>
    );
  };

  // ── Radio 选项数据 ────────────────────────────────────────────────────────

  const radioOptions: { value: RadioChoice; label: string }[] = [
    { value: 'save',   label: '保存本次修改' },
    { value: 'cancel', label: '取消本次修改' },
    { value: 'refine', label: '继续修改' },
  ];

  return (
    <div className="tool-approval-card" style={{
      display: 'flex', width: '100%', maxWidth: 520,
      borderRadius: 12, overflow: 'hidden',
      background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)',
    }} data-testid={testId ?? `tool-approval-card-${data.request_id}`}>
      {/* 左侧色条 */}
      <div style={{ width: 4, flexShrink: 0, background: accentColor }} />

      {/* 内容区 */}
      <div className="tool-approval-card__content" style={{ flex: 1, minWidth: 0 }} data-testid={`tool-approval-content-${data.request_id}`}>

        {/* ── 顶部：skill 卡片 ── */}
        <div className="tool-approval-card__skill" style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--border-subtle)' }} data-testid={`tool-approval-skill-${data.request_id}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
              <FileIcon />
            </span>
            <span className="tool-approval-card__skill-name" style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', flex: 1, minWidth: 0 }} data-testid={`tool-approval-skill-name-${data.request_id}`}>
              {data.skill_name}
            </span>
            {/* 操作徽标 */}
            <span style={{
              padding: '1px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, flexShrink: 0,
              background: isModify ? 'var(--accent-subtle, rgba(59,130,246,0.15))' : 'var(--error-subtle, rgba(239,68,68,0.15))',
              color: accentColor,
            }} className="tool-approval-card__action-badge" data-testid={`tool-approval-action-badge-${data.request_id}`}>
              {isModify ? '修改' : '删除'}
            </span>
          </div>

          {data.skill_description && (
            <p className="tool-approval-card__skill-description" style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }} data-testid={`tool-approval-skill-description-${data.request_id}`}>
              {data.skill_description}
            </p>
          )}

          {/* 文件路径 + 查看详情 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <p className="tool-approval-card__file-path" style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} data-testid={`tool-approval-file-path-${data.request_id}`}>
              {data.file_path}
            </p>
            <button
              onClick={() => !isDecided && onViewDetail?.(data)}
              disabled={isDecided}
              className="tool-approval-card__view-detail"
              data-testid={`tool-approval-view-detail-${data.request_id}`}
              style={{
                flexShrink: 0, padding: '2px 8px', borderRadius: 5, fontSize: 11,
                border: '1px solid var(--border-subtle)', background: 'none',
                cursor: isDecided ? 'not-allowed' : 'pointer',
                color: isDecided ? 'var(--text-muted)' : 'var(--accent, #3b82f6)',
                opacity: isDecided ? 0.5 : 1,
              }}
            >
              查看详情
            </button>
          </div>
        </div>

        {/* ── Diff 折叠区（次选，默认收起）── */}
        {isModify && data.diff_preview && (
          <div className="tool-approval-card__diff-section" style={{ borderBottom: '1px solid var(--border-subtle)' }} data-testid={`tool-approval-diff-section-${data.request_id}`}>
            <button
              onClick={() => setDiffExpanded(v => !v)}
              className="tool-approval-card__diff-toggle"
              data-testid={`tool-approval-diff-toggle-${data.request_id}`}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '7px 14px',
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--text-secondary)', fontSize: 11,
              }}
            >
              <span>查看 Diff</span>
              <ChevronIcon expanded={diffExpanded} />
            </button>
            {diffExpanded && (
              <div className="tool-approval-card__diff-preview" style={{ padding: '0 14px 12px' }} data-testid={`tool-approval-diff-preview-${data.request_id}`}>
                <DiffPreview
                  path={data.file_path}
                  oldStr={data.diff_preview.before}
                  newStr={data.diff_preview.after}
                  defaultExpanded={true}
                />
              </div>
            )}
          </div>
        )}

        {/* ── 已决议态：只读展示 ── */}
        {isDecided ? (
          <div className="tool-approval-card__decided" style={{ padding: '10px 14px' }} data-testid={`tool-approval-decided-${data.request_id}`}>
            {decided ? decidedLabel() : (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>（历史记录，无法操作）</span>
            )}
          </div>
        ) : (
          <>
            {/* ── 中部：三选一 radio ── */}
            <div className="tool-approval-card__options" style={{ padding: '12px 14px 0' }} data-testid={`tool-approval-options-${data.request_id}`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {radioOptions.map((opt) => (
                  <label
                    key={opt.value}
                    className="tool-approval-card__option"
                    data-testid={`tool-approval-option-${opt.value}-${data.request_id}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      cursor: 'pointer', padding: '6px 10px', borderRadius: 8,
                      border: `1px solid ${choice === opt.value ? 'var(--accent, #3b82f6)' : 'var(--border-subtle)'}`,
                      background: choice === opt.value ? 'var(--accent-subtle, rgba(59,130,246,0.08))' : 'transparent',
                      transition: 'all 0.15s',
                    }}
                  >
                    <input
                      type="radio"
                      name={`approval-${data.request_id}`}
                      value={opt.value}
                      checked={choice === opt.value}
                      onChange={() => setChoice(opt.value)}
                      className="tool-approval-card__radio"
                      data-testid={`tool-approval-radio-${opt.value}-${data.request_id}`}
                      style={{ accentColor: 'var(--accent, #3b82f6)', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{opt.label}</span>
                  </label>
                ))}
              </div>

              {/* 继续修改：条件展开 textarea */}
              {choice === 'refine' && (
                <div className="tool-approval-card__refine-section" style={{ marginTop: 10 }} data-testid={`tool-approval-refine-section-${data.request_id}`}>
                  <textarea
                    value={refineText}
                    onChange={e => setRefineText(e.target.value)}
                    placeholder="请输入修改要求..."
                    rows={3}
                    className="tool-approval-card__refine-input"
                    data-testid={`tool-approval-refine-input-${data.request_id}`}
                    style={{
                      width: '100%', padding: '8px 10px', fontSize: 12, borderRadius: 8,
                      border: `1px solid ${refineText.trim() ? 'var(--accent, #3b82f6)' : 'var(--border-subtle)'}`,
                      background: 'var(--input-bg, var(--bg-secondary))',
                      color: 'var(--text-primary)', outline: 'none',
                      resize: 'vertical', lineHeight: 1.5, boxSizing: 'border-box',
                      transition: 'border-color 0.15s',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent, #3b82f6)'; }}
                    onBlur={e => { if (!refineText.trim()) e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                  />
                </div>
              )}
            </div>

            {/* ── 底部：提交按钮 ── */}
            <div className="tool-approval-card__footer" style={{ padding: '12px 14px' }} data-testid={`tool-approval-footer-${data.request_id}`}>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="tool-approval-card__submit"
                data-testid={`tool-approval-submit-${data.request_id}`}
                style={{
                  width: '100%', padding: '8px 0', borderRadius: 8, border: 'none',
                  fontSize: 13, fontWeight: 500, cursor: canSubmit ? 'pointer' : 'not-allowed',
                  background: canSubmit ? 'var(--btn-primary-bg, #3b82f6)' : 'var(--bg-secondary)',
                  color: canSubmit ? 'var(--btn-primary-text, #fff)' : 'var(--text-muted)',
                  transition: 'all 0.15s',
                  opacity: canSubmit ? 1 : 0.6,
                }}
                onMouseEnter={e => { if (canSubmit) e.currentTarget.style.opacity = '0.85'; }}
                onMouseLeave={e => { if (canSubmit) e.currentTarget.style.opacity = '1'; }}
              >
                提交
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ToolApprovalCard;
