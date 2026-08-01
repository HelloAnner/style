/**
 * Plan 模式状态指示器
 * 
 * 当 Agent 进入 Plan 模式时，在对话区域顶部显示状态指示器。
 * 设计理念：酷炫但克制，符合产品整体气质。
 */

import React from 'react';
import { useSessionRuntimeStore } from '../../stores/sessionRuntimeStore';
import { usePreviewStore } from '../../stores/previewStore';

// 规划图标
const PlanIcon: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className, style }) => (
  <svg className={className} style={style} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
    <rect x="9" y="3" width="6" height="4" rx="1" />
    <path d="M9 12h6" />
    <path d="M9 16h6" />
  </svg>
);

// 文件图标
const FileIcon: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className, style }) => (
  <svg className={className} style={style} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

export const PlanModeIndicator: React.FC = () => {
  const { planModeState } = useSessionRuntimeStore();
  const { openFile } = usePreviewStore();
  
  if (!planModeState.active) {
    return null;
  }
  
  const handleOpenFile = () => {
    if (planModeState.planFile) {
      // 从路径中提取文件名
      const parts = planModeState.planFile.split('/');
      const fileName = parts[parts.length - 1];
      
      openFile({
        name: fileName,
        path: planModeState.planFile,
        level: 'session',
      });
    }
  };
  
  return (
    <div 
      data-testid="plan-mode-indicator"
      className="relative overflow-hidden"
      style={{
        margin: '0 16px 16px 16px',
        padding: '12px 16px',
        borderRadius: 12,
        background: 'var(--plan-indicator-bg)',
        border: '1px solid var(--plan-indicator-border)',
      }}
    >
      {/* 动态光效背景 - 从左至右流动 */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'var(--plan-indicator-shimmer)',
          animation: 'shimmer 6s infinite linear',
          backgroundSize: '200% 100%',
          opacity: 0.5,
        }}
      />
      
      {/* 内容 */}
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* 图标 */}
          <div 
            className="flex items-center justify-center w-8 h-8 rounded-full"
            style={{ background: 'var(--plan-indicator-icon-bg)' }}
          >
            <PlanIcon style={{ color: 'var(--plan-indicator-icon)' }} />
          </div>
          
          {/* 文字信息 */}
          <div>
            <div className="flex items-center gap-2">
              <span 
                className="text-sm font-medium"
                style={{ color: 'var(--plan-indicator-title)' }}
              >
                规划模式
              </span>
              <span 
                className="px-1.5 py-0.5 text-xs rounded"
                style={{ 
                  background: 'var(--plan-indicator-badge-bg)',
                  color: 'var(--plan-indicator-badge-text)',
                }}
              >
                进行中
              </span>
            </div>
            {planModeState.taskName && (
              <div 
                className="text-xs mt-0.5"
                style={{ color: 'var(--text-muted)' }}
              >
                {planModeState.taskName}
              </div>
            )}
          </div>
        </div>
        
        {/* 打开文件按钮 */}
        {planModeState.planFile && (
          <button
            onClick={handleOpenFile}
            data-testid="plan-mode-open-file"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all hover:scale-105"
            style={{
              background: 'var(--plan-indicator-btn-bg)',
              color: 'var(--plan-indicator-btn-text)',
              fontSize: 12,
            }}
          >
            <FileIcon />
            <span>查看方案</span>
          </button>
        )}
      </div>
      
      {/* CSS 动画 - 从左至右流动 */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
};

export default PlanModeIndicator;
