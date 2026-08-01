/**
 * 文件网格骨架屏
 * 在 tenantId 切换后、数据加载中时显示
 */

import React from 'react';

interface SkeletonCardProps {
  delay?: number;
}

const SkeletonCard: React.FC<SkeletonCardProps> = ({ delay = 0 }) => (
  <div
    style={{
      background: 'var(--bg-elevated)',
      borderRadius: 'var(--radius-md)',
      padding: '12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      animationDelay: `${delay}ms`,
    }}
  >
    {/* 文件图标骨架 */}
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: 'var(--radius-sm)',
        background: 'var(--bg-tertiary)',
        animation: 'pulse 1.5s ease-in-out infinite',
      }}
    />
    {/* 文件名骨架 */}
    <div
      style={{
        height: 10,
        borderRadius: 4,
        background: 'var(--bg-tertiary)',
        width: '80%',
        animation: 'pulse 1.5s ease-in-out infinite',
      }}
    />
    {/* 文件大小骨架 */}
    <div
      style={{
        height: 8,
        borderRadius: 4,
        background: 'var(--bg-tertiary)',
        width: '50%',
        animation: 'pulse 1.5s ease-in-out infinite',
      }}
    />
  </div>
);

export function SkeletonFileGrid() {
  return (
    <div
      data-testid="skeleton-file-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 172px), 208px))',
        gap: 10,
        padding: '12px 16px',
        overflowY: 'auto',
        flex: 1,
        justifyContent: 'start',
        gridAutoRows: 'max-content',
        alignItems: 'start',
      }}
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <SkeletonCard key={i} delay={i * 50} />
      ))}
    </div>
  );
}
