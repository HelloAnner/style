/**
 * 文件右键菜单
 * 使用 createPortal 挂到 body，支持预览/重命名/下载/删除
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useUserFileStore } from '../../stores/userFileStore';
import { useFileReferenceStore } from '../../stores/fileReferenceStore';
import { userFileDownloadUrl, type UserFileInfo } from '../../api/userFiles';
import { toast } from '../../utils/toast';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { getExt, getBaseName, replaceFileName, validateRenameBaseName } from '../../utils/fileTypes';

interface FileContextMenuProps {
  tenantId: string;
  file: UserFileInfo;
  position: { x: number; y: number };
  onClose: () => void;
  onPreview?: (file: UserFileInfo) => void;
}

export function FileContextMenu({
  tenantId,
  file,
  position,
  onClose,
  onPreview,
}: FileContextMenuProps) {
  const { renameOptimistic, deleteOptimistic } = useUserFileStore();
  const addReference = useFileReferenceStore(s => s.addReference);
  const fullName = file.displayName || file.path;
  const ext = getExt(fullName);
  const [mode, setMode] = useState<'menu' | 'rename' | 'confirm-delete' | 'name-conflict'>('menu');
  const [newName, setNewName] = useState(getBaseName(fullName));
  const [conflictMessage, setConflictMessage] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const modeRef = useRef<'menu' | 'rename' | 'confirm-delete' | 'name-conflict'>('menu');
  useEffect(() => { modeRef.current = mode; }, [mode]);
  const [coords, setCoords] = useState<{ top: number; left: number; ready: boolean }>({
    top: position.y,
    left: position.x,
    ready: false,
  });

  // 测量菜单真实尺寸后，将其 clamp 到 viewport 内，避免贴边被截断。
  // mode 变化会改变菜单尺寸（如切到 confirm-delete 文案更长），需要重新校正。
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 8;
    let left = position.x;
    let top = position.y;
    if (left + rect.width + gap > vw) left = Math.max(gap, vw - rect.width - gap);
    if (top + rect.height + gap > vh) top = Math.max(gap, vh - rect.height - gap);
    setCoords({ top, left, ready: true });
  }, [position.x, position.y, mode]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (modeRef.current === 'name-conflict') return;
      onClose();
    };
    const onClickOutside = () => {
      if (modeRef.current === 'name-conflict') return;
      onClose();
    };
    document.addEventListener('keydown', onEsc);
    document.addEventListener('mousedown', onClickOutside);
    return () => {
      document.removeEventListener('keydown', onEsc);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, [onClose]);

  const doRename = async () => {
    const trimmed = newName.trim();
    const baseName = getBaseName(fullName);
    const validationError = validateRenameBaseName(trimmed);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    if (!trimmed || trimmed === baseName) {
      onClose();
      return;
    }
    try {
      await renameOptimistic(tenantId, file.path, replaceFileName(file.path, trimmed + ext));
      onClose();
    } catch (e: any) {
      if (e?.response?.status === 409) {
        setConflictMessage(`「${trimmed + ext}」已存在，请修改文件名后重试。`);
        setMode('name-conflict');
      } else {
        toast.error(`重命名失败：${e.message}`);
        onClose();
      }
    }
  };

  const doDelete = async () => {
    onClose();
    try {
      if (file.id) await deleteOptimistic(tenantId, file.path, file.id);
      else await deleteOptimistic(tenantId, file.path);
    } catch (e: any) {
      toast.error(`删除失败：${e.message}`);
    }
  };

  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    top: coords.top,
    left: coords.left,
    zIndex: 1000,
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-md)',
    boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
    minWidth: 140,
    overflow: 'hidden',
    // 测量前先隐藏，避免首帧在错误位置闪一下
    visibility: (coords.ready && mode !== 'name-conflict') ? 'visible' : 'hidden',
  };

  const menuItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 14px',
    fontSize: 13,
    color: 'var(--text-primary)',
    cursor: 'pointer',
    transition: 'background var(--transition-fast)',
  };

  const dangerItemStyle: React.CSSProperties = {
    ...menuItemStyle,
    color: 'var(--danger)',
  };

  return createPortal(
    <>
    <div
      ref={menuRef}
      style={menuStyle}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {mode === 'menu' && (
        <ul role="menu" style={{ listStyle: 'none', margin: 0, padding: '4px 0' }}>
          <li
            role="menuitem"
            style={menuItemStyle}
            onClick={() => {
              onPreview?.(file);
              onClose();
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLElement).style.background = 'var(--bg-hover-v11)')
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLElement).style.background = 'transparent')
            }
          >
            预览
          </li>
          <li
            role="menuitem"
            style={menuItemStyle}
            onClick={() => {
              addReference({
                id: `ref-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                fileName: file.displayName || file.path,
                filePath: file.path,
                level: 'user_file',
                type: 'full',
              });
              onClose();
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLElement).style.background = 'var(--bg-hover-v11)')
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLElement).style.background = 'transparent')
            }
          >
            引用到对话
          </li>
          <li
            role="menuitem"
            style={menuItemStyle}
            onClick={() => {
              setNewName(getBaseName(fullName));
              setMode('rename');
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLElement).style.background = 'var(--bg-hover-v11)')
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLElement).style.background = 'transparent')
            }
          >
            重命名
          </li>
          <li
            role="menuitem"
            style={menuItemStyle}
            onClick={async () => {
              // window.open 不经过 fetch 拦截器，不会携带 Authorization，
              // 会被后端 401 拦截（见 docs/bug/20260422-我的文件下载跳登录.md）。
              try {
                const r = await fetch(
                  userFileDownloadUrl({ tenantId, path: file.path, disposition: 'attachment' })
                );
                if (!r.ok) throw new Error(String(r.status));
                const blob = await r.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = file.displayName || file.path.split('/').pop() || file.path;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 0);
              } catch {
                toast.error('下载失败');
              } finally {
                onClose();
              }
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLElement).style.background = 'var(--bg-hover-v11)')
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLElement).style.background = 'transparent')
            }
          >
            下载
          </li>
          <li
            role="menuitem"
            style={dangerItemStyle}
            onClick={() => setMode('confirm-delete')}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLElement).style.background = 'var(--danger-bg-soft)')
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLElement).style.background = 'transparent')
            }
          >
            删除
          </li>
        </ul>
      )}

      {mode === 'rename' && (
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>
            重命名文件
          </div>
          <input
            data-testid="rename-input"
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') doRename();
              if (e.key === 'Escape') onClose();
            }}
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              padding: '6px 8px',
              fontSize: 13,
              color: 'var(--text-primary)',
              outline: 'none',
              width: '100%',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button
              onClick={onClose}
              style={{
                padding: '4px 10px',
                fontSize: 12,
                background: 'transparent',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              取消
            </button>
            <button
              onClick={doRename}
              style={{
                padding: '4px 10px',
                fontSize: 12,
                background: 'var(--accent-color)',
                border: '1px solid var(--accent-color)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-on-accent)',
                cursor: 'pointer',
              }}
            >
              确定
            </button>
          </div>
        </div>
      )}

      {mode === 'confirm-delete' && (
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-primary)' }}>
            确定删除『{file.displayName || file.path}』？此操作不可撤销。
          </p>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button
              onClick={onClose}
              style={{
                padding: '4px 10px',
                fontSize: 12,
                background: 'transparent',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              取消
            </button>
            <button
              onClick={doDelete}
              style={{
                padding: '4px 10px',
                fontSize: 12,
                background: 'var(--danger-bg-soft)',
                border: '1px solid var(--danger)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--danger)',
                cursor: 'pointer',
              }}
            >
              删除
            </button>
          </div>
        </div>
      )}
    </div>
    {mode === 'name-conflict' && (
      <ConfirmDialog
        open={true}
        title="文件名冲突"
        description={conflictMessage}
        confirmText="修改"
        cancelText="取消"
        onConfirm={() => setMode('rename')}
        onCancel={onClose}
      />
    )}
    </>,
    document.body
  );
}
