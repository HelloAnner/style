import React, { memo, useCallback, useMemo } from 'react';
import { FileText } from 'lucide-react';
import type { SubAgentExecution } from '../../types';
import { useAgentStore } from '../../stores/agentStore';
import { usePreviewStore } from '../../stores/previewStore';
import type { FileLevel } from '../../stores/previewStore';

function fileAction(path: string): '预览' | '下载' {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  return ['docx', 'doc', 'pptx', 'ppt', 'xlsx', 'xls'].includes(ext) ? '下载' : '预览';
}

/** 结构化结果归档是子/主智能体之间的内部交互文件，不作为用户产物展示。 */
export function isInternalSubagentArtifact(path: string): boolean {
  const fileName = String(path || '').split('/').pop() || '';
  return /^result-archive(?:-\d+)?\.json$/i.test(fileName);
}

export function subAgentArtifactPreviewTarget(
  rawPath: string,
  currentSessionId: string | null,
): { name: string; path: string; level: FileLevel } | null {
  let path = String(rawPath || '').trim();
  if (!path) return null;
  if (path.startsWith('workspace://')) {
    path = path.slice('workspace://'.length);
  }
  path = path.replace(/^\/+/, '');
  if (!path || path.includes('\\')) return null;

  const parts = path.split('/');
  if (parts.length >= 4 && parts[0] === 'sessions' && parts[2] === 'files') {
    if (currentSessionId && parts[1] !== currentSessionId) return null;
    path = parts.slice(3).join('/');
  }
  if (!path || path.split('/').some((part) => !part || part === '.' || part === '..')) {
    return null;
  }
  return {
    name: path.split('/').pop() || path,
    path,
    level: 'session',
  };
}

export function isOffloadedConclusionPointer(content?: string | null): boolean {
  const text = String(content || '').trim();
  if (!text) return false;
  // 新协议归档指针："完整结构化结果已写入归档文件，主智能体可按需 read 该文件。首段摘要: ..."
  return (
    text.startsWith('完整结构化结果已写入归档文件') &&
    text.includes('主智能体可按需 read 该文件') &&
    text.includes('首段摘要:')
  );
}

// ========== Artifact chips ==========
// 产物 chip 行：细边框 pill，点击预览/下载。卡片展开区与执行详情 Drawer 共用。

export const ArtifactList: React.FC<{
  artifacts: NonNullable<SubAgentExecution['artifacts']>;
  onArtifactOpen?: (path: string) => void;
  hideLabel?: boolean;
}> = memo(({ artifacts, onArtifactOpen, hideLabel = false }) => {
  const currentSessionId = useAgentStore((s) => s.currentSessionId);
  const openFile = usePreviewStore((s) => s.openFile);

  const visibleArtifacts = useMemo(
    () => artifacts.filter((a) => !isInternalSubagentArtifact(a.path)),
    [artifacts],
  );

  const handleOpen = useCallback((path: string) => {
    const target = subAgentArtifactPreviewTarget(path, onArtifactOpen ? null : currentSessionId);
    if (!target) return;
    if (onArtifactOpen) {
      onArtifactOpen(target.path);
      return;
    }
    openFile(target);
  }, [currentSessionId, onArtifactOpen, openFile]);

  if (visibleArtifacts.length === 0) return null;

  return (
    <div className="subagent-artifacts" data-testid="subagent-artifact-list">
      {!hideLabel && (
        <div className="subagent-artifacts-label">
          <FileText size={12} />
          产出文件 ({visibleArtifacts.length})
        </div>
      )}
      <div className="subagent-artifact-chips">
        {visibleArtifacts.slice(0, 5).map((a, i) => {
          const fileName = a.path.split('/').pop() || a.path;
          const displayName = a.display_name || a.summary || fileName;
          const canOpen = subAgentArtifactPreviewTarget(
            a.path,
            onArtifactOpen ? null : currentSessionId,
          ) !== null;
          return (
            <span
              key={i}
              className="subagent-artifact-chip"
              data-testid={`subagent-artifact-${a.path}`}
            >
              <FileText size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <span className="subagent-artifact-chip-name">{displayName}</span>
              {a.size_bytes != null && (
                <span className="subagent-artifact-chip-size">
                  {a.size_bytes >= 1024 ? `${(a.size_bytes / 1024).toFixed(1)}KB` : `${a.size_bytes}B`}
                </span>
              )}
              <button
                type="button"
                onClick={() => handleOpen(a.path)}
                disabled={!canOpen}
                aria-label={`${fileAction(a.path)} ${fileName}`}
                className="subagent-artifact-chip-action"
                data-testid={`subagent-artifact-action-${a.path}`}
              >
                {fileAction(a.path)}
              </button>
            </span>
          );
        })}
        {visibleArtifacts.length > 5 && (
          <span className="subagent-artifact-chip subagent-artifact-chip-more">
            及其他 {visibleArtifacts.length - 5} 个文件
          </span>
        )}
      </div>
    </div>
  );
});
ArtifactList.displayName = 'ArtifactList';
