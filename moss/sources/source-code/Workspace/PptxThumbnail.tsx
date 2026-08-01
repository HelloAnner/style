import React, { useEffect, useRef, useState } from 'react';
import type {
  PptxViewer as PptxViewerInstance,
  SlideHandle,
} from '@aiden0z/pptx-renderer';
import styles from './PptxPreview.module.css';

interface PptxThumbnailProps {
  active: boolean;
  index: number;
  onSelect: () => void;
  viewer: PptxViewerInstance;
}

export const PptxThumbnail: React.FC<PptxThumbnailProps> = ({
  active,
  index,
  onSelect,
  viewer,
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const container = previewRef.current;
    if (!container) return;

    let handle: SlideHandle | null = null;
    let observer: IntersectionObserver | null = null;
    let disposed = false;

    const renderThumbnail = () => {
      if (handle || disposed) return;
      const width = container.clientWidth || 184;
      handle = viewer.renderThumbnailToContainer(index, container, { width });
      if (!handle) {
        setFailed(true);
        return;
      }
      void handle.ready.catch(() => {
        if (!disposed) setFailed(true);
      });
    };

    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver((entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          renderThumbnail();
        } else if (handle) {
          handle.dispose();
          handle = null;
          container.replaceChildren();
        }
      }, { rootMargin: '240px 0px' });
      observer.observe(container);
    } else {
      renderThumbnail();
    }

    return () => {
      disposed = true;
      observer?.disconnect();
      handle?.dispose();
      container.replaceChildren();
    };
  }, [index, viewer]);

  useEffect(() => {
    if (active && typeof buttonRef.current?.scrollIntoView === 'function') {
      buttonRef.current.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [active]);

  return (
    <button
      ref={buttonRef}
      type="button"
      className={`${styles.thumbnailButton} ${active ? styles.thumbnailButtonActive : ''}`}
      aria-label={`跳转到第 ${index + 1} 页`}
      aria-current={active ? 'page' : undefined}
      onClick={onSelect}
    >
      <span ref={previewRef} className={styles.thumbnailCanvas} aria-hidden="true">
        {failed && <span className={styles.thumbnailFallback}>无法预览</span>}
      </span>
      <span className={styles.thumbnailNumber}>{index + 1}</span>
    </button>
  );
};
