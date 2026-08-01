/**
 * 消息气泡组件
 */

import React, { memo, useMemo, useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ThinkingIndicator } from '../common/LoadingStates';
import { QuestionCard } from './QuestionCard';
import { QuestionnaireReplyCard } from './QuestionnaireReplyCard';
import { MarkdownContent } from './MarkdownContent';
import { useAgentStore } from '../../stores/agentStore';
import { useAgentContextStore } from '../../stores/agentContextStore';
import { usePreviewStore } from '../../stores/previewStore';
import { ChatAgentMark } from './ChatAgentMark';
import { useMediaUrl } from '../../lib/media';
import { DashboardAskChip, dashboardDisplayParts } from './DashboardAskChip';
import type { ChatMessage } from '../../types';
import { getAgentDisplayName } from '../../types/platform';

// ========== 文件类型判断工具函数 ==========

function getFileExtension(path: string): string {
  const name = path.split('/').pop() || '';
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return ext;
}

function isImagePath(path: string): boolean {
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'];
  return imageExts.includes(getFileExtension(path));
}

function getFileName(path: string): string {
  return path.split('/').pop() || path;
}

type AttachFileCategory = 'image' | 'document' | 'pdf' | 'code' | 'spreadsheet' | 'video' | 'audio' | 'presentation' | 'archive' | 'unknown';

function getAttachFileCategory(name: string): AttachFileCategory {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) return 'image';
  if (['pdf'].includes(ext)) return 'pdf';
  if (['csv', 'xlsx', 'xls', 'ods'].includes(ext)) return 'spreadsheet';
  if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'].includes(ext)) return 'audio';
  if (['pptx', 'ppt', 'key', 'odp'].includes(ext)) return 'presentation';
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(ext)) return 'archive';
  if (['py', 'js', 'ts', 'jsx', 'tsx', 'go', 'java', 'c', 'cpp', 'rs', 'rb', 'php', 'swift', 'kt', 'sh', 'bash', 'html', 'css', 'scss', 'less', 'sql', 'r', 'lua', 'dart', 'vue', 'svelte'].includes(ext)) return 'code';
  if (['md', 'txt', 'json', 'yaml', 'yml', 'toml', 'xml', 'log', 'ini', 'cfg', 'conf', 'env', 'rst', 'rtf', 'doc', 'docx'].includes(ext)) return 'document';
  return 'unknown';
}

const ATTACH_ACCENT: Record<string, string> = {
  pdf: 'var(--file-icon-pdf)',
  document: 'var(--file-link-color)',
  presentation: 'var(--file-icon-code)',
  spreadsheet: 'var(--file-icon-table)',
  video: 'var(--file-icon-image)',
  audio: 'var(--file-icon-persona)',
  archive: 'var(--custom-mode-icon)',
  code: 'var(--file-icon-code)',
};

function getAttachAccent(cat: AttachFileCategory): string {
  return ATTACH_ACCENT[cat] || 'var(--text-muted)';
}

// ========== 文件卡片图标（紧凑型 SVG）==========

const AttachFileIcon: React.FC<{ category: AttachFileCategory; size?: number }> = ({ category, size = 18 }) => {
  const color = getAttachAccent(category);
  const s = { width: size, height: size, flexShrink: 0 };
  switch (category) {
    case 'pdf':
      return <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h6" strokeLinecap="round"/></svg>;
    case 'presentation':
      return <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M12 17v4M8 21h8" strokeLinecap="round"/><path d="M7 8l4 3-4 3" strokeLinecap="round" strokeLinejoin="round"/></svg>;
    case 'spreadsheet':
      return <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18" strokeLinecap="round"/></svg>;
    case 'video':
      return <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8"><rect x="2" y="4" width="15" height="16" rx="2"/><path d="M17 8l5-3v14l-5-3V8z"/></svg>;
    case 'audio':
      return <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>;
    case 'archive':
      return <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"/><path d="M14 2v6h6"/><rect x="9" y="13" width="6" height="4" rx="1"/><path d="M12 13v-2" strokeLinecap="round"/></svg>;
    case 'code':
      return <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8"><path d="M16 18l6-6-6-6M8 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round"/></svg>;
    case 'document':
      return <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h4" strokeLinecap="round"/></svg>;
    default:
      return <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"/><path d="M14 2v6h6"/></svg>;
  }
};

