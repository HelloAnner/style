/**
 * ThinkingState - 等待期思考状态组件
 * 
 * 【设计目标】
 * 用户发送消息后到 Agent 开始输出前的等待期，
 * 显示一个优雅的动画图标 + "思考中" 文字。
 * 
 * 【与消息气泡的区别】
 * - 不显示消息气泡框
 * - 只显示图标和文字
 * - 占用空间更小，视觉更轻
 */

import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { useAgentContextStore } from '../../stores/agentContextStore';
import { ChatAgentMark } from './ChatAgentMark';
import type { ChatAgentDisplay } from './chatDisplayContext';

// ========== 动画思考图标 ==========

const ThinkingIcon: React.FC = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    style={{ color: 'var(--text-muted)' }}
  >
    {/* 三个圆点表示思考 - 使用主题色 */}
    <motion.circle
      cx="6"
      cy="12"
      r="2"
      fill="currentColor"
      animate={{ 
        opacity: [0.3, 1, 0.3],
        scale: [0.8, 1, 0.8],
      }}
      transition={{
        duration: 1.2,
        repeat: Infinity,
        delay: 0,
        ease: 'easeInOut',
      }}
    />
    <motion.circle
      cx="12"
      cy="12"
      r="2"
      fill="currentColor"
      animate={{ 
        opacity: [0.3, 1, 0.3],
        scale: [0.8, 1, 0.8],
      }}
      transition={{
        duration: 1.2,
        repeat: Infinity,
        delay: 0.2,
        ease: 'easeInOut',
      }}
    />
    <motion.circle
      cx="18"
      cy="12"
      r="2"
      fill="currentColor"
      animate={{ 
        opacity: [0.3, 1, 0.3],
        scale: [0.8, 1, 0.8],
      }}
      transition={{
        duration: 1.2,
        repeat: Infinity,
        delay: 0.4,
        ease: 'easeInOut',
      }}
    />
  </svg>
);

// ========== 主组件 ==========

interface ThinkingStateProps {
  /** 自定义文本 */
  text?: string;
  /** 是否显示头像 */
  showAvatar?: boolean;
  /** 可选的会话级 agent 展示信息 */
  agentDisplay?: ChatAgentDisplay;
}

export const ThinkingState: React.FC<ThinkingStateProps> = memo(({
  text = '思考中',
  showAvatar = true,
  agentDisplay,
}) => {
  const currentAgent = useAgentContextStore((s) => s.getCurrentAgent());
  const effectiveAgent = agentDisplay ?? currentAgent ?? { name: 'Moss', avatar_url: null };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="flex items-center gap-3"
      data-testid="thinking-state"
    >
      {/* Agent 头像（无特效） */}
      {showAvatar && (
        <ChatAgentMark size={32} agent={effectiveAgent} />
      )}
      
      {/* 思考状态 */}
      <div className="flex items-center gap-2" data-testid="thinking-state-content">
        <ThinkingIcon />
        <span 
          className="text-sm"
          style={{ color: 'var(--text-muted)' }}
        >
          {text}
        </span>
      </div>
    </motion.div>
  );
});

ThinkingState.displayName = 'ThinkingState';

// ========== 内联思考指示器（用于消息气泡内） ==========

export const InlineThinkingIndicator: React.FC = memo(() => (
  <span className="inline-flex items-center gap-1.5" data-testid="inline-thinking-indicator">
    <motion.span
      className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"
      animate={{ opacity: [0.3, 1, 0.3] }}
      transition={{ duration: 1, repeat: Infinity, delay: 0 }}
    />
    <motion.span
      className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"
      animate={{ opacity: [0.3, 1, 0.3] }}
      transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
    />
    <motion.span
      className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"
      animate={{ opacity: [0.3, 1, 0.3] }}
      transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
    />
  </span>
));

InlineThinkingIndicator.displayName = 'InlineThinkingIndicator';
