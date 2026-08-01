import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, FileSymlink, Share2, Trash2 } from 'lucide-react';
import editPencilIcon from '../../assets/icons/file-panel/edit-pencil.svg';
import renameInputIcon from '../../assets/icons/file-panel/rename-input.svg';
import { agentFilesApi } from '../../api/agentFiles';
import { userFileDownloadUrl, type UserFileInfo } from '../../api/userFiles';
import { useUserFileStore } from '../../stores/userFileStore';
import { toast } from '../../utils/toast';
import { getBaseName, getExt, isEditable, replaceFileName, validateRenameBaseName } from '../../utils/fileTypes';
import { ConfirmDialog } from '../common/ConfirmDialog';

interface FileActionPopoverProps {
  open: boolean;
  onClose: () => void;
  file: UserFileInfo;
  tenantId: string;
  anchorEl: HTMLElement | null;
  onPreview: (file: UserFileInfo) => void;
  onEdit?: (file: UserFileInfo) => void;
  scope?: 'user' | 'session';
  agentId?: string | null;
  sessionId?: string | null;
  onRefresh?: () => void | Promise<void>;
  onDeleted?: (path: string) => void;
  shared?: boolean;
  onShare?: () => void;
  onFileShare?: (anchorRect?: DOMRect | null) => void;
}