// ========== 构建文件 URL + 解析路径信息 ==========

function buildFileUrl(path: string, agentId: string | null): string {
  if (!agentId) return '';
  if (path.startsWith('sessions/')) {
    const parts = path.split('/');
    const pathSessionId = parts[1];
    const filePath = parts.slice(3).join('/');
    return `/api/v1/agents/${agentId}/sessions/${pathSessionId}/files/${filePath}`;
  }
  return `/api/v1/agents/${agentId}/files/${path}`;
}

function parseFilePath(path: string): string {
  if (path.startsWith('sessions/')) {
    return path.split('/').slice(3).join('/');
  }
  return path;
}

// ========== 上传图片附件行 ==========

const AttachedImageThumb: React.FC<{
  image: { path: string; url: string };
  index: number;
  maxHeight: number;
  maxWidth: number;
  onOpen: (path: string) => void;
}> = ({ image, index, maxHeight, maxWidth, onOpen }) => {
  const mediaSrc = useMediaUrl(image.url);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    setLoadFailed(false);
  }, [image.url]);

  return (
    <div
      className="message-attached-image"
      onClick={() => onOpen(image.path)}
      style={{
        height: maxHeight,
        maxWidth,
        borderRadius: 12,
        overflow: 'hidden',
        cursor: 'pointer',
        background: 'var(--file-card-bg)',
        flexShrink: 0,
        transition: 'opacity 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
      data-testid={`message-attached-image-${index}`}
    >
      {mediaSrc && !loadFailed ? (
        <img
          src={mediaSrc}
          alt={getFileName(image.path)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          onLoad={() => setLoadFailed(false)}
          onError={() => setLoadFailed(true)}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
          }}
          aria-hidden="true"
        >
          <div
            className={mediaSrc ? '' : 'animate-spin'}
            style={{
              width: 18,
              height: 18,
              borderRadius: '999px',
              border: '2px solid var(--border-subtle)',
              borderTopColor: 'var(--text-muted)',
            }}
          />
        </div>
      )}
    </div>
  );
};

const AttachedImageRow: React.FC<{
  images: { path: string; url: string }[];
  onOpen: (path: string) => void;
}> = ({ images, onOpen }) => {
  const count = images.length;
  const maxH = count <= 2 ? 160 : count <= 4 ? 120 : 80;

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: '100%' }} data-testid="message-attached-images">
      {images.map((img, i) => (
        <AttachedImageThumb
          key={i}
          image={img}
          index={i}
          maxHeight={maxH}
          maxWidth={count === 1 ? 280 : count === 2 ? 200 : 160}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
};

// ========== 上传文件附件行（非图片）==========

const AttachedFileRow: React.FC<{
  files: { path: string; name: string }[];
  onOpen: (path: string) => void;
}> = ({ files, onOpen }) => (
  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: '100%' }} data-testid="message-attached-files">
    {files.map((f, i) => {
      const cat = getAttachFileCategory(f.name);
      const accent = getAttachAccent(cat);
      return (
        <div
          key={i}
          className="message-attached-file"
          onClick={() => onOpen(f.path)}
          title={f.name}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 12px', borderRadius: 10,
            background: 'var(--file-card-bg)',
            cursor: 'pointer', maxWidth: 220, minWidth: 0,
            border: `1px solid color-mix(in srgb, ${accent} 18%, transparent)`,
            transition: 'background 0.15s, border-color 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = `color-mix(in srgb, ${accent} 10%, var(--file-card-bg))`;
            e.currentTarget.style.borderColor = `color-mix(in srgb, ${accent} 30%, transparent)`;
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'var(--file-card-bg)';
            e.currentTarget.style.borderColor = `color-mix(in srgb, ${accent} 18%, transparent)`;
          }}
          data-testid={`message-attached-file-${i}`}
        >
          <AttachFileIcon category={cat} size={16} />
          <span style={{
            fontSize: 12, fontWeight: 500, color: 'var(--text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{f.name}</span>
        </div>
      );
    })}
  </div>
);

