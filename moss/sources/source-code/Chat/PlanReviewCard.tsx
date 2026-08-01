/**
 * Plan 审批卡片
 * 
 * 当 Agent 调用 exit_plan_mode 后，显示方案审批界面。
 * 用户可以批准方案或请求修改。
 */

import React, { useState } from 'react';
import { MarkdownContent } from './MarkdownContent';
import { usePreviewStore } from '../../stores/previewStore';
import type { PlanReviewData } from '../../types';

interface PlanReviewCardProps {
  data: PlanReviewData;
  onApprove: () => void;
  onRequestChanges: (feedback: string) => void;
  disabled?: boolean;
}

// 图标组件
const CheckIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const EditIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

// 关闭图标
const CloseIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const FileIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

const ChevronIcon: React.FC<{ className?: string; expanded?: boolean }> = ({ className, expanded }) => (
  <svg 
    className={`${className} transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} 
    width="16" 
    height="16" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

export const PlanReviewCard: React.FC<PlanReviewCardProps> = ({
  data,
  onApprove,
  onRequestChanges,
  disabled = false,
}) => {
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [contentExpanded, setContentExpanded] = useState(true);
  // 本地批准状态
  const [localApproved, setLocalApproved] = useState(false);
  const isApproved = localApproved || disabled;
  
  const { openFile } = usePreviewStore();
  
  const handleOpenFile = () => {
    if (data.plan_file) {
      const parts = data.plan_file.split('/');
      const fileName = parts[parts.length - 1];
      openFile({
        name: fileName,
        path: data.plan_file,
        level: 'session',
      });
    }
  };
  
  const handleApprove = () => {
    setLocalApproved(true);
    onApprove();
  };
  
  const handleRequestChanges = () => {
    if (showFeedback && feedback.trim()) {
      onRequestChanges(feedback.trim());
      setFeedback('');
      setShowFeedback(false);
    } else {
      setShowFeedback(!showFeedback); // 切换显示/隐藏
    }
  };
  
  const handleCloseFeedback = () => {
    setShowFeedback(false);
    setFeedback('');
  };
  
  return (
    <div 
      data-testid="plan-review-card"
      className="w-full max-w-2xl overflow-hidden rounded-xl"
      style={{
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      {/* 头部：方案摘要 */}
      <div 
        data-testid="plan-review-header"
        className="px-5 py-4"
        style={{ 
          background: isApproved ? 'transparent' : 'var(--plan-review-header-bg)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span 
                className="px-2 py-0.5 text-xs font-medium rounded"
                style={{ 
                  background: isApproved ? 'var(--questionnaire-element-bg)' : 'var(--plan-review-badge-bg)',
                  color: isApproved ? 'var(--questionnaire-element-text)' : 'var(--plan-review-badge-text)',
                }}
              >
                {isApproved ? '已批准' : '方案待审'}
              </span>
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {data.task_name}
              </span>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {data.summary}
            </p>
          </div>
          
          {/* 查看文件按钮 */}
          <button
            onClick={handleOpenFile}
            data-testid="plan-review-open-file"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ml-4 flex-shrink-0"
            style={{
              background: 'var(--bg-secondary)',
              color: 'var(--text-muted)',
              fontSize: 12,
            }}
          >
            <FileIcon />
            <span>查看文件</span>
          </button>
        </div>
      </div>
      
      {/* 方案内容（可展开/收起） */}
      <div data-testid="plan-review-content-section">
        <button
          onClick={() => setContentExpanded(!contentExpanded)}
          data-testid="plan-review-toggle"
          className="w-full flex items-center justify-between px-5 py-3 transition-colors"
          style={{ 
            background: 'transparent',
            borderBottom: contentExpanded ? '1px solid var(--border-subtle)' : 'none',
          }}
        >
          <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            方案详情
          </span>
          <ChevronIcon className="text-zinc-500" expanded={contentExpanded} />
        </button>
        
        {contentExpanded && (
          <div 
            data-testid="plan-review-content"
            className="px-5 py-4 overflow-auto"
            style={{ 
              maxHeight: 400,
              background: 'var(--bg-secondary)',
            }}
          >
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              <MarkdownContent content={data.content || '（方案内容为空）'} />
            </div>
          </div>
        )}
      </div>
      
      {/* 反馈输入框（仅在点击"补充建议"后显示，且未批准时） */}
      {showFeedback && !isApproved && (
        <div className="px-5 py-4 relative" data-testid="plan-review-feedback" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          {/* 关闭按钮 */}
          <button
            onClick={handleCloseFeedback}
            data-testid="plan-review-feedback-close"
            className="absolute top-3 right-4 p-1 rounded hover:bg-black/10 transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            <CloseIcon />
          </button>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            data-testid="plan-review-feedback-input"
            placeholder="请描述您的建议..."
            rows={3}
            className="w-full px-4 py-3 rounded-lg resize-none text-sm focus:outline-none"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
            }}
          />
        </div>
      )}
      
      {/* 底部区域 */}
      <div 
        data-testid="plan-review-footer"
        className="px-5 py-4"
        style={{ borderTop: '1px solid var(--border-subtle)' }}
      >
        {isApproved ? (
          /* 已批准状态：简洁的确认信息 */
          <div className="flex items-center gap-2" data-testid="plan-review-approved" style={{ color: 'var(--text-muted)' }}>
            <CheckIcon />
            <span className="text-sm">方案已批准</span>
          </div>
        ) : (
          /* 待审状态：操作按钮 */
          <div className="flex items-center gap-3">
            {/* 批准按钮 - 暗色主题白色、亮色主题黑色 */}
            <button
              onClick={handleApprove}
              data-testid="plan-review-approve"
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium transition-all"
              style={{
                background: 'var(--plan-review-approve-bg)',
                color: 'var(--plan-review-approve-text)',
              }}
            >
              <CheckIcon />
              <span>批准并执行</span>
            </button>
            
            {/* 补充建议按钮 */}
            <button
              onClick={handleRequestChanges}
              data-testid="plan-review-request-changes"
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium transition-colors"
              style={{
                background: 'var(--bg-secondary)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <EditIcon />
              <span>{showFeedback && feedback.trim() ? '提交建议' : '补充建议'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlanReviewCard;
