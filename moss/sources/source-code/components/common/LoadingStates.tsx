/**
 * 加载状态组件 - Corevo Design System
 */

import React from 'react';
import { motion } from 'framer-motion';
import { LoadingIcon, ThinkingIcon } from './Icons';

// 通用加载指示器
export const LoadingSpinner: React.FC<{
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  testId?: string;
}> = ({ size = 'md', className = '', testId }) => {
  const sizes = {
    sm: 16,
    md: 24,
    lg: 32,
  };
  
  return (
    <div
      className={`loading-spinner flex items-center justify-center ${className}`}
      data-testid={testId}
    >
      <LoadingIcon size={sizes[size]} className="text-zinc-400" />
    </div>
  );
};

// Agent 思考中指示器
export const ThinkingIndicator: React.FC<{
  message?: string;
  testId?: string;
}> = ({ message = '思考中...', testId }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="thinking-indicator flex items-center gap-3 px-4 py-3 rounded-xl"
      data-testid={testId}
      style={{
        backgroundColor: 'var(--bg-tertiary)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <motion.div
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.7, 1, 0.7],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        <ThinkingIcon size={20} className="text-zinc-400" />
      </motion.div>
      <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{message}</span>
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-zinc-500"
            animate={{
              opacity: [0.3, 1, 0.3],
              scale: [0.8, 1, 0.8],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: i * 0.2,
            }}
          />
        ))}
      </div>
    </motion.div>
  );
};

// 工具执行中指示器
export const ToolExecutingIndicator: React.FC<{
  toolName: string;
  testId?: string;
}> = ({ toolName, testId }) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="tool-executing-indicator flex items-center gap-2 px-3 py-2 rounded-lg"
      data-testid={testId}
      style={{
        backgroundColor: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
      >
        <LoadingIcon size={14} className="text-zinc-400" />
      </motion.div>
      <span className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>{toolName}</span>
    </motion.div>
  );
};

// 脉冲点指示器
export const PulsingDot: React.FC<{
  color?: 'default' | 'success' | 'warning' | 'error';
  testId?: string;
}> = ({ color = 'default', testId }) => {
  const colorClasses = {
    default: 'bg-zinc-400',
    success: 'bg-green-500',
    warning: 'bg-amber-500',
    error: 'bg-red-500',
  };
  
  return (
    <span className="pulsing-dot relative flex h-2 w-2" data-testid={testId}>
      <span
        className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${colorClasses[color]}`}
      />
      <span
        className={`relative inline-flex rounded-full h-2 w-2 ${colorClasses[color]}`}
      />
    </span>
  );
};

// 骨架屏
export const Skeleton: React.FC<{
  className?: string;
  testId?: string;
}> = ({ className = '', testId }) => {
  return (
    <div
      className={`skeleton animate-pulse rounded ${className}`}
      data-testid={testId}
      style={{ backgroundColor: 'var(--bg-elevated)' }}
    />
  );
};

// 消息骨架屏
export const MessageSkeleton: React.FC<{
  testId?: string;
}> = ({ testId }) => {
  return (
    <div className="message-skeleton flex gap-3 p-4" data-testid={testId}>
      <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
};

// 连接状态类型
type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

// 连接状态指示器（增强版）
export const ConnectionStatus: React.FC<{
  isConnected?: boolean;
  connectionState?: ConnectionState;
  error?: string | null;
  onRetry?: () => void;
  testId?: string;
  retryButtonTestId?: string;
}> = ({ isConnected, connectionState, error, onRetry, testId, retryButtonTestId }) => {
  // 兼容旧的 isConnected 属性
  const state: ConnectionState = connectionState 
    ?? (isConnected ? 'connected' : 'connecting');
  
  if (error) {
    return (
      <div
        className="connection-status connection-status-error flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 text-red-500 text-xs"
        data-testid={testId}
      >
        <span className="w-2 h-2 rounded-full bg-red-500" />
        <span className="max-w-[200px] truncate">{error}</span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="ml-1 underline hover:no-underline"
            data-testid={retryButtonTestId}
          >
            重试
          </button>
        )}
      </div>
    );
  }
  
  const stateConfig = {
    connected: {
      bg: 'bg-green-500/10',
      text: 'text-green-500',
      dot: 'bg-green-500',
      label: '已连接',
      showLoading: false,
    },
    connecting: {
      bg: 'bg-amber-500/10',
      text: 'text-amber-500',
      dot: 'bg-amber-500',
      label: '连接中...',
      showLoading: true,
    },
    reconnecting: {
      bg: 'bg-amber-500/10',
      text: 'text-amber-500',
      dot: 'bg-amber-500',
      label: '重连中...',
      showLoading: true,
    },
    disconnected: {
      bg: 'bg-zinc-500/10',
      text: 'text-zinc-500',
      dot: 'bg-zinc-500',
      label: '已断开',
      showLoading: false,
    },
  };
  
  const config = stateConfig[state];
  
  return (
    <div
      className={`connection-status flex items-center gap-2 px-3 py-1.5 rounded-full text-xs ${config.bg} ${config.text}`}
      data-testid={testId}
    >
      {config.showLoading ? (
        <LoadingIcon size={12} className={config.text} />
      ) : (
        <span className={`w-2 h-2 rounded-full ${config.dot}`} />
      )}
      <span>{config.label}</span>
    </div>
  );
};
