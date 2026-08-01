/**
 * 文件预览组件
 * 
 * 根据文件类型渲染不同的预览内容
 * 支持：CSV、Excel、图片、Markdown、文本、PDF、PPTX、视频、音频
 */

import React, { useEffect, useState, useRef, useCallback, useMemo, memo } from 'react';
import { createPortal } from 'react-dom';
import { Download } from 'lucide-react';
import { useAgentStore } from '../../stores/agentStore';
import { useAgentContextStore } from '../../stores/agentContextStore';
import { useFileReferenceStore } from '../../stores/fileReferenceStore';
import { track } from '../../utils/track';
import { MarkdownContent } from '../Chat/MarkdownContent';
import { ExcelPreview } from '../common/ExcelPreview';
import { AgentsMd } from '../Sidebar/AgentsMd';
import { PptxPreview } from './PptxPreview';
import { fetchWithRetry, ApiError } from '../../lib/api';
import { useMediaUrl, fetchMedia, downloadFile } from '../../lib/media';
import type { WorkspaceTab } from '../../stores/previewStore';

interface FilePreviewProps {
  tab: WorkspaceTab;
  // 自定义 URL 构建器（用于技能、子Agent等特殊资源）
  customUrlBuilder?: (path: string) => string;
  // 刷新触发器（值变化时重新加载文件内容）
  refreshKey?: number;
  // 只读预览模式：隐藏引用、下载、新窗口等非预览动作
  readOnly?: boolean;
  // HTML iframe sandbox 策略；公共分享页可传更保守的策略，默认保留工作区原有交互能力。
  htmlSandbox?: string;
  // 只读页面可显式提供下载能力；未提供时仍保持纯预览。
  onDownload?: () => void;
}

const PDFJS_SCRIPT_URL = '/vendor/pdfjs/3.11.174/pdf.min.js';
const PDFJS_WORKER_URL = '/vendor/pdfjs/3.11.174/pdf.worker.min.js';
const PDF_MEDIA_FETCH_TIMEOUT_MS = 30000;

let pdfJsLoadPromise: Promise<any> | null = null;

const encodeFilePath = (path: string): string =>
  path.split('/').map(segment => encodeURIComponent(segment)).join('/');

function configurePdfJsWorker(pdfjsLib: any) {
  if (pdfjsLib?.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
  }
}

function loadPdfJsLib(): Promise<any> {
  const existingLib = (window as any).pdfjsLib;
  if (existingLib) {
    configurePdfJsWorker(existingLib);
    return Promise.resolve(existingLib);
  }

  if (!pdfJsLoadPromise) {
    pdfJsLoadPromise = new Promise<any>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = PDFJS_SCRIPT_URL;
      script.async = true;
      script.onload = () => {
        const pdfjsLib = (window as any).pdfjsLib;
        if (!pdfjsLib) {
          pdfJsLoadPromise = null;
          reject(new Error('加载 PDF 库失败'));
          return;
        }
        configurePdfJsWorker(pdfjsLib);
        resolve(pdfjsLib);
      };
      script.onerror = () => {
        pdfJsLoadPromise = null;
        reject(new Error('加载 PDF 库失败'));
      };
      document.head.appendChild(script);
    });
  }

  return pdfJsLoadPromise;
}

// 将 PDF.js / 网络层抛出的英文异常翻译成中文，避免在预览失败提示里直出英文。
function formatPreviewLoadError(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  const message = err.message || '';
  if (!message) return fallback;
  if (/Invalid PDF/i.test(message) || /file is not a PDF/i.test(message)) {
    return '加载失败：文件不是有效的 PDF';
  }
  if (/PasswordException|Password required|Incorrect password/i.test(message)) {
    return '加载失败：该文件已加密，暂不支持预览';
  }
  if (/Missing PDF|No data|Empty file/i.test(message)) {
    return '加载失败：文件内容为空';
  }
  if (/Unexpected server response/i.test(message) || /\b(40[0-9]|50[0-9])\b/.test(message)) {
    return '加载失败：服务暂不可用，请稍后重试';
  }
  if (/Failed to fetch|NetworkError|ERR_NETWORK|TimeoutError|aborted/i.test(message)) {
    return '加载失败：网络异常，请检查连接后重试';
  }
  // 已经是中文（含 CJK 字符）就原样返回；否则回落到通用中文文案，避免英文直出。
  if (/[一-鿿]/.test(message)) return message;
  return fallback;
}

// 判断文件类型的辅助函数
function isImageFile(name: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i.test(name);
}

function isExcelFile(name: string): boolean {
  return /\.(xlsx|xls)$/i.test(name);
}

function isPdfFile(name: string): boolean {
  return /\.pdf$/i.test(name);
}

function isVideoFile(name: string): boolean {
  return /\.(mp4|webm|ogg|mov|avi)$/i.test(name);
}

function isAudioFile(name: string): boolean {
  return /\.(mp3|wav|ogg|m4a|aac)$/i.test(name);
}

function isJsonFile(name: string): boolean {
  return /\.json$/i.test(name);
}

function isMarkdownFile(name: string): boolean {
  return /\.(md|markdown)$/i.test(name);
}

function isCsvFile(name: string): boolean {
  return /\.csv$/i.test(name);
}

function isHtmlFile(name: string): boolean {
  return /\.(html|htm)$/i.test(name);
}

export function isPptxFile(name: string): boolean {
  return /\.pptx$/i.test(name);
}

export function isLegacyPptFile(name: string): boolean {
  return /\.ppt$/i.test(name);
}

function isDocFile(name: string): boolean {
  return /\.(doc|docx)$/i.test(name);
}

function isTextPreviewFile(name: string): boolean {
  return /\.(txt|json|yaml|yml|toml|ini|conf|log|js|ts|jsx|tsx|py|java|c|cpp|h|hpp|css|scss|html|xml)$/i.test(name);
}

export function isFilePreviewSupported(name: string): boolean {
  return isImageFile(name) || isExcelFile(name) || isPdfFile(name) || isVideoFile(name) ||
    isAudioFile(name) || isCsvFile(name) || isMarkdownFile(name) || isPptxFile(name) ||
    isLegacyPptFile(name) ||
    isDocFile(name) || isTextPreviewFile(name);
}

