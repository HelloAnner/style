/**
 * WorkspaceDrawer — 工作室抽屉（4.3.0 版本）
 *
 * 单 Tab「个人文件」，替代旧的 FileCanvas.tsx。
 * - tenantId 切换时触发 loading 骨架屏 + 重新拉取个人文件
 * - 切 Agent 时数据不变（不触发 loading、不重新拉接口）
 * - 支持文件网格 + 抽屉内预览 + 右键菜单
 * - 订阅 WS asset-changed 事件做增量刷新
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Grid2X2, List, ListChecks, Loader2, Upload, X } from 'lucide-react';
import { useUserFileStore } from '../../stores/userFileStore';
import { useTenantStore } from '../../stores/tenantStore';
import { useUiStore } from '../../stores/uiStore';
import { usePreviewStore } from '../../stores/previewStore';
import { useAgentContextStore } from '../../stores/agentContextStore';
import { useAgentStore } from '../../stores/agentStore';
import { SidebarIcon } from '../Sidebar/icons/SidebarIcon';
import { toast } from '../../utils/toast';
import { translateUploadError } from '../../utils/fileTypes';
import { useAssetChangedWs } from '../../hooks/useAssetChangedWs';
import { FileGrid, type FileViewMode } from './FileGrid';
import { UserFilePreview } from './UserFilePreview';
import { SkeletonFileGrid } from './SkeletonFileGrid';
import styles from './WorkspaceDrawer.module.css';
import { agentFilesApi } from '../../api/agentFiles';
import { uploadUserFile, type UserFileInfo } from '../../api/userFiles';
import { kernelApiFetch } from '../../api/gateway';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { FineDesignTooltip } from '../common/FineDesignTooltip';
import type { FileInfo } from '../../types';
import closeIcon from '../../assets/icons/file-panel/close.svg';
import collapseIcon from '../../assets/icons/file-panel/collapse.svg';
import maximizeIcon from '../../assets/icons/file-panel/maximize.svg';
import searchIcon from '../../assets/icons/file-panel/search.svg';

type FileScope = 'user' | 'session';

const WORKSPACE_DRAWER_COPY = {
  zh: {
    displayMode: '文件显示方式',
    gridView: '图标视图',
    listView: '列表视图',
    search: '搜索',
    uploadFiles: '上传文件',
    batchSelect: '批量选择',
    cancelBatch: '取消批量',
    selectedBefore: '已选择 ',
    selectedAfter: ' 项',
    selectAll: '全选',
    clearAll: '清除全选',
    delete: '删除',
    batchDeleteTitle: (count: number) => `确定删除选中的 ${count} 个文件吗？`,
    batchDeleteDescription: '删除后无法找回，请谨慎操作。',
    cancel: '取消',
    batchDeleteFailed: (count: number) => `${count} 个文件删除失败`,
    selectFile: (name: string) => `选择 ${name}`,
    deselectFile: (name: string) => `取消选择 ${name}`,
  },
  en: {
    displayMode: 'File display mode',
    gridView: 'Grid view',
    listView: 'List view',
    search: 'Search',
    uploadFiles: 'Upload files',
    batchSelect: 'Select multiple',
    cancelBatch: 'Cancel selection',
    selectedBefore: '',
    selectedAfter: ' selected',
    selectAll: 'Select all',
    clearAll: 'Clear selection',
    delete: 'Delete',
    batchDeleteTitle: (count: number) => `Delete ${count} selected file${count === 1 ? '' : 's'}?`,
    batchDeleteDescription: 'Deleted files cannot be recovered. Please proceed carefully.',
    cancel: 'Cancel',
    batchDeleteFailed: (count: number) => `Failed to delete ${count} file${count === 1 ? '' : 's'}`,
    selectFile: (name: string) => `Select ${name}`,
    deselectFile: (name: string) => `Deselect ${name}`,
  },
} as const;

type WorkspaceDrawerLocale = keyof typeof WORKSPACE_DRAWER_COPY;

function resolveWorkspaceDrawerLocale(): WorkspaceDrawerLocale {
  if (typeof navigator === 'undefined') return 'zh';
  const language = navigator.language || navigator.languages?.[0] || '';
  return language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

function useWorkspaceDrawerCopy() {
  const [locale, setLocale] = useState<WorkspaceDrawerLocale>(() => resolveWorkspaceDrawerLocale());

  useEffect(() => {
    const next = resolveWorkspaceDrawerLocale();
    if (next !== locale) setLocale(next);
  }, [locale]);

  return WORKSPACE_DRAWER_COPY[locale];
}

function buildFailDesc(failures: Array<{ name: string; message: string }>) {
  const shown = failures.slice(0, 5);
  const rest = failures.length - shown.length;
  return (
    <span>
      {shown.map((f) => (
        <span key={f.name} style={{ display: 'block' }}>{f.name}上传失败：{f.message}</span>
      ))}
      {rest > 0 && (
        <span style={{ display: 'block', opacity: 0.7 }}>还有 {rest} 个文件失败</span>
      )}
    </span>
  );
}

const CONCURRENCY = 3;
const MAX_FILE_SIZE = 50 * 1024 * 1024;

const BLOCKED_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'com', 'msi', 'scr', 'pif',
  'vbs', 'vbe', 'wsf', 'wsh', 'ps1',
  'dll', 'sys', 'drv', 'cpl',
]);

function formatFileSize(bytes: number) {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function formatFileStat(count: number, bytes: number) {
  if (count === 0) return '0个文件';
  return `${count}个文件，${formatFileSize(bytes)}`;
}

function fileTooLargeMessage(file: File) {
  return `${file.name} 大小为 ${formatFileSize(file.size)}，超过 50MB 限制`;
}

function normalizeSessionFileInfo(file: FileInfo): UserFileInfo {
  return {
    id: file.id,
    path: file.path,
    displayName: file.name || file.path,
    size: file.size || 0,
    contentType: file.mime_type || null,
    uploadedAt: file.modified_at || '',
    etag: file.id || file.path,
    scope: file.scope,
    shared: file.scope === 'session_shared',
  };
}

function fileSelectionKey(file: Pick<UserFileInfo, 'id' | 'path'>): string {
  return file.id ? `id:${file.id}` : `path:${file.path}`;
}

function buildSessionFileUrl(agentId: string, sessionId: string, path: string, thumb = false): string {
  const query = new URLSearchParams({ disposition: 'inline' });
  if (thumb) {
    query.set('thumb', 'true');
  }
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  return `/api/v1/agents/${agentId}/sessions/${sessionId}/files/${encodedPath}?${query.toString()}`;
}

async function runWithConcurrency<T>(
  items: T[],
  handler: (item: T) => Promise<void>,
  limit: number,
): Promise<void> {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift()!;
      try {
        await handler(item);
      } catch (err) {
        console.error('upload failed', err);
      }
    }
  });
  await Promise.all(workers);
}

export function WorkspaceDrawer() {
  const copy = useWorkspaceDrawerCopy();
  const tenantId = useTenantStore((s) => s.currentWorkspace?.tenantId ?? null);
  const currentAgentId = useAgentContextStore((s) => s.currentAgentId);
  const currentSessionId = useAgentStore((s) => s.currentSessionId);
  const hasSessionScope = Boolean(currentAgentId && currentSessionId);
  const { files, loading, fetchFiles } = useUserFileStore();
  const { closeRightPanel, workspaceMaximized, toggleWorkspaceMaximized } = useUiStore();
  const previewTabs = usePreviewStore((s) => s.tabs);
  const activeTabId = usePreviewStore((s) => s.activeTabId);
  const closeTab = usePreviewStore((s) => s.closeTab);

  const sessionScopeKey = hasSessionScope ? `${currentAgentId}/${currentSessionId}` : '';
  const [fileScope, setFileScope] = useState<FileScope>(() => hasSessionScope ? 'session' : 'user');
  const lastSessionScopeKeyRef = useRef(sessionScopeKey);

  // 清理 auto-open flag
  useEffect(() => {
    if (fileScope === 'session' && (window as any).__mossAutoOpenSession) {
      delete (window as any).__mossAutoOpenSession;
    }
  }, [fileScope]);
  const fileScopeRef = useRef(fileScope);
  fileScopeRef.current = fileScope;
  const [query, setQuery] = useState('');
  const [previewFile, setPreviewFile] = useState<UserFileInfo | null>(null);
  const [previewScope, setPreviewScope] = useState<FileScope>('user');
  const [sessionFiles, setSessionFiles] = useState<UserFileInfo[]>([]);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<FileViewMode>('grid');
  const [batchMode, setBatchMode] = useState(false);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(() => new Set());
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [startInEdit, setStartInEdit] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 监听外部切 tab 指令（auto-open 触发）
  useEffect(() => {
    const handler = () => {
      if (!hasSessionScope) return;
      setFileScope('session');
    };
    window.addEventListener('moss:switch-to-session-tab', handler);
    return () => window.removeEventListener('moss:switch-to-session-tab', handler);
  }, [hasSessionScope]);

  useEffect(() => {
    if (!hasSessionScope && fileScope === 'session') {
      setFileScope('user');
    }
  }, [fileScope, hasSessionScope]);

  useEffect(() => {
    if (!hasSessionScope) {
      lastSessionScopeKeyRef.current = '';
      return;
    }
    if (lastSessionScopeKeyRef.current === sessionScopeKey) return;
    lastSessionScopeKeyRef.current = sessionScopeKey;
    setFileScope('session');
  }, [hasSessionScope, sessionScopeKey]);

  // v11: tenantId 变化时拉新数据；切 Agent 不触发（agentId 不在依赖里）
  useEffect(() => {
    if (tenantId) fetchFiles(tenantId);
  }, [tenantId]);

  useEffect(() => {
    if (!currentAgentId || !currentSessionId) {
      setSessionFiles([]);
      setSessionError(null);
      setSessionLoading(false);
      return;
    }

    let cancelled = false;
    setSessionLoading(true);
    setSessionError(null);
    agentFilesApi.listSession(currentAgentId, currentSessionId)
      .then((res) => {
        if (cancelled) return;
        setSessionFiles(res.files.filter((file) => !file.is_dir).map(normalizeSessionFileInfo));
      })
      .catch((err) => {
        if (cancelled) return;
        setSessionFiles([]);
        setSessionError((err as Error)?.message || '会话文件加载失败');
      })
      .finally(() => {
        if (!cancelled) setSessionLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fileScope, currentAgentId, currentSessionId]);

  const refreshSessionFiles = useCallback(async () => {
    if (!currentAgentId || !currentSessionId) return;
    setSessionLoading(true);
    setSessionError(null);
    try {
      const res = await agentFilesApi.listSession(currentAgentId, currentSessionId);
      setSessionFiles(res.files.filter((file) => !file.is_dir).map(normalizeSessionFileInfo));
    } catch (err) {
      setSessionFiles([]);
      setSessionError((err as Error)?.message || '会话文件加载失败');
    } finally {
      setSessionLoading(false);
    }
  }, [currentAgentId, currentSessionId]);

  const removeSessionFile = useCallback((path: string) => {
    setSessionFiles((current) => current.filter((file) => file.path !== path));
  }, []);

  const refreshAllFiles = useCallback(() => {
    if (tenantId) {
      fetchFiles(tenantId);
      // 如果当前在会话文件 tab，也同步刷新会话文件
      if (fileScopeRef.current === 'session') {
        refreshSessionFiles();
      }
    }
  }, [tenantId, fetchFiles, refreshSessionFiles]);

  // 订阅 WS asset-changed 事件：USER_FILE 增量更新 + FILE_SESSION/FILE_SHARED 触发会话文件刷新
  useAssetChangedWs(refreshSessionFiles);

  // 本地上传会先发该事件；立即回查正式列表，补齐分享所需的 file asset id。
  useEffect(() => {
    const handleSessionFileAdded = () => {
      void refreshSessionFiles();
    };
    window.addEventListener('session-file-added', handleSessionFileAdded);
    return () => window.removeEventListener('session-file-added', handleSessionFileAdded);
  }, [refreshSessionFiles]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList || !tenantId) return;

    const files = Array.from(fileList);
    const n = files.length;
    if (n === 0) return;

    const failures: Array<{ name: string; message: string }> = [];
    const uploadFiles = files.filter((file) => {
      if (!(file.size <= MAX_FILE_SIZE)) {
        failures.push({ name: file.name, message: fileTooLargeMessage(file) });
        return false;
      }
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext && BLOCKED_EXTENSIONS.has(ext)) {
        failures.push({ name: file.name, message: `不支持的文件类型` });
        return false;
      }
      return true;
    });

    if (uploadFiles.length === 0) {
      toast.error(n === 1 ? '上传失败' : `${n} 个文件全部上传失败`, {
        description: n === 1 ? failures[0].message : buildFailDesc(failures),
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setUploading(true);
    const toastId = toast.loading(
      uploadFiles.length === 1 ? `上传 ${uploadFiles[0].name}…` : `上传 ${uploadFiles.length} 个文件…`
    );
    let ok = 0;
    try {
      await runWithConcurrency(uploadFiles, async (file) => {
        try {
          if (fileScope === 'session') {
            if (!currentAgentId || !currentSessionId) {
              throw new Error('当前会话不存在，无法上传到当前会话');
            }
            const formData = new FormData();
            formData.append('file', file);
            const response = await kernelApiFetch(
              `/api/v1/agents/${currentAgentId}/sessions/${currentSessionId}/files/${file.name.split('/').map(encodeURIComponent).join('/')}`,
              { method: 'POST', body: formData }
            );
            if (!response.ok) {
              const detail = await response.json()
                .then((data) => data?.message ?? data?.detail)
                .catch(() => response.statusText);
              throw new Error(detail || '上传失败');
            }
            await refreshSessionFiles();
          } else {
            const info = await uploadUserFile({ tenantId, file, silent: true });
            useUserFileStore.getState().addFile(info);
            try { await useUserFileStore.getState().shareFile(tenantId, info.path); } catch { /* */ }
          }
          ok++;
        } catch (e) {
          failures.push({ name: file.name, message: translateUploadError((e as Error)?.message || '未知错误') });
        }
        if (n > 1 && ok + failures.length < n) {
          toast.loading(`上传中 ${ok + failures.length}/${n}…`, { id: toastId });
        }
      }, CONCURRENCY);
      const fail = failures.length;
      if (fail === 0) {
        toast.success(
          n === 1 ? `已上传 ${files[0].name}` : `已上传 ${n} 个文件`,
          { id: toastId }
        );
      } else if (ok === 0) {
        toast.error(
          n === 1 ? '上传失败' : `${n} 个文件全部上传失败`,
          { id: toastId, description: n === 1 ? failures[0].message : buildFailDesc(failures) }
        );
      } else {
        toast.error(`上传完成，${ok} 成功 ${fail} 失败`, {
          id: toastId,
          description: buildFailDesc(failures),
        });
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const activeFiles = fileScope === 'session' ? sessionFiles : files;
  const activeLoading = fileScope === 'session' ? sessionLoading : loading;

  const filtered = useMemo(
    () => activeFiles.filter((f) => (f.displayName || f.path).toLowerCase().includes(query.toLowerCase())),
    [activeFiles, query]
  );

  const allFilteredSelected = filtered.length > 0 && filtered.every((file) => selectedPaths.has(fileSelectionKey(file)));

  const toggleBatchMode = () => {
    setBatchMode((current) => {
      if (current) setSelectedPaths(new Set());
      return !current;
    });
  };

  const toggleSelectedFile = useCallback((file: UserFileInfo) => {
    const key = fileSelectionKey(file);
    setSelectedPaths((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleSelectAll = () => {
    setSelectedPaths((current) => {
      const next = new Set(current);
      if (allFilteredSelected) filtered.forEach((file) => next.delete(fileSelectionKey(file)));
      else filtered.forEach((file) => next.add(fileSelectionKey(file)));
      return next;
    });
  };

  const deleteSelectedFiles = async () => {
    if (selectedPaths.size === 0 || !tenantId) return;
    const targets = activeFiles.filter((file) => selectedPaths.has(fileSelectionKey(file)));
    setBatchDeleteOpen(false);
    setBatchDeleting(true);
    try {
      let failed = 0;
      let successKeys = new Set(targets.map(fileSelectionKey));
      if (fileScope === 'session' && currentAgentId && currentSessionId) {
        const result = await agentFilesApi.deleteBatch(
          { agentId: currentAgentId, sessionId: currentSessionId, level: 'session' },
          targets.map((file) => file.path)
        );
        const failedPaths = new Set(result.results.filter((item) => !item.success).map((item) => item.path));
        failed = result.failedCount || failedPaths.size;
        successKeys = failed > 0 && failedPaths.size === 0
          ? new Set()
          : new Set(
            targets
              .filter((file) => !failedPaths.has(file.path))
              .map(fileSelectionKey)
          );
        setSessionFiles((current) => current.filter((file) => !successKeys.has(fileSelectionKey(file))));
      } else {
        try {
          await useUserFileStore.getState().deleteBatchOptimistic(
            tenantId,
            targets.map((file) => ({ path: file.path, fileId: file.id }))
          );
        } catch (e: any) {
          const result = e?.result;
          const failedResults = Array.isArray(result?.results)
            ? result.results.filter((item: { success: boolean }) => !item.success)
            : [];
          failed = typeof result?.failedCount === 'number' ? result.failedCount : failedResults.length || targets.length;
          successKeys = failed > 0 && failedResults.length === 0
            ? new Set()
            : new Set(
              targets
                .filter((file) => !failedResults.some((item: { path: string; fileId?: string }) =>
                  (item.fileId && file.id ? item.fileId === file.id : item.path === file.path)
                ))
                .map(fileSelectionKey)
            );
        }
      }
      setSelectedPaths((current) => {
        const next = new Set(current);
        successKeys.forEach((key) => next.delete(key));
        return next;
      });
      if (failed > 0) toast.error(copy.batchDeleteFailed(failed));
    } finally {
      setBatchDeleting(false);
    }
  };

  const handleScopeChange = (scope: FileScope) => {
    if (scope === 'session' && !hasSessionScope) {
      return;
    }
    setFileScope(scope);
    setPreviewFile(null);
    setPreviewScope(scope);
    setStartInEdit(false);
    setQuery('');
    setBatchMode(false);
    setSelectedPaths(new Set());
    if (scope === 'user' && tenantId) {
      fetchFiles(tenantId);
    }
  };

  const closeWorkspaceFileTabsByLevel = useCallback((level: 'session' | 'user-file') => {
    const fileTabIds = usePreviewStore.getState().tabs
      .filter(t => t.kind === 'file' && t.level === level)
      .map(t => t.id);
    fileTabIds.forEach(id => closeTab(id));
  }, [closeTab]);

  const activeWorkspaceFileTab = useMemo(() => {
    if (!activeTabId) return null;
    const activeTab = previewTabs.find((tab) => tab.id === activeTabId);
    if (
      !activeTab ||
      activeTab.kind !== 'file' ||
      (activeTab.level !== 'user-file' && activeTab.level !== 'session')
    ) {
      return null;
    }
    return activeTab;
  }, [activeTabId, previewTabs]);

  const activePreviewScope: FileScope | null = activeWorkspaceFileTab
    ? (activeWorkspaceFileTab.level === 'session' ? 'session' : 'user')
    : null;

  const resolvedPreviewFile = useMemo(() => {
    if (activeWorkspaceFileTab) {
      // 优先从原始文件数据取 shared 状态；取不到时按 session 文件默认 false
      const sourceFile = files.find(f => f.path === activeWorkspaceFileTab.path)
        ?? sessionFiles.find(f => f.path === activeWorkspaceFileTab.path);
      return {
        path: activeWorkspaceFileTab.path,
        displayName: activeWorkspaceFileTab.name,
        id: sourceFile?.id ?? activeWorkspaceFileTab.fileId,
        size: sourceFile?.size,
        uploadedAt: sourceFile?.uploadedAt,
        shared: sourceFile?.shared ?? false,
      };
    }
    if (!previewFile) {
      return null;
    }
    return {
      path: previewFile.path,
      displayName: previewFile.displayName,
      id: previewFile.id,
      size: previewFile.size,
      uploadedAt: previewFile.uploadedAt,
      shared: Boolean(previewFile.shared),
    };
  }, [activeWorkspaceFileTab, previewFile, files, sessionFiles]);

  const resolvedPreviewScope: FileScope = activePreviewScope ?? previewScope;

  const activeFileCount = activeFiles.length;
  const activeFileSize = activeFiles.reduce((sum, f) => sum + f.size, 0);

  if (!tenantId) return null;

  return (
    <div className={styles.drawer} data-testid="workspace-drawer">
      <header className={styles.header} data-testid="workspace-header">
        <div className={styles.titleWrap} data-testid="workspace-title">
          <SidebarIcon name="workspace" size={20} className={styles.titleIcon} />
          <div className={styles.title}>我的文件</div>
        </div>
        <div className={styles.actions} data-testid="workspace-header-actions">
          <button
            onClick={toggleWorkspaceMaximized}
            className={styles.iconBtn}
            title={workspaceMaximized ? '还原' : '最大化'}
            data-testid="btn-maximize"
          >
            <img
              src={workspaceMaximized ? collapseIcon : maximizeIcon}
              alt=""
              aria-hidden="true"
              className={styles.headerActionIcon}
            />
          </button>
          <button
            onClick={closeRightPanel}
            className={styles.iconBtn}
            title="关闭"
            data-testid="btn-close"
          >
            <img src={closeIcon} alt="" aria-hidden="true" className={styles.headerActionIcon} />
          </button>
        </div>
      </header>

      {/* 工具栏：第一行范围/统计；第二行操作/视图切换 */}
      {!resolvedPreviewFile && (
        <>
          <div className={styles.toolbarRow} data-testid="workspace-toolbar">
            <div className={styles.segmentedControl} role="tablist" aria-label="文件范围" data-testid="workspace-scope-tabs">
              <button
                type="button"
                role="tab"
                aria-selected={fileScope === 'session'}
                aria-disabled={!hasSessionScope}
                disabled={!hasSessionScope}
                className={
                  !hasSessionScope
                    ? styles.segmentDisabled
                    : fileScope === 'session'
                      ? styles.segmentActive
                      : styles.segment
                }
                onClick={() => handleScopeChange('session')}
                title={!hasSessionScope ? '新会话下暂无当前会话文件' : undefined}
                data-testid="workspace-tab-session-files"
              >
                当前会话
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={fileScope === 'user'}
                className={fileScope === 'user' ? styles.segmentActive : styles.segment}
                onClick={() => handleScopeChange('user')}
                data-testid="workspace-tab-user-files"
              >
                全部文件
              </button>
            </div>

            <span className={styles.fileStat} data-testid="workspace-file-stat">
              {formatFileStat(activeFileCount, activeFileSize)}
            </span>

            <button
              type="button"
              className={styles.uploadBtn}
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              title={copy.uploadFiles}
              aria-label={copy.uploadFiles}
              data-testid="btn-upload"
            >
              {uploading ? (
                <Loader2 size={16} className={styles.spin} />
              ) : (
                <Upload size={14} aria-hidden="true" />
              )}
              <span className={styles.uploadBtnText}>{copy.uploadFiles}</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={handleUpload}
              data-testid="workspace-file-input"
            />
          </div>

          <div className={styles.secondaryToolbarRow}>
            {batchMode ? (
              <div className={styles.batchActionBar} data-testid="workspace-batch-actions">
                <span className={styles.selectedCount}>
                  {copy.selectedBefore}<strong>{selectedPaths.size}</strong>{copy.selectedAfter}
                </span>
                <button type="button" className={styles.batchTextBtn} onClick={toggleSelectAll} disabled={filtered.length === 0}>
                  {allFilteredSelected ? copy.clearAll : copy.selectAll}
                </button>
                <button type="button" className={styles.batchDeleteBtn} onClick={() => setBatchDeleteOpen(true)} disabled={selectedPaths.size === 0 || batchDeleting}>
                  {copy.delete}
                </button>
              </div>
            ) : (
              <div className={styles.searchInputWrap} data-testid="workspace-search-wrap">
                <img src={searchIcon} alt="" aria-hidden="true" className={styles.searchIcon} />
                <input
                  placeholder={copy.search}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className={styles.search}
                  aria-label={copy.search}
                  data-testid="workspace-search-input"
                />
              </div>
            )}

            <div className={styles.toolbarLeftActions}>
              <button
                type="button"
                className={batchMode ? styles.batchModeBtnActive : styles.batchModeBtn}
                onClick={toggleBatchMode}
                aria-pressed={batchMode}
                aria-label={batchMode ? copy.cancelBatch : copy.batchSelect}
                data-testid="workspace-batch-toggle"
              >
                {batchMode ? <X size={15} aria-hidden="true" /> : <ListChecks size={15} aria-hidden="true" />}
                <span>{batchMode ? copy.cancelBatch : copy.batchSelect}</span>
              </button>
              <div className={styles.viewModeToggle} aria-label={copy.displayMode} data-testid="workspace-view-toggle">
                <FineDesignTooltip content={copy.gridView} placement="bottom" tooltipId="workspace-grid-view-tooltip" testId="workspace-grid-view">
                  <button
                    type="button"
                    className={viewMode === 'grid' ? styles.viewModeBtnActive : styles.viewModeBtn}
                    aria-label={copy.gridView}
                    aria-pressed={viewMode === 'grid'}
                    onClick={() => setViewMode('grid')}
                    data-testid="workspace-view-grid"
                  >
                    <Grid2X2 size={14} />
                  </button>
                </FineDesignTooltip>
                <FineDesignTooltip content={copy.listView} placement="bottom" align="end" tooltipId="workspace-list-view-tooltip" testId="workspace-list-view">
                  <button
                    type="button"
                    className={viewMode === 'list' ? styles.viewModeBtnActive : styles.viewModeBtn}
                    aria-label={copy.listView}
                    aria-pressed={viewMode === 'list'}
                    onClick={() => setViewMode('list')}
                    data-testid="workspace-view-list"
                  >
                    <List size={15} />
                  </button>
                </FineDesignTooltip>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 主内容区 */}
      {resolvedPreviewFile ? (
        resolvedPreviewScope === 'session' ? (
          <UserFilePreview
            tenantId={tenantId}
            path={resolvedPreviewFile.path}
            displayName={resolvedPreviewFile.displayName}
            fileId={resolvedPreviewFile.id}
            startInEdit={startInEdit}
            scope="session"
            isShared={resolvedPreviewFile.shared}
            agentId={currentAgentId}
            sessionId={currentSessionId}
            onRefresh={refreshSessionFiles}
            onBack={() => {
              setStartInEdit(false);
              setPreviewFile(null);
              closeWorkspaceFileTabsByLevel('session');
            }}
          />
        ) : (
          <UserFilePreview
            tenantId={tenantId}
            isShared={resolvedPreviewFile.shared}
            path={resolvedPreviewFile.path}
            displayName={resolvedPreviewFile.displayName}
            fileId={resolvedPreviewFile.id}
            startInEdit={startInEdit}
            onBack={() => {
              setStartInEdit(false);
              setPreviewFile(null);
              closeWorkspaceFileTabsByLevel('user-file');
            }}
          />
        )
      ) : (
        <>
          {activeLoading ? (
            <SkeletonFileGrid />
          ) : sessionError && fileScope === 'session' ? (
            <div className={styles.emptyState} data-testid="workspace-session-error">{sessionError}</div>
          ) : (
            <FileGrid
              files={filtered}
              tenantId={tenantId}
              searchQuery={query}
              referenceLevel={fileScope === 'session' ? 'session' : 'user_file'}
              emptyLabel={fileScope === 'session' ? '当前会话暂无文件' : '暂无文件'}
              actionsEnabled={true}
              actionScope={fileScope}
              agentId={currentAgentId}
              sessionId={currentSessionId}
              onRefresh={refreshAllFiles}
              onDeleted={fileScope === 'session' ? removeSessionFile : undefined}
              viewMode={viewMode}
              selectionMode={batchMode}
              selectedPaths={selectedPaths}
              onToggleSelection={toggleSelectedFile}
              getSelectionLabel={(name, selected) => selected ? copy.deselectFile(name) : copy.selectFile(name)}
              imageUrlBuilder={fileScope === 'session' && currentAgentId && currentSessionId
                ? (file) => buildSessionFileUrl(currentAgentId, currentSessionId, file.path, true)
                : undefined}
              onOpen={(f) => { setPreviewFile(f); setPreviewScope(fileScope); setStartInEdit(false); }}
              onEdit={(f) => { setPreviewFile(f); setPreviewScope(fileScope); setStartInEdit(true); }}
            />
          )}
        </>
      )}
      <ConfirmDialog
        open={batchDeleteOpen}
        title={copy.batchDeleteTitle(selectedPaths.size)}
        description={copy.batchDeleteDescription}
        confirmText={copy.delete}
        cancelText={copy.cancel}
        variant="danger"
        onConfirm={() => void deleteSelectedFiles()}
        onCancel={() => setBatchDeleteOpen(false)}
      />
    </div>
  );
}
