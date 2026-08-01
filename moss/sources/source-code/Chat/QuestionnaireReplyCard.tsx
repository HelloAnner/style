/**
 * 问卷回复卡片 - 在对话流中展示用户对问卷的回复（问题 + 填写内容）
 * 刷新后由服务端 questionnaireReply 元数据恢复展示。
 */

import React from 'react';
import type { QuestionnaireReplyData } from '../../types';

interface QuestionnaireReplyCardProps {
  data: QuestionnaireReplyData;
}

const CheckIcon: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className, style }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={className} style={style}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export const QuestionnaireReplyCard: React.FC<QuestionnaireReplyCardProps> = ({ data }) => {
  const items = data?.items ?? [];
  if (items.length === 0 && data?.status !== 'submitted') return null;

  return (
    <div
      data-testid="questionnaire-reply-card"
      className="w-full rounded-xl overflow-hidden"
      style={{
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div className="px-4 py-3 flex items-center gap-2" data-testid="questionnaire-reply-header" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--questionnaire-element-bg)' }}
        >
          <CheckIcon style={{ color: 'var(--questionnaire-element-text)' }} />
        </div>
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          问卷回复
        </span>
      </div>
      <div>
        {items.length === 0 ? (
          <div className="questionnaire-reply-item px-4 py-3" data-testid="questionnaire-reply-empty">
            <div className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              未填写可选问题
            </div>
          </div>
        ) : items.map((item, index) => (
          <div
            key={index}
            className="questionnaire-reply-item px-4 py-3"
            data-testid={`questionnaire-reply-item-${index}`}
            style={index > 0 ? { borderTop: '1px solid var(--border-subtle)' } : undefined}
          >
            <div className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
              {item.question}
            </div>
            <div className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {item.omitted ? '未填写（可选）' : Array.isArray(item.answer) ? item.answer.join('、') : item.answer}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default QuestionnaireReplyCard;