// CSV 预览组件
const CsvPreview: React.FC<{ content: string }> = ({ content }) => {
  const rows = content.split('\n').filter(row => row.trim());
  const headers = rows[0]?.split(',') || [];
  const dataRows = rows.slice(1);
  
  return (
    <div className="file-preview-csv h-full overflow-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr style={{ background: 'var(--bg-tertiary)' }}>
            {headers.map((header, i) => (
              <th 
                key={i}
                className="text-left sticky top-0"
                style={{ 
                  padding: '10px 16px',
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  background: 'var(--bg-tertiary)',
                  borderBottom: '1px solid var(--border-subtle)',
                }}
              >
                {header.trim()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataRows.map((row, rowIndex) => {
            const cells = row.split(',');
            return (
              <tr 
                key={rowIndex}
                className="hover:bg-zinc-800/30 transition-colors"
              >
                {cells.map((cell, cellIndex) => (
                  <td 
                    key={cellIndex}
                    style={{ 
                      padding: '10px 16px',
                      fontSize: 13,
                      color: cellIndex === cells.length - 1 && /^[¥$]?\d/.test(cell.trim())
                        ? '#22C55E' // 价格列用绿色
                        : 'var(--text-tertiary)',
                      borderBottom: '1px solid var(--border-subtle)',
                    }}
                  >
                    {cell.trim()}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// 图片预览组件
const ImagePreview: React.FC<{ url: string; fallbackUrl?: string; name: string }> = ({ url, name }) => {
  const mediaSrc = useMediaUrl(url);
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div className="file-preview-image-error h-full flex items-center justify-center p-8 text-zinc-500 text-sm">
        图片加载失败
      </div>
    );
  }

  return (
    <div className="file-preview-image h-full flex items-center justify-center p-8 bg-zinc-900/50 overflow-auto">
      {mediaSrc ? (
        <img
          src={mediaSrc}
          alt={name}
          className="object-contain rounded-lg"
          style={{
            boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
            maxWidth: '100%',
            maxHeight: '100%',
          }}
          decoding="async"
          onError={() => setError(true)}
        />
      ) : (
        <div className="w-8 h-8 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
      )}
    </div>
  );
};

// PDF 预览组件 — pdf.js 渲染，自适应容器 + Retina 高清
const PdfPreview: React.FC<{ url: string; name: string; readOnly?: boolean }> = ({ url, name, readOnly = false }) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mediaSrc, setMediaSrc] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [userScale, setUserScale] = useState<number | null>(null);
  const [fitScale, setFitScale] = useState(1);
  const pdfDocRef = useRef<any>(null);
  const pageNativeSizeRef = useRef<{ w: number; h: number }>({ w: 1, h: 1 });
  const renderTaskRef = useRef<any>(null);

  const effectiveScale = userScale ?? fitScale;

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), PDF_MEDIA_FETCH_TIMEOUT_MS);

    try { renderTaskRef.current?.cancel?.(); } catch { /* already done */ }
    pdfDocRef.current = null;
    pageNativeSizeRef.current = { w: 1, h: 1 };
    setMediaSrc('');
    setLoading(true);
    setError(null);
    setCurrentPage(1);
    setTotalPages(0);
    setUserScale(null);
    setFitScale(1);

    if (!url) {
      window.clearTimeout(timeout);
      setError('加载失败：文件地址为空');
      setLoading(false);
      return () => controller.abort();
    }

    fetchMedia(url, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        const pdfBlob = blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
        objectUrl = URL.createObjectURL(pdfBlob);
        setMediaSrc(objectUrl);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(formatPreviewLoadError(err, '加载 PDF 失败'));
        setLoading(false);
      })
      .finally(() => {
        window.clearTimeout(timeout);
      });

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeout);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: any = null;

    const loadPdf = async () => {
      if (!mediaSrc) {
        return;
      }
      try {
        setLoading(true);
        setError(null);

        const pdfjsLib = await loadPdfJsLib();
        if (cancelled) return;

        loadingTask = pdfjsLib.getDocument(mediaSrc);
        const pdf = await loadingTask.promise;

        if (cancelled) return;

        pdfDocRef.current = pdf;
        const firstPage = await pdf.getPage(1);
        const vp0 = firstPage.getViewport({ scale: 1 });
        pageNativeSizeRef.current = { w: vp0.width, h: vp0.height };

        setTotalPages(pdf.numPages);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(formatPreviewLoadError(err, '加载 PDF 失败'));
          setLoading(false);
        }
      }
    };

    loadPdf();
    return () => {
      cancelled = true;
      try { loadingTask?.destroy?.(); } catch { /* already done */ }
    };
  }, [mediaSrc]);

  const calcFitScale = useCallback(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const padding = 32;
    const cw = el.clientWidth - padding;
    const { w, h } = pageNativeSizeRef.current;
    if (w <= 0 || h <= 0) return;
    // ponytail: PDF/doc preview favors readable width; ignore sub-pixel resize loops from canvas reflow.
    const nextScale = Math.round((cw / w) * 1000) / 1000;
    setFitScale(prev => Math.abs(prev - nextScale) < 0.005 ? prev : nextScale);
  }, []);

  useEffect(() => {
    if (loading || !wrapperRef.current) return;
    calcFitScale();
    const ro = new ResizeObserver(calcFitScale);
    ro.observe(wrapperRef.current);
    return () => ro.disconnect();
  }, [loading, calcFitScale]);

  useEffect(() => {
    if (!pdfDocRef.current || !canvasRef.current || !wrapperRef.current) return;

    let cancelled = false;

    const renderPage = async () => {
      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel(); } catch { /* already done */ }
      }

      const pdf = pdfDocRef.current;
      const page = await pdf.getPage(currentPage);

      if (cancelled) return;

      const vp0 = page.getViewport({ scale: 1 });
      pageNativeSizeRef.current = { w: vp0.width, h: vp0.height };

      const dpr = window.devicePixelRatio || 1;
      const displayScale = effectiveScale;
      const renderScale = displayScale * dpr;

      const viewport = page.getViewport({ scale: renderScale });
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d')!;

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width / dpr}px`;
      canvas.style.height = `${viewport.height / dpr}px`;

      const task = page.render({ canvasContext: ctx, viewport });
      renderTaskRef.current = task;
      try {
        await task.promise;
      } catch (e: any) {
        if (e?.name !== 'RenderingCancelledException') throw e;
      }
    };

    renderPage();
    return () => { cancelled = true; };
  }, [currentPage, effectiveScale]);

  const handleZoom = useCallback((delta: number) => {
    setUserScale(prev => {
      const base = prev ?? fitScale;
      return Math.max(0.25, Math.min(5, base + delta));
    });
  }, [fitScale]);

  const handleFitReset = useCallback(() => setUserScale(null), []);

  const handleOpenInNewTab = () => {
    track('file_preview', { sub_event: 'maximize' });
    window.open(mediaSrc || url, '_blank');
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      setCurrentPage(p => Math.max(1, p - 1));
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      setCurrentPage(p => Math.min(totalPages, p + 1));
    }
  }, [totalPages]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    let accum = 0;
    let cooldown = 0;
    const THRESHOLD = 80;
    const COOLDOWN_MS = 250;
    const handleWheel = (e: WheelEvent) => {
      const atTop = el.scrollTop <= 0;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
      if ((!atTop && e.deltaY < 0) || (!atBottom && e.deltaY > 0)) {
        accum = 0;
        return;
      }
      e.preventDefault();
      const now = Date.now();
      if (now < cooldown) return;
      accum += e.deltaY;
      if (Math.abs(accum) < THRESHOLD) return;
      const dir = accum > 0 ? 1 : -1;
      const pages = Math.min(3, Math.floor(Math.abs(accum) / THRESHOLD));
      accum = 0;
      cooldown = now + COOLDOWN_MS;
      setCurrentPage(p => Math.max(1, Math.min(totalPages, p + dir * pages)));
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [totalPages]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center" style={{ background: '#525659' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-5 h-5 border-2 border-zinc-500 border-t-white rounded-full animate-spin" />
          <span className="text-sm text-zinc-400">加载 PDF 中...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center" style={{ background: 'var(--bg-secondary)' }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--bg-tertiary)' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-red-400">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M14 2v6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <p className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>{name}</p>
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>{error}</p>
        {!readOnly && (
          <div className="flex gap-3">
            <button onClick={handleOpenInNewTab} className="px-4 py-2 rounded-lg text-sm" style={{ background: 'var(--accent-color, #3b82f6)', color: '#fff' }}>
              新窗口打开
            </button>
          </div>
        )}
      </div>
    );
  }

  const displayPercent = Math.round(effectiveScale * 100);

  return (
    <div className="h-full w-full flex flex-col" style={{ background: '#525659' }}>
      <div
        className="flex items-center justify-between px-3 py-2 shrink-0"
        style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-subtle)' }}
      >
        <span className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>{name}</span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="w-7 h-7 rounded flex items-center justify-center text-xs disabled:opacity-30"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
            >‹</button>
            <span className="text-xs min-w-[60px] text-center" style={{ color: 'var(--text-muted)' }}>
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="w-7 h-7 rounded flex items-center justify-center text-xs disabled:opacity-30"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
            >›</button>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleZoom(-0.1)}
              className="w-7 h-7 rounded flex items-center justify-center text-xs"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
            >−</button>
            <button
              onClick={handleFitReset}
              className="text-xs min-w-[42px] text-center px-1"
              style={{ color: 'var(--text-muted)' }}
              title="恢复自适应"
            >
              {displayPercent}%
            </button>
            <button
              onClick={() => handleZoom(0.1)}
              className="w-7 h-7 rounded flex items-center justify-center text-xs"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
            >+</button>
          </div>
          {!readOnly && (
            <button onClick={handleOpenInNewTab} className="px-3 py-1.5 rounded text-xs" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
              新窗口
            </button>
          )}
        </div>
      </div>
      <div
        ref={wrapperRef}
        className="flex-1 overflow-auto flex items-start justify-center py-4"
        style={{ background: '#525659', scrollbarGutter: 'stable both-edges' }}
      >
        <canvas ref={canvasRef} style={{ display: 'block' }} />
      </div>
    </div>
  );
};

// 旧版二进制 .ppt 无法由浏览器端 OOXML 渲染器解析，保留服务端转 PDF 的兼容链路。
const LegacyPptPreview: React.FC<{ url: string; name: string }> = ({ url, name }) => {
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const slideAreaRef = useRef<HTMLDivElement>(null);
  const thumbContainerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [userScale, setUserScale] = useState<number | null>(null);
  const [fitScale, setFitScale] = useState(1);
  const pdfDocRef = useRef<any>(null);
  const pageNativeSizeRef = useRef<{ w: number; h: number }>({ w: 1, h: 1 });
  const thumbCanvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const thumbsRendered = useRef<Set<number>>(new Set());
  const renderTaskRef = useRef<any>(null);

  const effectiveScale = userScale ?? fitScale;

  const pdfUrl = useMediaUrl(useMemo(() => {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}format=pdf`;
  }, [url]));

  useEffect(() => {
    let cancelled = false;

    const loadPdf = async () => {
      if (!pdfUrl) {
        return;
      }
      try {
        setLoading(true);
        setError(null);

        const pdfjsLib = await loadPdfJsLib();
        if (cancelled) return;

        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;

        if (cancelled) return;

        pdfDocRef.current = pdf;
        const firstPage = await pdf.getPage(1);
        const vp0 = firstPage.getViewport({ scale: 1 });
        pageNativeSizeRef.current = { w: vp0.width, h: vp0.height };

        setTotalPages(pdf.numPages);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(formatPreviewLoadError(err, '加载演示文稿失败'));
          setLoading(false);
        }
      }
    };

    loadPdf();
    return () => { cancelled = true; };
  }, [pdfUrl]);

  const calcFitScale = useCallback(() => {
    const el = slideAreaRef.current;
    if (!el) return;
    const padding = 32;
    const cw = el.clientWidth - padding;
    const ch = el.clientHeight - padding;
    const { w, h } = pageNativeSizeRef.current;
    if (w <= 0 || h <= 0) return;
    setFitScale(Math.min(cw / w, ch / h));
  }, []);

  useEffect(() => {
    if (loading || !slideAreaRef.current) return;
    calcFitScale();
    const ro = new ResizeObserver(calcFitScale);
    ro.observe(slideAreaRef.current);
    return () => ro.disconnect();
  }, [loading, calcFitScale]);

  // render main slide (Retina-aware)
  useEffect(() => {
    if (!pdfDocRef.current || !mainCanvasRef.current) return;

    let cancelled = false;

    const renderSlide = async () => {
      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel(); } catch { /* done */ }
      }

      const pdf = pdfDocRef.current;
      const page = await pdf.getPage(currentPage);

      if (cancelled) return;

      const vp0 = page.getViewport({ scale: 1 });
      pageNativeSizeRef.current = { w: vp0.width, h: vp0.height };

      const dpr = window.devicePixelRatio || 1;
      const renderScale = effectiveScale * dpr;
      const viewport = page.getViewport({ scale: renderScale });

      const canvas = mainCanvasRef.current!;
      const ctx = canvas.getContext('2d')!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width / dpr}px`;
      canvas.style.height = `${viewport.height / dpr}px`;

      const task = page.render({ canvasContext: ctx, viewport });
      renderTaskRef.current = task;
      try {
        await task.promise;
      } catch (e: any) {
        if (e?.name !== 'RenderingCancelledException') throw e;
      }
    };

    renderSlide();
    return () => { cancelled = true; };
  }, [currentPage, effectiveScale]);

  // render thumbnails — scale to fit container width (Retina-aware)
  useEffect(() => {
    if (!pdfDocRef.current || totalPages === 0) return;

    const renderThumbs = async () => {
      const pdf = pdfDocRef.current;
      const dpr = window.devicePixelRatio || 1;
      const thumbDisplayWidth = 140;
      for (let i = 1; i <= totalPages; i++) {
        if (thumbsRendered.current.has(i)) continue;
        const canvas = thumbCanvasRefs.current.get(i);
        if (!canvas) continue;
        try {
          const page = await pdf.getPage(i);
          const vp0 = page.getViewport({ scale: 1 });
          const thumbScale = (thumbDisplayWidth * dpr) / vp0.width;
          const vp = page.getViewport({ scale: thumbScale });
          canvas.width = vp.width;
          canvas.height = vp.height;
          canvas.style.width = `${thumbDisplayWidth}px`;
          canvas.style.height = `${vp.height / dpr}px`;
          const ctx = canvas.getContext('2d')!;
          await page.render({ canvasContext: ctx, viewport: vp }).promise;
          thumbsRendered.current.add(i);
        } catch { /* ignore */ }
      }
    };

    renderThumbs();
  }, [totalPages]);

  useEffect(() => {
    const el = thumbContainerRef.current?.querySelector(`[data-slide="${currentPage}"]`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentPage]);

  const handleZoom = useCallback((delta: number) => {
    setUserScale(prev => {
      const base = prev ?? fitScale;
      return Math.max(0.25, Math.min(5, base + delta));
    });
  }, [fitScale]);

  const handleFitReset = useCallback(() => setUserScale(null), []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      setCurrentPage(p => Math.max(1, p - 1));
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      setCurrentPage(p => Math.min(totalPages, p + 1));
    }
  }, [totalPages]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    const el = slideAreaRef.current;
    if (!el) return;
    let accum = 0;
    let cooldown = 0;
    const THRESHOLD = 80;
    const COOLDOWN_MS = 250;
    const handleWheel = (e: WheelEvent) => {
      const atTop = el.scrollTop <= 0;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
      if ((!atTop && e.deltaY < 0) || (!atBottom && e.deltaY > 0)) {
        accum = 0;
        return;
      }
      e.preventDefault();
      const now = Date.now();
      if (now < cooldown) return;
      accum += e.deltaY;
      if (Math.abs(accum) < THRESHOLD) return;
      const dir = accum > 0 ? 1 : -1;
      const pages = Math.min(3, Math.floor(Math.abs(accum) / THRESHOLD));
      accum = 0;
      cooldown = now + COOLDOWN_MS;
      setCurrentPage(p => Math.max(1, Math.min(totalPages, p + dir * pages)));
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [totalPages]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center" style={{ background: 'var(--bg-secondary)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 border-2 border-orange-500/30 border-t-orange-400 rounded-full animate-spin" />
          </div>
          <div className="text-center">
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>正在加载演示文稿...</span>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>首次打开需转换为可预览格式</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center" style={{ background: 'var(--bg-secondary)' }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(251, 146, 60, 0.1)' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-orange-400">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M14 2v6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <rect x="7" y="12" width="10" height="6" rx="0.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M11 13.5v3l2.5-1.5L11 13.5z" fill="currentColor"/>
          </svg>
        </div>
        <p className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>{name}</p>
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>{error}</p>
      </div>
    );
  }

  const displayPercent = Math.round(effectiveScale * 100);

  return (
    <div className="h-full w-full flex flex-col" style={{ background: 'var(--bg-secondary)' }}>
      <div
        className="flex items-center justify-between px-3 py-2 shrink-0"
        style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-orange-400">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M14 2v6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <rect x="7" y="12" width="10" height="6" rx="0.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M11 13.5v3l2.5-1.5L11 13.5z" fill="currentColor"/>
          </svg>
          <span className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>{name}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="w-7 h-7 rounded flex items-center justify-center text-xs disabled:opacity-30"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
            >‹</button>
            <span className="text-xs min-w-[70px] text-center" style={{ color: 'var(--text-muted)' }}>
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="w-7 h-7 rounded flex items-center justify-center text-xs disabled:opacity-30"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
            >›</button>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleZoom(-0.1)}
              className="w-7 h-7 rounded flex items-center justify-center text-xs"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
            >−</button>
            <button
              onClick={handleFitReset}
              className="text-xs min-w-[42px] text-center px-1"
              style={{ color: 'var(--text-muted)' }}
              title="恢复自适应"
            >
              {displayPercent}%
            </button>
            <button
              onClick={() => handleZoom(0.1)}
              className="w-7 h-7 rounded flex items-center justify-center text-xs"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
            >+</button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div
          ref={thumbContainerRef}
          className="shrink-0 overflow-y-auto py-2"
          style={{
            width: 160,
            background: 'var(--bg-primary)',
            borderRight: '1px solid var(--border-subtle)',
          }}
        >
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
            <div
              key={page}
              data-slide={page}
              onClick={() => setCurrentPage(page)}
              className="mx-2 mb-2 cursor-pointer rounded-lg overflow-hidden transition-all"
              style={{
                border: page === currentPage
                  ? '2px solid var(--accent-color, #f97316)'
                  : '2px solid transparent',
                opacity: page === currentPage ? 1 : 0.7,
              }}
            >
              <div className="relative" style={{ background: '#525659' }}>
                <canvas
                  ref={(el) => { if (el) thumbCanvasRefs.current.set(page, el); }}
                  className="w-full block"
                />
                <div
                  className="absolute bottom-0 right-0 text-[10px] px-1.5 py-0.5 rounded-tl"
                  style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}
                >
                  {page}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div
          ref={slideAreaRef}
          className="flex-1 overflow-auto flex items-center justify-center p-4"
          style={{ background: '#525659' }}
        >
          <canvas
            ref={mainCanvasRef}
            className="block rounded shadow-2xl"
          />
        </div>
      </div>
    </div>
  );
};

// 视频预览组件
const VideoPreview: React.FC<{ url: string }> = ({ url }) => {
  const mediaSrc = useMediaUrl(url);
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="h-full flex items-center justify-center p-4 bg-zinc-900/50">
      {!loaded && (
        <div
          className="flex items-center justify-center rounded-lg"
          style={{
            width: '70%',
            maxWidth: 800,
            aspectRatio: '16 / 9',
            background: 'rgba(0,0,0,0.4)',
          }}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
            <span className="text-xs text-zinc-400">加载视频中...</span>
          </div>
        </div>
      )}
      {mediaSrc && (
        <video
          src={mediaSrc}
          controls
          preload="metadata"
          onLoadedMetadata={() => setLoaded(true)}
          className="max-w-full max-h-full rounded-lg shadow-2xl"
          style={{
            maxHeight: 'calc(100% - 2rem)',
            display: loaded ? 'block' : 'none',
          }}
        >
          您的浏览器不支持视频播放
        </video>
      )}
    </div>
  );
};

// 音频预览组件
const AudioPreview: React.FC<{ url: string; name: string }> = ({ url, name }) => {
  const mediaSrc = useMediaUrl(url);
  return (
    <div className="h-full flex flex-col items-center justify-center p-8 bg-zinc-900/50">
      <div className="w-24 h-24 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
        <span className="text-4xl">🎵</span>
      </div>
      <p className="text-zinc-300 font-medium mb-4">{name}</p>
      {mediaSrc ? (
        <audio
          src={mediaSrc}
          controls
          className="w-full max-w-md"
        >
          您的浏览器不支持音频播放
        </audio>
      ) : (
        <div className="w-8 h-8 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
      )}
    </div>
  );
};

// Markdown 预览组件（含选段引用）
const MarkdownPreviewContent: React.FC<{ content: string; fileName: string; filePath: string; level: 'shared' | 'session'; readOnly?: boolean }> = memo(({ content, fileName, filePath, level, readOnly = false }) => {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} className="h-full overflow-auto" style={{
      padding: 24,
      contain: 'paint',
      willChange: 'transform',
    }}>
      <div className="max-w-4xl mx-auto">
        <MarkdownContent content={content} />
      </div>
      {!readOnly && (
        <SelectionToolbar containerRef={ref} fileName={fileName} filePath={filePath} level={level} fullContent={content} />
      )}
    </div>
  );
});

// HTML 预览组件
interface HtmlPreviewProps {
  content: string;
  name: string;
  sandbox?: string;
}

const HtmlPreview: React.FC<HtmlPreviewProps> = ({ content, name, sandbox = 'allow-scripts allow-same-origin' }) => {
  const [iframeContent, setIframeContent] = useState<string>('');
  
  useEffect(() => {
    setIframeContent(content);
  }, [content]);
  
  return (
    <div className="h-full w-full flex flex-col">
      {/* iframe 预览 */}
      <iframe
        srcDoc={iframeContent}
        className="flex-1 w-full border-0 bg-white"
        title={`HTML 预览: ${name}`}
        sandbox={sandbox}
      />
    </div>
  );
};

const STYLESHEET_LINK_RE = /<link\s+[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>|<link\s+[^>]*href=["']([^"']+)["'][^>]*rel=["']stylesheet["'][^>]*>/gi;
const SCRIPT_TAG_RE = /<script\b[^>]*>[\s\S]*?<\/script>/gi;
const BODY_TAG_RE = /<body\b[^>]*>/i;
const HEAD_RE = /<head\b[^>]*>[\s\S]*?<\/head>/i;

function isInlineableStylesheetHref(href: string): boolean {
  return !!href
    && !/^(https?:)?\/\//i.test(href)
    && !/^(data|blob|javascript|mailto):/i.test(href)
    && !href.startsWith('#');
}

function resolveRelativeFilePath(baseFilePath: string, href: string): string {
  const cleanHref = href.replace(/[?#].*$/, '').replace(/\\/g, '/');
  const rawPath = cleanHref.startsWith('/')
    ? cleanHref.replace(/^\/+/, '')
    : `${baseFilePath.replace(/\\/g, '/').replace(/\/[^/]*$/, '')}/${cleanHref}`;
  const parts: string[] = [];
  for (const part of rawPath.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return parts.join('/');
}

function isBlockingClassicScriptTag(scriptTag: string): boolean {
  if (/\s(?:async|defer)\b/i.test(scriptTag)) return false;

  const typeMatch = scriptTag.match(/\btype\s*=\s*["']?([^"'\s>]+)/i);
  if (!typeMatch) return true;

  const type = typeMatch[1].toLowerCase();
  return /^(text|application)\/(javascript|ecmascript)(?:;|$)/.test(type);
}

function findFirstClassicBodyScriptIndex(bodyHtml: string): number {
  SCRIPT_TAG_RE.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = SCRIPT_TAG_RE.exec(bodyHtml)) !== null) {
    if (isBlockingClassicScriptTag(match[0])) {
      return match.index;
    }
  }

  return -1;
}

function moveBlockingHeadScriptsBehindContent(html: string): string {
  const headMatch = HEAD_RE.exec(html);
  if (!headMatch) return html;

  const headHtml = headMatch[0];
  const movedScripts: string[] = [];
  SCRIPT_TAG_RE.lastIndex = 0;

  const nextHeadHtml = headHtml.replace(SCRIPT_TAG_RE, (scriptTag) => {
    if (!isBlockingClassicScriptTag(scriptTag)) return scriptTag;
    movedScripts.push(scriptTag);
    return '';
  });

  if (movedScripts.length === 0) return html;

  let processedHtml = `${html.slice(0, headMatch.index)}${nextHeadHtml}${html.slice(headMatch.index + headHtml.length)}`;
  const scriptBlock = `${movedScripts.join('\n')}\n`;
  const bodyMatch = BODY_TAG_RE.exec(processedHtml);

  if (bodyMatch) {
    const bodyContentStart = bodyMatch.index + bodyMatch[0].length;
    const bodyHtml = processedHtml.slice(bodyContentStart);
    const firstBodyScriptIndex = findFirstClassicBodyScriptIndex(bodyHtml);

    if (firstBodyScriptIndex >= 0) {
      const insertAt = bodyContentStart + firstBodyScriptIndex;
      return `${processedHtml.slice(0, insertAt)}${scriptBlock}${processedHtml.slice(insertAt)}`;
    }
  }

  if (/<\/body>/i.test(processedHtml)) {
    return processedHtml.replace(/<\/body>/i, `${scriptBlock}</body>`);
  }

  return `${processedHtml}\n${scriptBlock}`;
}

async function inlineLinkedStylesheets(
  html: string,
  htmlPath: string,
  buildFileUrl: (filePath: string) => string,
): Promise<string> {
  const matches: { fullMatch: string; href: string }[] = [];
  let match: RegExpExecArray | null;
  STYLESHEET_LINK_RE.lastIndex = 0;

  while ((match = STYLESHEET_LINK_RE.exec(html)) !== null) {
    const href = match[1] || match[2] || '';
    if (isInlineableStylesheetHref(href)) {
      matches.push({ fullMatch: match[0], href });
    }
  }

  if (matches.length === 0) return html;

  let processedHtml = html;
  for (const { fullMatch, href } of matches) {
    try {
      const cssPath = resolveRelativeFilePath(htmlPath, href);
      const cssUrl = buildFileUrl(cssPath);
      if (!cssUrl) continue;

      const response = await fetch(cssUrl);
      if (!response.ok) continue;

      const cssContent = await response.text();
      processedHtml = processedHtml.replace(fullMatch, `<style>\n${cssContent}\n</style>`);
    } catch {
      // CSS 是 HTML 的可选伴随资源；加载失败不阻塞主 HTML 预览。
    }
  }

  return processedHtml;
}

// 引用图标
const QuoteIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

// 文本选中浮动工具条
const SelectionToolbar: React.FC<{
  containerRef: React.RefObject<HTMLDivElement | null>;
  fileName: string;
  filePath: string;
  level: 'shared' | 'session';
  fullContent: string;
}> = ({ containerRef, fileName, filePath, level, fullContent }) => {
  const addReference = useFileReferenceStore(s => s.addReference);
  const [toolbarPos, setToolbarPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleUp = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) {
        setToolbarPos(null);
        return;
      }
      const range = sel.getRangeAt(0);
      if (!container.contains(range.commonAncestorContainer)) {
        setToolbarPos(null);
        return;
      }
      const text = sel.toString().trim();
      if (!text) { setToolbarPos(null); return; }

      setSelectedText(text);
      const rect = range.getBoundingClientRect();
      setToolbarPos({ x: rect.left + rect.width / 2, y: rect.top - 8 });
    };

    const handleDown = (e: MouseEvent) => {
      if (toolbarRef.current?.contains(e.target as Node)) return;
      setToolbarPos(null);
    };

    container.addEventListener('mouseup', handleUp);
    document.addEventListener('mousedown', handleDown);
    return () => {
      container.removeEventListener('mouseup', handleUp);
      document.removeEventListener('mousedown', handleDown);
    };
  }, [containerRef]);

  const handleQuote = () => {
    track('file_preview', { sub_event: 'quote' });
    if (!selectedText) return;
    const lines = fullContent.split('\n');
    let startLine = 1, endLine = lines.length;
    let searchIdx = fullContent.indexOf(selectedText);
    if (searchIdx >= 0) {
      startLine = fullContent.slice(0, searchIdx).split('\n').length;
      endLine = startLine + selectedText.split('\n').length - 1;
    }
    addReference({
      id: `seg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      fileName, filePath, level,
      type: 'segment',
      segment: { startLine, endLine, text: selectedText },
    });
    window.getSelection()?.removeAllRanges();
    setToolbarPos(null);
  };

  if (!toolbarPos) return null;

  return createPortal(
    <div
      ref={toolbarRef}
      style={{
        position: 'fixed',
        left: toolbarPos.x,
        top: toolbarPos.y,
        transform: 'translate(-50%, -100%)',
        zIndex: 9999,
      }}
    >
      <button
        onClick={handleQuote}
        className="flex items-center transition-colors hover:brightness-110"
        style={{
          height: 30,
          padding: '0 10px',
          gap: 5,
          borderRadius: 8,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          color: 'var(--text-secondary)',
          fontSize: 12,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        <QuoteIcon size={13} />
        引用到对话
      </button>
    </div>,
    document.body,
  );
};

// JSON 可视化卡片 —— 将对象/数组渲染为可折叠的卡片式布局
const JsonCardValue: React.FC<{ value: unknown; label?: string }> = ({ value }) => {
  if (value === null || value === undefined) {
    return <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 13 }}>null</span>;
  }
  if (typeof value === 'boolean') {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium"
        style={{ background: value ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: value ? '#4ade80' : '#f87171' }}
      >
        {String(value)}
      </span>
    );
  }
  if (typeof value === 'number') {
    return <span style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{String(value)}</span>;
  }
  if (typeof value === 'string') {
    if (value.length > 200) {
      return <span style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{value}</span>;
    }
    return <span style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5, wordBreak: 'break-word' }}>{value}</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>[ ]</span>;
    const allPrimitive = value.every(v => v === null || typeof v !== 'object');
    if (allPrimitive && value.length <= 10) {
      return (
        <div className="flex flex-wrap gap-1.5">
          {value.map((item, i) => (
            <span
              key={i}
              className="inline-flex items-center px-2 py-0.5 rounded text-[12px]"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
            >
              {item === null ? 'null' : String(item)}
            </span>
          ))}
        </div>
      );
    }
    return (
      <div className="space-y-2" style={{ marginTop: 4 }}>
        {value.map((item, i) => (
          <JsonCardSection key={i} keyName={`#${i + 1}`} value={item} isArrayItem />
        ))}
      </div>
    );
  }
  if (typeof value === 'object') {
    return <JsonCardObject data={value as Record<string, unknown>} nested />;
  }
  return <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{String(value)}</span>;
};

