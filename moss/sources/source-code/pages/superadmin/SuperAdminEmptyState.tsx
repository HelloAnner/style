import React from 'react';
import { Inbox, SearchX, AlertTriangle, type LucideIcon } from 'lucide-react';

type EmptyTone = 'empty' | 'search' | 'error';

type Props = {
  title?: string;
  description?: string;
  tone?: EmptyTone;
  action?: React.ReactNode;
  className?: string;
};

const ICON_MAP: Record<EmptyTone, LucideIcon> = {
  empty: Inbox,
  search: SearchX,
  error: AlertTriangle,
};

export const SuperAdminEmptyState: React.FC<Props> = ({
  title,
  description,
  tone = 'empty',
  action,
  className = '',
}) => {
  const Icon = ICON_MAP[tone];
  const defaultTitle = tone === 'error' ? '加载失败' : tone === 'search' ? '未找到结果' : '暂无数据';

  return (
    <div className={`fi-empty-state ${tone} ${className}`}>
      <div className="fi-empty-state-icon">
        <Icon size={24} />
      </div>
      <div className="fi-empty-state-title">{title ?? defaultTitle}</div>
      {description && <div className="fi-empty-state-desc">{description}</div>}
      {action && <div className="fi-empty-state-action">{action}</div>}
    </div>
  );
};

export default SuperAdminEmptyState;
