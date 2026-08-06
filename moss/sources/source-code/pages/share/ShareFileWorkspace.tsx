/**
 * ShareFileWorkspace - read-only public share file workspace.
 *
 * 全面对标真实产品 Workspace 的视觉设计：
 * - 玻璃面板容器（glass-bg, blur, shadow）
 * - "分享会话文件" 头部
 * - 个人文件网格（160×160 卡片）
 * - 分类型预览缩略图（文档/代码/表格/PDF/PPT/图片等）
 * - 点击进入文件预览（Markdown 渲染、代码高亮、图片）
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Download, Search, X } from 'lucide-react';
import { AnimatePresence } from '../../lib/motion';
import { kernelApiFetch } from '../../api/gateway';
import { FileCardPreview } from '../../components/Workspace/FileCardPreview';
import { FilePreview } from '../../components/Workspace/FilePreview';
import drawerStyles from '../../components/Workspace/WorkspaceDrawer.module.css';
import closeIcon from '../../assets/icons/file-panel/close.svg';
import collapseIcon from '../../assets/icons/file-panel/collapse.svg';
import maximizeIcon from '../../assets/icons/file-panel/maximize.svg';
import type { ReplayFileItem } from './ReplayEngine';
import { shareFileDownloadUrl, shareFilePreviewUrl } from './shareFileUrls';

const MarkdownContent = React.lazy(() =>
  import('../../components/Chat/MarkdownContent').then((m) => ({ default: m.MarkdownContent })),
);

function getFileExt(name: string): string {
  return name.split('.').pop()?.toLowerCase() || '';
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

const MARKDOWN_EXTS = new Set(['md', 'markdown']);
const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico']);
const FILE_PREVIEW_EXTS = new Set(['html', 'htm', 'pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx']);

// ---------------------------------------------------------------------------
// ShareFileWorkspace
// ---------------------------------------------------------------------------

interface ShareFileWorkspaceProps {
  files: ReplayFileItem[];
  shareToken: string;
  allowDownload?: boolean;
  isOpen: boolean;
  isMaximized: boolean;
  onToggleMaximized: () => void;
  onClose: () => void;
  openFileRequest?: { name: string; ts: number } | null;
}

export const ShareFileWorkspace: React.FC<ShareFileWorkspaceProps> = ({ files, shareToken, allowDownload = false, isOpen, isMaximized, onToggleMaximized, onClose, openFileRequest }) => {
  const [previewFile, setPreviewFile] = useState<ReplayFileItem | null>(null);
  const [previewContent, setPreviewContent] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [isImage, setIsImage] = useState(false);
  const [query, setQuery] = useState('');
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);

  const sessionFiles = useMemo(() => {
    const seen = new Set<string>();
    return files.filter((f) => {
      const key = f.path.replace(/^\/+/, '').replace(/^files\//, '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [files]);
  const fileSummary = useMemo(() => {
    const totalSize = sessionFiles.reduce((sum, file) => sum + (typeof file.size === 'number' ? file.size : 0), 0);
    return `${sessionFiles.length}个文件，${formatFileSize(totalSize)}`;
  }, [sessionFiles]);
  const filteredFiles = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return sessionFiles;
    return sessionFiles.filter((file) =>
      file.name.toLowerCase().includes(trimmed) ||
      file.path.toLowerCase().includes(trimmed)
    );
  }, [query, sessionFiles]);

  const handleOpenFile = async (file: ReplayFileItem) => {
    setPreviewFile(file);
    setPreviewLoading(true);
    setIsImage(false);

    const ext = getFileExt(file.name);
    const url = shareFilePreviewUrl(shareToken, file.path);

    if (FILE_PREVIEW_EXTS.has(ext)) {
      setPreviewLoading(false);
      return;
    }

    if (IMAGE_EXTS.has(ext)) {
      setIsImage(true);
      setPreviewContent(url);
      setPreviewLoading(false);
      return;
    }

    try {
      const res = await kernelApiFetch(url);
      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.startsWith('image/')) {
          setIsImage(true);
          setPreviewContent(url);
        } else {
          setPreviewContent(await res.text());
        }
      } else {
        setPreviewContent('无法加载文件内容');
      }
    } catch {
      setPreviewContent('加载失败');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDownload = async (file: ReplayFileItem) => {
    try {
      const response = await kernelApiFetch(shareFileDownloadUrl(shareToken, file.path));
      if (!response.ok) throw new Error(String(response.status));
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = file.name || file.path.split('/').pop() || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    } catch (err) {
      console.error('share file download failed', err);
    }
  };

  const lastOpenTsRef = useRef(0);
  useEffect(() => {
    if (!openFileRequest || openFileRequest.ts === lastOpenTsRef.current || sessionFiles.length === 0) return;
    lastOpenTsRef.current = openFileRequest.ts;
    const fileName = openFileRequest.name;
    const match = sessionFiles.find(f =>
      f.name === fileName ||
      f.path === fileName ||
      f.path.endsWith('/' + fileName) ||
      fileName.includes(f.name)
    );
    if (match) handleOpenFile(match);
  }, [openFileRequest, sessionFiles]);

  const isMarkdown = previewFile ? MARKDOWN_EXTS.has(getFileExt(previewFile.name)) : false;
  const isImgFile = previewFile ? IMAGE_EXTS.has(getFileExt(previewFile.name)) : false;
  const usesFilePreview = previewFile ? FILE_PREVIEW_EXTS.has(getFileExt(previewFile.name)) : false;
  const previewTab = previewFile ? {
    id: `share:${previewFile.path}`,
    name: previewFile.name,
    path: previewFile.path,
    type: 'unknown' as const,
    level: 'session' as const,
    kind: 'file' as const,
  } : null;

  if (!isOpen) return null;

  return (
    <div
      data-testid="share-file-workspace"
      className="h-full w-full flex flex-col overflow-hidden"
      style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(var(--glass-blur))',
        WebkitBackdropFilter: 'blur(var(--glass-blur))',
        borderRadius: 0,
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--panel-shadow, 0 8px 32px rgba(0,0,0,0.12))',
      }}
    >
      {/* Header — matches real Workspace */}
      <div className="flex items-center justify-between px-4 h-14" data-testid="share-file-workspace-header" style={{ flexShrink: 0, borderBottom: '1px solid var(--border-default)' }}>
        <div className="flex items-center gap-2" style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          {previewFile && (
            <button
              onClick={() => setPreviewFile(null)}
              data-testid="share-file-workspace-back"
              className="flex items-center justify-center hover:bg-zinc-700/50 transition-colors"
              style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)', flexShrink: 0 }}
            >
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="15,18 9,12 15,6" />
              </svg>
            </button>
          )}
          <span className="font-medium" title={previewFile?.name} style={{ color: 'var(--text-primary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {previewFile ? previewFile.name : '分享会话文件'}
          </span>
        </div>
        <button
          type="button"
          onClick={onToggleMaximized}
          data-testid="share-file-workspace-maximize"
          className={`share-file-workspace-maximize ${drawerStyles.iconBtn}`}
          title={isMaximized ? '还原' : '最大化'}
          aria-label={isMaximized ? '还原文件区' : '最大化文件区'}
        >
          <img
            src={isMaximized ? collapseIcon : maximizeIcon}
            alt=""
            aria-hidden="true"
            className={drawerStyles.headerActionIcon}
          />
        </button>
        {allowDownload && previewFile && (
          <button
            type="button"
            onClick={() => void handleDownload(previewFile)}
            data-testid="share-file-workspace-download"
            className="p-1.5 rounded-md hover:bg-zinc-700/50 transition-colors"
            title="下载"
            aria-label="下载"
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', marginLeft: 8, marginRight: 8, flexShrink: 0 }}
          >
            <Download size={16} />
          </button>
        )}
        <button
          onClick={onClose}
          data-testid="share-file-workspace-close"
          className={drawerStyles.iconBtn}
          title="关闭"
          aria-label="关闭文件区"
        >
          <img src={closeIcon} alt="" aria-hidden="true" className={drawerStyles.headerActionIcon} />
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }} data-testid="share-file-workspace-content">
        <AnimatePresence mode="wait">
          {previewFile ? (
            <motion.div
              key="preview"
              data-testid="share-file-workspace-preview"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              style={{ height: '100%' }}
            >
              {usesFilePreview && previewTab ? (
                <FilePreview
                  key={previewTab.id}
                  tab={previewTab}
                  customUrlBuilder={(path) => shareFilePreviewUrl(shareToken, path)}
                  htmlSandbox="allow-scripts allow-same-origin"
                />
              ) : previewLoading ? (
                <div data-testid="share-file-workspace-preview-loading" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-tertiary)', fontSize: 14 }}>
                  <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.5 }}>加载中...</motion.span>
                </div>
              ) : (isImage || isImgFile) ? (
                <div data-testid="share-file-workspace-preview-image" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 20 }}>
                  <img src={previewContent} alt={previewFile.name} style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8, objectFit: 'contain' }} />
                </div>
              ) : isMarkdown ? (
                <div data-testid="share-file-workspace-preview-markdown" style={{ padding: 20, fontSize: 14, lineHeight: 1.7, color: 'var(--text-primary)' }}>
                  <React.Suspense fallback={<pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{previewContent}</pre>}>
                    <MarkdownContent content={previewContent} />
                  </React.Suspense>
                </div>
              ) : (
                <pre data-testid="share-file-workspace-preview-text" style={{
                  padding: 20, margin: 0, fontSize: 13, lineHeight: 1.6,
                  color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
                }}>
                  {previewContent}
                </pre>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="canvas"
              data-testid="share-file-workspace-browser"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ background: '#fff' }}
            >
              {sessionFiles.length > 0 && (
                <div style={{ marginBottom: 8 }} data-testid="share-file-workspace-files">
                  <div style={{ padding: '12px 16px' }}>
                    <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>
                        {fileSummary}
                      </span>
                      <div
                        style={{
                          marginLeft: 'auto',
                          width: 180,
                          height: 30,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '0 8px',
                          borderRadius: 6,
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        <Search size={14} style={{ flexShrink: 0 }} />
                        <input
                          data-testid="share-file-workspace-search"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder="搜索"
                          aria-label="搜索文件"
                          style={{
                            width: '100%',
                            minWidth: 0,
                            border: 'none',
                            outline: 'none',
                            background: 'transparent',
                            color: 'var(--text-primary)',
                            fontSize: 12,
                          }}
                        />
                        {query && (
                          <button
                            type="button"
                            onClick={() => setQuery('')}
                            data-testid="share-file-workspace-search-clear"
                            title="清空搜索"
                            aria-label="清空搜索"
                            style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex' }}
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div data-testid="share-file-workspace-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8, padding: '0 16px 16px' }}>
                    {filteredFiles.map((file) => (
                      <div
                        key={file.path}
                        data-testid={`share-file-card-${file.path}`}
                        onClick={() => handleOpenFile(file)}
                        onMouseEnter={() => setHoveredPath(file.path)}
                        onMouseLeave={() => setHoveredPath(null)}
                        className="share-file-card cursor-pointer select-none group"
                        style={{
                          background: '#fff',
                          borderRadius: 6,
                          border: '0.5px solid var(--border-soft, rgba(0,0,0,0.08))',
                          padding: 4,
                        }}
                      >
                        <div style={{
                          width: '100%', height: 120,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          position: 'relative', borderRadius: 6, overflow: 'hidden',
                          background: 'var(--bg-primary)',
                        }}>
                            <FileCardPreview fileName={file.name} />
                          {allowDownload && hoveredPath === file.path && (
                            <button
                              type="button"
                              className="share-file-download"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleDownload(file);
                              }}
                              data-testid={`share-file-download-${file.path}`}
                              title="下载"
                              aria-label={`下载 ${file.name}`}
                              style={{
                                position: 'absolute',
                                top: 8,
                                right: 8,
                                width: 28,
                                height: 28,
                                borderRadius: 6,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '1px solid var(--border-subtle)',
                                background: 'var(--bg-elevated)',
                                color: 'var(--text-primary)',
                                cursor: 'pointer',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                              }}
                            >
                              <Download size={14} />
                            </button>
                          )}
                        </div>
                        <div style={{ padding: '6px 4px 0', textAlign: 'center', width: '100%' }}>
                          <div
                            style={{
                              fontSize: 12, fontWeight: 500, color: 'var(--text-primary)',
                              lineHeight: 1.35,
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical' as any,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              wordBreak: 'break-all',
                              height: '2.7em',
                            }}
                            title={file.name}
                          >
                            {file.name}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {filteredFiles.length === 0 && (
                    <div data-testid="share-file-workspace-empty-search" style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', fontSize: 13 }}>
                      未找到文件
                    </div>
                  )}
                </div>
              )}
              {sessionFiles.length === 0 && (
                <div data-testid="share-file-workspace-empty" style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)', fontSize: 14 }}>
                  暂无文件
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
