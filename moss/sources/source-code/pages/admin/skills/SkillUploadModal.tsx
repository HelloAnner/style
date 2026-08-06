import React, { useEffect, useMemo, useRef, useState } from 'react';
import { skillManagementApi, type SkillZipPreviewResponse, type UnifiedSkillItem } from '../../../api/skillManagement';
import { previewSkillZipLocally } from '../../../utils/skillZipPreview';
import { toast } from '../../../utils/toast';

type UploadStep = 'select' | 'loading' | 'preview';

interface SkillUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploaded?: (skill: UnifiedSkillItem) => void;
  existingNames?: string[];
}

const MAX_SIZE = 50 * 1024 * 1024;

function buildSuggestedName(baseName: string, existingNames: string[]): string {
  const trimmed = (baseName || '新技能').trim() || '新技能';
  let suffix = 2;
  let candidate = `${trimmed}-${suffix}`;
  while (existingNames.includes(candidate)) {
    suffix += 1;
    candidate = `${trimmed}-${suffix}`;
  }
  return candidate;
}

function formatUploadError(message: string): string {
  if (!message) return '技能包校验失败，请检查 zip 内容';
  if (message.includes('Skill name already exists in tenant')) {
    return '当前空间已存在同名技能，请修改名称后再继续';
  }
  if (message.includes('SKILL.md not found')) {
    return '技能包校验失败：未检测到 SKILL.md 文件';
  }
  if (message.includes('invalid skill zip')) {
    return '技能包校验失败：不是合法的技能包 zip 文件';
  }
  if (message.includes('invalid zip entry path')) {
    return '技能包校验失败：zip 内文件路径不合法';
  }
  if (message.includes('skill zip is empty')) {
    return '技能包校验失败：zip 文件内容为空';
  }
  if (
    message.includes('end of central directory') ||
    message.includes('Corrupted zip') ||
    message.includes('is this a zip file')
  ) {
    return '技能包校验失败：zip 文件已损坏或格式不正确，请重新打包后再上传';
  }
  if (message.includes('Encrypted zip')) {
    return '技能包校验失败：暂不支持加密的 zip 文件，请上传未加密的技能包';
  }
  return '技能包校验失败：无法解析 zip 文件，请确认文件完整后重试';
}

type PreviewTreeRow = { key: string; label: string; path: string; depth: number; dir: boolean };

function buildPreviewTreeRows(files: string[]): PreviewTreeRow[] {
  const rows: PreviewTreeRow[] = [];
  const seenDirs = new Set<string>();
  [...files].filter((path) => path !== '.DS_Store').sort().forEach((path) => {
    const parts = path.split('/').filter(Boolean);
    let current = '';
    parts.slice(0, -1).forEach((part, index) => {
      current += `${part}/`;
      if (!seenDirs.has(current)) {
        seenDirs.add(current);
        rows.push({ key: current, label: part, path: current, depth: index, dir: true });
      }
    });
    rows.push({
      key: path,
      label: parts[parts.length - 1] || path,
      path,
      depth: Math.max(0, parts.length - 1),
      dir: false,
    });
  });
  return rows;
}

function buildExpandedPreviewDirs(rows: PreviewTreeRow[]): Record<string, boolean> {
  return rows
    .filter(row => row.dir)
    .reduce<Record<string, boolean>>((acc, row) => {
      acc[row.path] = row.depth === 0;
      return acc;
    }, {});
}

function previewAncestorDirs(row: PreviewTreeRow): string[] {
  const parts = row.path.split('/').filter(Boolean);
  const limit = row.dir ? parts.length - 1 : parts.length - 1;
  const result: string[] = [];
  let current = '';
  parts.slice(0, limit).forEach((part) => {
    current += `${part}/`;
    result.push(current);
  });
  return result;
}

