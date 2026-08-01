import { Check, MoreHorizontal } from 'lucide-react';
import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { userFileDownloadUrl, type UserFileInfo } from '../../api/userFiles';
import quoteIcon from '../../assets/icons/file-panel/quote.svg';
import unreferenceIcon from '../../assets/icons/file-panel/unreference.svg';
import shareBadgeIcon from '../../assets/file-icons/share-badge.svg';
import { useFileReferenceStore } from '../../stores/fileReferenceStore';
import { useUserFileStore } from '../../stores/userFileStore';
import { FileActionPopover } from './FileActionPopover';
import { FileCardPreview, resolveFileIcon } from './FileCardPreview';
import { FileShareDialog } from './FileShareDialog';
import { ShareAndReferenceDialog } from './ShareAndReferenceDialog';
import { ShareConfirmDialog } from './ShareConfirmDialog';
import { buildHighlightSegments } from '../Chat/Home/HighlightText';
import { toast } from '../../utils/toast';
import { getWorkspaceFileCategory, getWorkspaceFileTypeLabel } from './fileCardModel';
import { FineDesignTooltip } from '../common/FineDesignTooltip';

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function toTimestampMs(iso: string): number | null {
  const ts = new Date(iso).getTime();
  return Number.isFinite(ts) ? ts : null;
}

