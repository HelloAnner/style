/**
 * ReplayWorkspace — 回放用工作室面板
 *
 * 全面对标真实产品 Workspace 的视觉设计：
 * - 玻璃面板容器（glass-bg, blur, shadow）
 * - StudioIcon + "工作室" 头部
 * - 文件画布网格（160×160 卡片）
 * - 分类型预览缩略图（文档/代码/表格/PDF/PPT/图片等）
 * - 点击进入文件预览（Markdown 渲染、代码高亮、图片）
 */

import React, { useState, useMemo, useEffect, useRef, memo } from 'react';
import { motion } from 'framer-motion';
import { AnimatePresence } from '../../lib/motion';
import { kernelApiFetch } from '../../api/gateway';
import type { ReplayFileItem } from './ReplayEngine';

const MarkdownContent = React.lazy(() =>
  import('../../components/Chat/MarkdownContent').then((m) => ({ default: m.MarkdownContent })),
);

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

const StudioIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <rect x="4" y="3" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="2" />
    <path d="M8 19l4-4 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 15v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const CanvasIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);

// ---------------------------------------------------------------------------
// File category detection — mirrors real FileCanvas
// ---------------------------------------------------------------------------

type FileCategory = 'image' | 'document' | 'pdf' | 'code' | 'spreadsheet' | 'video' | 'audio' | 'presentation' | 'archive' | 'unknown';

function getFileCategory(name: string): FileCategory {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) return 'image';
  if (['pdf'].includes(ext)) return 'pdf';
  if (['csv', 'xlsx', 'xls', 'ods'].includes(ext)) return 'spreadsheet';
  if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'].includes(ext)) return 'audio';
  if (['pptx', 'ppt', 'key', 'odp'].includes(ext)) return 'presentation';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive';
  if (['py', 'js', 'ts', 'jsx', 'tsx', 'go', 'java', 'c', 'cpp', 'rs', 'rb', 'php', 'html', 'css', 'sql', 'sh'].includes(ext)) return 'code';
  if (['md', 'txt', 'json', 'yaml', 'yml', 'toml', 'xml', 'log', 'doc', 'docx', 'rst'].includes(ext)) return 'document';
  return 'unknown';
}

function getFileExt(name: string): string {
  return name.split('.').pop()?.toLowerCase() || '';
}

const MARKDOWN_EXTS = new Set(['md', 'markdown']);
const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico']);

// ---------------------------------------------------------------------------
// Card surface tokens — match real FileCanvas
// ---------------------------------------------------------------------------

const CARD_BG = 'var(--preview-card-bg, rgba(255,255,255,0.07))';
const CARD_BORDER = '1px solid var(--preview-card-border, rgba(255,255,255,0.1))';
const CARD_SHADOW = '0 2px 12px rgba(0,0,0,0.12)';
const LINE_COLOR = 'var(--text-secondary)';

const ACCENT = {
  doc: '#3b82f6', pdf: '#ef4444', ppt: '#f97316',
  archive: '#ca8a04', video: '#ec4899', spreadsheet: '#10b981',
};

// ---------------------------------------------------------------------------
// File type preview thumbnails — match real FileCanvas exactly
// ---------------------------------------------------------------------------

const DocumentPreview = memo(() => (
  <div style={{ width: 100, height: 130, borderRadius: 6, background: CARD_BG, border: CARD_BORDER, padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 6, boxShadow: CARD_SHADOW }}>
    <div style={{ height: 3, borderRadius: 2, background: ACCENT.doc, opacity: 0.45, width: '80%' }} />
    <div style={{ height: 3, borderRadius: 2, background: LINE_COLOR, opacity: 0.2, width: '100%' }} />
    <div style={{ height: 3, borderRadius: 2, background: LINE_COLOR, opacity: 0.2, width: '60%' }} />
    <div style={{ height: 3, borderRadius: 2, background: LINE_COLOR, opacity: 0.3, width: '90%' }} />
    <div style={{ height: 3, borderRadius: 2, background: LINE_COLOR, opacity: 0.15, width: '70%' }} />
    <div style={{ height: 3, borderRadius: 2, background: LINE_COLOR, opacity: 0.2, width: '95%' }} />
    <div style={{ height: 3, borderRadius: 2, background: LINE_COLOR, opacity: 0.13, width: '45%' }} />
  </div>
));