export const SkillUploadModal: React.FC<SkillUploadModalProps> = ({ isOpen, onClose, onUploaded, existingNames = [] }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [step, setStep] = useState<UploadStep>('select');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<SkillZipPreviewResponse | null>(null);
  const [activePreviewPath, setActivePreviewPath] = useState('SKILL.md');
  const [resolvedName, setResolvedName] = useState('');
  const [renameName, setRenameName] = useState('');
  const [renamePromptOpen, setRenamePromptOpen] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [expandedDirs, setExpandedDirs] = useState<Record<string, boolean>>({});

  const duplicateName = !!resolvedName.trim() && existingNames.includes(resolvedName.trim());
  const renameDuplicateName = !!renameName.trim() && existingNames.includes(renameName.trim());
  const suggestedName = (renamePromptOpen || duplicateName)
    ? buildSuggestedName(renameName || preview?.name || resolvedName, existingNames)
    : '';
  const previewTreeRows = useMemo(() => buildPreviewTreeRows(preview?.files || []), [preview?.files]);
  const previewFileSet = useMemo(() => new Set(preview?.files || []), [preview?.files]);
  const truncatedPreviewFileSet = useMemo(
    () => new Set(preview?.truncatedTextFiles || []),
    [preview?.truncatedTextFiles],
  );
  const activePreviewContent = activePreviewPath === 'SKILL.md'
    ? (preview?.textFiles?.['SKILL.md'] || preview?.skillMdContent || '')
    : (preview?.textFiles?.[activePreviewPath] || '');
  const activePreviewNotice = truncatedPreviewFileSet.has(activePreviewPath)
    ? '文件内容较大，当前仅展示前 256 KB 预览'
    : (!activePreviewContent && previewFileSet.has(activePreviewPath)
      ? '该文件暂不支持文本预览'
      : '');
  const visiblePreviewRows = previewTreeRows.filter((row) =>
    previewAncestorDirs(row).every((ancestor) => expandedDirs[ancestor] !== false),
  );

  useEffect(() => {
    if (!isOpen) {
      abortRef.current?.abort();
      abortRef.current = null;
      setStep('select');
      setFile(null);
      setPreview(null);
      setActivePreviewPath('SKILL.md');
      setResolvedName('');
      setRenameName('');
      setRenamePromptOpen(false);
      setError('');
      setDragging(false);
      setUploading(false);
      setExpandedDirs({});
    }
  }, [isOpen]);

  useEffect(() => {
    if (!preview) {
      setExpandedDirs({});
      return;
    }
    setExpandedDirs(buildExpandedPreviewDirs(previewTreeRows));
  }, [preview, previewTreeRows]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const acceptFile = async (nextFile: File) => {
    if (!nextFile.name.toLowerCase().endsWith('.zip')) {
      setError('只支持上传 .zip 文件');
      return;
    }
    if (nextFile.size > MAX_SIZE) {
      setError('文件大小不能超过 50MB');
      return;
    }
    setError('');
    setFile(nextFile);
    setPreview(null);
    setStep('loading');
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await previewSkillZipLocally(nextFile);
      if (controller.signal.aborted) return;
      const initialName = res.name?.trim() || nextFile.name.replace(/\.zip$/i, '').trim() || '新技能包';
      setPreview(res);
      setActivePreviewPath('SKILL.md');
      setResolvedName(initialName);
      setRenameName(initialName);
      setRenamePromptOpen(existingNames.includes(initialName));
      setStep('preview');
    } catch (err) {
      if (controller.signal.aborted) return;
      setStep('select');
      setError(formatUploadError((err as Error)?.message || ''));
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const handleApplyRename = () => {
    const nextName = renameName.trim();
    if (!nextName) {
      setError('请先输入新的技能名称');
      return;
    }
    if (existingNames.includes(nextName)) {
      setError('当前空间已存在同名技能，请继续修改名称');
      return;
    }
    setResolvedName(nextName);
    setRenameName(nextName);
    setRenamePromptOpen(false);
    setError('');
  };

  const handleConfirm = async () => {
    if (!file || !preview) return;
    if (renamePromptOpen) {
      setError('请先确认新的技能名称');
      return;
    }
    if (!resolvedName.trim()) {
      setError('请先输入技能名称');
      return;
    }
    if (duplicateName) {
      setRenameName(resolvedName);
      setRenamePromptOpen(true);
      setError('当前空间已存在同名技能，请修改名称后再继续');
      return;
    }
    setUploading(true);
    setError('');
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const created = await skillManagementApi.uploadZip(
        resolvedName.trim(),
        preview.description || '',
        file,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      toast.success('技能包上传成功');
      onUploaded?.(created);
      onClose();
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(formatUploadError((err as Error)?.message || '上传失败'));
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setUploading(false);
    }
  };

  const renderSelect = () => (
    <div style={{ padding: '20px 20px 18px' }} data-testid="skill-upload-select">
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const dropped = e.dataTransfer.files?.[0];
          if (dropped) void acceptFile(dropped);
        }}
        style={{
          height: 194,
          borderRadius: 10,
          border: `1px dashed ${dragging ? 'var(--accent)' : 'var(--border-subtle)'}`,
          background: dragging ? 'var(--info-bg-soft)' : 'var(--bg-tertiary)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          gap: 10,
        }}
        data-testid="skill-upload-dropzone"
      >
        <div style={{ fontSize: 32, lineHeight: 1, color: 'var(--text-secondary)' }}>+</div>
        <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>点击或拖拽文件到此区域进行上传</div>
      </div>
      <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
        请上传包含 `SKILL.md` 文件的 `.zip` 文件（上限 50 MB）
      </div>
      {!!error && (
        <div style={errorAlertStyle} data-testid="skill-upload-error">
          {error}
        </div>
      )}
    </div>
  );

  const renderLoading = () => (
    <div style={{ padding: '88px 20px 84px', display: 'flex', flexDirection: 'column', alignItems: 'center' }} data-testid="skill-upload-loading">
      <div style={{ width: 220, height: 12, borderRadius: 999, background: 'var(--border-default)', overflow: 'hidden' }}>
        <div className="skill-upload-loading-bar" style={{ width: '100%', height: '100%', borderRadius: 999 }} />
      </div>
      <div style={{ marginTop: 14, fontSize: 14, color: 'var(--text-muted)' }}>正在解析技能包，请稍候…</div>
    </div>
  );

  const renderPreview = () => (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }} data-testid="skill-upload-preview">
      <div style={{ padding: '14px 16px 0', flexShrink: 0 }}>
        <div style={{
          border: '1px solid var(--border-subtle)',
          borderRadius: 10,
          padding: 14,
          display: 'grid',
          gridTemplateColumns: '48px 1fr',
          gap: 12,
        }} data-testid="skill-upload-preview-summary">
          <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--info-bg-soft)' }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }} data-testid="skill-upload-preview-name">
              {resolvedName || preview?.name || file?.name || '未命名技能'}
            </div>
            <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' }} data-testid="skill-upload-preview-description">
              {preview?.description || '未在 SKILL.md 中解析到描述'}
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }} data-testid="skill-upload-preview-meta">
              上传　本地文件：{file?.name || '-'}　归档目录：{preview?.archiveRoot || '/'}
            </div>
          </div>
        </div>
        {renamePromptOpen && (
          <div style={warningAlertStyle} data-testid="skill-upload-rename-prompt">
            <div style={{ marginBottom: 8 }}>当前空间已存在同名技能，请修改名称后再继续上传。</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                value={renameName}
                onChange={(e) => { setRenameName(e.target.value); setError(''); }}
                placeholder="请输入新的技能名称"
                data-testid="skill-upload-rename-input"
                style={{
                  flex: 1,
                  minWidth: 180,
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--warning-border-soft)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={() => { setRenameName(suggestedName); setError(''); }}
                style={suggestionButtonStyle}
                data-testid="skill-upload-use-suggested-name"
              >
                使用建议名：{suggestedName}
              </button>
              <button
                type="button"
                onClick={handleApplyRename}
                style={confirmRenameButtonStyle(renameDuplicateName)}
                disabled={renameDuplicateName}
                data-testid="skill-upload-confirm-name"
              >
                确认名称
              </button>
            </div>
          </div>
        )}
      </div>
      <div style={{ padding: '12px 16px 16px', display: 'flex', minHeight: 0, gap: 12, flex: 1, overflow: 'hidden' }}>
        <div style={{
          flex: 1,
          minWidth: 0,
          border: '1px solid var(--border-subtle)',
          borderRadius: 10,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }} data-testid="skill-upload-preview-content">
          <div style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, borderBottom: '1px solid var(--border-subtle)' }} data-testid="skill-upload-preview-content-title">
            {activePreviewPath === 'SKILL.md' ? '技能内容（SKILL.md）' : `文件预览（${activePreviewPath}）`}
          </div>
          {!!activePreviewNotice && (
            <div style={{
              padding: '8px 12px',
              fontSize: 12,
              color: 'var(--warning)',
              background: 'var(--warning-bg-soft)',
              borderBottom: '1px solid var(--warning-border-soft)',
            }} data-testid="skill-upload-preview-notice">
              {activePreviewNotice}
            </div>
          )}
          <pre style={{
            margin: 0,
            padding: '14px 16px',
            flex: 1,
            overflow: 'auto',
            background: 'var(--bg-secondary)',
            fontSize: 12,
            lineHeight: 1.7,
            color: 'var(--text-primary)',
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }} data-testid="skill-upload-preview-text">
            {activePreviewContent || '当前文件没有可展示的文本预览'}
          </pre>
        </div>
        <div style={{
          width: 180,
          flexShrink: 0,
          border: '1px solid var(--border-subtle)',
          borderRadius: 10,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }} data-testid="skill-upload-file-tree">
          <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }} data-testid="skill-upload-file-tree-title">
            文件列表
          </div>
          <div style={{ padding: 8, overflow: 'auto' }} data-testid="skill-upload-file-list">
            {visiblePreviewRows.map((item) => (
              <div
                key={item.key}
                className="skill-upload-file-row"
                onClick={() => {
                  if (item.dir) {
                    setExpandedDirs((prev) => ({ ...prev, [item.path]: !prev[item.path] }));
                    return;
                  }
                  setActivePreviewPath(item.path);
                }}
                style={{
                  padding: '6px 8px',
                  paddingLeft: 8 + item.depth * 14,
                  borderRadius: 6,
                  background: item.path === activePreviewPath ? 'var(--bg-tertiary)' : 'transparent',
                  fontSize: 12,
                  color: item.path === activePreviewPath ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: item.dir || item.path === activePreviewPath ? 600 : 400,
                  wordBreak: 'break-all',
                  cursor: 'pointer',
                }}
                data-testid={`skill-upload-file-row-${item.path}`}
              >
                {item.dir ? (expandedDirs[item.path] === false ? '▸ ' : '▾ ') : ''}{item.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        .skill-upload-loading-bar {
          background: linear-gradient(90deg, var(--btn-primary-bg) 0%, var(--accent) 100%);
          animation: skillUploadPulse 1.2s ease-in-out infinite;
        }
        @keyframes skillUploadPulse {
          0%, 100% { opacity: 0.82; }
          50% { opacity: 1; }
        }
      `}</style>
      <input
        ref={inputRef}
        type="file"
        accept=".zip"
        style={{ display: 'none' }}
        data-testid="skill-upload-file-input"
        onChange={(e) => {
          const nextFile = e.target.files?.[0];
          if (nextFile) void acceptFile(nextFile);
          e.target.value = '';
        }}
      />
      <div
        className="fixed inset-0 z-[220] flex items-center justify-center"
        style={{ background: 'rgba(15, 23, 42, 0.22)', padding: 24, overflow: 'auto' }}
        onClick={onClose}
        data-testid="skill-upload-backdrop"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: step === 'preview' ? 980 : 420,
            maxWidth: '92vw',
            minHeight: step === 'preview' ? 0 : 280,
            height: step === 'preview' ? 'min(760px, calc(100vh - 48px))' : 'auto',
            maxHeight: 'calc(100vh - 48px)',
            background: 'var(--modal-bg)',
            borderRadius: 12,
            boxShadow: '0 24px 80px rgba(15, 23, 42, 0.18)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            margin: 'auto',
          }}
          data-testid="skill-upload-modal"
        >
          <div style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }} data-testid="skill-upload-header">
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }} data-testid="skill-upload-title">
              {step === 'preview' ? '技能预览' : '上传技能包'}
            </div>
            <button type="button" onClick={onClose} style={iconButtonStyle} data-testid="skill-upload-close">×</button>
          </div>
          {step === 'select' && renderSelect()}
          {step === 'loading' && renderLoading()}
          {step === 'preview' && renderPreview()}
          {step !== 'select' && !!error && <div style={{ padding: '0 16px 12px' }} data-testid="skill-upload-error-wrap"><div style={errorAlertStyle} data-testid="skill-upload-error">{error}</div></div>}
          {step === 'preview' && (
            <div style={{ padding: '0 16px 16px', display: 'flex', justifyContent: 'flex-end', gap: 10 }} data-testid="skill-upload-footer">
              <button type="button" onClick={onClose} style={secondaryButtonStyle} data-testid="skill-upload-cancel">取消</button>
              <button type="button" onClick={() => void handleConfirm()} disabled={uploading || renamePromptOpen} style={primaryButtonStyle(uploading || renamePromptOpen)} data-testid="skill-upload-confirm">
                {uploading ? '上传中...' : '确定'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

const iconButtonStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  border: 'none',
  background: 'transparent',
  color: 'var(--text-muted)',
  fontSize: 22,
  lineHeight: 1,
  cursor: 'pointer',
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 8,
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-secondary)',
  color: 'var(--text-primary)',
  cursor: 'pointer',
};

const primaryButtonStyle = (disabled: boolean): React.CSSProperties => ({
  padding: '8px 16px',
  borderRadius: 8,
  border: 'none',
  background: 'var(--btn-primary-bg)',
  color: 'var(--btn-primary-text)',
  opacity: disabled ? 0.6 : 1,
  cursor: disabled ? 'wait' : 'pointer',
});

const errorAlertStyle: React.CSSProperties = {
  marginTop: 12,
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid var(--danger-border-soft)',
  background: 'var(--danger-bg-soft)',
  color: 'var(--danger)',
  fontSize: 12,
  lineHeight: 1.6,
};

const warningAlertStyle: React.CSSProperties = {
  marginTop: 12,
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid var(--warning-border-soft)',
  background: 'var(--warning-bg-soft)',
  color: 'var(--warning)',
  fontSize: 12,
  lineHeight: 1.6,
};

const suggestionButtonStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid var(--warning-border-soft)',
  background: 'var(--bg-secondary)',
  color: 'var(--warning)',
  fontSize: 12,
  cursor: 'pointer',
  flexShrink: 0,
};

const confirmRenameButtonStyle = (disabled: boolean): React.CSSProperties => ({
  padding: '8px 10px',
  borderRadius: 8,
  border: 'none',
  background: 'var(--btn-primary-bg)',
  color: 'var(--btn-primary-text)',
  fontSize: 12,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.6 : 1,
  flexShrink: 0,
});
