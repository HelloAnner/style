/**
 * 可折叠区域组件
 */

import React from 'react';
import { motion } from 'framer-motion';
import { AnimatePresence } from '../../lib/motion';
import { ChevronIcon } from './Icons';

interface CollapsibleProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  titleColor?: 'default' | 'accent' | 'secondary' | 'success' | 'error' | 'warning';
  icon?: React.ReactNode;
  badge?: string | number;
  className?: string;
  testId?: string;
  triggerTestId?: string;
  contentTestId?: string;
}

const colorClasses = {
  default: 'text-zinc-400',
  accent: 'text-accent',
  secondary: 'text-secondary',
  success: 'text-success',
  error: 'text-error',
  warning: 'text-warning',
};

export const Collapsible: React.FC<CollapsibleProps> = ({
  title,
  isOpen,
  onToggle,
  children,
  titleColor = 'default',
  icon,
  badge,
  className = '',
  testId,
  triggerTestId,
  contentTestId,
}) => {
  return (
    <div
      className={`collapsible border-t border-surface-200 ${className}`}
      data-testid={testId}
    >
      {/* 头部 */}
      <button
        onClick={onToggle}
        className="collapsible-trigger w-full flex items-center justify-between px-3 py-2 hover:bg-surface-100/50 transition-colors"
        data-testid={triggerTestId}
      >
        <div className="flex items-center gap-2">
          {icon && <span className={colorClasses[titleColor]}>{icon}</span>}
          <span className={`text-xs font-medium ${colorClasses[titleColor]}`}>
            {title}
          </span>
          {badge !== undefined && (
            <span className="px-1.5 py-0.5 text-xs rounded bg-surface-200 text-zinc-500">
              {badge}
            </span>
          )}
        </div>
        
        <motion.div
          animate={{ rotate: isOpen ? 90 : 0 }}
          transition={{ duration: 0.15 }}
        >
          <ChevronIcon size={12} className="text-zinc-600" />
        </motion.div>
      </button>
      
      {/* 内容 */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            className="collapsible-content-wrapper"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div
              className="collapsible-content px-3 pb-3"
              data-testid={contentTestId}
            >
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
