import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { FilePreview } from '../../components/Workspace/FilePreview';
import type { WorkspaceTab } from '../../stores/previewStore';
import { kernelApiFetch } from '../../api/gateway';
import { useAuthStore } from '../../stores/authStore';
import { useAuthRehydrated } from '../../hooks/useAuthRehydrated';
import { appendRedirect } from '../../utils/authNavigation';
import { downloadFile } from '../../lib/media';
import { buildCurrentOriginUrl } from './shareNavigation';

interface FileShareMeta {
  token: string;
  share_type?: 'enterprise' | 'public';
  name: string;
  path: string;
  size?: number;
  updated_at?: string | null;
  content_url: string;
}

function formatFileSize(bytes?: number): string {
  if (bytes == null) return '未知大小';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value?: string | null): string {
  if (!value) return '未知时间';
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return '未知时间';
  return new Date(ts).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

const ErrorView: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex items-center justify-center px-6" style={{ minHeight: '100dvh', background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
    <div className="text-center">
      <p className="text-base font-medium" style={{ color: 'var(--text-primary)' }}>无法预览文件</p>
      <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>{message}</p>
    </div>
  </div>
);

const LoadingView: React.FC = () => (
  <div className="flex items-center justify-center px-6" style={{ minHeight: '100dvh', background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>正在加载分享文件</p>
  </div>
);

const FileSharePage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [meta, setMeta] = useState<FileShareMeta | null>(null);
  const [error, setError] = useState('');
  const sharePath = token ? `/file/${encodeURIComponent(token)}` : '/';
  const authRehydrated = useAuthRehydrated();
  const restoreSession = useAuthStore((s) => s.restoreSession);
  const attemptedAuthRestoreRef = useRef(false);

  const redirectTop = useCallback((url: string) => {
    if (window.top !== window.self) {
      window.top!.location.href = url;
    } else {
      window.location.href = url;
    }
  }, []);

  useEffect(() => {
    if (!token || !authRehydrated) return;
    let cancelled = false;
    (async () => {
      try {
        let res = await kernelApiFetch(`/api/v1/file-share/${encodeURIComponent(token)}/meta`);
        if (res.status === 401 && !attemptedAuthRestoreRef.current) {
          attemptedAuthRestoreRef.current = true;
          const { user } = useAuthStore.getState();
          if (user && await restoreSession()) {
            res = await kernelApiFetch(`/api/v1/file-share/${encodeURIComponent(token)}/meta`);
          }
        }
        if (!res.ok) {
          if (res.status === 401) {
            redirectTop(appendRedirect('/login', sharePath));
            throw Object.assign(new Error('redirecting'), { redirected: true });
          }
          if (res.status === 403) throw new Error('无权访问该企业内分享');
          throw new Error('分享链接不存在或已失效');
        }
        const data = await res.json();
        if (!cancelled) setMeta(data);
      } catch (e: any) {
        if ((e as any)?.redirected) return;
        if (!cancelled) setError(e?.message || '分享链接不存在或已失效');
      }
    })();
    return () => { cancelled = true; };
  }, [authRehydrated, redirectTop, restoreSession, sharePath, token]);

  const tab = useMemo<WorkspaceTab | null>(() => {
    if (!meta) return null;
    return {
      id: `file-share-${meta.token}`,
      name: meta.name,
      path: meta.path || meta.name,
      type: 'unknown',
      level: 'user-file',
      kind: 'file',
    };
  }, [meta]);

  const buildFileUrl = useCallback(() => meta?.content_url || '', [meta]);

  const handleCTA = useCallback(() => {
    window.location.href = buildCurrentOriginUrl('/');
  }, []);

  const handleDownload = useCallback(() => {
    if (!meta || meta.share_type !== 'enterprise') return;
    void downloadFile(`${meta.content_url}?disposition=attachment`, meta.name);
  }, [meta]);

  if (error) return <ErrorView message={error} />;
  if (!meta || !tab) return <LoadingView />;

  return (
    <div className="flex flex-col overflow-hidden" style={{ minHeight: '100dvh', height: '100dvh', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} data-testid="file-share-page">
      <header className="shrink-0 px-4 py-2 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-primary)' }}>
        <div className="flex min-w-0 flex-1 items-center" style={{ gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
            MOSS·谋士
          </span>
          <div style={{ width: 1, height: 16, background: 'var(--border-subtle)', flexShrink: 0 }} />
          <h1 className="truncate" style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 600 }}>{meta.name}</h1>
        </div>
        <div className="hidden min-w-0 flex-1 flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs md:flex" style={{ color: 'var(--text-muted)' }}>
            <span>{formatFileSize(meta.size)}</span>
            <span>更新于 {formatDate(meta.updated_at)}</span>
        </div>
        {meta.share_type === 'enterprise' && (
          <button
            type="button"
            onClick={handleDownload}
            aria-label="下载文件"
            title="下载文件"
            data-testid="file-share-download"
            className="flex shrink-0 items-center justify-center transition-opacity hover:opacity-70"
            style={{ width: 30, height: 30, color: 'var(--text-muted)', background: 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer' }}
          >
            <Download size={16} />
          </button>
        )}
        <button type="button" onClick={handleCTA} className="shrink-0" style={{ padding: '0 14px', height: 34, fontSize: 12, fontWeight: 400, whiteSpace: 'nowrap', color: 'var(--btn-primary-bg)', background: 'color-mix(in srgb, var(--info-bg-soft) 55%, var(--bg-primary))', borderRadius: 6, border: 'none', cursor: 'pointer', transition: 'opacity 0.15s' }} onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')} onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}>
          免费试用 Moss →
        </button>
      </header>
      <main className="min-h-0 flex-1">
        <FilePreview
          tab={tab}
          customUrlBuilder={buildFileUrl}
          readOnly
          onDownload={meta.share_type === 'enterprise' ? handleDownload : undefined}
        />
      </main>
    </div>
  );
};

export default FileSharePage;
