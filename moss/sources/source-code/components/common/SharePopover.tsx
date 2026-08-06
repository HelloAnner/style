import { type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { AnimatePresence } from '../../lib/motion';
import { MossSwitch } from './MossSwitch';

export type SharePopoverItemType = 'enterprise' | 'public';

export interface SharePopoverItem {
  type: SharePopoverItemType;
  label: string;
  url: string;
  loading: boolean;
  copied: boolean;
  error: string;
  disabled?: boolean;
}

interface SharePopoverProps {
  open: boolean;
  title: string;
  anchorRect?: DOMRect | null;
  zIndex?: number;
  testId?: string;
  backdropTestId?: string;
  children?: ReactNode;
  childrenBeforeItems?: ReactNode;
  items: SharePopoverItem[];
  onClose: () => void;
  onToggle: (type: SharePopoverItemType) => void;
  onCopy: (type: SharePopoverItemType) => void;
  onOpen: (type: SharePopoverItemType) => void;
}

export function SharePopover({
  open,
  title,
  anchorRect,
  zIndex = 60,
  testId,
  backdropTestId,
  children,
  childrenBeforeItems,
  items,
  onClose,
  onToggle,
  onCopy,
  onOpen,
}: SharePopoverProps) {
  if (!open) return null;

  const panelWidth = Math.min(380, window.innerWidth - 24);
  const preferredLeft = (anchorRect?.right ?? window.innerWidth - 16) - panelWidth;
  const panelLeft = Math.max(12, Math.min(preferredLeft, window.innerWidth - panelWidth - 12));
  const panelTop = Math.max(12, (anchorRect?.bottom ?? 52) + 8);

  const renderItem = (item: SharePopoverItem, index: number) => {
    const enabled = Boolean(item.url);
    const disabled = item.loading || item.disabled;
    return (
      <div
        className="share-item"
        style={{
          minHeight: enabled || item.error ? undefined : 64,
          padding: '20px 0',
          borderTop: index === 0 ? 'none' : '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: enabled || item.error ? 'flex-start' : 'center',
          gap: 10,
        }}
        data-testid={`share-item-${item.type}`}
        key={item.type}
      >
        <div style={{ minHeight: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
          <MossSwitch
            className="share-toggle"
            checked={enabled}
            ariaLabel={item.label}
            disabled={disabled}
            onChange={() => onToggle(item.type)}
            testId={`share-toggle-${item.type}`}
          />
          <span style={{ fontSize: 14, lineHeight: 1.35, fontWeight: 600, color: 'var(--text-primary)' }}>{item.label}</span>
        </div>

        {item.error && (
          <div style={{ padding: '6px 8px', background: 'var(--danger-bg-soft)', borderRadius: 6, fontSize: 12, color: 'var(--danger)' }}>
            {item.error}
          </div>
        )}

        {enabled && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              readOnly
              className="share-url-input"
              value={item.url}
              style={{
                flex: 1,
                minWidth: 0,
                padding: '6px 8px',
                fontSize: 12,
                color: 'var(--text-primary)',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-default)',
                borderRadius: 6,
                outline: 'none',
                fontFamily: 'monospace',
              }}
              data-testid={`share-url-${item.type}`}
            />
            <button
              type="button"
              className="share-copy-button"
              onClick={() => onCopy(item.type)}
              disabled={item.loading}
              style={{
                padding: '7px 12px',
                fontSize: 12,
                fontWeight: 500,
                color: item.copied ? 'var(--text-secondary)' : 'var(--bg-primary)',
                background: item.copied ? 'var(--bg-tertiary)' : 'var(--text-primary)',
                borderRadius: 6,
                border: 'none',
                cursor: item.loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
              }}
              data-testid={`share-copy-${item.type}`}
            >
              {item.copied ? '已复制' : '复制'}
            </button>
            <button
              type="button"
              className="share-open-button"
              onClick={() => onOpen(item.type)}
              disabled={item.loading}
              style={{
                padding: '7px 12px',
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--text-primary)',
                background: 'var(--bg-tertiary)',
                borderRadius: 6,
                border: '1px solid var(--border-default)',
                cursor: item.loading ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
              }}
              data-testid={`share-open-${item.type}`}
            >
              打开
            </button>
          </div>
        )}
      </div>
    );
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <div className="fixed inset-0" style={{ zIndex }} onClick={onClose} data-testid={backdropTestId} />
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="fixed"
            style={{ top: panelTop, left: panelLeft, zIndex: zIndex + 1 }}
            onClick={e => e.stopPropagation()}
            data-testid={testId}
          >
            <div style={{ width: panelWidth, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 10, boxShadow: '0 12px 40px rgba(0,0,0,0.25), 0 2px 10px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
              <div style={{ height: 46, background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'flex-end', padding: '0 14px 10px' }}>
                <h2 style={{ margin: 0, fontSize: 15, lineHeight: 1.3, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</h2>
              </div>
              <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column' }}>
                {childrenBeforeItems}
                {children}
                {items.map(renderItem)}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
