import { useState, useMemo, useCallback, useEffect } from 'react';
import { ChevronLeft, Download, Check, X as XIcon, Share2, Trash2 } from 'lucide-react';
import editPencilIcon from '../../assets/icons/file-panel/edit-pencil.svg';
import renameInputIcon from '../../assets/icons/file-panel/rename-input.svg';
import quoteIcon from '../../assets/icons/file-panel/quote.svg';
import unreferenceIcon from '../../assets/icons/file-panel/unreference.svg';
import { userFileDownloadUrl, uploadUserFile } from '../../api/userFiles';
import { agentFilesApi } from '../../api/agentFiles';
import { useUserFileStore } from '../../stores/userFileStore';
import { useTenantStore } from '../../stores/tenantStore';
import { useFileReferenceStore } from '../../stores/fileReferenceStore';
import { FilePreview } from './FilePreview';
import { FileShareDialog } from './FileShareDialog';
import { ShareAndReferenceDialog } from './ShareAndReferenceDialog';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { toast } from '../../utils/toast';
import { track } from '../../utils/track';
import { EDITABLE_EXTS, getExt, getBaseName, replaceFileName, validateRenameBaseName } from '../../utils/fileTypes';
import type { WorkspaceTab } from '../../stores/previewStore';

interface UserFilePreviewProps {
  tenantId: string;
  path: string;
  displayName?: string;
  fileId?: string;
  startInEdit?: boolean;
  isShared?: boolean;
  onBack: () => void;
  scope?: 'user' | 'session';
  agentId?: string | null;
  sessionId?: string | null;
  onRefresh?: () => void | Promise<void>;
}

function encodeFilePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

function sessionFileUrl(
  agentId: string,
  sessionId: string,
  path: string,
  disposition: 'inline' | 'attachment' = 'inline'
): string {
  const query = new URLSearchParams({ disposition });
  return `/api/v1/agents/${agentId}/sessions/${sessionId}/files/${encodeFilePath(path)}?${query.toString()}`;
}