// ========== 解析并渲染用户消息内容 ==========

interface ParsedUserContent {
  textParts: { type: 'text'; content: string }[];
  refParts: ({ type: 'file_ref'; fileName: string; fileId?: string } | { type: 'file_segment'; fileName: string; lineRange: string; fileId?: string })[];
  uploadedFiles: string[];
}

export function parseUserContent(content: string): ParsedUserContent {
  type Part = { type: 'text'; content: string }
    | { type: 'file'; content: string }
    | { type: 'file_ref'; fileName: string; fileId?: string }
    | { type: 'file_segment'; fileName: string; lineRange: string; fileId?: string };

  let processed = content;
  const newFormatRegex = /\[\[UPLOADED_FILES\]\]\n([\s\S]*?)(?=\n\n|$)/g;
  let nfm;
  while ((nfm = newFormatRegex.exec(content)) !== null) {
    const files: string[] = [];
    const lines = nfm[1].split('\n');
    for (const line of lines) {
      if (!line.startsWith('- ')) continue;
      let raw = line.substring(2);
      if (raw.startsWith('文件: ') || raw.startsWith('文件:')) {
        raw = raw.replace(/^文件:\s*/, '');
      }
      const pipeIdx = raw.indexOf(' | 路径: ');
      if (pipeIdx !== -1) raw = raw.substring(0, pipeIdx);
      const toolHintIdx = raw.indexOf(' → ');
      if (toolHintIdx !== -1) raw = raw.substring(0, toolHintIdx);
      const parenIdx = raw.indexOf(' (execute_python');
      if (parenIdx !== -1) raw = raw.substring(0, parenIdx);
      const name = raw.trim();
      if (name && !name.startsWith('提示')) files.push(name);
    }
    processed = processed.replace(nfm[0], files.map(f => `[[UPLOADED_FILE:${f}]]`).join('\n'));
  }
  processed = processed.replace(/\[\[REF_CONTEXT\]\][\s\S]*?\[\[\/REF_CONTEXT\]\]/g, '');
  processed = processed.replace(/(\[\[FILE_REF:\s*[^\]]+\]\])\n\(文件路径:[^\)]*\)\n?/g, '$1');
  processed = processed.replace(/(\[\[FILE_REF:\s*[^\]]+\]\])\n\(read:[^\)]*\)\n?/g, '$1');
  processed = processed.replace(
    /\[\[FILE_SEGMENT:\s*([^\]]+?)\s+(L\d+-\d+)\]\]\n[\s\S]*?(?=\n\n|\[\[|$)/g,
    '[[FILE_SEGMENT:$1:$2]]',
  );

  const tokenRegex = /\[\[UPLOADED_FILE:([^\]]+)\]\]|\[\[FILE_REF:([^:\]]+)(?::([^\]]+))?\]\]|\[\[FILE_SEGMENT:([^:]+):(L\d+-\d+)(?::([^\]]+))?\]\]/g;
  let lastIndex = 0;
  let m;
  const allParts: Part[] = [];
  while ((m = tokenRegex.exec(processed)) !== null) {
    if (m.index > lastIndex) {
      const text = processed.slice(lastIndex, m.index).trim();
      if (text) allParts.push({ type: 'text', content: text });
    }
    if (m[1]) {
      allParts.push({ type: 'file', content: m[1] });
    } else if (m[2]) {
      const fid = m[3]?.startsWith('f_') ? m[3] : undefined;
      allParts.push({ type: 'file_ref', fileName: m[2].trim(), fileId: fid });
    } else if (m[4] && m[5]) {
      const fid = m[6]?.startsWith('f_') ? m[6] : undefined;
      allParts.push({ type: 'file_segment', fileName: m[4].trim(), lineRange: m[5], fileId: fid });
    }
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < processed.length) {
    const text = processed.slice(lastIndex).trim();
    if (text) allParts.push({ type: 'text', content: text });
  }

  const textParts: ParsedUserContent['textParts'] = [];
  const refParts: ParsedUserContent['refParts'] = [];
  const uploadedFiles: string[] = [];

  for (const p of allParts) {
    if (p.type === 'text') textParts.push(p);
    else if (p.type === 'file') uploadedFiles.push(p.content);
    else if (p.type === 'file_ref') refParts.push(p);
    else if (p.type === 'file_segment') refParts.push(p);
  }

  return { textParts, refParts, uploadedFiles };
}

