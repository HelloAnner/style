/**
 * 通用文件右键上下文菜单
 *
 * 在 FileCanvas（工作室·文件画布）和 Sidebar 中复用。
 * 根据文件所在位置（shared / session）动态显示操作项。
 *
 * 注意：所有需要二次确认的操作一律使用 ConfirmDialog 组件，
 * 不要使用原生 window.confirm —— 后者在 Arc / Safari / 带扩展的 Firefox
 * 等浏览器里可能被静默屏蔽，导致「点击无反应」。
 */

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { agentFilesApi } from '../../api/agentFiles';
import { usePreviewStore } from '../../stores/previewStore';
import { useFileReferenceStore } from '../../stores/fileReferenceStore';
import { useSessionRuntimeStore } from '../../stores/sessionRuntimeStore';
import { downloadFile } from '../../lib/media';
import { hasActiveAssistantMessage } from '../../lib/conversationActivity';
import { track } from '../../utils/track';
import { toast } from '../../utils/toast';
import { ConfirmDialog } from './ConfirmDialog';
import type { FileInfo } from '../../types';
import { getFileName, replaceFileName, validateRenameBaseName } from '../../utils/fileTypes';

type PendingConfirm = {
  title: string;
  description?: string;
  confirmText: string;
  variant: 'default' | 'danger';
  onConfirm: () => void;
};

export interface FileContextMenuProps {
  x: number;
  y: number;
  file: FileInfo;
  level: 'shared' | 'session';
  agentId: string;
  sessionId: string | null;
  onClose: () => void;
  onRefresh: () => void;
}

