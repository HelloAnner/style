/**
 * Agent 卡片组件 - 极简版
 * 
 * 圆形渐变头像 + 简洁布局
 */

import React from 'react';
import type { Agent } from '../../types/platform';
import { getAgentDisplayName, getAvatarById } from '../../types/platform';
import { Settings, Trash2, Check } from 'lucide-react';

interface AgentCardProps {
  agent: Agent;
  isSelected: boolean;
  onSelect: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

// Agent 头像组件 - 圆形纯渐变
const AgentAvatar: React.FC<{ avatarId: string; size?: number }> = ({ 
  avatarId, 
  size = 36 
}) => {
  const avatar = getAvatarById(avatarId);
  
  return (
    <div
      className="agent-card-avatar"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: avatar.gradient,
        flexShrink: 0,
      }}
    />
  );
};

export const AgentCard: React.FC<AgentCardProps> = ({
  agent,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
}) => {
  return (
    <div
      onClick={onSelect}
      className="agent-card group relative cursor-pointer transition-colors"
      data-testid={`agent-card-${agent.id}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        borderRadius: 10,
        background: isSelected ? 'var(--agent-card-selected-bg)' : 'transparent',
        marginBottom: 2,
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = 'var(--hover-bg)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = 'transparent';
        }
      }}
    >
      {/* 圆形渐变头像 */}
      <AgentAvatar avatarId={agent.avatar_url || ''} size={36} />
      
      {/* 名称和描述 */}
      <div className="agent-card-content flex-1 min-w-0">
        <div className="agent-card-header flex items-center gap-2">
          <span 
            className="font-medium truncate"
            style={{ fontSize: 14, color: 'var(--text-primary)' }}
          >
            {getAgentDisplayName(agent)}
          </span>
          {isSelected && (
            <Check size={14} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />
          )}
        </div>
        {agent.description && (
          <p 
            className="truncate"
            style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}
          >
            {agent.description}
          </p>
        )}
      </div>
      
      {/* 操作按钮 - 悬停显示 */}
      <div 
        className="agent-card-actions flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ flexShrink: 0 }}
      >
        {onEdit && (
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="agent-card-edit p-1.5 rounded-lg transition-colors"
            data-testid={`agent-card-edit-${agent.id}`}
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--hover-bg)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
            title="编辑"
          >
            <Settings size={14} />
          </button>
        )}
        {onDelete && !agent.is_default && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="agent-card-delete p-1.5 rounded-lg transition-colors"
            data-testid={`agent-card-delete-${agent.id}`}
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
              e.currentTarget.style.color = '#EF4444';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
            title="删除"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
};

export { AgentAvatar };