interface UserMessageContentProps {
  content: string;
  displayContent?: string;
  agentId: string | null;
  sessionId: string | null;
}

const FileRefChip: React.FC<{
  fileName: string; isSegment?: boolean; lineRange?: string;
  fileId?: string;
}> = ({ fileName, isSegment, lineRange, fileId }) => {
  const openFile = usePreviewStore(s => s.openFile);
  const handleClick = useCallback(() => {
    if (!fileName) return;
    openFile({ name: fileName, path: fileName, fileId });
  }, [fileName, fileId, openFile]);

  return (
    <span
      onClick={handleClick}
      className="inline-flex items-center gap-1.5"
      style={{
        padding: '3px 10px', borderRadius: 8, fontSize: 12, fontWeight: 500,
        background: 'var(--accent-bg)', color: 'var(--file-link-color)',
        verticalAlign: 'middle', cursor: 'pointer',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--selected-bg)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent-bg)')}
      data-testid="message-file-ref-chip"
    >
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <path d="M9 2H4.5A1.5 1.5 0 0 0 3 3.5v9A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5V6L9 2Z" />
        <path d="M9 2v4h4" />
      </svg>
      {fileName}{isSegment && lineRange ? ` ${lineRange}` : ''}
    </span>
  );
};

const UserMessageContent: React.FC<UserMessageContentProps> = ({ content, displayContent }) => {
  const parsed = useMemo(() => parseUserContent(content), [content]);
  const visibleContent = (displayContent || content || '').trim();
  const dashboardChip = dashboardDisplayParts(visibleContent);
  if (dashboardChip) {
    return <DashboardAskChip text={visibleContent} />;
  }
  if ((displayContent || '').trim()) {
    return <div className="whitespace-pre-wrap" data-testid="user-message-display-text">{visibleContent}</div>;
  }

  if (parsed.textParts.length === 0 && parsed.refParts.length === 0 && parsed.uploadedFiles.length === 0) {
    return <div className="whitespace-pre-wrap">{content}</div>;
  }

  return (
    <div data-testid="user-message-content">
      {parsed.refParts.length > 0 && (
        <div className="flex flex-wrap gap-1.5" style={{ marginBottom: parsed.textParts.length > 0 ? 8 : 0 }} data-testid="user-message-ref-list">
          {parsed.refParts.map((p, i) =>
            p.type === 'file_ref' ? (
              <FileRefChip key={i} fileName={p.fileName} fileId={p.fileId} />
            ) : (
              <FileRefChip key={i} fileName={p.fileName} isSegment lineRange={p.lineRange} fileId={p.fileId} />
            ),
          )}
        </div>
      )}
      {parsed.textParts.map((part, i) => (
        <div key={i} className="whitespace-pre-wrap" data-testid="user-message-text">{part.content}</div>
      ))}
    </div>
  );
};

// ========== 附件区域（消息气泡上方）==========

