/**
 * 右侧面板骨架屏 - 工作室 / 自动化
 * 首次打开时占位，避免右侧大片空白；明暗主题通过 CSS 变量适配。
 */

import React from 'react';

const SkeletonLine: React.FC<{ width?: string | number; height?: string | number; style?: React.CSSProperties }> = ({
  width = '100%',
  height = 12,
  style,
}) => (
  <div
    className="skeleton-line"
    data-testid="panel-skeleton-line"
    style={{
      width: typeof width === 'number' ? `${width}px` : width,
      height: typeof height === 'number' ? `${height}px` : height,
      ...style,
    }}
  />
);

// ========== 工作室骨架 ==========
export const WorkspaceSkeleton: React.FC = () => (
  <div
    className="h-full w-full flex flex-col overflow-hidden"
    data-testid="workspace-skeleton"
    style={{
      borderRadius: 16,
      background: 'var(--glass-bg)',
      border: '1px solid var(--border-subtle)',
      boxShadow: 'var(--panel-shadow)',
    }}
  >
    {/* 标签栏 */}
    <div
      className="flex items-center gap-2 px-3 pt-3 pb-2"
      style={{ borderBottom: '1px solid var(--border-subtle)' }}
    >
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="skeleton-line"
          style={{
            width: i === 1 ? 100 : 80,
            height: 36,
            borderRadius: 12,
          }}
        />
      ))}
    </div>
    {/* 预览区头部 */}
    <div
      className="flex items-center justify-between px-4 py-3"
      style={{ borderBottom: '1px solid var(--border-subtle)' }}
    >
      <div className="flex items-center gap-2">
        <SkeletonLine width={14} height={14} />
        <SkeletonLine width={120} height={14} />
      </div>
      <div className="flex gap-2">
        <SkeletonLine width={56} height={28} />
        <SkeletonLine width={56} height={28} />
      </div>
    </div>
    {/* 主内容区 - 模拟文件预览 */}
    <div className="flex-1 p-4 space-y-4">
      <SkeletonLine width="90%" height={16} />
      <SkeletonLine width="70%" height={14} />
      <SkeletonLine width="85%" height={14} />
      <SkeletonLine width="40%" height={14} />
      <div className="pt-4">
        <SkeletonLine width="60%" height={80} style={{ borderRadius: 12 }} />
      </div>
    </div>
  </div>
);

// ========== 自动化面板骨架 ==========
export const AutomationPanelSkeleton: React.FC = () => (
  <div
    className="h-full w-full flex flex-col overflow-hidden"
    data-testid="automation-panel-skeleton"
    style={{
      borderRadius: 16,
      background: 'var(--glass-bg)',
      border: '1px solid var(--border-subtle)',
      boxShadow: 'var(--panel-shadow)',
      position: 'relative',
    }}
  >
    {/* 头部 */}
    <div
      className="flex items-center justify-between px-5 py-4"
      style={{ position: 'relative', zIndex: 1 }}
    >
      <div className="flex items-center gap-2">
        <SkeletonLine width={16} height={16} style={{ borderRadius: 4 }} />
        <SkeletonLine width={72} height={18} />
        <SkeletonLine width={28} height={18} style={{ borderRadius: 8 }} />
      </div>
      <SkeletonLine width={28} height={28} style={{ borderRadius: 6 }} />
    </div>
    {/* 内容区 - 任务列表或详情占位 */}
    <div className="flex-1 overflow-auto px-5 pb-5 space-y-4" style={{ position: 'relative', zIndex: 1 }}>
      <SkeletonLine width={100} height={11} style={{ textTransform: 'uppercase' }} />
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          style={{
            padding: 16,
            borderRadius: 14,
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <SkeletonLine width="70%" height={14} style={{ marginBottom: 8 }} />
          <SkeletonLine width="100%" height={12} style={{ marginBottom: 6 }} />
          <SkeletonLine width="50%" height={12} />
        </div>
      ))}
    </div>
  </div>
);

export default { WorkspaceSkeleton, AutomationPanelSkeleton };