const PdfPreview = memo(() => (
  <div style={{ width: 100, height: 130, position: 'relative' }}>
    <div style={{ width: '100%', height: '100%', borderRadius: 6, background: CARD_BG, border: CARD_BORDER, padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 6, boxShadow: CARD_SHADOW, clipPath: 'polygon(0 0, 75% 0, 100% 18%, 100% 100%, 0 100%)' }}>
      <div style={{ height: 3, borderRadius: 2, background: ACCENT.pdf, opacity: 0.5, width: '65%' }} />
      <div style={{ height: 3, borderRadius: 2, background: LINE_COLOR, opacity: 0.2, width: '100%' }} />
      <div style={{ height: 3, borderRadius: 2, background: LINE_COLOR, opacity: 0.2, width: '55%' }} />
      <div style={{ height: 3, borderRadius: 2, background: LINE_COLOR, opacity: 0.25, width: '85%' }} />
      <div style={{ height: 3, borderRadius: 2, background: LINE_COLOR, opacity: 0.15, width: '70%' }} />
    </div>
    <div style={{ position: 'absolute', top: 0, right: 0, width: 25, height: 23, background: 'rgba(255,255,255,0.05)', borderLeft: CARD_BORDER, borderBottom: CARD_BORDER, borderRadius: '0 0 0 4px' }} />
  </div>
));

const CodePreview = memo(() => (
  <div style={{ width: 132, height: 106, borderRadius: 8, background: 'var(--code-preview-bg, #1e1e2e)', border: CARD_BORDER, overflow: 'hidden', boxShadow: CARD_SHADOW }}>
    <div style={{ height: 18, display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px', background: 'var(--code-preview-bar, rgba(255,255,255,0.05))' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff5f57' }} />
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#febc2e' }} />
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#28c840' }} />
    </div>
    <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'flex', gap: 4 }}><span style={{ width: 20, height: 3, borderRadius: 2, background: '#c678dd', opacity: 0.85 }} /><span style={{ width: 32, height: 3, borderRadius: 2, background: '#61afef', opacity: 0.75 }} /></div>
      <div style={{ display: 'flex', gap: 4, paddingLeft: 10 }}><span style={{ width: 26, height: 3, borderRadius: 2, background: '#98c379', opacity: 0.75 }} /><span style={{ width: 16, height: 3, borderRadius: 2, background: '#d19a66', opacity: 0.65 }} /></div>
      <div style={{ display: 'flex', gap: 4, paddingLeft: 10 }}><span style={{ width: 14, height: 3, borderRadius: 2, background: '#e06c75', opacity: 0.75 }} /><span style={{ width: 38, height: 3, borderRadius: 2, background: '#56b6c2', opacity: 0.65 }} /></div>
      <div style={{ display: 'flex', gap: 4 }}><span style={{ width: 28, height: 3, borderRadius: 2, background: '#c678dd', opacity: 0.85 }} /><span style={{ width: 18, height: 3, borderRadius: 2, background: '#abb2bf', opacity: 0.45 }} /></div>
    </div>
  </div>
));

