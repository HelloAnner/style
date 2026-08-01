import React, { useCallback, useEffect, useRef, useState } from 'react';
import type {
  PptxFiles,
  PptxViewer as PptxViewerInstance,
} from '@aiden0z/pptx-renderer';
import { FileText } from 'lucide-react';
import pdfModuleSrc from 'pdfjs-dist/build/pdf.min.mjs?url';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useMediaUrl } from '../../lib/media';
import { PptxThumbnail } from './PptxThumbnail';
import styles from './PptxPreview.module.css';

interface PptxPreviewProps {
  url: string;
  name: string;
}

const MIN_ZOOM = 50;
const MAX_ZOOM = 200;
const ZOOM_STEP = 10;
const MAX_PPTX_BYTES = 64 * 1024 * 1024;

class PptxInputError extends Error {}

export async function readResponseWithLimit(
  response: Response,
  maxBytes = MAX_PPTX_BYTES,
): Promise<ArrayBuffer> {
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new PptxInputError('PPTX exceeds raw size limit');
  }

  if (!response.body) {
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > maxBytes) {
      throw new PptxInputError('PPTX exceeds raw size limit');
    }
    return buffer;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new PptxInputError('PPTX exceeds raw size limit');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes.buffer;
}

function stripExternalRelationships(xml: string): string {
  if (!xml) return xml;
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.getElementsByTagName('parsererror').length > 0) {
    throw new PptxInputError('Invalid relationship XML');
  }

  for (const relationship of Array.from(
    document.getElementsByTagNameNS('*', 'Relationship'),
  )) {
    if (relationship.getAttribute('TargetMode')?.trim().toLowerCase() === 'external') {
      relationship.remove();
    }
  }
  return new XMLSerializer().serializeToString(document);
}

export function stripExternalResources(files: PptxFiles): void {
  files.presentationRels = stripExternalRelationships(files.presentationRels);
  const relationshipMaps = [
    files.slideRels,
    files.slideLayoutRels,
    files.slideMasterRels,
    files.chartRels,
  ];
  for (const relationships of relationshipMaps) {
    if (!relationships) continue;
    for (const [path, xml] of relationships) {
      relationships.set(path, stripExternalRelationships(xml));
    }
  }
}

function previewErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === 'AbortError') return '';
  if (error instanceof Error) {
    if (error instanceof PptxInputError && /size limit/.test(error.message)) {
      return '文件过大，暂不支持在浏览器中预览';
    }
    if (/HTTP 401|HTTP 403/.test(error.message)) return '没有权限读取该演示文稿';
    if (/HTTP 404/.test(error.message)) return '演示文稿不存在或已被删除';
    if (/HTTP 5\d\d/.test(error.message)) return '服务暂不可用，请稍后重试';
    if (/zip|pptx|presentation|corrupt|invalid/i.test(error.message)) {
      return '文件不是有效的 PPTX，或内容已经损坏';
    }
  }
  return '无法读取演示文稿，请稍后重试';
}