const JsonCardSection: React.FC<{ keyName: string; value: unknown; isArrayItem?: boolean }> = ({ keyName, value, isArrayItem }) => {
  const isExpandable = value !== null && typeof value === 'object';
  const [expanded, setExpanded] = useState(true);

  if (!isExpandable) {
    return (
      <div className="flex items-start gap-3" style={{ padding: '6px 0', minHeight: 28 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', minWidth: 80, flexShrink: 0, paddingTop: 1 }}>
          {keyName}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <JsonCardValue value={value} />
        </div>
      </div>
    );
  }

  const isArray = Array.isArray(value);
  const count = isArray ? (value as unknown[]).length : Object.keys(value as object).length;

  return (
    <div
      className="rounded-xl transition-all"
      style={{
        background: isArrayItem ? 'var(--bg-secondary)' : 'transparent',
        border: isArrayItem ? '1px solid var(--border-subtle)' : 'none',
        overflow: 'hidden',
      }}
    >
      <div
        className="flex items-center gap-2 select-none"
        style={{
          padding: isArrayItem ? '8px 12px' : '6px 0',
          cursor: 'pointer',
        }}
        onClick={() => setExpanded(e => !e)}
      >
        <svg
          width="10" height="10" viewBox="0 0 10 10"
          style={{ flexShrink: 0, transition: 'transform 0.15s', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', color: 'var(--text-muted)' }}
        >
          <path d="M3 1l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>{keyName}</span>
        <span
          className="inline-flex items-center px-1.5 py-0 rounded text-[10px]"
          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}
        >
          {isArray ? `${count} items` : `${count} keys`}
        </span>
      </div>
      {expanded && (
        <div style={{ padding: isArrayItem ? '0 12px 10px' : '0 0 4px' }}>
          <JsonCardValue value={value} />
        </div>
      )}
    </div>
  );
};

const JsonCardObject: React.FC<{ data: Record<string, unknown>; nested?: boolean }> = ({ data, nested }) => {
  const entries = Object.entries(data);
  if (entries.length === 0) {
    return <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{ }</span>;
  }

  const primitiveEntries = entries.filter(([, v]) => v === null || typeof v !== 'object');
  const complexEntries = entries.filter(([, v]) => v !== null && typeof v === 'object');

  return (
    <div>
      {primitiveEntries.length > 0 && (
        <div
          className="rounded-xl"
          style={{
            background: nested ? 'transparent' : 'var(--bg-secondary)',
            border: nested ? 'none' : '1px solid var(--border-subtle)',
            padding: nested ? '0' : '12px 16px',
            marginBottom: complexEntries.length > 0 ? 12 : 0,
          }}
        >
          {primitiveEntries.map(([k, v], i) => (
            <div key={k}>
              <div className="flex items-start gap-3" style={{ padding: '6px 0', minHeight: 28 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', minWidth: 100, flexShrink: 0, paddingTop: 1 }}>
                  {k}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <JsonCardValue value={v} />
                </div>
              </div>
              {i < primitiveEntries.length - 1 && (
                <div style={{ height: 1, background: 'var(--border-subtle)', opacity: 0.5 }} />
              )}
            </div>
          ))}
        </div>
      )}
      {complexEntries.length > 0 && (
        <div className="space-y-2">
          {complexEntries.map(([k, v]) => (
            <JsonCardSection key={k} keyName={k} value={v} />
          ))}
        </div>
      )}
    </div>
  );
};

// JSON 预览组件
const JsonPreview: React.FC<{ content: string; fileName: string; filePath: string; level: 'shared' | 'session'; readOnly?: boolean }> = ({ content, fileName, filePath, level, readOnly = false }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<'visual' | 'raw'>('visual');

  const parsed = useMemo(() => {
    try { return JSON.parse(content); }
    catch { return null; }
  }, [content]);

  const stats = useMemo(() => {
    if (!parsed) return null;
    const bytes = new Blob([content]).size;
    const sizeStr = bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    const isArr = Array.isArray(parsed);
    const count = isArr ? parsed.length : Object.keys(parsed).length;
    return { size: sizeStr, type: isArr ? 'Array' : 'Object', count };
  }, [parsed, content]);

  if (!parsed) {
    return <TextPreview content={content} fileName={fileName} filePath={filePath} level={level} readOnly={readOnly} />;
  }

  return (
    <div ref={ref} className="file-preview-json h-full flex flex-col" style={{ background: 'var(--bg-primary)' }}>
      <div
        className="flex items-center justify-between flex-shrink-0"
        style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}
      >
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
            <button
              onClick={() => setViewMode('visual')}
              style={{
                padding: '3px 10px', fontSize: 11, fontWeight: 500, border: 'none', cursor: 'pointer',
                background: viewMode === 'visual' ? 'var(--bg-tertiary)' : 'transparent',
                color: viewMode === 'visual' ? 'var(--text-primary)' : 'var(--text-muted)',
              }}
            >
              可视化
            </button>
            <button
              onClick={() => setViewMode('raw')}
              style={{
                padding: '3px 10px', fontSize: 11, fontWeight: 500, border: 'none', cursor: 'pointer',
                borderLeft: '1px solid var(--border-subtle)',
                background: viewMode === 'raw' ? 'var(--bg-tertiary)' : 'transparent',
                color: viewMode === 'raw' ? 'var(--text-primary)' : 'var(--text-muted)',
              }}
            >
              源码
            </button>
          </div>
          {stats && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {stats.type} · {stats.count} {stats.type === 'Array' ? 'items' : 'keys'} · {stats.size}
            </span>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-auto" style={{ padding: '16px 20px' }}>
        {viewMode === 'visual' ? (
          Array.isArray(parsed)
            ? <JsonCardValue value={parsed} />
            : <JsonCardObject data={parsed as Record<string, unknown>} />
        ) : (
          <pre
            className="whitespace-pre-wrap font-mono"
            style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}
          >
            {JSON.stringify(parsed, null, 2)}
          </pre>
        )}
      </div>
      {!readOnly && (
        <SelectionToolbar containerRef={ref} fileName={fileName} filePath={filePath} level={level} fullContent={content} />
      )}
    </div>
  );
};

// 文本预览组件（含选段引用）
const TextPreview: React.FC<{ content: string; fileName: string; filePath: string; level: 'shared' | 'session'; readOnly?: boolean }> = ({ content, fileName, filePath, level, readOnly = false }) => {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} className="file-preview-text h-full overflow-auto" style={{ padding: 24 }}>
      <pre
        className="whitespace-pre-wrap font-mono"
        style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}
      >
        {content}
      </pre>
      {!readOnly && (
        <SelectionToolbar containerRef={ref} fileName={fileName} filePath={filePath} level={level} fullContent={content} />
      )}
    </div>
  );
};

// 不支持预览的文件
const UnsupportedPreview: React.FC<{ name: string; onDownload: () => void; readOnly?: boolean }> = ({ name, onDownload, readOnly = false }) => {
  return (
    <div className="file-preview-unsupported h-full flex flex-col items-center justify-center text-zinc-500">
      <div className="w-16 h-16 rounded-xl bg-zinc-800 flex items-center justify-center mb-4">
        <span className="text-2xl">📄</span>
      </div>
      <p className="text-lg font-medium text-zinc-300 mb-2">{name}</p>
      <p className="text-sm mb-6">该文件暂不支持在线预览</p>
      {!readOnly && (
        <button
          type="button"
          onClick={onDownload}
          className="inline-flex h-9 items-center justify-center gap-2 px-4 transition-[transform,opacity] duration-150 hover:opacity-80 active:scale-[0.97]"
          style={{
            background: 'var(--btn-mono-bg)',
            color: 'var(--btn-mono-text)',
            border: '1px solid var(--btn-mono-bg)',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
          }}
          data-testid="unsupported-preview-download"
        >
          <Download size={14} strokeWidth={1.8} aria-hidden="true" />
          <span>下载文件</span>
        </button>
      )}
    </div>
  );
};

// 加载中状态（带超时提示）
const LoadingState: React.FC<{ 
  loadingTime?: number;  // 已加载时长（毫秒）
}> = ({ loadingTime = 0 }) => {
  const showSlowHint = loadingTime > 5000;  // 超过 5 秒显示提示
  
  return (
    <div className="file-preview-loading h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div 
          className="w-5 h-5 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin"
        />
        <span style={{ color: 'var(--text-muted)' }}>
          {showSlowHint ? '加载较慢，请稍候...' : '加载中...'}
        </span>
        {showSlowHint && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)', opacity: 0.6 }}>
            网络可能不稳定
          </span>
        )}
      </div>
    </div>
  );
};

