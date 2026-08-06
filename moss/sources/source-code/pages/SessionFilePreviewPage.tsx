import React, { useCallback, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Download } from 'lucide-react';
import { FilePreview } from '../components/Workspace/FilePreview';
import { fetchMedia } from '../lib/media';
import type { WorkspaceTab } from '../stores/previewStore';

type SessionFileDownloadUrlResponse = {
  url?: unknown;
};

function encodeFilePath(path: string): string {
  return path.split('/').map(segment => encodeURIComponent(segment)).join('/');
}

function fileNameFromPath(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  return normalized.split('/').filter(Boolean).pop() || normalized || '文件';
}

const PreviewError: React.FC<{ message: string }> = ({ message }) => (
  <div
    className="flex items-center justify-center px-6"
    style={{ minHeight: '100dvh', background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}
  >
    <div className="text-center">
      <p className="text-base font-medium" style={{ color: 'var(--text-primary)' }}>无法预览文件</p>
      <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>{message}</p>
    </div>
  </div>
);

const SessionFilePreviewPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const agentId = searchParams.get('agentId')?.trim() || '';
  const filePath = searchParams.get('path')?.trim() || '';

  const fileName = useMemo(() => fileNameFromPath(filePath), [filePath]);

  const tab = useMemo<WorkspaceTab>(() => ({
    id: 'external-session-file-preview',
    name: fileName,
    path: filePath,
    type: 'unknown',
    level: 'session',
    kind: 'file',
  }), [fileName, filePath]);

  const buildSessionFileUrl = useCallback((path: string) => {
    if (!agentId || !sessionId) {
      return '';
    }
    return `/api/v1/agents/${encodeURIComponent(agentId)}/sessions/${encodeURIComponent(sessionId)}/files/${encodeFilePath(path)}?disposition=inline`;
  }, [agentId, sessionId]);

  const buildSessionFileDownloadUrlEndpoint = useCallback(() => {
    if (!agentId || !sessionId) {
      return '';
    }
    return `/api/v1/agents/${encodeURIComponent(agentId)}/sessions/${encodeURIComponent(sessionId)}/file-download-url`;
  }, [agentId, sessionId]);

  const handleDownload = useCallback(() => {
    const endpoint = buildSessionFileDownloadUrlEndpoint();
    if (!endpoint || !filePath) {
      return;
    }
    void fetchMedia(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath }),
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json() as Promise<SessionFileDownloadUrlResponse>;
      })
      .then(data => {
        const url = typeof data.url === 'string' ? data.url.trim() : '';
        if (!url) {
          throw new Error('missing download url');
        }
        window.location.assign(url);
      })
      .catch(error => {
        console.error('[SessionFilePreviewPage] download failed:', error);
      });
  }, [buildSessionFileDownloadUrlEndpoint, filePath]);

  if (!sessionId) {
    return <PreviewError message="缺少会话信息" />;
  }

  if (!agentId || !filePath) {
    return <PreviewError message="缺少文件信息" />;
  }

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{ minHeight: '100dvh', height: '100dvh', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
      data-testid="session-file-preview-page"
    >
      <header
        className="shrink-0 px-4 py-3 flex items-center gap-3"
        style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-primary)' }}
      >
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          {fileName}
        </h1>
        <button
          type="button"
          onClick={handleDownload}
          className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium"
          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
          aria-label="下载文件"
          title="下载文件"
        >
          <Download size={16} aria-hidden="true" />
          <span>下载</span>
        </button>
      </header>
      <main className="min-h-0 flex-1">
        <FilePreview tab={tab} customUrlBuilder={buildSessionFileUrl} readOnly />
      </main>
    </div>
  );
};

export default SessionFilePreviewPage;
