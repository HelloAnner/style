/**
 * TodoDrawer - 任务清单抽屉组件
 * 
 * 【设计理念】
 * - 位于输入框上方的折叠抽屉
 * - 首次创建和每次更新时展开，2秒后自动收起
 * - 收起后只显示一行高度，展示当前正在进行的任务
 * - 整体设计参考 Lovable 的风格
 */

import React, { memo, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { AnimatePresence } from '../../lib/motion';
import { Circle, CheckCircle2, Loader2, XCircle, ChevronUp, ChevronDown } from 'lucide-react';

// ========== 类型定义 ==========

export interface TodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
}

interface TodoDrawerProps {
  /** 任务列表 */
  todos: TodoItem[];
  /** 是否显示（有任务时显示） */
  visible?: boolean;
}

// ========== 任务图标组件 ==========

const TodoIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 11l3 3L22 4" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// ========== 主组件 ==========

export const TodoDrawer: React.FC<TodoDrawerProps> = memo(({ todos, visible = true }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [lastTodosHash, setLastTodosHash] = useState('');
  const autoCollapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // 计算统计数据
  const stats = useMemo(() => {
    const result = { total: 0, completed: 0, inProgress: 0, pending: 0 };
    for (const todo of todos) {
      result.total++;
      if (todo.status === 'completed') result.completed++;
      else if (todo.status === 'in_progress') result.inProgress++;
      else if (todo.status === 'pending') result.pending++;
    }
    return result;
  }, [todos]);
  
  // 当前进行中的任务
  const currentTask = useMemo(() => {
    return todos.find(t => t.status === 'in_progress') || todos.find(t => t.status === 'pending');
  }, [todos]);
  
  // 计算 todos 的 hash（用于检测更新）
  const todosHash = useMemo(() => {
    return JSON.stringify(todos.map(t => `${t.id}:${t.status}`));
  }, [todos]);
  
  // 清除自动收起定时器
  const clearAutoCollapseTimer = useCallback(() => {
    if (autoCollapseTimerRef.current) {
      clearTimeout(autoCollapseTimerRef.current);
      autoCollapseTimerRef.current = null;
    }
  }, []);
  
  // 设置自动收起定时器
  const scheduleAutoCollapse = useCallback(() => {
    clearAutoCollapseTimer();
    autoCollapseTimerRef.current = setTimeout(() => {
      setIsExpanded(false);
    }, 2000); // 2秒后自动收起
  }, [clearAutoCollapseTimer]);
  
  // 监听 todos 变化，触发展开
  useEffect(() => {
    if (todos.length === 0) return;
    
    if (todosHash !== lastTodosHash) {
      setLastTodosHash(todosHash);
      // 新任务或更新时展开
      setIsExpanded(true);
      scheduleAutoCollapse();
    }
  }, [todosHash, lastTodosHash, scheduleAutoCollapse, todos.length]);
  
  // 清理定时器
  useEffect(() => {
    return () => clearAutoCollapseTimer();
  }, [clearAutoCollapseTimer]);
  
  // 手动切换展开/收起
  const toggleExpand = useCallback(() => {
    setIsExpanded(prev => {
      if (!prev) {
        // 展开时设置自动收起
        scheduleAutoCollapse();
      } else {
        // 收起时清除定时器
        clearAutoCollapseTimer();
      }
      return !prev;
    });
  }, [scheduleAutoCollapse, clearAutoCollapseTimer]);
  
  // 鼠标进入时暂停自动收起
  const handleMouseEnter = useCallback(() => {
    clearAutoCollapseTimer();
  }, [clearAutoCollapseTimer]);
  
  // 鼠标离开时重新设置自动收起
  const handleMouseLeave = useCallback(() => {
    if (isExpanded) {
      scheduleAutoCollapse();
    }
  }, [isExpanded, scheduleAutoCollapse]);
  
  // 不显示或没有任务时返回 null
  if (!visible || todos.length === 0) {
    return null;
  }
  
  // 进度百分比
  const progress = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
  
  // 状态图标
  const StatusIcon: React.FC<{ status: string; size?: number }> = ({ status, size = 14 }) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 size={size} style={{ color: 'var(--text-muted)' }} />;
      case 'in_progress':
        return <Loader2 size={size} className="animate-spin" style={{ color: 'var(--text-secondary)' }} />;
      case 'cancelled':
        return <XCircle size={size} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />;
      default:
        return <Circle size={size} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />;
    }
  };
  
  return (
    <div
      data-testid="todo-drawer"
      className="rounded-t-lg border border-b-0 overflow-hidden"
      style={{
        background: 'var(--bg-primary)',
        borderColor: 'var(--border-muted)',
        maxWidth: '100%',
        boxShadow: '0 -4px 16px rgba(0,0,0,0.08)',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* 收起状态：单行显示 */}
      <div 
        className="flex items-center gap-2 px-3 py-2 cursor-pointer"
        data-testid="todo-drawer-toggle"
        onClick={toggleExpand}
        style={{ borderBottom: isExpanded ? '1px solid var(--border-subtle)' : 'none' }}
      >
        {/* 图标 */}
        <div className="flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
          <TodoIcon size={14} />
        </div>
        
        {/* 标题和进度 */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            任务清单
          </span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {stats.completed}/{stats.total}
          </span>
          
          {/* 迷你圆环进度 */}
          <svg width="14" height="14" viewBox="0 0 14 14" className="flex-shrink-0">
            {/* 背景圆环 */}
            <circle
              cx="7"
              cy="7"
              r="5"
              fill="none"
              stroke="var(--bg-tertiary)"
              strokeWidth="2"
            />
            {/* 进度圆环 */}
            <motion.circle
              cx="7"
              cy="7"
              r="5"
              fill="none"
              stroke={progress === 100 ? 'var(--text-muted)' : 'var(--text-tertiary)'}
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 5}
              initial={{ strokeDashoffset: 2 * Math.PI * 5 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 5 * (1 - progress / 100) }}
              transition={{ duration: 0.3 }}
              style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
            />
          </svg>
        </div>
        
        {/* 当前任务预览（收起时显示） - 占据剩余空间 */}
        {!isExpanded && currentTask && (
          <span 
            data-testid="todo-drawer-current-task"
            className="text-xs truncate flex-1 text-right"
            style={{ color: 'var(--text-muted)' }}
          >
            {currentTask.content}
          </span>
        )}
        
        {/* 展开/收起图标 */}
        <div className="flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
          {isExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </div>
      </div>
      
      {/* 展开状态：完整任务列表 */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            data-testid="todo-drawer-expanded"
            className="overflow-hidden"
          >
            <div className="px-2 py-1.5 space-y-0.5 max-h-48 overflow-y-auto" data-testid="todo-drawer-list">
              {todos.map((todo, index) => (
                <motion.div
                  key={todo.id || index}
                  data-testid={`todo-drawer-item-${todo.id}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className={`todo-drawer-item flex items-start gap-2 px-2 py-1.5 rounded transition-colors ${
                    todo.status === 'in_progress' 
                      ? 'bg-zinc-500/5' 
                      : ''
                  }`}
                >
                  {/* 状态图标 */}
                  <div className="flex-shrink-0 mt-0.5">
                    <StatusIcon status={todo.status} size={14} />
                  </div>
                  
                  {/* 任务内容 */}
                  <span 
                    className={`text-xs leading-relaxed flex-1 ${
                      todo.status === 'completed' || todo.status === 'cancelled'
                        ? 'line-through opacity-50'
                        : ''
                    }`}
                    style={{ 
                      color: todo.status === 'in_progress' 
                        ? 'var(--text-primary)' 
                        : 'var(--text-secondary)'
                    }}
                  >
                    {todo.content}
                  </span>
                  
                  {/* 状态标签（仅进行中显示） */}
                  {todo.status === 'in_progress' && (
                    <span 
                      className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded"
                      style={{ 
                        background: 'var(--bg-tertiary)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      进行中
                    </span>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

TodoDrawer.displayName = 'TodoDrawer';