function formatFileDate(iso: string): string {
  const ts = toTimestampMs(iso);
  if (!ts) return '';
  return new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function fileIdentity(file: UserFileInfo): string {
  return file.id || `${file.scope || 'unknown'}:${file.path}`;
}

function fileSelectionKey(file: UserFileInfo): string {
  return file.id ? `id:${file.id}` : `path:${file.path}`;
}

export type FileViewMode = 'grid' | 'list';

interface FileGridProps {
  files: UserFileInfo[];
  tenantId: string;
  onOpen: (file: UserFileInfo) => void;
  onEdit?: (file: UserFileInfo) => void;
  referenceLevel?: 'user_file' | 'session';
  emptyLabel?: string;
  actionsEnabled?: boolean;
  imageUrlBuilder?: (file: UserFileInfo) => string;
  actionScope?: 'user' | 'session';
  agentId?: string | null;
  sessionId?: string | null;
  onRefresh?: () => void | Promise<void>;
  onDeleted?: (path: string) => void;
  searchQuery?: string;
  viewMode?: FileViewMode;
  selectionMode?: boolean;
  selectedPaths?: ReadonlySet<string>;
  onToggleSelection?: (file: UserFileInfo) => void;
  getSelectionLabel?: (name: string, selected: boolean) => string;
}

export function FileGrid({
  files,
  tenantId,
  onOpen,
  onEdit,
  referenceLevel = 'user_file',
  emptyLabel = '暂无个人文件',
  actionsEnabled = true,
  imageUrlBuilder,
  actionScope = 'user',
  agentId,
  sessionId,
  onRefresh,
  onDeleted,
  searchQuery = '',
  viewMode = 'grid',
  selectionMode = false,
  selectedPaths = new Set<string>(),
  onToggleSelection,
  getSelectionLabel = (name, selected) => selected ? `Deselect ${name}` : `Select ${name}`,
}: FileGridProps) {
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);
  const [hoveredActionKey, setHoveredActionKey] = useState<string | null>(null);
  const [actionPopover, setActionPopover] = useState<{
    file: UserFileInfo;
    anchorEl: HTMLElement;
  } | null>(null);

  const addReference = useFileReferenceStore((s) => s.addReference);
  const removeReference = useFileReferenceStore((s) => s.removeReference);
  const references = useFileReferenceStore((s) => s.references) ?? [];
  const shareFile = useUserFileStore((s) => s.shareFile);
  const [quotedPath, setQuotedPath] = useState<string | null>(null);
  const quoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const quotedPathRef = useRef(quotedPath);
  quotedPathRef.current = quotedPath;
  const [pendingRefFile, setPendingRefFile] = useState<UserFileInfo | null>(null);
  const [shareAndRefOpen, setShareAndRefOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<UserFileInfo | null>(null);
  const [fileShareTarget, setFileShareTarget] = useState<UserFileInfo | null>(null);
  const [fileShareAnchorRect, setFileShareAnchorRect] = useState<DOMRect | null>(null);

  const doAddReference = useCallback(
    (f: UserFileInfo) => {
      addReference({
        id: `ref-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        fileName: f.displayName || f.path,
        filePath: f.path,
        level: referenceLevel,
        type: 'full',
      });
      setQuotedPath(f.path);
      if (quoteTimerRef.current) clearTimeout(quoteTimerRef.current);
      quoteTimerRef.current = setTimeout(() => setQuotedPath(null), 1500);
    },
    [addReference, referenceLevel]
  );

  // 引用动作：toggle — 已引用则取消，未引用则判断共享状态后添加
  const handleQuote = useCallback(
    (f: UserFileInfo) => {
      const existingRef = references.find(
        (r) => r.filePath === f.path && r.level === referenceLevel && r.type === 'full'
      );
      if (existingRef) {
        removeReference(existingRef.id);
        if (quotedPathRef.current === f.path) {
          if (quoteTimerRef.current) clearTimeout(quoteTimerRef.current);
          setQuotedPath(null);
        }
        return;
      }

      // 当前会话的文件 OR 已共享的文件 → 直接引用
      const canDirectRef = actionScope === 'session' || f.shared;
      if (canDirectRef) {
        doAddReference(f);
        return;
      }

      // 未共享 → 弹出"共享并引用"确认
      setPendingRefFile(f);
      setShareAndRefOpen(true);
    },
    [addReference, removeReference, references, referenceLevel, actionScope, doAddReference]
  );

  const doShareFile = async () => {
    if (!shareTarget || !tenantId) return;
    try {
      await useUserFileStore.getState().shareFile(tenantId, shareTarget.path);
      toast.success('已共享文件');
      await onRefresh?.();
    } catch (e: any) {
      toast.error(`共享失败：${e.message || '未知错误'}`);
    }
    setShareTarget(null);
  };

  const handleShareAndRef = async () => {
    if (!pendingRefFile || !tenantId) return;
    try {
      await shareFile(tenantId, pendingRefFile.path);
      doAddReference({ ...pendingRefFile, shared: true });
    } finally {
      setShareAndRefOpen(false);
      setPendingRefFile(null);
    }
  };

  useEffect(() => {
    return () => {
      if (quoteTimerRef.current) clearTimeout(quoteTimerRef.current);
    };
  }, []);

  const sorted = useMemo(
    () => [...files].sort((a, b) => (toTimestampMs(b.uploadedAt) ?? 0) - (toTimestampMs(a.uploadedAt) ?? 0)),
    [files]
  );

  const gridTemplateColumns = 'repeat(auto-fill, minmax(180px, 1fr))';
  const isListView = viewMode === 'list';

  if (sorted.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-tertiary)', fontSize: 13 }} data-testid="file-grid-empty">
        {emptyLabel}
      </div>
    );
  }

  return (
    <>
      <div
        style={{
          display: isListView ? 'flex' : 'grid',
          flexDirection: isListView ? 'column' : undefined,
          gridTemplateColumns: isListView ? undefined : gridTemplateColumns,
          gap: isListView ? 0 : '1%',
          width: '100%',
          boxSizing: 'border-box',
          padding: isListView ? '0 16px 12px' : '0 16px 16px',
          overflowY: 'auto',
          flex: 1,
          alignContent: 'start',
          justifyContent: 'start',
          gridAutoRows: 'max-content',
          alignItems: isListView ? 'stretch' : 'start',
        }}
        data-testid="file-grid"
      >
        {isListView && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: selectionMode ? '28px 28px minmax(0, 1fr) 58px 68px 100px' : '28px minmax(0, 1fr) 58px 68px 100px 58px',
              alignItems: 'center',
              gap: 10,
              height: 30,
              padding: '0 8px',
              color: 'var(--text-placeholder)',
              fontSize: 11,
              lineHeight: '18px',
              borderBottom: '1px solid var(--border-soft)',
              flexShrink: 0,
            }}
            data-testid="file-list-header"
          >
            {selectionMode && <span />}
            <span />
            <span>名称</span>
            <span>格式</span>
            <span>大小</span>
            <span>日期</span>
            {!selectionMode && <span />}
          </div>
        )}
        {sorted.map((file) => {
          const fileName = file.displayName || file.path;
          const nameSegments = buildHighlightSegments(fileName, searchQuery ? [searchQuery] : []);
          const category = getWorkspaceFileCategory(fileName);
          const fileKey = fileIdentity(file);
          const viewFileKey = `${viewMode}:${fileKey}`;
          const isHovered = hoveredPath === fileKey || (actionPopover ? fileIdentity(actionPopover.file) === fileKey : false);
          const isReferenced = references.some(
            (r) => r.filePath === file.path && r.level === referenceLevel && r.type === 'full'
          );
          const isJustQuoted = quotedPath === file.path;
          const isShared = ('scope' in file ? file.scope === 'session_shared' : false) || ('shared' in file ? Boolean((file as any).shared) : false);
          const selectionKey = fileSelectionKey(file);
          const isSelected = selectedPaths.has(selectionKey);
          const toggleSelection = () => onToggleSelection?.(file);
          const selectionCheckbox = selectionMode ? (
            <button
              type="button"
              className={isSelected ? 'workspace-file-checkbox is-selected' : 'workspace-file-checkbox'}
              aria-label={getSelectionLabel(fileName, isSelected)}
              aria-pressed={isSelected}
              onClick={(event) => { event.stopPropagation(); toggleSelection(); }}
              data-testid={`file-select-${file.path}`}
            >
              {isSelected && <Check size={11} strokeWidth={3} aria-hidden="true" />}
            </button>
          ) : null;

          const cardBorderColor = isReferenced
            ? 'var(--accent-color, #3b82f6)'
            : isHovered
              ? 'var(--border-default, rgba(0,0,0,0.14))'
              : 'var(--border-soft, rgba(0,0,0,0.08))';

          const actionButtons = (
            <>
              <button
                className="workspace-file-card-quote"
                style={{
                  width: isListView ? 26 : 22,
                  height: isListView ? 26 : 22,
                  borderRadius: 4,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: hoveredActionKey === `${fileKey}:ref`
                    ? 'var(--bg-hover-v11)'
                    : isReferenced || isJustQuoted
                      ? 'var(--accent-color-bg-subtle, rgba(59,130,246,0.08))'
                      : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background 0.15s, opacity 0.15s',
                  opacity: hoveredActionKey === `${fileKey}:ref` ? 1 : 0.9,
                }}
                title={isReferenced ? '点击取消引用' : '引用到对话'}
                onClick={(e) => {
                  e.stopPropagation();
                  handleQuote(file);
                }}
                onMouseEnter={() => setHoveredActionKey(`${fileKey}:ref`)}
                onMouseLeave={() => setHoveredActionKey(null)}
                data-testid={`file-card-quote-${file.path}`}
              >
                <img
                  src={isReferenced || isJustQuoted ? unreferenceIcon : quoteIcon}
                  alt=""
                  aria-hidden="true"
                  style={{ width: 13, height: 13, display: 'block' }}
                />
              </button>
              {actionsEnabled && (
                <button
                  className="workspace-file-card-more"
                  style={{
                    width: isListView ? 26 : 22,
                    height: isListView ? 26 : 22,
                    borderRadius: 4,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: hoveredActionKey === `${fileKey}:more`
                      ? 'var(--bg-hover-v11)'
                      : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background 0.15s, opacity 0.15s',
                    opacity: hoveredActionKey === `${fileKey}:more` ? 1 : 0.9,
                  }}
                  title="更多操作"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (actionPopover && fileIdentity(actionPopover.file) === fileKey) {
                      setActionPopover(null);
                    } else {
                      setActionPopover({ file, anchorEl: e.currentTarget as HTMLElement });
                    }
                  }}
                  onMouseEnter={() => setHoveredActionKey(`${fileKey}:more`)}
                  onMouseLeave={() => setHoveredActionKey(null)}
                  data-testid={`file-card-more-${file.path}`}
                >
                  <MoreHorizontal size={13} />
                </button>
              )}
            </>
          );

          if (isListView) {
            return (
              <div
                key={viewFileKey}
                className="workspace-file-list-row"
                onClick={() => selectionMode ? toggleSelection() : onOpen(file)}
                onMouseEnter={() => setHoveredPath(fileKey)}
                onMouseLeave={() => setHoveredPath(null)}
                style={{
                  minHeight: 44,
                  display: 'grid',
                  gridTemplateColumns: selectionMode ? '28px 28px minmax(0, 1fr) 58px 68px 100px' : '28px minmax(0, 1fr) 58px 68px 100px 58px',
                  alignItems: 'center',
                  gap: 10,
                  padding: '0 8px',
                  borderRadius: 0,
                  border: 'none',
                  borderBottom: '1px solid var(--border-soft)',
                  boxShadow: isReferenced ? 'inset 2px 0 0 var(--accent-color)' : 'none',
                  background: isHovered ? 'var(--bg-hover-v11)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'background 0.15s, box-shadow 0.15s',
                }}
                data-testid={`file-list-row-${file.path}`}
              >
                {selectionMode && selectionCheckbox}
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'transparent',
                    position: 'relative',
                    flexShrink: 0,
                  }}
                >
                  <img
                    src={resolveFileIcon(fileName)}
                    alt=""
                    aria-hidden="true"
                    style={{ width: 18, height: 18, objectFit: 'contain', display: 'block' }}
                  />
                  {isShared && (
                    <img
                      src={shareBadgeIcon}
                      alt=""
                      aria-hidden="true"
                      title="共享文件"
                      style={{
                        position: 'absolute',
                        right: -5,
                        bottom: -5,
                        width: 16,
                        height: 13,
                        objectFit: 'contain',
                        display: 'block',
                        pointerEvents: 'none',
                      }}
                    />
                  )}
                </div>
                <FineDesignTooltip
                  content={fileName}
                  placement="bottom"
                  align="end"
                  tooltipId={`workspace-file-name-${fileKey}-tooltip`}
                  testId={`workspace-file-name-${fileKey}`}
                  wrapperStyle={{ minWidth: 0, width: '100%' }}
                >
                  <div
                    className="workspace-file-list-name"
                    style={{
                      minWidth: 0,
                      width: '100%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                      lineHeight: '20px',
                    }}
                  >
                    {nameSegments.map((segment, index) => (
                      <span
                        key={`${segment.text}_${index}`}
                        style={segment.highlighted ? { color: 'var(--warning)', fontWeight: 500 } : undefined}
                      >
                        {segment.text}
                      </span>
                    ))}
                  </div>
                </FineDesignTooltip>
                <span
                  style={{
                    color: 'var(--text-secondary)',
                    fontSize: 12,
                    lineHeight: '18px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {getWorkspaceFileTypeLabel(fileName)}
                </span>
                <span
                  style={{
                    color: 'var(--text-secondary)',
                    fontSize: 12,
                    lineHeight: '18px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatFileSize(file.size)}
                </span>
                <span
                  style={{
                    color: 'var(--text-placeholder)',
                    fontSize: 12,
                    lineHeight: '18px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatFileDate(file.uploadedAt)}
                </span>
                {!selectionMode && <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: 2,
                    minWidth: 56,
                    opacity: isHovered || isReferenced || isJustQuoted || (actionPopover && fileIdentity(actionPopover.file) === fileKey) ? 1 : 0,
                    pointerEvents: isHovered || isReferenced || isJustQuoted || (actionPopover && fileIdentity(actionPopover.file) === fileKey) ? 'auto' : 'none',
                    transition: 'opacity 0.15s',
                  }}
                >
                  {actionButtons}
                </div>}
              </div>
            );
          }

          return (
            <div
              key={viewFileKey}
              className="workspace-file-card"
              onClick={() => selectionMode ? toggleSelection() : onOpen(file)}
              onMouseEnter={() => setHoveredPath(fileKey)}
              onMouseLeave={() => setHoveredPath(null)}
              style={{
                background: 'var(--bg-elevated, #fff)',
                borderRadius: 6,
                border: `0.5px solid ${cardBorderColor}`,
                cursor: 'pointer',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                minWidth: 0,
                padding: 4,
                transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.15s',
                boxShadow: isHovered ? '0 8px 24px rgba(9,30,64,0.08)' : '0 1px 2px rgba(9,30,64,0.04)',
                transform: isHovered ? 'translateY(-1px)' : 'translateY(0)',
              }}
              data-testid={`file-card-${file.path}`}
            >
              {selectionMode && (
                <div className="workspace-file-card-checkbox-wrap">{selectionCheckbox}</div>
              )}
              <div
                style={{
                  height: 120,
                  background: 'var(--workspace-file-preview-bg, rgba(11,11,11,0.03))',
                  borderRadius: 6,
                  flexShrink: 0,
                  minWidth: 0,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    opacity: isHovered ? 0.72 : 1,
                    filter: isHovered ? 'saturate(0.88)' : 'none',
                    transition: 'opacity 0.15s ease, filter 0.15s ease',
                  }}
                >
                  <FileCardPreview
                    fileName={fileName}
                    imageUrl={category === 'image'
                      ? (imageUrlBuilder?.(file) ?? userFileDownloadUrl({ tenantId, path: file.path, disposition: 'inline', thumb: true }))
                      : undefined}
                  />
                </div>
                {isHovered && !selectionMode && (
                  <div
                    className="workspace-file-card-actions"
                    style={{
                      position: 'absolute',
                      top: 6,
                      right: 6,
                      zIndex: 10,
                      display: 'flex',
                      gap: 2,
                      background: 'var(--bg-elevated)',
                      border: '0.5px solid var(--border-soft, rgba(0,0,0,0.08))',
                      borderRadius: 6,
                      padding: 3,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    }}
                    data-testid={`file-card-actions-${file.path}`}
                  >
                    {actionButtons}
                  </div>
                )}

              </div>

              {isShared && (
                <img
                  src={shareBadgeIcon}
                  alt=""
                  aria-hidden="true"
                  title="共享文件"
                  style={{
                    position: 'absolute',
                    bottom: 6,
                    right: -5,
                    width: 28,
                    height: 24,
                    objectFit: 'contain',
                    display: 'block',
                    zIndex: 10,
                    pointerEvents: 'none',
                  }}
                />
              )}

              <div style={{ padding: '12px 12px 8px', display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <div style={{ minWidth: 0 }}>
                  <span
                    className="workspace-file-card-name"
                    title={file.path}
                    style={{
                      display: '-webkit-box',
                      fontSize: 14,
                      fontWeight: 400,
                      color: 'var(--text-primary)',
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'normal',
                      lineHeight: '22px',
                      minHeight: 44,
                      WebkitBoxOrient: 'vertical',
                      WebkitLineClamp: 2,
                    }}
                    data-testid={`file-card-name-${file.path}`}
                  >
                    {nameSegments.map((segment, index) => (
                      <span
                        key={`${segment.text}_${index}`}
                        style={segment.highlighted ? { color: 'var(--warning)', fontWeight: 500 } : undefined}
                      >
                        {segment.text}
                      </span>
                    ))}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span
                    className="workspace-file-card-size"
                    style={{
                      fontSize: 12,
                      color: 'var(--text-placeholder)',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      lineHeight: '20px',
                    }}
                    data-testid={`file-card-size-${file.path}`}
                  >
                    {formatFileSize(file.size)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {actionsEnabled && !selectionMode && actionPopover && (
        <FileActionPopover
          open={true}
          onClose={() => { setActionPopover(null); setHoveredPath(null); }}
          file={actionPopover.file}
          tenantId={tenantId}
          anchorEl={actionPopover.anchorEl}
          onPreview={onOpen}
          onEdit={onEdit}
          scope={actionScope}
          agentId={agentId}
          sessionId={sessionId}
          onRefresh={onRefresh}
          onDeleted={onDeleted}
          shared={('scope' in actionPopover.file ? actionPopover.file.scope === 'session_shared' : false) || ('shared' in actionPopover.file ? (actionPopover.file as any).shared : false)}
          onShare={() => {
            setShareTarget(actionPopover.file);
            setActionPopover(null);
          }}
          onFileShare={(anchorRect) => {
            setFileShareTarget(actionPopover.file);
            setFileShareAnchorRect(anchorRect ?? null);
            setActionPopover(null);
          }}
        />
      )}

      <ShareConfirmDialog
        open={shareTarget !== null}
        fileName={shareTarget?.displayName || shareTarget?.path || ''}
        onCancel={() => { setShareTarget(null); setHoveredPath(null); }}
        onConfirm={doShareFile}
      />

      <ShareAndReferenceDialog
        open={shareAndRefOpen}
        fileName={pendingRefFile?.displayName || pendingRefFile?.path || ''}
        onCancel={() => { setShareAndRefOpen(false); setPendingRefFile(null); setHoveredPath(null); }}
        onConfirm={handleShareAndRef}
      />

      <FileShareDialog
        open={fileShareTarget !== null}
        fileId={fileShareTarget?.id}
        fileName={fileShareTarget?.displayName || fileShareTarget?.path || ''}
        anchorRect={fileShareAnchorRect}
        onClose={() => { setFileShareTarget(null); setFileShareAnchorRect(null); setHoveredPath(null); }}
      />
    </>
  );
}