const UserAttachments: React.FC<{ content: string; agentId: string | null; sessionId: string | null }> = ({ content, agentId, sessionId }) => {
  const openFile = usePreviewStore(s => s.openFile);
  const parsed = useMemo(() => parseUserContent(content), [content]);

  const handleOpenFile = useCallback((filePath: string) => {
    const name = getFileName(filePath);
    const actualPath = parseFilePath(filePath);
    if (filePath.startsWith('sessions/')) {
      openFile({ name, path: actualPath, level: 'session' });
    } else {
      openFile({ name, path: actualPath, level: sessionId ? 'session' : 'agent-shared' });
    }
  }, [openFile, sessionId]);

  if (parsed.uploadedFiles.length === 0) return null;

  const images = parsed.uploadedFiles.filter(p => isImagePath(p));
  const others = parsed.uploadedFiles.filter(p => !isImagePath(p));

  const buildUrl = (p: string) => {
    const name = getFileName(p);
    if (p.startsWith('sessions/')) return buildFileUrl(p, agentId);
    if (sessionId && agentId) return `/api/v1/agents/${agentId}/sessions/${sessionId}/files/${name}`;
    return buildFileUrl(p, agentId);
  };

  const imageItems = images.map(p => ({ path: p, url: buildUrl(p) }));
  const fileItems = others.map(p => ({ path: p, name: getFileName(p) }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 6 }} data-testid="message-attachments">
      {imageItems.length > 0 && (
        <AttachedImageRow images={imageItems} onOpen={handleOpenFile} />
      )}
      {fileItems.length > 0 && (
        <AttachedFileRow files={fileItems} onOpen={handleOpenFile} />
      )}
    </div>
  );
};

// 任务完成角标图标
const TaskCompleteBadge: React.FC = () => (
  <div 
    className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg"
    title="任务已完成"
  >
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-white">
      <path 
        d="M20 6L9 17l-5-5" 
        stroke="currentColor" 
        strokeWidth="3" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
    </svg>
  </div>
);

interface MessageBubbleProps {
  message: ChatMessage;
  isLast?: boolean;
  onQuestionSubmit?: (answers: Record<string, string | string[]>, questionData?: import('../../types').QuestionData) => boolean | void | Promise<boolean | void>;
}

