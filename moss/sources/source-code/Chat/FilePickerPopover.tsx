import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Code, File, FileText, Film, Image, Music, Table } from 'lucide-react';
import { agentFilesApi } from '../../api/agentFiles';
import type { UserFileInfo } from '../../api/userFiles';
import type { FileInfo } from '../../types';

export type FilePickerReferenceLevel = 'user_file' | 'shared' | 'session';

export type FilePickerFile = UserFileInfo & {
  referenceLevel: FilePickerReferenceLevel;
};

const AtIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4" />
    <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" />
  </svg>
);

function getFileIcon(path: string): React.ReactNode {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const s = 14;
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) {
    return <Image size={s} style={{ color: 'var(--color-file-image)' }} />;
  }
  if (['mp4', 'webm', 'mov', 'avi'].includes(ext)) {
    return <Film size={s} style={{ color: 'var(--text-muted)' }} />;
  }
  if (['mp3', 'wav', 'm4a', 'aac'].includes(ext)) {
    return <Music size={s} style={{ color: 'var(--text-muted)' }} />;
  }
  if (['csv', 'xlsx', 'xls'].includes(ext)) {
    return <Table size={s} style={{ color: 'var(--color-file-csv)' }} />;
  }
  if (['py', 'js', 'ts', 'jsx', 'tsx', 'java', 'c', 'cpp', 'go', 'rs', 'json', 'yaml', 'yml'].includes(ext)) {
    return <Code size={s} style={{ color: 'var(--color-file-config)' }} />;
  }
  if (['md', 'txt', 'log'].includes(ext)) {
    return <FileText size={s} style={{ color: 'var(--color-file-markdown)' }} />;
  }
  if (ext === 'pdf') {
    return <FileText size={s} style={{ color: 'var(--danger)' }} />;
  }
  return <File size={s} style={{ color: 'var(--text-muted)' }} />;
}

function toUserFileInfo(file: FileInfo): UserFileInfo {
  return {
    path: file.path,
    displayName: file.name || file.path,
    size: file.size || 0,
    contentType: file.mime_type || null,
    uploadedAt: file.modified_at || '',
    etag: file.id || file.path,
    scope: file.scope,
    shared: file.scope === 'session_shared' || Boolean(file.shared),
  };
}

function isSessionReferenceCandidate(file: FileInfo): boolean {
  return !file.is_dir
    && file.scope !== 'session_shared'
    && file.location !== 'shared'
    && !file.shared;
}

function referenceLevelLabel(level: FilePickerReferenceLevel): string {
  if (level === 'session') return '会话';
  if (level === 'shared') return '共享';
  return '个人';
}

interface FilePickerPopoverProps {
  query: string;
  anchorRect: DOMRect | null;
  agentId?: string | null;
  sessionId?: string | null;
  onSelect: (file: FilePickerFile) => void;
  onClose: () => void;
}

