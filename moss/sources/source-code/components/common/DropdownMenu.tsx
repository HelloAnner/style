/**
 * 通用下拉菜单
 *
 * 使用 createPortal 挂到 body，fixed 定位 + useLayoutEffect 测量后
 * clamp 到视口内。支持 danger 项样式、Escape / 外部点击关闭。
 *
 * 不追求 antd / shadcn 级完整能力（无子菜单、无搜索、无键盘箭头导航），
 * 只覆盖"一列菜单项 + 一个触发器"场景。
 */

import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';

export interface DropdownMenuItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  selected?: boolean;
  onClick: () => void;
}

export type DropdownMenuPlacement = 'bottom-end' | 'bottom-start' | 'top-end' | 'top-start';

export interface DropdownMenuProps {
  items: DropdownMenuItem[];
  trigger: React.ReactElement;
  placement?: DropdownMenuPlacement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  menuMinWidth?: number;
}

export function DropdownMenu({
  items,
  trigger,
  placement = 'bottom-end',
  open: controlledOpen,
  onOpenChange,
  menuMinWidth = 160,
}: DropdownMenuProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const setOpen = useCallback((next: boolean) => {
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  }, [isControlled, onOpenChange]);

  const triggerRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; ready: boolean }>({
    top: 0, left: 0, ready: false,
  });

  // 测量菜单真实尺寸后定位 + 翻转
  useLayoutEffect(() => {
    if (!open) { setCoords(c => ({ ...c, ready: false })); return; }
    const triggerEl = triggerRef.current?.firstElementChild as HTMLElement | null;
    const menuEl = menuRef.current;
    if (!triggerEl || !menuEl) return;
    const t = triggerEl.getBoundingClientRect();
    const m = menuEl.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 4;

    let top: number;
    let left: number;
    const placeBottom = placement.startsWith('bottom');
    const placeEnd = placement.endsWith('end');

    top = placeBottom ? t.bottom + gap : t.top - m.height - gap;
    left = placeEnd ? t.right - m.width : t.left;

    // 翻转：垂直溢出
    if (placeBottom && top + m.height > vh - gap) top = t.top - m.height - gap;
    if (!placeBottom && top < gap) top = t.bottom + gap;
    // 水平溢出：clamp
    if (left + m.width > vw - gap) left = vw - m.width - gap;
    if (left < gap) left = gap;

    setCoords({ top, left, ready: true });
  }, [open, placement, menuMinWidth]);

  // Escape + 外部 pointerdown 关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, setOpen]);

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setOpen(!open);
  };

  return (
    <>
      <span
        ref={triggerRef}
        onClick={handleTriggerClick}
        style={{ display: 'inline-flex' }}
      >
        {trigger}
      </span>
      {open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            zIndex: 1000,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            minWidth: menuMinWidth,
            padding: 4,
            visibility: coords.ready ? 'visible' : 'hidden',
          }}
          onClick={(e) => e.stopPropagation()}
          data-testid="dropdown-menu"
        >
          {items.map((item) => (
            <button
              key={item.key}
              role="menuitem"
              disabled={item.disabled}
              onClick={(e) => {
                e.stopPropagation();
                if (item.disabled) return;
                setOpen(false);
                item.onClick();
              }}
              onMouseEnter={(e) => {
                if (item.disabled) return;
                e.currentTarget.style.background = item.danger
                  ? 'var(--danger-bg-soft)'
                  : 'var(--hover-bg)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                boxSizing: 'border-box',
                padding: '8px 12px',
                border: 'none',
                borderRadius: 6,
                background: 'transparent',
                cursor: item.disabled ? 'not-allowed' : 'pointer',
                fontSize: 13,
                fontWeight: item.selected ? 600 : 400,
                color: item.selected
                  ? 'var(--moss-home-title-accent)'
                  : item.danger
                    ? 'var(--danger)'
                    : 'var(--text-primary)',
                opacity: item.disabled && !item.selected ? 0.5 : 1,
                textAlign: 'left',
                transition: 'background 0.12s',
              }}
              data-testid={`dropdown-menu-item-${item.key}`}
            >
              {item.icon && (
                <span style={{ display: 'inline-flex', width: 16, height: 16, flexShrink: 0 }}>
                  {item.icon}
                </span>
              )}
              <span style={{ flex: 1, minWidth: 0 }}>{item.label}</span>
              {item.selected && (
                <Check size={14} aria-hidden="true" style={{ flexShrink: 0 }} />
              )}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
