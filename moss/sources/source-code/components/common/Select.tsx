/**
 * 自定义下拉选择组件
 * 
 * 特性：
 * - 支持明暗主题
 * - 流畅的动画效果
 * - 键盘导航支持
 * - 与设计系统一致的样式
 */

import React, { useState, useRef, useEffect, useId, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { AnimatePresence } from '../../lib/motion';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
  badge?: string;
  groupHeader?: boolean;
}

export interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  variant?: 'default' | 'underline';
  density?: 'default' | 'compact' | 'mini';
  triggerStyle?: React.CSSProperties;
  triggerRole?: React.AriaRole;
  ariaLabel?: string;
  menuZIndex?: number;
  testId?: string;
  triggerTestId?: string;
  menuTestId?: string;
  optionTestIdPrefix?: string;
  emptyStateTestId?: string;
}

const toTestIdSegment = (value: string) => value.replace(/[^a-zA-Z0-9_-]+/g, '-');

export const Select: React.FC<SelectProps> = ({
  value,
  onChange,
  options,
  placeholder = '请选择',
  disabled = false,
  className = '',
  style,
  variant = 'default',
  density = 'default',
  triggerStyle,
  triggerRole,
  ariaLabel,
  menuZIndex = 1100,
  testId,
  triggerTestId,
  menuTestId,
  optionTestIdPrefix,
  emptyStateTestId,
}) => {
  const isUnderline = variant === 'underline';
  const listboxId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; ready: boolean }>({
    top: 0, left: 0, width: 0, ready: false,
  });

  const selectedOption = options.find(opt => opt.value === value);

  const findSelectableIndex = useCallback((start: number, direction: 1 | -1) => {
    if (options.length === 0) return -1;
    for (let offset = 0; offset < options.length; offset += 1) {
      const index = (start + direction * offset + options.length) % options.length;
      const option = options[index];
      if (!option.disabled && !option.groupHeader) return index;
    }
    return -1;
  }, [options]);

  // 测量触发器位置后定位 + 视口翻转，配合 createPortal 逃出父容器 overflow 边界
  useLayoutEffect(() => {
    if (!isOpen) { setCoords(c => ({ ...c, ready: false })); return; }
    const triggerEl = triggerRef.current;
    const menuEl = listRef.current;
    if (!triggerEl) return;
    const t = triggerEl.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 4;
    const menuHeight = menuEl?.offsetHeight ?? 280;

    let top = t.bottom + gap;
    let left = t.left;
    const width = t.width;

    // 垂直翻转：下方放不下则翻到上方
    if (top + menuHeight > vh - gap) {
      const flipped = t.top - menuHeight - gap;
      if (flipped >= gap) top = flipped;
    }
    // 水平 clamp
    if (left + width > vw - gap) left = vw - width - gap;
    if (left < gap) left = gap;

    setCoords({ top, left, width, ready: true });
  }, [isOpen, options.length]);

  // 滚动/窗口 resize 时重新测量
  useEffect(() => {
    if (!isOpen) return;
    const reposition = () => {
      const triggerEl = triggerRef.current;
      const menuEl = listRef.current;
      if (!triggerEl) return;
      const t = triggerEl.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const gap = 4;
      const menuHeight = menuEl?.offsetHeight ?? 280;
      let top = t.bottom + gap;
      let left = t.left;
      if (top + menuHeight > vh - gap) {
        const flipped = t.top - menuHeight - gap;
        if (flipped >= gap) top = flipped;
      }
      if (left + t.width > vw - gap) left = vw - t.width - gap;
      if (left < gap) left = gap;
      setCoords({ top, left, width: t.width, ready: true });
    };
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [isOpen]);
  
  // 点击外部关闭（含 portal 内的下拉列表）
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);
  
  // 键盘导航
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return;
    
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (isOpen && highlightedIndex >= 0) {
          const option = options[highlightedIndex];
          if (!option.disabled && !option.groupHeader) {
            onChange(option.value);
            setIsOpen(false);
            triggerRef.current?.focus();
          }
        } else {
          setIsOpen(true);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setHighlightedIndex(prev => findSelectableIndex(prev < 0 ? 0 : prev + 1, 1));
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (isOpen) {
          setHighlightedIndex(prev => findSelectableIndex(prev < 0 ? options.length - 1 : prev - 1, -1));
        }
        break;
      case 'Home':
        if (isOpen) {
          e.preventDefault();
          setHighlightedIndex(findSelectableIndex(0, 1));
        }
        break;
      case 'End':
        if (isOpen) {
          e.preventDefault();
          setHighlightedIndex(findSelectableIndex(options.length - 1, -1));
        }
        break;
      case 'Tab':
        setIsOpen(false);
        break;
    }
  }, [disabled, findSelectableIndex, highlightedIndex, isOpen, onChange, options]);
  
  // 打开时滚动到选中项
  useEffect(() => {
    if (isOpen && listRef.current) {
      const selectedIndex = options.findIndex(opt => opt.value === value);
      setHighlightedIndex(
        selectedIndex >= 0 && !options[selectedIndex]?.disabled && !options[selectedIndex]?.groupHeader
          ? selectedIndex
          : findSelectableIndex(0, 1),
      );
    }
  }, [findSelectableIndex, isOpen, options, value]);

  useEffect(() => {
    if (!isOpen || highlightedIndex < 0) return;
    document
      .getElementById(`${listboxId}-option-${highlightedIndex}`)
      ?.scrollIntoView?.({ block: 'nearest' });
  }, [highlightedIndex, isOpen, listboxId]);
  
  const handleSelect = (option: SelectOption) => {
    if (option.disabled) return;
    onChange(option.value);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const densityStyle: React.CSSProperties = density === 'mini'
    ? { height: 30, padding: '0 8px', borderRadius: 6, fontSize: 12 }
    : density === 'compact'
      ? { height: 36, padding: '0 10px', borderRadius: 8, fontSize: 13 }
      : {};
  
  return (
    <div
      ref={containerRef}
      className={`select relative ${className}`}
      data-testid={testId}
      style={style}
    >
      {/* 触发器 */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        role={triggerRole}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        aria-activedescendant={
          isOpen && highlightedIndex >= 0 ? `${listboxId}-option-${highlightedIndex}` : undefined
        }
        className="select-trigger w-full flex items-center justify-between transition-colors"
        data-testid={triggerTestId}
        style={isUnderline ? {
          padding: '0 0 10px 0',
          fontSize: 15,
          borderRadius: 0,
          border: 'none',
          borderBottom: '1px solid var(--studio-border-input)',
          background: 'transparent',
          color: selectedOption ? 'var(--studio-text-input)' : 'var(--studio-text-placeholder)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          outline: 'none',
          textAlign: 'left',
          opacity: disabled ? 0.6 : 1,
          ...densityStyle,
          ...triggerStyle,
        } : {
          padding: '10px 14px',
          fontSize: 14,
          borderRadius: 10,
          border: `1px solid ${isOpen ? 'var(--accent-color)' : 'var(--input-border)'}`,
          background: disabled ? 'var(--bg-tertiary)' : 'var(--input-bg)',
          color: selectedOption ? 'var(--text-primary)' : 'var(--text-muted)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          outline: 'none',
          textAlign: 'left',
          opacity: disabled ? 0.6 : 1,
          ...densityStyle,
          ...triggerStyle,
        }}
      >
        <span 
          className="flex-1 flex items-center gap-2 truncate"
          style={{ marginRight: 8 }}
        >
          <span className="truncate">{selectedOption?.label || placeholder}</span>
          {selectedOption?.badge && (
            <span style={{
              fontSize: 10,
              fontWeight: 500,
              padding: '1px 6px',
              borderRadius: 4,
              background: 'var(--hover-bg)',
              color: 'var(--text-muted)',
              border: '1px solid var(--border-subtle)',
              flexShrink: 0,
              lineHeight: '16px',
            }}>
              {selectedOption.badge}
            </span>
          )}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown size={isUnderline ? 14 : 16} style={{ color: isUnderline ? 'var(--studio-text-faint)' : 'var(--text-muted)', flexShrink: 0 }} />
        </motion.div>
      </button>
      
      {/* 下拉列表（用 createPortal 渲染到 body，逃出父容器 overflow 边界） */}
      {createPortal(
        <AnimatePresence>
          {isOpen && (<motion.div
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label={ariaLabel}
            className="select-menu"
            data-testid={menuTestId}
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            style={isUnderline ? {
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              width: coords.width,
              zIndex: menuZIndex,
              visibility: coords.ready ? 'visible' : 'hidden',
              background: 'var(--studio-dropdown-bg)',
              border: '1px solid var(--studio-border-input)',
              borderRadius: 12,
              boxShadow: 'var(--studio-dropdown-shadow)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              maxHeight: 280,
              overflowY: 'auto',
              overflowX: 'hidden',
            } : {
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              width: coords.width,
              zIndex: menuZIndex,
              visibility: coords.ready ? 'visible' : 'hidden',
              background: 'var(--dropdown-bg)',
              border: '1px solid var(--dropdown-border)',
              borderRadius: 12,
              boxShadow: 'var(--shadow-lg)',
              maxHeight: 280,
              overflowY: 'auto',
              overflowX: 'hidden',
            }}
          >
            <div style={{ padding: 4 }}>
              {options.map((option, index) => {
                if (option.groupHeader) {
                  return (
                    <div
                      key={option.value}
                      role="presentation"
                      className="select-group-header"
                      style={{
                        padding: '8px 12px 4px',
                        fontSize: 11,
                        fontWeight: 600,
                        color: isUnderline ? 'var(--studio-text-muted)' : 'var(--text-muted)',
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        userSelect: 'none',
                        ...(index > 0 ? {
                          marginTop: 4,
                          borderTop: `1px solid ${isUnderline ? 'var(--studio-border-input)' : 'var(--border-subtle)'}`,
                          paddingTop: 10,
                        } : {}),
                      }}
                    >
                      {option.label}
                    </div>
                  );
                }

                const isSelected = option.value === value;
                const isHighlighted = index === highlightedIndex;
                
                return (
                  <div
                    key={option.value}
                    id={`${listboxId}-option-${index}`}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={option.disabled || undefined}
                    onClick={() => handleSelect(option)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className="select-option flex items-center justify-between transition-colors"
                    data-testid={optionTestIdPrefix ? `${optionTestIdPrefix}-${toTestIdSegment(option.value)}` : undefined}
                    style={{
                      padding: isUnderline ? '9px 12px' : '10px 12px',
                      fontSize: isUnderline ? 13 : 14,
                      borderRadius: 8,
                      cursor: option.disabled ? 'not-allowed' : 'pointer',
                      background: isHighlighted
                        ? (isUnderline ? 'var(--studio-surface-hover)' : 'var(--hover-bg)')
                        : 'transparent',
                      color: option.disabled 
                        ? (isUnderline ? 'var(--studio-text-faint)' : 'var(--text-muted)')
                        : isSelected 
                          ? (isUnderline ? 'var(--studio-text-primary)' : 'var(--text-primary)')
                          : (isUnderline ? 'var(--studio-text-secondary)' : 'var(--text-secondary)'),
                      opacity: option.disabled ? 0.5 : 1,
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 truncate">
                        <span className="truncate">{option.label}</span>
                        {option.badge && (
                          <span style={{
                            fontSize: 10,
                            fontWeight: 500,
                            padding: '1px 6px',
                            borderRadius: 4,
                            background: 'var(--hover-bg)',
                            color: 'var(--text-muted)',
                            border: '1px solid var(--border-subtle)',
                            flexShrink: 0,
                            lineHeight: '16px',
                          }}>
                            {option.badge}
                          </span>
                        )}
                      </div>
                      {option.description && (
                        <div 
                          className="truncate"
                          style={{ 
                            fontSize: isUnderline ? 11 : 12, 
                            color: isUnderline ? 'var(--studio-text-desc)' : 'var(--text-muted)',
                            marginTop: 2,
                          }}
                        >
                          {option.description}
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <Check 
                        size={16} 
                        style={{ 
                          color: 'var(--accent-color)', 
                          marginLeft: 8,
                          flexShrink: 0,
                        }} 
                      />
                    )}
                  </div>
                );
              })}
              
              {options.length === 0 && (
                <div
                  className="select-empty-state"
                  data-testid={emptyStateTestId}
                  style={{
                    padding: '16px 12px',
                    fontSize: 13,
                    color: 'var(--text-muted)',
                    textAlign: 'center',
                  }}
                >
                  暂无选项
                </div>
              )}
            </div>
          </motion.div>)}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
};

export default Select;
