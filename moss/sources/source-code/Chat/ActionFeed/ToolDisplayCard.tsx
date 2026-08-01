/**
 * ToolDisplayCard — 卡片模式的自定义工具展示组件
 *
 * 在 ActionFeed 内联渲染：左侧居中裁切的方形图片 + 右侧单行描述。
 * 工具执行中时显示 shimmer 光影掠过动效，结果返回后 shimmer 消失，卡片保留。
 * 入场时从左侧滑入。
 */

import React, { memo, useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../../../stores/authStore';
import { readCurrentTenantId } from '../../../stores/authStorage';

interface ToolDisplayCardProps {
  imageUrl?: string;
  description?: string;
  isLoading?: boolean;
}

function useAuthImage(url?: string): string | undefined {
  const [blobUrl, setBlobUrl] = useState<string>();
  const blobRef = useRef<string>();
  const token = useAuthStore(s => s.token);

  useEffect(() => {
    if (!url) { setBlobUrl(undefined); return; }
    let cancelled = false;

    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const tenantId = readCurrentTenantId();
    if (tenantId) headers['X-Tenant-Id'] = tenantId;

    fetch(url, { headers })
      .then(r => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.blob();
      })
      .then(blob => {
        if (!cancelled && blob.size > 0) {
          const u = URL.createObjectURL(blob);
          blobRef.current = u;
          setBlobUrl(u);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current);
        blobRef.current = undefined;
      }
    };
  }, [url, token]);

  return blobUrl;
}

const MIN_SHIMMER_MS = 4000;

export const ToolDisplayCard: React.FC<ToolDisplayCardProps> = memo(({
  imageUrl,
  description,
  isLoading = false,
}) => {
  const resolvedImage = useAuthImage(imageUrl);

  const shimmerStartRef = useRef<number>(0);
  const [showShimmer, setShowShimmer] = useState(isLoading);

  useEffect(() => {
    if (isLoading) {
      if (!shimmerStartRef.current) shimmerStartRef.current = Date.now();
      setShowShimmer(true);
      return;
    }
    const elapsed = Date.now() - shimmerStartRef.current;
    const remaining = Math.max(0, MIN_SHIMMER_MS - elapsed);
    if (remaining === 0) {
      setShowShimmer(false);
      shimmerStartRef.current = 0;
      return;
    }
    const timer = setTimeout(() => {
      setShowShimmer(false);
      shimmerStartRef.current = 0;
    }, remaining);
    return () => clearTimeout(timer);
  }, [isLoading]);

  return (
    <>
      <style>{`
        .tool-card-shimmer {
          position: absolute; inset: 0; z-index: 1; pointer-events: none;
          border-radius: inherit;
          background: linear-gradient(
            135deg,
            transparent 0%, transparent 30%,
            var(--tool-card-shimmer-hl, rgba(255,255,255,0.12)) 50%,
            transparent 70%, transparent 100%
          );
          background-size: 400% 400%;
          animation: toolCardShimmer 2s ease-in-out infinite;
        }
        [data-theme="light"] .tool-card-shimmer {
          --tool-card-shimmer-hl: rgba(0,0,0,0.06);
        }
        [data-theme="dark"] .tool-card-shimmer {
          --tool-card-shimmer-hl: rgba(255,255,255,0.09);
        }
        @keyframes toolCardShimmer {
          0% { background-position: 100% 100%; }
          100% { background-position: 0% 0%; }
        }
        @keyframes toolCardSlideIn {
          from { opacity: 0; transform: translateX(-16px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .tool-display-card-enter {
          animation: toolCardSlideIn 0.28s ease-out both;
        }
      `}</style>

      <div
        className="tool-display-card-enter"
        style={{
          position: 'relative',
          display: 'inline-flex', alignItems: 'center', gap: 10,
          padding: 10,
          borderRadius: 10,
          border: '1px solid var(--border-subtle)',
          background: 'var(--bg-tertiary)',
          overflow: 'hidden',
          marginTop: 6,
        }}
        data-testid="tool-display-card"
      >
        {showShimmer && <div className="tool-card-shimmer" data-testid="tool-display-card-shimmer" />}

        {resolvedImage ? (
          <div
            style={{
              width: 44, height: 44, borderRadius: 8,
              overflow: 'hidden', flexShrink: 0,
              background: 'var(--bg-secondary)',
            }}
            data-testid="tool-display-card-image"
          >
            <img
              src={resolvedImage}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>
        ) : (
          <div
            style={{
              width: 44, height: 44, borderRadius: 8,
              background: 'var(--bg-secondary)', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            data-testid="tool-display-card-placeholder"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" opacity="0.4">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
        )}

        <span
          style={{
            width: '8em',
            fontSize: 13, fontWeight: 500,
            color: 'var(--text-primary)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            position: 'relative', zIndex: 2,
            flexShrink: 0,
          }}
          data-testid="tool-display-card-description"
        >
          {description || ''}
        </span>
      </div>
    </>
  );
});

ToolDisplayCard.displayName = 'ToolDisplayCard';