export const FileContextMenu: React.FC<FileContextMenuProps> = ({
  x, y, file, level, agentId, sessionId, onClose, onRefresh,
}) => {
  const openFile = usePreviewStore(s => s.openFile);
  const openFolder = usePreviewStore(s => s.openFolder);
  const updateTabByFileId = usePreviewStore(s => s.updateTabByFileId);
  const addFileReference = useFileReferenceStore(s => s.addReference);
  const messages = useSessionRuntimeStore(s => s.messages);

  const [renaming, setRenaming] = useState(false);
  const displayFileName = getFileName(file.name || file.path);
  const fileTestId = (file.id || file.path || file.name).replace(/[^a-zA-Z0-9_-]+/g, '-');
  const [newName, setNewName] = useState(displayFileName);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pendingConfirm) return; // 弹窗打开时不要因点击外部空白就把菜单关掉
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, pendingConfirm]);

  // Adjust position if overflowing viewport
  const [pos, setPos] = useState({ x, y });
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    let nx = x, ny = y;
    if (x + rect.width > window.innerWidth - 8) nx = window.innerWidth - rect.width - 8;
    if (y + rect.height > window.innerHeight - 8) ny = window.innerHeight - rect.height - 8;
    if (nx !== x || ny !== y) setPos({ x: nx, y: ny });
  }, [x, y]);

  const target = { agentId, level, sessionId };
  const tabLevel = level === 'shared' ? 'agent-shared' : 'session';

  const askIfRunning = (onProceed: () => void) => {
    if (!hasActiveAssistantMessage(messages)) {
      onProceed();
      return;
    }
    setPendingConfirm({
      title: '当前任务正在运行',
      description: '修改文件可能影响正在执行的任务，是否仍要继续？',
      confirmText: '继续',
      variant: 'default',
      onConfirm: () => { setPendingConfirm(null); onProceed(); },
    });
  };

  const doRename = async (trimmed: string) => {
    try {
      const dest = replaceFileName(file.path, trimmed);
      await agentFilesApi.rename(target, file.path, dest);
      if (file.id) {
        updateTabByFileId(file.id, { name: trimmed, path: dest });
      }
      toast.success('已重命名');
      onRefresh();
    } catch (e) {
      toast.error(`重命名失败：${(e as Error)?.message || '未知错误'}`);
    } finally {
      onClose();
    }
  };

  const handleRename = () => {
    const trimmed = newName.trim();
    const validationError = validateRenameBaseName(trimmed);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    if (!trimmed || trimmed === displayFileName) { setRenaming(false); return; }
    track('file_context_menu', { sub_event: 'rename' });
    askIfRunning(() => { setRenaming(false); void doRename(trimmed); });
  };

  const doDelete = async () => {
    try {
      await agentFilesApi.delete(target, file.path);
      toast.success(`已删除 "${file.name}"`);
      onRefresh();
    } catch (e) {
      toast.error(`删除失败：${(e as Error)?.message || '未知错误'}`);
    } finally {
      onClose();
    }
  };

  const handleDelete = () => {
    askIfRunning(() => {
      setPendingConfirm({
        title: `删除 "${file.name}"？`,
        description: '此操作不可撤销，文件将从工作区彻底移除。',
        confirmText: '删除',
        variant: 'danger',
        onConfirm: () => { setPendingConfirm(null); track('file_context_menu', { sub_event: 'delete' }); void doDelete(); },
      });
    });
  };

  const handlePromote = async () => {
    track('file_context_menu', { sub_event: 'share' });
    if (!sessionId) return;
    try {
      await agentFilesApi.promote(agentId, sessionId, file.path);
      if (file.id) updateTabByFileId(file.id, { path: file.name, level: 'agent-shared' });
      toast.success('已移至共享资料');
      onRefresh();
    } catch (e) {
      toast.error(`移动失败：${(e as Error)?.message || '未知错误'}`);
    } finally {
      onClose();
    }
  };

  const handleDemote = async () => {
    track('file_context_menu', { sub_event: 'cross_session_quote' });
    if (!sessionId) return;
    try {
      await agentFilesApi.demote(agentId, sessionId, file.path);
      if (file.id) updateTabByFileId(file.id, { path: file.name, level: 'session' });
      toast.success('已移至当前会话');
      onRefresh();
    } catch (e) {
      toast.error(`移动失败：${(e as Error)?.message || '未知错误'}`);
    } finally {
      onClose();
    }
  };

  const handleReference = () => {
    track('file_context_menu', { sub_event: 'quote' });
    addFileReference({
      id: `ref-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      fileId: file.id,
      fileName: file.name,
      filePath: file.path,
      level,
      type: 'full',
    });
    onClose();
  };

  const handleOpen = () => {
    if (file.is_dir) {
      openFolder({ name: file.name, path: file.path, assetType: 'folder', level: tabLevel });
    } else {
      openFile({ fileId: file.id, name: file.name, path: file.path, level: tabLevel });
    }
    onClose();
  };

  const baseUrl = level === 'session' && sessionId
    ? `/api/v1/agents/${agentId}/sessions/${sessionId}/files`
    : `/api/v1/agents/${agentId}/files`;

  const handleDownload = () => {
    track('file_context_menu', { sub_event: 'download' });
    onClose();
    if (file.is_dir) {
      const url = `${baseUrl}/${file.path.split('/').map(encodeURIComponent).join('/')}?format=zip`;
      void downloadFile(url, `${file.name}.zip`);
    } else {
      const url = `${baseUrl}/${file.path.split('/').map(encodeURIComponent).join('/')}`;
      void downloadFile(url, file.name);
    }
  };

  const itemCls = "flex items-center w-full text-left hover:bg-zinc-700/40 transition-colors";
  const itemStyle: React.CSSProperties = {
    padding: '7px 14px', fontSize: 12, cursor: 'pointer',
    color: 'var(--text-secondary)', gap: 8,
  };
  const sep = <div style={{ height: 1, background: 'var(--border-subtle)', margin: '3px 0' }} />;

  const menu = (
    <div
      ref={menuRef}
      className="file-context-menu"
      data-testid={`file-context-menu-${fileTestId}`}
      style={{
        position: 'fixed', left: pos.x, top: pos.y, zIndex: 9999,
        background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
        borderRadius: 10, padding: '4px 0', minWidth: 180,
        boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
      }}
      onClick={e => e.stopPropagation()}
    >
      {renaming ? (
        <div style={{ padding: '6px 10px' }}>
          <input
            autoFocus
            data-testid={`file-context-menu-rename-input-${fileTestId}`}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleRename();
              if (e.key === 'Escape') setRenaming(false);
            }}
            onBlur={handleRename}
            style={{
              width: '100%', fontSize: 12, padding: '4px 8px', borderRadius: 6,
              background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)', outline: 'none',
            }}
          />
        </div>
      ) : (
        <>
          <button className={itemCls} data-testid={`file-context-menu-open-${fileTestId}`} style={itemStyle} onClick={handleOpen}>打开</button>
          <button className={itemCls} data-testid={`file-context-menu-reference-${fileTestId}`} style={itemStyle} onClick={handleReference}>引用到对话</button>
          {sep}
          <button className={itemCls} data-testid={`file-context-menu-rename-${fileTestId}`} style={itemStyle} onClick={() => { setRenaming(true); setNewName(displayFileName); }}>重命名</button>
          {level === 'session' && (
            <button className={itemCls} data-testid={`file-context-menu-promote-${fileTestId}`} style={itemStyle} onClick={handlePromote}>移至共享资料</button>
          )}
          {level === 'shared' && sessionId && (
            <button className={itemCls} data-testid={`file-context-menu-demote-${fileTestId}`} style={itemStyle} onClick={handleDemote}>移至当前会话</button>
          )}
          <button className={itemCls} data-testid={`file-context-menu-download-${fileTestId}`} style={itemStyle} onClick={handleDownload}>{file.is_dir ? '下载为 .zip' : '下载'}</button>
          {sep}
          <button className={itemCls} data-testid={`file-context-menu-delete-${fileTestId}`} style={{ ...itemStyle, color: '#ef4444' }} onClick={handleDelete}>删除</button>
        </>
      )}
    </div>
  );

  return (
    <>
      {createPortal(menu, document.body)}
      <ConfirmDialog
        open={!!pendingConfirm}
        title={pendingConfirm?.title || ''}
        description={pendingConfirm?.description}
        confirmText={pendingConfirm?.confirmText}
        variant={pendingConfirm?.variant}
        backdropTestId="file-context-menu-confirm-backdrop"
        panelTestId="file-context-menu-confirm-dialog"
        titleTestId="file-context-menu-confirm-title"
        descriptionTestId="file-context-menu-confirm-description"
        cancelButtonTestId="file-context-menu-confirm-cancel"
        confirmButtonTestId="file-context-menu-confirm-confirm"
        onConfirm={() => pendingConfirm?.onConfirm()}
        onCancel={() => setPendingConfirm(null)}
      />
    </>
  );
};
