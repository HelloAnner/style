import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FolderOpen, Upload } from 'lucide-react';

interface UploadMenuProps {
  open: boolean;
  onClose: () => void;
  onUploadFile: () => void;
  onSelectMyFiles: () => void;
  anchorEl: HTMLElement | null;
}

export function UploadMenu({
  open,
  onClose,
  onUploadFile,
  onSelectMyFiles,
  anchorEl,
}: UploadMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; ready: boolean }>({
    top: 0,
    left: 0,
    ready: false,
  });

  useLayoutEffect(() => {
    if (!open || !anchorEl || !menuRef.current) return;
    const anchorRect = anchorEl.getBoundingClientRect();
    const menuRect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const gap = 8;

    let top = anchorRect.top - menuRect.height - gap;
    if (top < gap) top = anchorRect.bottom + gap;
    let left = anchorRect.right - menuRect.width;
    if (left < gap) left = gap;
    if (left + menuRect.width + gap > vw) left = vw - menuRect.width - gap;

    setCoords({ top, left, ready: true });
  }, [open, anchorEl]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open, onClose]);

  if (!open) return null;

  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    top: coords.top,
    left: coords.left,
    zIndex: 1001,
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-md)',
    boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
    minWidth: 160,
    padding: '4px 0',
    visibility: coords.ready ? 'visible' : 'hidden',
  };

  const itemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 14px',
    fontSize: 13,
    color: 'var(--text-primary)',
    cursor: 'pointer',
    transition: 'background var(--transition-fast)',
    width: '100%',
    textAlign: 'left' as const,
    background: 'transparent',
    border: 'none',
    fontFamily: 'inherit',
  };

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      data-testid="upload-menu"
      style={menuStyle}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        role="menuitem"
        data-testid="upload-menu-upload-file"
        style={itemStyle}
        onClick={() => {
          onUploadFile();
          onClose();
        }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLElement).style.background = 'var(--bg-hover-v11)')
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLElement).style.background = 'transparent')
        }
      >
        <Upload size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        上传文件
      </button>
      <button
        role="menuitem"
        data-testid="upload-menu-select-my-files"
        style={itemStyle}
        onClick={() => {
          onSelectMyFiles();
          onClose();
        }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLElement).style.background = 'var(--bg-hover-v11)')
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLElement).style.background = 'transparent')
        }
      >
        <FolderOpen size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        选择我的文件
      </button>
    </div>,
    document.body
  );
}