export const FilePickerPopover: React.FC<FilePickerPopoverProps> = ({
  query,
  anchorRect,
  agentId,
  sessionId,
  onSelect,
  onClose,
}) => {
  void referenceLevelLabel;
  const [sharedFiles, setSharedFiles] = useState<UserFileInfo[]>([]);
  const [sessionFiles, setSessionFiles] = useState<UserFileInfo[]>([]);
  const [sharedLoading, setSharedLoading] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!agentId) {
      setSharedFiles([]);
      setSharedLoading(false);
      return;
    }

    let cancelled = false;
    setSharedLoading(true);
    agentFilesApi.listShared(agentId)
      .then((res) => {
        if (cancelled) return;
        setSharedFiles(res.files.filter((file) => !file.is_dir).map(toUserFileInfo));
      })
      .catch(() => {
        if (!cancelled) setSharedFiles([]);
      })
      .finally(() => {
        if (!cancelled) setSharedLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [agentId]);

  useEffect(() => {
    if (!agentId || !sessionId) {
      setSessionFiles([]);
      setSessionLoading(false);
      return;
    }

    let cancelled = false;
    setSessionLoading(true);
    agentFilesApi.listSession(agentId, sessionId)
      .then((res) => {
        if (cancelled) return;
        setSessionFiles(res.files
          .filter(isSessionReferenceCandidate)
          .map(toUserFileInfo));
      })
      .catch(() => {
        if (!cancelled) setSessionFiles([]);
      })
      .finally(() => {
        if (!cancelled) setSessionLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [agentId, sessionId]);

  const groupedFiles = useMemo(() => {
    const matchesQuery = (file: UserFileInfo) => {
      const name = file.displayName || file.path;
      return !query || name.toLowerCase().includes(query.toLowerCase());
    };
    const sharedPaths = new Set(sharedFiles.map((file) => file.path));
    return [
      {
        key: 'shared' as const,
        title: '共享文件',
        files: sharedFiles
          .filter(matchesQuery)
          .map((file): FilePickerFile => ({ ...file, referenceLevel: 'shared' })),
      },
      {
        key: 'session' as const,
        title: '当前会话文件',
        files: sessionFiles
          .filter((file) => !file.shared && file.scope !== 'session_shared' && !sharedPaths.has(file.path))
          .filter(matchesQuery)
          .map((file): FilePickerFile => ({ ...file, referenceLevel: 'session' })),
      },
    ];
  }, [sharedFiles, sessionFiles, query]);

  const filtered = useMemo(
    () => groupedFiles.flatMap((group) => group.files),
    [groupedFiles]
  );

  const rows = useMemo(() => {
    let index = 0;
    return groupedFiles.flatMap((group) => {
      const items: Array<
        | { type: 'heading'; key: string; title: string }
        | { type: 'file'; key: string; file: FilePickerFile; index: number }
      > = [{ type: 'heading', key: group.key, title: group.title }];
      group.files.forEach((file) => {
        items.push({
          type: 'file',
          key: `${file.referenceLevel}:${file.path}`,
          file,
          index,
        });
        index += 1;
      });
      return items;
    });
  }, [groupedFiles]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }
    if (filtered.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (filtered[selectedIdx]) onSelect(filtered[selectedIdx]);
    }
  }, [filtered, selectedIdx, onSelect, onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIdx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIdx]);

  if (!anchorRect) return null;

  const popoverStyle: React.CSSProperties = {
    position: 'fixed',
    left: anchorRect.left,
    bottom: window.innerHeight - anchorRect.top + 6,
    width: Math.min(390, anchorRect.width),
    maxHeight: 450,
    zIndex: 9999,
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 12,
    boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.12 }}
      style={popoverStyle}
    >
      <div className="flex items-center" style={{ padding: '10px 12px 6px', gap: 6 }}>
        <AtIcon size={13} />
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
          引用文件 {query && <span style={{ color: 'var(--text-tertiary)' }}>· {query}</span>}
        </span>
      </div>

      <div ref={listRef} role="listbox" style={{ flex: 1, overflowY: 'auto', padding: '2px 0 6px' }}>
        {(sharedLoading || sessionLoading) && filtered.length === 0 && (
          <div style={{ padding: '20px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            加载中...
          </div>
        )}
        {!sharedLoading && !sessionLoading && filtered.length === 0 && (
          <div style={{ padding: '20px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            暂无可引用文件
          </div>
        )}
        {rows.map((row) => row.type === 'heading' ? (
          <div
            key={`heading-${row.key}`}
            style={{
              padding: '8px 12px 4px',
              fontSize: 12,
              color: 'var(--text-muted)',
              fontWeight: 500,
            }}
          >
            {row.title}
          </div>
        ) : (
          <div
            key={row.key}
            data-index={row.index}
            role="option"
            aria-selected={row.index === selectedIdx}
            onClick={() => onSelect(row.file)}
            onMouseEnter={() => setSelectedIdx(row.index)}
            className="file-picker-item flex items-center cursor-pointer transition-colors"
            style={{
              padding: '9px 12px',
              gap: 8,
              background: row.index === selectedIdx ? 'var(--bg-tertiary)' : 'transparent',
              borderRadius: 6,
              margin: '0 4px',
            }}
            data-testid={`file-pick-item-${row.file.referenceLevel}-${row.file.path}`}
          >
            {getFileIcon(row.file.path)}
            <span className="truncate" style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1 }}>
              {row.file.displayName || row.file.path}
            </span>
          </div>
        ))}
      </div>

      <div style={{ padding: '6px 12px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 12 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>↑↓ 导航</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>↵ 选择</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Esc 关闭</span>
      </div>
    </motion.div>
  );
};