export function UserFilePreview({
  tenantId,
  path,
  displayName,
  fileId,
  startInEdit = false,
  isShared = false,
  onBack,
  scope = 'user',
  agentId,
  sessionId,
  onRefresh,
}: UserFilePreviewProps) {
  const [currentPath, setCurrentPath] = useState(path);
  const [currentDisplayName, setCurrentDisplayName] = useState(displayName);
  // 当外部 path 变化时（如切换文件），同步重置
  useEffect(() => {
    setCurrentPath(path);
    setCurrentDisplayName(displayName);
  }, [path, displayName]);

  const name = currentDisplayName || currentPath.split('/').pop() || currentPath;
  const ext = currentPath.split('.').pop()?.toLowerCase() || '';
  const isEditable = EDITABLE_EXTS.has(ext);

  const { renameOptimistic, deleteOptimistic } = useUserFileStore();
  const addReference = useFileReferenceStore((s) => s.addReference);
  const removeReference = useFileReferenceStore((s) => s.removeReference);
  const references = useFileReferenceStore((s) => s.references);

  const isReferenced = references.some(
    (r) => r.filePath === currentPath && r.level === (scope === 'session' ? 'session' : 'user_file') && r.type === 'full'
  );

  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);
  const [enteringEdit, setEnteringEdit] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [renameMode, setRenameMode] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameConflict, setRenameConflict] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [shareAndRefOpen, setShareAndRefOpen] = useState(false);
  const [fileShareOpen, setFileShareOpen] = useState(false);
  const [fileShareAnchorRect, setFileShareAnchorRect] = useState<DOMRect | null>(null);

  const shareFile = useUserFileStore((s) => s.shareFile);
  const tenantIdForStore = useTenantStore((s) => s.currentWorkspace?.tenantId ?? '');

  const fakeTab: WorkspaceTab = useMemo(() => ({
    id: currentPath,
    name,
    path: currentPath,
    type: 'text',
    level: scope === 'session' ? 'session' : 'user-file',
    kind: 'file',
  }), [currentPath, name, scope]);

  const customUrlBuilder = useCallback(
    (p: string) => (
      scope === 'session' && agentId && sessionId
        ? sessionFileUrl(agentId, sessionId, p, 'inline')
        : userFileDownloadUrl({ tenantId, path: p, disposition: 'inline' })
    ),
    [agentId, scope, sessionId, tenantId],
  );

  const downloadUrl = scope === 'session' && agentId && sessionId
    ? sessionFileUrl(agentId, sessionId, currentPath, 'attachment')
    : userFileDownloadUrl({ tenantId, path: currentPath, disposition: 'attachment' });

  const handleDownload = async () => {
    try {
      const r = await fetch(downloadUrl);
      if (!r.ok) throw new Error(String(r.status));
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      alert('下载失败');
    }
  };

  const handleEnterEdit = async () => {
    setEnteringEdit(true);
    try {
      const r = await fetch(customUrlBuilder(currentPath));
      if (!r.ok) throw new Error(String(r.status));
      const text = await r.text();
      setEditText(text);
      setEditMode(true);
    } catch {
      alert('加载失败');
    } finally {
      setEnteringEdit(false);
    }
  };

  // "更多 → 编辑"入口：打开详情后自动进入编辑态
  useEffect(() => {
    if (startInEdit && isEditable && !editMode) {
      handleEnterEdit();
    }
  }, [startInEdit]);

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      const contentType = currentPath.endsWith('.md') ? 'text/markdown'
        : currentPath.endsWith('.json') ? 'application/json'
        : currentPath.endsWith('.csv') ? 'text/csv'
        : 'text/plain';
      if (scope === 'session') {
        if (!agentId || !sessionId) throw new Error('session file context is missing');
        await agentFilesApi.update({ agentId, sessionId, level: 'session' }, currentPath, editText, contentType);
        await onRefresh?.();
      } else {
        const file = new File([editText], currentPath, { type: contentType });
        await uploadUserFile({ tenantId, file, path: currentPath, overwrite: true });
      }
      setEditMode(false);
      setRefreshKey(k => k + 1);
    } catch {
      alert('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleReference = () => {
    if (isReferenced) {
      const existingRef = references.find(
        (r) => r.filePath === currentPath && r.level === (scope === 'session' ? 'session' : 'user_file') && r.type === 'full'
      );
      if (existingRef) removeReference(existingRef.id);
      return;
    }
    // 非会话文件且未共享，弹出共享并引用确认
    if (scope !== 'session' && !isShared) {
      setShareAndRefOpen(true);
      return;
    }
    addReference({
      id: `ref-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      fileName: name,
      filePath: currentPath,
      level: scope === 'session' ? 'session' : 'user_file',
      type: 'full',
    });
  };

  const handleShareAndRef = async () => {
    if (!tenantIdForStore) return;
    track('file_preview', { sub_event: 'share' });
    try {
      await shareFile(tenantIdForStore, currentPath);
      addReference({
        id: `ref-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        fileName: name,
        filePath: currentPath,
        level: scope === 'session' ? 'session' : 'user_file',
        type: 'full',
      });
      setShareAndRefOpen(false);
    } catch (e: any) {
      toast.error(`共享失败：${e.message || '未知错误'}`);
    }
  };

  const handleRenameConfirm = async () => {
    const trimmed = renameValue.trim();
    const baseName = getBaseName(currentPath);
    const ext = getExt(currentPath);
    const validationError = validateRenameBaseName(trimmed);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    if (!trimmed || trimmed === baseName) {
      setRenameMode(false);
      return;
    }
    track('file_preview', { sub_event: 'rename' });
    try {
      const newName = trimmed + ext;
      const nextPath = replaceFileName(currentPath, newName);
      if (scope === 'session') {
        if (!agentId || !sessionId) throw new Error('session file context is missing');
        await agentFilesApi.rename({ agentId, sessionId, level: 'session' }, currentPath, nextPath);
        await onRefresh?.();
      } else {
        await renameOptimistic(tenantId, currentPath, nextPath);
      }
      setCurrentDisplayName(newName);
      setCurrentPath(nextPath);
      setRenameMode(false);
    } catch (e: any) {
      if (e?.response?.status === 409) {
        setRenameConflict(`「${trimmed + ext}」已存在，请修改文件名后重试。`);
      } else {
        toast.error(`重命名失败：${e.message}`);
        setRenameMode(false);
      }
    }
  };

  const handleDeleteConfirm = async () => {
    track('file_preview', { sub_event: 'delete' });
    try {
      if (scope === 'session') {
        if (!agentId || !sessionId) throw new Error('session file context is missing');
        await agentFilesApi.delete({ agentId, sessionId, level: 'session' }, currentPath);
        await onRefresh?.();
      } else {
        if (fileId) await deleteOptimistic(tenantId, currentPath, fileId);
        else await deleteOptimistic(tenantId, currentPath);
      }
      onBack();
    } catch (e: any) {
      toast.error(`删除失败：${e.message}`);
    } finally {
      setDeleteConfirm(false);
    }
  };

  const actionBtnStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    fontSize: 12, color: 'var(--text-primary)',
    background: 'transparent', border: 'none', cursor: 'pointer',
    padding: '3px 8px', borderRadius: 'var(--radius-sm)',
    transition: 'color var(--transition-fast), background var(--transition-fast)',
  };

  const iconBtnStyle: React.CSSProperties = {
    ...actionBtnStyle,
    padding: '4px 6px',
    flexShrink: 0,
  };

  // Match the file preview header controls: the back target is 32px, with an 18px glyph.
  const backBtnStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    padding: 0,
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-muted)',
    borderRadius: 8,
    flexShrink: 0,
    transition: 'color var(--transition-fast), background var(--transition-fast)',
  };

  // Keep this CTA aligned with the upload button's mono-button treatment.
  const referenceBtnStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 32,
    fontSize: 12, lineHeight: '16px', fontWeight: 500,
    color: 'var(--btn-mono-text)',
    background: 'var(--btn-mono-bg)',
    border: '1px solid var(--btn-mono-bg)',
    cursor: 'pointer',
    padding: '0 12px', borderRadius: 8,
    transition: 'background var(--transition-fast), border-color var(--transition-fast), opacity var(--transition-fast)',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    opacity: 1,
  };

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}
      data-testid="user-file-preview"
    >
      {/* 面包屑 */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 12px', borderBottom: '1px solid var(--border-default)',
          flexShrink: 0, gap: 8,
        }}
        data-testid="user-file-preview-header"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, flex: 1 }}>
          <button
            onClick={onBack}
            style={backBtnStyle}
            onMouseEnter={(e) => {
              const target = e.currentTarget as HTMLElement;
              target.style.color = 'var(--text-primary)';
              target.style.background = 'var(--bg-tertiary)';
            }}
            onMouseLeave={(e) => {
              const target = e.currentTarget as HTMLElement;
              target.style.color = 'var(--text-muted)';
              target.style.background = 'transparent';
            }}
            data-testid="user-file-preview-back"
          >
            <ChevronLeft size={18} />
          </button>
          {renameMode ? (
            <>
              <input
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameConfirm();
                  if (e.key === 'Escape') setRenameMode(false);
                }}
                style={{
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '4px 8px',
                  fontSize: 12,
                  color: 'var(--text-primary)',
                  outline: 'none',
                  width: 200,
                }}
                placeholder="输入新文件名"
                data-testid="user-file-preview-rename-input"
              />
              <button
                onClick={handleRenameConfirm}
                style={{
                  ...iconBtnStyle,
                  color: 'var(--bg-primary, #fff)',
                  background: 'var(--text-primary)',
                  border: '1px solid var(--text-primary)',
                }}
                title="确认"
                data-testid="user-file-preview-rename-confirm"
              >
                <Check size={13} />
              </button>
              <button onClick={() => setRenameMode(false)} style={iconBtnStyle} title="取消" data-testid="user-file-preview-rename-cancel">
                <XIcon size={13} />
              </button>
            </>
          ) : (
            <>
              <span
                title={name}
                style={{
                  fontSize: 12, fontWeight: 500, color: 'var(--text-primary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
                data-testid="user-file-preview-title"
              >
                {name}
              </span>
              <button
                onClick={() => { setRenameValue(getBaseName(currentPath)); setRenameMode(true); }}
                style={iconBtnStyle}
                title="重命名"
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = '0.7')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = '1')}
                data-testid="user-file-preview-rename"
              >
                <img src={renameInputIcon} alt="" style={{ width: 14, height: 14 }} />
              </button>
            </>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {editMode ? (
            <>
              <button
                onClick={() => setEditMode(false)}
                disabled={saving}
                style={{
                  padding: '4px 12px', fontSize: 12, fontWeight: 500,
                  background: 'transparent',
                  border: '1px solid var(--border-default, rgba(0,0,0,0.14))',
                  borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  whiteSpace: 'nowrap',
                }}
                data-testid="user-file-preview-edit-cancel"
              >
                取消
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                style={{
                  padding: '4px 12px', fontSize: 12, fontWeight: 500,
                  background: 'var(--text-primary, #0B0B0B)',
                  border: '1px solid var(--text-primary, #0B0B0B)',
                  borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                  color: 'var(--bg-primary, #fff)',
                  whiteSpace: 'nowrap',
                }}
                data-testid="user-file-preview-edit-save"
              >
                {saving ? '保存中' : '保存'}
              </button>
            </>
          ) : (
            <>
              {isEditable && (
                <button
                  onClick={handleEnterEdit}
                  disabled={enteringEdit}
                  style={iconBtnStyle}
                  title="编辑"
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = '0.7')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = '1')}
                  data-testid="user-file-preview-edit"
                >
                  <img src={editPencilIcon} alt="" style={{ width: 14, height: 14 }} />
                </button>
              )}
              <button
                onClick={() => setDeleteConfirm(true)}
                style={iconBtnStyle}
                title="删除"
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--danger)')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text-primary)')}
                data-testid="user-file-preview-delete"
              >
                <Trash2 size={13} />
              </button>
              <button onClick={handleDownload} style={iconBtnStyle} title="下载"
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = '0.7')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = '1')}
                data-testid="user-file-preview-download"
              >
                <Download size={13} />
              </button>
              {fileId && (
                <button onClick={(e) => { setFileShareAnchorRect(e.currentTarget.getBoundingClientRect()); setFileShareOpen(true); }} style={iconBtnStyle} title="分享文件"
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = '0.7')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = '1')}
                  data-testid="user-file-preview-share-link"
                >
                  <Share2 size={13} />
                </button>
              )}
              <button onClick={handleReference} style={referenceBtnStyle} title={isReferenced ? '取消引用' : '引用到会话'}
                onMouseEnter={(e) => {
                  const target = e.currentTarget as HTMLElement;
                  target.style.background = 'var(--btn-mono-hover-bg)';
                  target.style.borderColor = 'var(--btn-mono-hover-bg)';
                }}
                onMouseLeave={(e) => {
                  const target = e.currentTarget as HTMLElement;
                  target.style.background = 'var(--btn-mono-bg)';
                  target.style.borderColor = 'var(--btn-mono-bg)';
                }}
                data-testid="user-file-preview-reference"
              >
                <img src={isReferenced ? unreferenceIcon : quoteIcon} alt="" style={{ width: 14, height: 14, filter: 'brightness(0) invert(1)' }} />
                {isReferenced ? '取消引用' : '引用到会话'}
              </button>
            </>
          )}
        </div>
      </div>

      {deleteConfirm && (
        <ConfirmDialog
          open={deleteConfirm}
          title={isShared ? '确定删除共享文件吗？' : '确定删除文件吗？'}
          description={isShared
            ? '当前文件已被共享，可能被其他会话引用，删除后无法找回，请谨慎操作。'
            : '删除后无法找回，请谨慎操作。'}
          variant="danger"
          confirmText="删除"
          cancelText="取消"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteConfirm(false)}
        />
      )}

      <ShareAndReferenceDialog
        open={shareAndRefOpen}
        fileName={name}
        onCancel={() => setShareAndRefOpen(false)}
        onConfirm={handleShareAndRef}
      />

      <FileShareDialog
        open={fileShareOpen}
        fileId={fileId}
        fileName={name}
        anchorRect={fileShareAnchorRect}
        onClose={() => { setFileShareOpen(false); setFileShareAnchorRect(null); }}
      />

      {renameConflict && (
        <ConfirmDialog
          open={!!renameConflict}
          title="文件名冲突"
          description={renameConflict}
          confirmText="修改"
          cancelText="取消"
          onConfirm={() => setRenameConflict('')}
          onCancel={() => { setRenameConflict(''); setRenameMode(false); }}
        />
      )}

      {/* 预览/编辑内容 */}
      <div style={{ flex: 1, overflow: 'auto' }} data-testid="user-file-preview-content">
        {editMode ? (
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            spellCheck={false}
            style={{
              width: '100%', height: '100%', boxSizing: 'border-box',
              padding: '16px', fontSize: 12, lineHeight: 1.6,
              color: 'var(--text-primary)', background: 'var(--bg-drawer, transparent)',
              border: 'none', outline: 'none', resize: 'none',
              fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
            }}
            data-testid="user-file-preview-editor"
          />
        ) : (
          <FilePreview key={`${fakeTab.level}:${fakeTab.path}:${refreshKey}`} tab={fakeTab} customUrlBuilder={customUrlBuilder} refreshKey={refreshKey} />
        )}
      </div>
    </div>
  );
}
