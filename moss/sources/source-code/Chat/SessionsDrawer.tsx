/**
 * 历史会话抽屉组件
 * 
 * 从右侧滑出，显示历史会话列表
 */

import React, { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { X, Trash2, MessageSquare } from 'lucide-react';
import { useAgentStore } from '../../stores/agentStore';
import { useAgent } from '../../hooks/useAgent';
import { useAgentContextStore } from '../../stores/agentContextStore';
import { getAvatarById } from '../../types/platform';

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function extractAccentColor(gradient: string): string {
  const hexes = gradient.match(/#[0-9A-Fa-f]{6}/g) || [];
  return hexes[0] || '#A855F7';
}

// 星标图标 - 收藏（主题适配，无彩色）
const StarIcon: React.FC<{ size?: number; filled?: boolean }> = ({ size = 14, filled = false }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path 
      d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      fill={filled ? 'currentColor' : 'none'}
      style={{ color: 'var(--text-tertiary)' }}
    />
  </svg>
);

interface SessionsDrawerProps {
  onClose: () => void;
}

export const SessionsDrawer: React.FC<SessionsDrawerProps> = ({ onClose }) => {
  const { sessions, currentSessionId } = useAgentStore();
  const { fetchSessions, deleteSession } = useAgent();
  const currentAgent = useAgentContextStore((s) => s.getCurrentAgent());
  const accent = useMemo(() => {
    const avatar = getAvatarById(currentAgent?.avatar_url || null);
    return extractAccentColor(avatar.gradient);
  }, [currentAgent?.avatar_url]);
  
  // 加载会话列表
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);
  
  const navigate = useNavigate();
  
  const handleSessionClick = (sessionId: string) => {
    navigate(`/s/${sessionId}`);
    onClose();
  };
  
  // 删除会话
  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (confirm('确定要删除这个会话吗？')) {
      await deleteSession(sessionId);
    }
  };
  
  // 格式化时间
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;
    
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
    });
  };
  
  return (
    <>
      {/* 背景遮罩 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        data-testid="sessions-drawer-backdrop"
        className="fixed inset-0"
        style={{ background: 'rgba(0, 0, 0, 0.5)', zIndex: 9998 }}
      />
      
      {/* 抽屉面板 */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        data-testid="sessions-drawer"
        className="fixed right-0 top-0 bottom-0 flex flex-col"
        style={{
          width: 360,
          background: 'var(--bg-secondary)',
          borderLeft: '1px solid var(--border-subtle)',
          zIndex: 9999,
        }}
      >
        {/* 头部 */}
        <div
          className="flex items-center justify-between"
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
            历史会话
          </h2>
          <button
            onClick={onClose}
            data-testid="sessions-drawer-close"
            className="flex items-center justify-center transition-colors"
            style={{ width: 32, height: 32, borderRadius: 8, color: 'var(--text-tertiary)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <X size={18} />
          </button>
        </div>
        
        {/* 会话列表 */}
        <div className="flex-1 overflow-y-auto" style={{ padding: '8px 12px' }} data-testid="sessions-drawer-list">
          {sessions.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center"
              data-testid="sessions-drawer-empty"
              style={{ padding: '48px 24px', color: 'var(--text-muted)' }}
            >
              <MessageSquare size={32} className="mb-3 text-zinc-600" />
              <p style={{ fontSize: 14 }}>暂无历史会话</p>
              <p style={{ fontSize: 12, marginTop: 4 }}>开始新对话后，会话将显示在这里</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => (
                <motion.div
                  key={session.id}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => handleSessionClick(session.id)}
                  data-testid={`session-item-${session.id}`}
                  className="session-item group cursor-pointer rounded-xl"
                  style={{
                    padding: '12px 14px',
                    background: session.id === currentSessionId ? hexToRgba(accent, 0.08) : 'transparent',
                    border: session.id === currentSessionId
                      ? `1px solid ${hexToRgba(accent, 0.22)}`
                      : '1px solid transparent',
                    transition: 'background 0.15s, border-color 0.15s',
                  }}
                  onMouseEnter={e => {
                    if (session.id !== currentSessionId) {
                      e.currentTarget.style.background = 'var(--hover-bg)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (session.id !== currentSessionId) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      {/* 会话标题 + 标签 */}
                      <div className="flex items-center" style={{ gap: 6 }}>
                        {(session.is_automation || session.title?.startsWith('[自动化]')) && (
                          <span style={{
                            fontSize: 10, fontWeight: 600, padding: '1px 5px',
                            borderRadius: 4, background: 'rgba(59,130,246,0.15)',
                            color: '#60a5fa', flexShrink: 0,
                          }}>自动化</span>
                        )}
                        <p
                          className="truncate"
                          style={{
                            fontSize: 14,
                            fontWeight: 500,
                            color: session.id === currentSessionId
                              ? accent
                              : 'var(--text-primary)',
                          }}
                        >
                          {(session.title || '未命名会话').replace(/^\[自动化\]\s*/, '')}
                        </p>
                        {session.starred && (
                          <StarIcon size={12} filled />
                        )}
                      </div>
                      
                      {/* 消息数量 */}
                      <p
                        style={{
                          fontSize: 12,
                          color: 'var(--text-muted)',
                          marginTop: 4,
                        }}
                      >
                        {session.message_count} 条消息
                      </p>
                      
                      {/* 时间 */}
                      <p
                        style={{
                          fontSize: 11,
                          color: 'var(--text-muted)',
                          marginTop: 4,
                        }}
                      >
                        {formatTime(session.updated_at)}
                      </p>
                    </div>
                    
                    {/* 删除按钮 */}
                    <button
                      onClick={(e) => handleDeleteSession(e, session.id)}
                      data-testid={`session-delete-${session.id}`}
                      className="session-delete opacity-0 group-hover:opacity-100 flex items-center justify-center
                               hover:bg-red-500/20 transition-all"
                      style={{ width: 28, height: 28, borderRadius: 6, marginLeft: 8 }}
                    >
                      <Trash2 size={14} className="text-red-400" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
};

export default SessionsDrawer;