const SpreadsheetPreview = memo(() => {
  const GB = 'var(--preview-card-border, rgba(255,255,255,0.1))';
  return (
    <div style={{ width: 132, height: 98, borderRadius: 6, background: CARD_BG, border: CARD_BORDER, overflow: 'hidden', boxShadow: CARD_SHADOW }}>
      <div style={{ height: 16, background: 'rgba(255,255,255,0.04)', display: 'flex', borderBottom: `1px solid ${GB}` }}>
        {[0, 1, 2, 3].map(c => <span key={c} style={{ flex: 1, borderRight: c < 3 ? `1px solid ${GB}` : 'none' }} />)}
      </div>
      {[0, 1, 2, 3, 4].map(r => (
        <div key={r} style={{ height: 16, display: 'flex', borderBottom: `1px solid ${GB}` }}>
          {[0, 1, 2, 3].map(c => (
            <span key={c} style={{ flex: 1, borderRight: c < 3 ? `1px solid ${GB}` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {r < 3 && c < 2 && <span style={{ width: '60%', height: 3, borderRadius: 1, background: c === 0 ? 'rgba(16,185,129,0.45)' : LINE_COLOR, opacity: c === 0 ? 1 : 0.15 }} />}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
});

const PresentationPreview = memo(() => (
  <div style={{ width: 136, height: 96, borderRadius: 6, background: CARD_BG, border: CARD_BORDER, padding: '16px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8, boxShadow: CARD_SHADOW }}>
    <div style={{ height: 5, borderRadius: 2, background: ACCENT.ppt, opacity: 0.5, width: '70%' }} />
    <div style={{ height: 3, borderRadius: 2, background: LINE_COLOR, opacity: 0.2, width: '50%' }} />
    <div style={{ marginTop: 4, display: 'flex', gap: 6 }}>
      {[0, 1, 2].map(i => <div key={i} style={{ width: 24, height: 18, borderRadius: 3, background: LINE_COLOR, opacity: 0.1 }} />)}
    </div>
  </div>
));

const VideoPreview = memo(() => (
  <div style={{ width: 140, height: 88, borderRadius: 8, background: CARD_BG, border: CARD_BORDER, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: CARD_SHADOW, position: 'relative' }}>
    <div style={{ width: 30, height: 30, borderRadius: '50%', border: `2px solid ${ACCENT.video}`, opacity: 0.6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 0, height: 0, borderStyle: 'solid', borderWidth: '5px 0 5px 9px', borderColor: `transparent transparent transparent ${ACCENT.video}`, marginLeft: 2, opacity: 0.8 }} />
    </div>
  </div>
));

const UnknownPreview = memo<{ ext: string }>(({ ext }) => (
  <div style={{ width: 100, height: 120, borderRadius: 6, background: CARD_BG, border: CARD_BORDER, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: CARD_SHADOW }}>
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" style={{ opacity: 0.5 }}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
    </svg>
    {ext && <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', opacity: 0.65 }}>.{ext}</span>}
  </div>
));

const FileTypePreview = memo<{ fileName: string }>(({ fileName }) => {
  const cat = getFileCategory(fileName);
  switch (cat) {
    case 'document': return <DocumentPreview />;
    case 'pdf': return <PdfPreview />;
    case 'code': return <CodePreview />;
    case 'spreadsheet': return <SpreadsheetPreview />;
    case 'video': return <VideoPreview />;
    case 'audio': return <VideoPreview />;
    case 'presentation': return <PresentationPreview />;
    case 'archive': return <UnknownPreview ext="zip" />;
    default: return <UnknownPreview ext={getFileExt(fileName).toUpperCase()} />;
  }
});

// ---------------------------------------------------------------------------
// URL builder for share file API
// ---------------------------------------------------------------------------

function buildShareFileUrl(shareToken: string, filePath: string, thumb = false): string {
  const cleanPath = filePath.replace(/^\/+/, '');
  const encoded = cleanPath.split('/').map(encodeURIComponent).join('/');
  const qs = thumb ? '?thumb=true' : '';
  return `/api/v1/share/${shareToken}/files/${encoded}${qs}`;
}

// ---------------------------------------------------------------------------
// ReplayWorkspace
// ---------------------------------------------------------------------------

interface ReplayWorkspaceProps {
  files: ReplayFileItem[];
  shareToken: string;
  isOpen: boolean;
  onClose: () => void;
  openFileRequest?: { name: string; ts: number } | null;
}

export const ReplayWorkspace: React.FC<ReplayWorkspaceProps> = ({ files, shareToken, isOpen, onClose, openFileRequest }) => {
  const [previewFile, setPreviewFile] = useState<ReplayFileItem | null>(null);
  const [previewContent, setPreviewContent] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [isImage, setIsImage] = useState(false);

  const sessionFiles = useMemo(() => {
    const seen = new Set<string>();
    return files.filter((f) => {
      if (seen.has(f.path)) return false;
      seen.add(f.path);
      return true;
    });
  }, [files]);

  const handleOpenFile = async (file: ReplayFileItem) => {
    setPreviewFile(file);
    setPreviewLoading(true);
    setIsImage(false);

    const ext = getFileExt(file.name);
    const url = buildShareFileUrl(shareToken, file.path);

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

  if (!isOpen) return null;

  return (
    <div
      className="h-full w-full flex flex-col overflow-hidden"
      style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(var(--glass-blur))',
        WebkitBackdropFilter: 'blur(var(--glass-blur))',
        borderRadius: 16,
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--panel-shadow, 0 8px 32px rgba(0,0,0,0.12))',
      }}
      data-testid="replay-workspace"
    >
      {/* Header — matches real Workspace */}
      <div className="flex items-center justify-between px-4 h-14" style={{ flexShrink: 0 }} data-testid="replay-workspace-header">
        <div className="flex items-center gap-2">
          {previewFile && (
            <button
              onClick={() => setPreviewFile(null)}
              className="flex items-center justify-center hover:bg-zinc-700/50 transition-colors"
              style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}
              data-testid="replay-workspace-back"
            >
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="15,18 9,12 15,6" />
              </svg>
            </button>
          )}
          <StudioIcon size={18} className="text-zinc-400" />
          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
            {previewFile ? previewFile.name : '我的文件'}
          </span>
          {!previewFile && sessionFiles.length > 0 && (
            <span className="px-1.5 py-0.5 rounded text-xs" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
              {sessionFiles.length}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-zinc-700/50 transition-colors"
          style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
          data-testid="replay-workspace-close"
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Tab bar — canvas tab active */}
      {!previewFile && (
        <div
          className="flex items-center overflow-x-auto"
          style={{ padding: '8px 12px 0', gap: 4, borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}
          data-testid="replay-workspace-tabs"
        >
          <div
            className="flex items-center bg-[var(--bg-tertiary)]"
            style={{ height: 36, padding: '0 12px', gap: 8, borderRadius: '12px 12px 0 0' }}
            data-testid="replay-workspace-canvas-tab"
          >
            <CanvasIcon size={14} className="text-zinc-400" />
            <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>文件画布</span>
          </div>
        </div>
      )}

      {/* File header for preview mode */}
      {previewFile && (
        <div
          className="flex items-center"
          style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}
          data-testid="replay-workspace-preview-header"
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ flexShrink: 0 }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
          </svg>
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginLeft: 10 }}>
            {previewFile.name}
          </span>
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }} data-testid="replay-workspace-content">
        <AnimatePresence mode="wait">
          {previewFile ? (
            <motion.div
              key="preview"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              style={{ height: '100%' }}
              data-testid="replay-workspace-preview"
            >
              {previewLoading ? (
                <div
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-tertiary)', fontSize: 14 }}
                  data-testid="replay-workspace-preview-loading"
                >
                  <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.5 }}>加载中...</motion.span>
                </div>
              ) : (isImage || isImgFile) ? (
                <div
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 20 }}
                  data-testid="replay-workspace-preview-image"
                >
                  <img src={previewContent} alt={previewFile.name} style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8, objectFit: 'contain' }} />
                </div>
              ) : isMarkdown ? (
                <div
                  style={{ padding: 20, fontSize: 14, lineHeight: 1.7, color: 'var(--text-primary)' }}
                  data-testid="replay-workspace-preview-markdown"
                >
                  <React.Suspense fallback={<pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{previewContent}</pre>}>
                    <MarkdownContent content={previewContent} />
                  </React.Suspense>
                </div>
              ) : (
                <pre
                  style={{
                    padding: 20, margin: 0, fontSize: 13, lineHeight: 1.6,
                    color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
                  }}
                  data-testid="replay-workspace-preview-text"
                >
                  {previewContent}
                </pre>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="canvas"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ padding: '20px 24px', background: 'var(--bg-primary)' }}
              data-testid="replay-workspace-browser"
            >
              {sessionFiles.length > 0 && (
                <div style={{ marginBottom: 16 }} data-testid="replay-workspace-files">
                  <div className="flex items-center gap-2" style={{ marginBottom: 14 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      会话文件
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-xs" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                      {sessionFiles.length}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }} data-testid="replay-workspace-grid">
                    {sessionFiles.map((file, index) => (
                      <motion.div
                        key={file.path}
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 25, delay: index * 0.06 }}
                        onClick={() => handleOpenFile(file)}
                        className="replay-workspace-file-card cursor-pointer select-none group"
                        style={{ transition: 'transform 0.15s' }}
                        data-testid={`replay-workspace-file-${file.path}`}
                      >
                        <div style={{
                          width: '100%', aspectRatio: '1',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          position: 'relative', borderRadius: 12, overflow: 'hidden',
                        }}>
                          {IMAGE_EXTS.has(getFileExt(file.name)) ? (
                            <img
                              src={buildShareFileUrl(shareToken, file.path, true)}
                              alt={file.name}
                              style={{ maxWidth: 136, maxHeight: 136, objectFit: 'cover', borderRadius: 10 }}
                              loading="lazy"
                            />
                          ) : (
                            <FileTypePreview fileName={file.name} />
                          )}
                          {/* Bling glow on entry */}
                          <motion.div
                            initial={{ opacity: 0.6 }}
                            animate={{ opacity: 0 }}
                            transition={{ duration: 1.5, delay: index * 0.06 }}
                            style={{ position: 'absolute', inset: 0, borderRadius: 12, boxShadow: '0 0 24px 6px rgba(99,102,241,0.25)', pointerEvents: 'none' }}
                          />
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
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
              {sessionFiles.length === 0 && (
                <div
                  style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)', fontSize: 14 }}
                  data-testid="replay-workspace-empty"
                >
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
