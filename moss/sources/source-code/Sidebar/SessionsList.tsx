/**
 * 会话历史列表组件
 */

import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAgentStore } from '../../stores/agentStore';
import { useAgent } from '../../hooks/useAgent';
import { HistoryIcon, TrashIcon, ChatIcon } from '../common/Icons';

export const SessionsList: React.FC = () => {
  const { sessions, deleteSession } = useAgent();
  const { currentSessionId } = useAgentStore();
  const navigate = useNavigate();
  
  const handleLoadSession = (sessionId: string) => {
    if (sessionId === currentSessionId) return;
    navigate(`/s/${sessionId}`);
  };
  
  if (sessions.length === 0) {
    return (
      <div className="sessions-list-empty px-3 py-4">
        <div className="text-center">
          <HistoryIcon size={32} className="mx-auto mb-2 text-zinc-600" />
          <p className="text-sm text-zinc-500">暂无历史会话</p>
          <p className="text-xs text-zinc-600 mt-1">
            开始新对话后将保存在这里
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="sessions-list px-3 overflow-y-auto h-full pb-4">
      <div className="sessions-list-header text-xs text-zinc-500 px-2 mb-2">
        历史会话 ({sessions.length})
      </div>
      <div className="sessions-list-items space-y-1">
        {sessions.map((session, index) => (
          <motion.div
            key={session.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.03 }}
          >
            <SessionItem
              id={session.id}
              title={session.title || `会话 ${session.id.slice(0, 6)}`}
              messageCount={session.message_count}
              updatedAt={session.updated_at}
              isActive={session.id === currentSessionId}
              onClick={() => handleLoadSession(session.id)}
              onDelete={() => deleteSession(session.id)}
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
};

interface SessionItemProps {
  id: string;
  title: string;
  messageCount: number;
  updatedAt: string;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
}

const SessionItem: React.FC<SessionItemProps> = ({
  id,
  title,
  messageCount,
  updatedAt,
  isActive,
  onClick,
  onDelete,
}) => {
  return (
    <div
      onClick={onClick}
      className={`
        sessions-list-item group px-3 py-2.5 rounded-lg border transition-colors cursor-pointer
        ${isActive 
          ? 'border-zinc-600 bg-zinc-800/50' 
          : 'hover:border-zinc-700 hover:bg-zinc-800/30'
        }
      `}
      data-testid={`sessions-list-item-${id}`}
      style={{ borderColor: isActive ? undefined : 'var(--border-subtle)' }}
    >
      <div className="sessions-list-item-header flex items-center justify-between">
        <div className="sessions-list-item-content flex items-center gap-2 min-w-0">
          <ChatIcon size={14} className={isActive ? 'text-zinc-200' : 'text-zinc-500'} />
          {title.startsWith('[自动化]') && (
            <span style={{
              fontSize: 9, fontWeight: 600, padding: '1px 4px',
              borderRadius: 3, background: 'rgba(59,130,246,0.15)',
              color: '#60a5fa', flexShrink: 0,
            }}>自动化</span>
          )}
          <span className={`text-sm truncate ${isActive ? 'text-zinc-200' : 'text-zinc-400'}`}>
            {title.replace(/^\[自动化\]\s*/, '')}
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="sessions-list-item-delete p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 transition-all"
          data-testid={`sessions-list-item-delete-${id}`}
        >
          <TrashIcon size={12} className="text-zinc-500 hover:text-red-400" />
        </button>
      </div>
      <div className="sessions-list-item-meta flex items-center gap-2 mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
        <span>{messageCount} 条消息</span>
        <span>·</span>
        <span>{formatRelativeTime(updatedAt)}</span>
      </div>
    </div>
  );
};

// 格式化相对时间
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays < 7) return `${diffDays} 天前`;
  
  return date.toLocaleDateString('zh-CN');
}