// 错误状态（带重试按钮）
const ErrorState: React.FC<{ 
  message: string; 
  onRetry?: () => void;
  retryCount?: number;
}> = ({ message, onRetry, retryCount = 0 }) => (
  <div className="file-preview-error h-full flex items-center justify-center">
    <div className="text-center">
      <div 
        className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center"
        style={{ background: 'rgba(239, 68, 68, 0.1)' }}
      >
        <span className="text-xl">⚠️</span>
      </div>
      <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>无法加载文件</p>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          data-testid="file-preview-error-retry"
          className="mt-4 px-4 py-1.5 text-sm rounded-md transition-colors"
          style={{
            background: 'var(--accent-color, #3b82f6)',
            color: '#fff',
          }}
        >
          {retryCount > 0 ? `重试 (${retryCount})` : '重试'}
        </button>
      )}
    </div>
  </div>
);

export const FilePreview: React.FC<FilePreviewProps> = ({ tab, customUrlBuilder, refreshKey, readOnly = false, htmlSandbox, onDownload }) => {
  const selectedAgentId = useAgentContextStore(s => s.currentAgentId);
  const currentSessionId = useAgentStore(s => s.currentSessionId);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingTime, setLoadingTime] = useState(0);     // 加载耗时
  const [retryCount, setRetryCount] = useState(0);       // 重试次数
  const loadingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  
  // 有 customUrlBuilder 时为子资源预览，不走主 Agent 的 AgentsMd 分支
  const isAgentsMd = !customUrlBuilder && (tab.name === 'agent.md' || tab.path === 'agent.md' || tab.path === 'agents.md');
  
  // 构建文件 URL（使用 useMemo 避免重复计算和依赖循环）
  const buildUrl = useCallback((level: string) => {
    if (customUrlBuilder) return customUrlBuilder(tab.path);
    if (!selectedAgentId) return '';
    const base = `/api/v1/agents/${selectedAgentId}`;
    const encodedPath = encodeFilePath(tab.path);
    if (level === 'session' && currentSessionId) {
      return `${base}/sessions/${currentSessionId}/files/${encodedPath}`;
    }
    return `${base}/files/${encodedPath}`;
  }, [selectedAgentId, customUrlBuilder, tab.path, currentSessionId]);
  
  const fileUrl = useMemo(() => {
    return buildUrl(tab.level || 'agent-shared');
  }, [buildUrl, tab.level]);
  
  
  // 构建指定路径的文件 URL（用于加载同名 CSS 等）
  const buildFileUrl = useCallback((filePath: string): string => {
    if (customUrlBuilder) {
      return customUrlBuilder(filePath);
    }

    if (!selectedAgentId) return '';

    const base = `/api/v1/agents/${selectedAgentId}`;
    const level = tab.level || 'agent-shared';
    const encodedPath = encodeFilePath(filePath);
    
    if (level === 'session' && currentSessionId) {
      return `${base}/sessions/${currentSessionId}/files/${encodedPath}`;
    }
    
    return `${base}/files/${encodedPath}`;
  }, [selectedAgentId, customUrlBuilder, tab.level, currentSessionId]);
  
  // 下载文件
  const handleDownload = () => {
    track('file_preview', { sub_event: 'download' });
    if (onDownload) {
      onDownload();
      return;
    }
    if (!fileUrl) return;
    downloadFile(fileUrl, tab.name);
  };
  
  // 判断是否需要加载文本内容
  const needsTextContent = isCsvFile(tab.name) || isMarkdownFile(tab.name) || isTextPreviewFile(tab.name);
  
  // 文件加载函数（支持重试）
  const loadFile = useCallback(async () => {
    // customUrlBuilder 接管时（例如"我的文件"走 Platform 自己的 URL）完全脱离 agent/session 维度
    if (!customUrlBuilder) {
      if (!selectedAgentId) {
        setError('未选择 Agent');
        setLoading(false);
        return;
      }

      // 会话级文件需要 sessionId
      if (tab.level === 'session' && !currentSessionId) {
        setError('会话未就绪');
        setLoading(false);
        return;
      }
    }
    
    // 图片、PDF、视频、音频、Excel 不需要加载文本内容
    if (!needsTextContent) {
      setLoading(false);
      return;
    }
    
    // 开始加载
    setLoading(true);
    setError(null);
    setLoadingTime(0);
    
    // 启动加载计时器
    const startTime = Date.now();
    loadingTimerRef.current = setInterval(() => {
      if (mountedRef.current) {
        setLoadingTime(Date.now() - startTime);
      }
    }, 1000);
    
    try {
      let text: string;
      const cacheBuster = `${fileUrl.includes('?') ? '&' : '?'}_t=${Date.now()}`;

      if (isAgentsMd) {
        // agents.md 使用特殊 API（带重试）
        const response = await fetchWithRetry(
          `/api/v1/agents/${selectedAgentId}/agents-md${cacheBuster}`,
          { timeout: 15000, retries: 2 }
        );
        const data = await response.json();
        text = data.content || '';
      } else {
        // 尝试加载文件，404 时自动 fallback 到另一个级别
        let response: Response | null = null;
        try {
          response = await fetchWithRetry(
            `${fileUrl}${cacheBuster}`,
            { timeout: 15000, retries: 0 }
          );
        } catch (err) {
          if (err instanceof ApiError && err.status === 404 && !customUrlBuilder && currentSessionId) {
            const fallbackLevel = tab.level === 'session' ? 'agent-shared' : 'session';
            const fallbackUrl = buildUrl(fallbackLevel);
            if (fallbackUrl && fallbackUrl !== fileUrl) {
              console.log(`[FilePreview] 404 fallback: ${tab.level} → ${fallbackLevel}`);
              response = await fetchWithRetry(
                `${fallbackUrl}${cacheBuster}`,
                { timeout: 15000, retries: 1 }
              );
            } else {
              throw err;
            }
          } else {
            throw err;
          }
        }
        text = await response!.text();
      }

      if (isHtmlFile(tab.name)) {
        text = await inlineLinkedStylesheets(text, tab.path, buildFileUrl);
        text = moveBlockingHeadScriptsBehindContent(text);
      }

      if (!mountedRef.current) return;
      
      setContent(text);
      setRetryCount(0);  // 成功后重置重试计数
    } catch (err) {
      if (!mountedRef.current) return;
      
      // 提取用户友好的错误消息
      let errorMessage = '加载失败';
      if (err instanceof ApiError) {
        errorMessage = err.userMessage;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      // 清理计时器
      if (loadingTimerRef.current) {
        clearInterval(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [selectedAgentId, needsTextContent, isAgentsMd, fileUrl, tab.name, tab.path, tab.level, currentSessionId, buildFileUrl, buildUrl]);
  
  // 使用 ref 保存最新的 loadFile 引用，避免依赖循环
  const loadFileRef = useRef(loadFile);
  loadFileRef.current = loadFile;
  
  // 手动重试（通过 ref 调用最新的 loadFile）
  const handleRetry = useCallback(() => {
    setRetryCount(c => c + 1);
    loadFileRef.current();
  }, []);
  
  // 首次加载和依赖变化时加载
  // 注意：不要将 loadFile 作为依赖项，否则会导致无限循环
  // loadFile 内部已经依赖了所有必要的状态
  useEffect(() => {
    mountedRef.current = true;
    
    // 会话级文件必须等待 currentSessionId 就绪（customUrlBuilder 接管时例外）
    if (!customUrlBuilder && tab.level === 'session' && !currentSessionId) {
      console.log('[FilePreview] 等待会话 ID...');
      return;
    }

    loadFile();
    
    return () => {
      mountedRef.current = false;
      if (loadingTimerRef.current) {
        clearInterval(loadingTimerRef.current);
      }
    };
  }, [tab.path, tab.name, tab.level, selectedAgentId, currentSessionId, refreshKey]);
  
  // fallback URL（媒体文件 404 时切换级别重试）
  const fallbackUrl = useMemo(() => {
    if (customUrlBuilder || !currentSessionId) return undefined;
    const fallbackLevel = tab.level === 'session' ? 'agent-shared' : 'session';
    const url = buildUrl(fallbackLevel);
    return url !== fileUrl ? url : undefined;
  }, [customUrlBuilder, currentSessionId, tab.level, buildUrl, fileUrl]);
  
  // agents.md 使用专门的组件（不需要等待 loading）
  if (isAgentsMd) {
    return <AgentsMd />;
  }
  
  if (loading) {
    return <LoadingState loadingTime={loadingTime} />;
  }
  
  if (error) {
    return <ErrorState message={error} onRetry={handleRetry} retryCount={retryCount} />;
  }
  
  // 根据文件类型渲染
  if (isImageFile(tab.name)) {
    return <ImagePreview url={fileUrl} fallbackUrl={fallbackUrl} name={tab.name} />;
  }
  
  if (isPdfFile(tab.name)) {
    return <PdfPreview url={fileUrl} name={tab.name} readOnly={readOnly} />;
  }
  
  if (isExcelFile(tab.name)) {
    return <ExcelPreview fileUrl={fileUrl} fileName={tab.name} className="h-full" />;
  }

  if (isPptxFile(tab.name)) {
    return <PptxPreview url={fileUrl} name={tab.name} />;
  }

  if (isLegacyPptFile(tab.name)) {
    return <LegacyPptPreview url={fileUrl} name={tab.name} />;
  }

  if (isDocFile(tab.name)) {
    const docPdfUrl = fileUrl + (fileUrl.includes('?') ? '&' : '?') + 'format=pdf';
    return <PdfPreview url={docPdfUrl} name={tab.name} readOnly={readOnly} />;
  }
  
  if (isVideoFile(tab.name)) {
    return <VideoPreview url={fileUrl} />;
  }
  
  if (isAudioFile(tab.name)) {
    return <AudioPreview url={fileUrl} name={tab.name} />;
  }
  
  const fileLevel: 'shared' | 'session' = tab.level === 'session' ? 'session' : 'shared';

  if (isCsvFile(tab.name)) {
    return <CsvPreview content={content || ''} />;
  }
  
  if (isMarkdownFile(tab.name)) {
    return <MarkdownPreviewContent content={content || ''} fileName={tab.name} filePath={tab.path} level={fileLevel} readOnly={readOnly} />;
  }

  if (isJsonFile(tab.name) && content !== null) {
    return <JsonPreview content={content} fileName={tab.name} filePath={tab.path} level={fileLevel} readOnly={readOnly} />;
  }
  
  // HTML 文件
  if (isHtmlFile(tab.name) && content !== null) {
    return <HtmlPreview content={content} name={tab.name} sandbox={htmlSandbox} />;
  }
  
  // 文本文件
  if (needsTextContent && content !== null) {
    return <TextPreview content={content} fileName={tab.name} filePath={tab.path} level={fileLevel} readOnly={readOnly} />;
  }
  
  // 不支持的文件类型
  return <UnsupportedPreview name={tab.name} onDownload={handleDownload} readOnly={readOnly && !onDownload} />;
};

export default FilePreview;
