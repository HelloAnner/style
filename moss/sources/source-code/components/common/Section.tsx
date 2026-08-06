/**
 * 分区组件 - 用于执行链中的不同部分
 */

import React from 'react';

type SectionColor = 'accent' | 'secondary' | 'success' | 'error' | 'warning' | 'info' | 'default';

interface SectionProps {
  icon?: React.ReactNode;
  title: string;
  color?: SectionColor;
  highlighted?: boolean;
  badge?: string | number;
  children: React.ReactNode;
  className?: string;
  testId?: string;
  headerTestId?: string;
  contentTestId?: string;
  badgeTestId?: string;
}

const colorConfig: Record<SectionColor, {
  iconBg: string;
  iconText: string;
  titleText: string;
  highlightBg: string;
  highlightBorder: string;
}> = {
  accent: {
    iconBg: 'bg-accent/20',
    iconText: 'text-accent',
    titleText: 'text-accent',
    highlightBg: 'bg-accent/5',
    highlightBorder: 'border-accent/20',
  },
  secondary: {
    iconBg: 'bg-secondary/20',
    iconText: 'text-secondary',
    titleText: 'text-secondary',
    highlightBg: 'bg-secondary/5',
    highlightBorder: 'border-secondary/20',
  },
  success: {
    iconBg: 'bg-success/20',
    iconText: 'text-success',
    titleText: 'text-success',
    highlightBg: 'bg-success/5',
    highlightBorder: 'border-success/20',
  },
  error: {
    iconBg: 'bg-error/20',
    iconText: 'text-error',
    titleText: 'text-error',
    highlightBg: 'bg-error/5',
    highlightBorder: 'border-error/20',
  },
  warning: {
    iconBg: 'bg-warning/20',
    iconText: 'text-warning',
    titleText: 'text-warning',
    highlightBg: 'bg-warning/5',
    highlightBorder: 'border-warning/20',
  },
  info: {
    iconBg: 'bg-blue-500/20',
    iconText: 'text-blue-400',
    titleText: 'text-blue-400',
    highlightBg: 'bg-blue-500/5',
    highlightBorder: 'border-blue-500/20',
  },
  default: {
    iconBg: 'bg-zinc-500/20',
    iconText: 'text-zinc-400',
    titleText: 'text-zinc-400',
    highlightBg: 'bg-zinc-500/5',
    highlightBorder: 'border-zinc-500/20',
  },
};

export const Section: React.FC<SectionProps> = ({
  icon,
  title,
  color = 'default',
  highlighted = false,
  badge,
  children,
  className = '',
  testId,
  headerTestId,
  contentTestId,
  badgeTestId,
}) => {
  const config = colorConfig[color];
  
  const containerClass = highlighted
    ? `p-3 rounded-lg ${config.highlightBg} border ${config.highlightBorder}`
    : '';
  
  return (
    <div
      className={`section mt-3 overflow-hidden ${containerClass} ${className}`}
      data-testid={testId}
    >
      {/* 标题行 */}
      <div className="section-header flex items-center gap-2 mb-2 flex-wrap" data-testid={headerTestId}>
        {icon && (
          <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${config.iconBg}`}>
            <span className={config.iconText}>{icon}</span>
          </div>
        )}
        <span className={`text-xs font-medium ${config.titleText}`}>
          {title}
        </span>
        {badge !== undefined && (
          <span
            className="section-badge px-1.5 py-0.5 text-xs rounded bg-surface-200 text-zinc-500"
            data-testid={badgeTestId}
          >
            {badge}
          </span>
        )}
      </div>
      
      {/* 内容 */}
      <div
        className={`section-content overflow-hidden ${icon ? 'pl-7' : ''}`}
        data-testid={contentTestId}
      >
        {children}
      </div>
    </div>
  );
};

/**
 * 状态徽章组件
 */
interface StatusBadgeProps {
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | string;
  size?: 'sm' | 'md';
  testId?: string;
}

const statusConfig: Record<string, {
  bg: string;
  text: string;
  label: string;
}> = {
  pending: {
    bg: 'bg-zinc-500/20',
    text: 'text-zinc-400',
    label: '等待中',
  },
  running: {
    bg: 'bg-accent/20',
    text: 'text-accent',
    label: '执行中',
  },
  completed: {
    bg: 'bg-success/20',
    text: 'text-success',
    label: '完成',
  },
  failed: {
    bg: 'bg-error/20',
    text: 'text-error',
    label: '失败',
  },
  cancelled: {
    bg: 'bg-warning/20',
    text: 'text-warning',
    label: '已取消',
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'sm',
  testId,
}) => {
  // 添加空值保护，未知状态使用默认样式
  const config = (status && statusConfig[status]) || {
    bg: 'bg-zinc-500/20',
    text: 'text-zinc-400',
    label: status || '未知',
  };
  const sizeClass = size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-sm';
  
  return (
    <span
      className={`status-badge rounded ${sizeClass} ${config.bg} ${config.text}`}
      data-testid={testId}
    >
      {config.label}
    </span>
  );
};