export const PptxPreview: React.FC<PptxPreviewProps> = ({ url, name }) => {
  const mediaUrl = useMediaUrl(url);
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<PptxViewerInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentSlide, setCurrentSlide] = useState(1);
  const [totalSlides, setTotalSlides] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [warning, setWarning] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const container = viewerContainerRef.current;
    if (!container) return;

    const abortController = new AbortController();
    let disposed = false;
    let viewer: PptxViewerInstance | null = null;

    setLoading(true);
    setError('');
    setCurrentSlide(1);
    setTotalSlides(0);
    setZoom(100);
    setWarning('');
    container.replaceChildren();

    const loadPresentation = async () => {
      try {
        const response = await fetch(mediaUrl, { signal: abortController.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const buffer = await readResponseWithLimit(response);
        if (disposed) return;

        const {
          PptxViewer,
          RECOMMENDED_ZIP_LIMITS,
          buildPresentation,
          parseZipLazyMedia,
        } = await import('@aiden0z/pptx-renderer');
        if (disposed) return;

        const files = await parseZipLazyMedia(buffer, RECOMMENDED_ZIP_LIMITS);
        if (disposed) return;
        stripExternalResources(files);
        const presentation = buildPresentation(files, { lazySlides: true });
        if (presentation.slides.length === 0) {
          throw new PptxInputError('PPTX contains no slides');
        }

        viewer = new PptxViewer(container, {
          fitMode: 'contain',
          zoomPercent: 100,
          lazySlides: true,
          lazyMedia: true,
          pdfjs: {
            moduleUrl: pdfModuleSrc,
            workerUrl: pdfWorkerSrc,
          },
          onSlideChange: (index) => {
            if (!disposed) setCurrentSlide(index + 1);
          },
          onSlideError: () => {
            if (!disposed) {
              setError('当前幻灯片无法渲染，请检查文件内容后重试');
              setLoading(false);
            }
          },
          onNodeError: () => {
            if (!disposed) setWarning('部分元素未能完整显示');
          },
        });
        viewerRef.current = viewer;
        viewer.load(presentation);
        await viewer.renderSlide(0);

        if (disposed) return;
        setTotalSlides(viewer.slideCount);
        setLoading(false);
      } catch (loadError) {
        if (disposed || abortController.signal.aborted) return;
        viewer?.destroy();
        if (viewerRef.current === viewer) viewerRef.current = null;
        viewer = null;
        setError(previewErrorMessage(loadError));
        setLoading(false);
      }
    };

    void loadPresentation();

    return () => {
      disposed = true;
      abortController.abort();
      viewer?.destroy();
      if (viewerRef.current === viewer) viewerRef.current = null;
    };
  }, [mediaUrl, reloadKey]);

  const goToSlide = useCallback(async (slide: number) => {
    const viewer = viewerRef.current;
    if (!viewer || totalSlides === 0) return;
    const target = Math.max(1, Math.min(totalSlides, slide));
    try {
      await viewer.goToSlide(target - 1, { behavior: 'smooth', block: 'nearest' });
    } catch {
      setError('当前幻灯片无法渲染，请检查文件内容后重试');
    }
  }, [totalSlides]);

  const changeZoom = useCallback(async (delta: number) => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom + delta));
    try {
      await viewer.setZoom(nextZoom);
      setZoom(nextZoom);
    } catch {
      setError('无法调整预览缩放，请重试');
    }
  }, [zoom]);

  const resetZoom = useCallback(async () => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    try {
      await viewer.setZoom(100);
      await viewer.setFitMode('contain');
      setZoom(100);
    } catch {
      setError('无法重置预览缩放，请重试');
    }
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      void goToSlide(currentSlide - 1);
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      void goToSlide(currentSlide + 1);
    }
  };

  return (
    <section
      className={styles.preview}
      aria-label={`${name} 演示文稿预览`}
      aria-busy={loading}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      data-testid="pptx-renderer-preview"
    >
      <header className={styles.toolbar}>
        <div className={styles.fileInfo} title={name}>
          <FileText size={20} aria-hidden="true" />
          <span>{name}</span>
        </div>

        <div className={styles.controlGroup} aria-label="幻灯片导航">
          <button
            type="button"
            className={styles.iconButton}
            aria-label="上一页"
            disabled={loading || currentSlide <= 1}
            onClick={() => void goToSlide(currentSlide - 1)}
          >
            ‹
          </button>
          <span className={styles.pageCounter} aria-live="polite">
            {totalSlides > 0 ? `${currentSlide} / ${totalSlides}` : '— / —'}
          </span>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="下一页"
            disabled={loading || currentSlide >= totalSlides}
            onClick={() => void goToSlide(currentSlide + 1)}
          >
            ›
          </button>
        </div>

        <div className={`${styles.controlGroup} ${styles.zoomControls}`} aria-label="预览缩放">
          <button
            type="button"
            className={styles.iconButton}
            aria-label="缩小"
            disabled={loading || zoom <= MIN_ZOOM}
            onClick={() => void changeZoom(-ZOOM_STEP)}
          >
            −
          </button>
          <button
            type="button"
            className={styles.zoomButton}
            aria-label="重置缩放"
            disabled={loading}
            onClick={() => void resetZoom()}
          >
            {zoom}%
          </button>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="放大"
            disabled={loading || zoom >= MAX_ZOOM}
            onClick={() => void changeZoom(ZOOM_STEP)}
          >
            +
          </button>
        </div>
      </header>

      <div className={styles.content}>
        {totalSlides > 0 && viewerRef.current && (
          <aside className={styles.thumbnailRail} aria-label="幻灯片缩略图">
            {Array.from({ length: totalSlides }, (_, index) => (
              <PptxThumbnail
                key={index}
                active={currentSlide === index + 1}
                index={index}
                onSelect={() => void goToSlide(index + 1)}
                viewer={viewerRef.current as PptxViewerInstance}
              />
            ))}
          </aside>
        )}

        <div className={styles.stage}>
          {warning && !error && (
            <div className={styles.warning} role="status">
              {warning}
            </div>
          )}
          <div
            ref={viewerContainerRef}
            className={styles.viewer}
            aria-hidden={loading || Boolean(error)}
            data-testid="pptx-renderer-container"
          />

          {loading && (
            <div className={styles.state} role="status">
              <span className={styles.spinner} aria-hidden="true" />
              <strong>正在解析演示文稿</strong>
              <span>首次打开会在浏览器中读取幻灯片结构</span>
            </div>
          )}

          {error && (
            <div className={styles.state} role="alert">
              <strong>演示文稿加载失败</strong>
              <span>{error}</span>
              <button
                type="button"
                className={styles.retryButton}
                aria-label="重新加载演示文稿"
                onClick={() => setReloadKey((key) => key + 1)}
              >
                重试
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