export const MessageBubble: React.FC<MessageBubbleProps> = memo(({
  message,
  isLast = false,
  onQuestionSubmit,
}) => {
  const selectedAgentId = useAgentContextStore(s => s.currentAgentId);
  const currentSessionId = useAgentStore(s => s.currentSessionId);
  const currentAgent = useAgentContextStore(s => s.getCurrentAgent());
  const isUser = message.role === 'user';
  const isStreaming = message.isStreaming && isLast;
  const hasQuestion = message.questionData && message.role === 'assistant';
  
  // 检测并处理 [[TASK_COMPLETE]] 标记
  const { displayContent, isTaskComplete } = useMemo(() => {
    const taskCompletePattern = /\[\[TASK_COMPLETE\]\]/g;
    const hasTaskComplete = taskCompletePattern.test(message.content);
    // 移除标记并清理多余空白
    const rawDisplayContent = isUser && message.displayContent ? message.displayContent : message.content;
    const cleanedContent = rawDisplayContent
      .replace(taskCompletePattern, '')
      .trim();
    return {
      displayContent: cleanedContent,
      isTaskComplete: hasTaskComplete && !isUser,
    };
  }, [message.content, message.displayContent, isUser]);

  // 用户消息仅包含附件（无文字、无引用）时，气泡内部会完全为空，
  // 加上 padding + borderRadius 会塌缩成一个灰色圆圈。此时跳过气泡外壳。
  const isEmptyUserBubble = useMemo(() => {
    if (!isUser) return false;
    if (isStreaming) return false;
    if (message.questionnaireReply?.items?.length || message.questionnaireReply?.status === 'submitted') return false;
    if (message.displayContent?.trim()) return false;
    const parsed = parseUserContent(message.content);
    return parsed.textParts.length === 0 && parsed.refParts.length === 0;
  }, [isUser, isStreaming, message.content, message.displayContent, message.questionnaireReply]);
  const isDashboardChipUserBubble = isUser && Boolean(dashboardDisplayParts(message.displayContent || message.content || ''));
  const isDisplayOnlyUserBubble = isUser && (Boolean(message.displayContent?.trim()) || isDashboardChipUserBubble);
  
  // 如果是问卷消息，渲染问卷卡片
  if (hasQuestion && message.questionData) {
    return (
      <div
        className="flex flex-row"
        style={{ gap: 12 }}
        data-testid="assistant-question-message"
      >
        {/* Agent 头像 */}
        <ChatAgentMark size={24} agent={currentAgent} />
        
        {/* 问卷卡片 */}
        <div className="flex flex-col flex-1" style={{ maxWidth: '100%', minWidth: 0 }}>
          {/* 名称 + 时间 */}
          <div className="flex items-center" style={{ gap: 8, marginBottom: 6, paddingLeft: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
              {getAgentDisplayName(currentAgent)}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {formatRelativeTime(message.timestamp)}
            </span>
          </div>
          <QuestionCard
            data={message.questionData}
            messageId={message.id}
            header={message.content || undefined}  // Agent 的 thought 作为问卷 header
            onSubmit={(answers) => onQuestionSubmit?.(answers, message.questionData)}
            disabled={!isLast} // 只有最后一条消息的问卷可以交互
          />
        </div>
      </div>
    );
  }
  
  return (
    <div
      className={`message-bubble ${isUser ? 'user-message-bubble flex-row-reverse' : 'assistant-message-bubble flex-row'} flex`}
      style={{ gap: 12 }}
      data-testid={isUser ? 'user-message-bubble' : 'assistant-message-bubble'}
    >
      {!isUser && <ChatAgentMark size={24} agent={currentAgent} />}
      
      {/* 消息内容 */}
      <div
        className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
        style={{ maxWidth: isUser ? '82%' : '100%', minWidth: 0 }}
      >
        {/* 角色标签 + 时间 */}
        <div className={`flex items-center ${isUser ? 'flex-row-reverse' : ''}`} style={{ gap: 8, marginBottom: 6, paddingLeft: isUser ? 0 : 2, paddingRight: isUser ? 2 : 0 }}>
          {!isUser && (
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
              {getAgentDisplayName(currentAgent)}
            </span>
          )}
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {formatRelativeTime(message.timestamp)}
          </span>
        </div>
        
        {/* 上传文件附件 — 在气泡上方展示 */}
        {isUser && (
          <UserAttachments content={message.content} agentId={selectedAgentId} sessionId={currentSessionId} />
        )}

        {/* 消息体 - 圆角16px, 内边距14px。仅附件无文字的用户消息跳过气泡，避免塌缩为灰圆。 */}
        {!isEmptyUserBubble && (
          <div
            className={`message-bubble-body ${isUser ? 'user-message-body' : 'assistant-message-body'} relative`}
            style={{
              padding: isDisplayOnlyUserBubble ? 0 : isUser ? '12px 16px' : 14,
              borderRadius: isDisplayOnlyUserBubble ? 0 : isUser ? 6 : 12,
              background: isDisplayOnlyUserBubble ? 'transparent' : isUser ? 'var(--bubble-user)' : 'var(--bubble-agent)',
              border: isDisplayOnlyUserBubble || isUser ? 'none' : '1px solid var(--border-muted)',
              color: 'var(--text-secondary)',
            }}
            data-testid={isUser ? 'user-message-body' : 'assistant-message-body'}
          >
            {/* 思考中状态 */}
            {isStreaming && !displayContent ? (
              <ThinkingIndicator />
            ) : (
              <div className="break-words" style={{ fontSize: 14, lineHeight: 1.6 }}>
                {isUser ? (
                  message.questionnaireReply?.items?.length || message.questionnaireReply?.status === 'submitted' ? (
                    <QuestionnaireReplyCard data={message.questionnaireReply} />
                  ) : (
                    <UserMessageContent
                      content={message.content}
                      displayContent={message.displayContent}
                      agentId={selectedAgentId}
                      sessionId={currentSessionId}
                    />
                  )
                ) : (
                  <MarkdownContent content={displayContent} />
                )}
                {isStreaming && (
                  <motion.span
                    className="inline-block w-2 h-4 ml-1 bg-current"
                    animate={{ opacity: [1, 0] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                  />
                )}
              </div>
            )}

            {/* 任务完成角标 */}
            {isTaskComplete && <TaskCompleteBadge />}
          </div>
        )}
      </div>
    </div>
  );
});

// 格式化相对时间 - "刚刚"、"2分钟前" 等
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;
  
  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
  });
}