export function FileActionPopover({
  open,
  onClose,
  file,
  tenantId,
  anchorEl,
  onPreview,
  onEdit,
  scope = 'user',
  agentId,
  sessionId,
  onRefresh,
  onDeleted,
  shared = false,
  onShare,
  onFileShare,
}: FileActionPopoverProps) {
  const { renameOptimistic, deleteOptimistic } = useUserFileStore();
  const [mode, setMode] = useState<'menu' | 'rename' | 'name-conflict'>('menu');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const deleteDialogOpenRef = useRef(false);
  useEffect(() => { deleteDialogOpenRef.current = deleteDialogOpen; }, [deleteDialogOpen]);
  const [newName, setNewName] = useState(getBaseName(file.path));
  const [conflictMessage, setConflictMessage] = useState('');
  const [coords, setCoords] = useState({ top: 0, left: 0, ready: false });
  const menuRef = useRef<HTMLDivElement>(null);
  const modeRef = useRef(mode);

  useEffect(() => { modeRef.current = mode; }, [mode]);

  useLayoutEffect(() => {
    if (!open || !anchorEl || !menuRef.current) return;
    const anchorRect = anchorEl.getBoundingClientRect();
    const menuRect = menuRef.current.getBoundingClientRect();
    const gap = 4;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let top = anchorRect.bottom + gap;
    if (top + menuRect.height + gap > vh) top = anchorRect.top - menuRect.height - gap;
    let left = anchorRect.right - menuRect.width;
    if (left < gap) left = gap;
    if (left + menuRect.width + gap > vw) left = vw - menuRect.width - gap;
    setCoords({ top, left, ready: true });
  }, [open, anchorEl, mode]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modeRef.current !== 'name-conflict') onClose();
    };
    const onClick = (e: MouseEvent) => {
      if (modeRef.current === 'name-conflict') return;
      if (deleteDialogOpenRef.current) return;
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open, onClose]);

  const doRename = async () => {
    const trimmed = newName.trim();
    const baseName = getBaseName(file.path);
    const ext = getExt(file.path);
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
      const nextPath = replaceFileName(file.path, trimmed + ext);
      if (scope === 'session' && agentId && sessionId) {
        await agentFilesApi.rename({ agentId, sessionId, level: 'session' }, file.path, nextPath);
        await onRefresh?.();
        // 同步刷新全部文件
        useUserFileStore.getState().fetchFiles(tenantId, { silent: true });
      } else {
        await renameOptimistic(tenantId, file.path, nextPath);
        // 同步刷新会话文件
        await onRefresh?.();
      }
      onClose();
    } catch (e: any) {
      if (e?.response?.status === 409) {
        setConflictMessage(`"${trimmed + ext}" 已存在，请修改文件名后重试。`);
        setMode('name-conflict');
      } else {
        toast.error(`重命名失败：${e.message || '未知错误'}`);
        onClose();
      }
    }
  };

  const handleShare = () => {
    onShare?.();
  };

  const handleFileShare = () => {
    onFileShare?.(anchorEl?.getBoundingClientRect() ?? null);
  };

  const doDelete = async () => {
    onClose();
    try {
      if (scope === 'session' && agentId && sessionId) {
        await agentFilesApi.delete({ agentId, sessionId, level: 'session' }, file.path);
        onDeleted?.(file.path);
      } else {
        if (file.id) await deleteOptimistic(tenantId, file.path, file.id);
        else await deleteOptimistic(tenantId, file.path);
      }
    } catch (e: any) {
      toast.error(`删除失败：${e.message || '未知错误'}`);
    }
  };

  const doDownload = async () => {
    try {
      const url = scope === 'session' && agentId && sessionId
        ? `/api/v1/agents/${agentId}/sessions/${sessionId}/files/${file.path.split('/').map(encodeURIComponent).join('/')}?disposition=attachment`
        : userFileDownloadUrl({ tenantId, path: file.path, disposition: 'attachment' });
      const response = await fetch(url);
      if (!response.ok) throw new Error(String(response.status));
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = file.displayName || file.path.split('/').pop() || file.path;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    } catch {
      toast.error('下载失败');
    } finally {
      onClose();
    }
  };

  if (!open) return null;

  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    top: coords.top,
    left: coords.left,
    zIndex: 250,
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-md)',
    boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
    minWidth: 156,
    overflow: 'hidden',
    visibility: coords.ready ? 'visible' : 'hidden',
  };

  const editable = Boolean(onEdit) && isEditable(file.path);

  const itemBase: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 14px',
    fontSize: 13,
    color: 'var(--text-primary)',
    cursor: 'pointer',
    transition: 'background var(--transition-fast)',
    width: '100%',
    textAlign: 'left',
    background: 'transparent',
    border: 'none',
    fontFamily: 'inherit',
  };

  const buttonHover = {
    onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.background = 'var(--bg-hover-v11)';
    },
    onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.background = 'transparent';
    },
  };

  return createPortal(
    <>
      <div
        ref={menuRef}
        role="menu"
        style={menuStyle}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        data-testid="file-action-popover"
      >
        {mode === 'menu' && (
          <ul role="presentation" style={{ listStyle: 'none', margin: 0, padding: '4px 0' }}>
            {editable && (
              <MenuButton icon={<img src={editPencilIcon} alt="" style={{ width: 13, height: 13 }} />} label="编辑" style={itemBase} onClick={() => { (onEdit || onPreview)(file); onClose(); }} hover={buttonHover} testId="file-action-edit" />
            )}
            <MenuButton icon={<Share2 size={13} />} label="分享文件" style={itemBase} onClick={handleFileShare} hover={buttonHover} testId="file-action-link-share" />
            {!shared && (
              <MenuButton icon={<FileSymlink size={13} />} label="跨会话引用" style={itemBase} onClick={handleShare} hover={buttonHover} testId="file-action-share" />
            )}
            <MenuButton icon={<Download size={13} />} label="下载" style={itemBase} onClick={doDownload} hover={buttonHover} testId="file-action-download" />
            <MenuButton icon={<img src={renameInputIcon} alt="" style={{ width: 14, height: 14 }} />} label="重命名" style={itemBase} onClick={() => { setNewName(getBaseName(file.path)); setMode('rename'); }} hover={buttonHover} testId="file-action-rename" />
            <MenuButton
              icon={<Trash2 size={13} />}
              label="删除"
              style={{ ...itemBase, color: 'var(--danger)' }}
              onClick={() => { setDeleteDialogOpen(true); }}
              hover={{
                onMouseEnter: (e) => { e.currentTarget.style.background = 'var(--danger-bg-soft)'; },
                onMouseLeave: (e) => { e.currentTarget.style.background = 'transparent'; },
              }}
              testId="file-action-delete"
            />
          </ul>
        )}

        {mode === 'rename' && (
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>重命名文件</div>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void doRename();
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
              data-testid="file-rename-input"
            />
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <SmallButton label="取消" onClick={onClose} testId="file-rename-cancel" />
              <SmallButton label="确定" primary onClick={() => void doRename()} testId="file-rename-confirm" />
            </div>
          </div>
        )}

      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        title={shared ? '确定删除共享文件吗？' : '确定删除文件吗？'}
        description={shared
          ? '当前文件已被共享，可能被其他会话引用，删除后无法找回，请谨慎操作。'
          : '删除后无法找回，请谨慎操作。'}
        confirmText="删除"
        cancelText="取消"
        variant="danger"
        onConfirm={() => { setDeleteDialogOpen(false); void doDelete(); }}
        onCancel={() => { setDeleteDialogOpen(false); onClose(); }}
      />

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

function MenuButton({
  icon,
  label,
  style,
  onClick,
  hover,
  testId,
}: {
  icon: React.ReactNode;
  label: string;
  style: React.CSSProperties;
  onClick: () => void;
  hover: {
    onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => void;
    onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => void;
  };
  testId?: string;
}) {
  return (
    <li>
      <button
        role="menuitem"
        className="file-action-menu-button"
        style={style}
        onClick={onClick}
        {...hover}
        data-testid={testId}
      >
        {icon}
        {label}
      </button>
    </li>
  );
}

function SmallButton({
  label,
  onClick,
  primary,
  danger,
  testId,
}: {
  label: string;
  onClick: () => void;
  primary?: boolean;
  danger?: boolean;
  testId?: string;
}) {
  return (
    <button
      className="file-rename-action-button"
      onClick={onClick}
      style={{
        padding: '4px 10px',
        fontSize: 12,
        background: primary ? 'var(--text-primary)' : danger ? 'var(--danger-bg-soft)' : 'transparent',
        border: `1px solid ${primary ? 'var(--text-primary)' : danger ? 'var(--danger)' : 'var(--border-default)'}`,
        borderRadius: 'var(--radius-sm)',
        color: primary ? 'var(--bg-primary, #fff)' : danger ? 'var(--danger)' : 'var(--text-secondary)',
        cursor: 'pointer',
      }}
      data-testid={testId}
    >
      {label}
    </button>
  );
}
