/**
 * Markdown 内容渲染组件
 * 
 * 使用 react-markdown 渲染 Markdown 内容，支持：
 * - GFM (GitHub Flavored Markdown)
 * - 代码语法高亮
 * - 表格、任务列表等扩展语法
 * - 点击文件路径在工作室中预览
 */

import React, { memo, useCallback, useDeferredValue, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const remarkPluginsStable = [remarkGfm];
import { SyntaxHighlighter } from '../../lib/syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useMediaUrl } from '../../lib/media';
import { useTheme } from '../common/ThemeProvider';
import { userFileDownloadUrl } from '../../api/userFiles';
import { usePreviewStore } from '../../stores/previewStore';
import { useAgentStore } from '../../stores/agentStore';
import { useAgentContextStore } from '../../stores/agentContextStore';
import { useTenantStore } from '../../stores/tenantStore';
import { ChartRenderer } from '../common/ChartRenderer';
import { extractOversizedCodeBlocks, OversizedCodeBlock } from './OversizedCodeBlock';
import {
  normalizeMarkdownTables,
  normalizeCjkEmphasis,
  normalizeLooseEmphasis,
  normalizeIsolatedListMarkers,
} from '../../lib/wsContentParsers';

// 常见文件扩展名列表
const FILE_EXTENSIONS = [
  // 文档
  'md', 'txt', 'pdf', 'doc', 'docx', 'ppt', 'pptx', 'rtf',
  // 表格
  'csv', 'xlsx', 'xls',
  // 代码
  'py', 'js', 'ts', 'tsx', 'jsx', 'json', 'html', 'css', 'scss', 'less',
  'java', 'c', 'cpp', 'h', 'go', 'rs', 'rb', 'php', 'sh', 'bash', 'zsh',
  'sql', 'yaml', 'yml', 'toml', 'xml', 'ini', 'conf', 'env',
  // 图片
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'bmp',
  // 音视频
  'mp3', 'wav', 'ogg', 'mp4', 'webm', 'avi', 'mov',
  // 其他
  'zip', 'tar', 'gz', 'rar', '7z',
];

// 判断是否为文件路径
const isFilePath = (text: string): boolean => {
  if (!text || typeof text !== 'string') return false;
  
  // react-markdown 会对中文 href 做 URI 编码。文件类型和长度必须按
  // 解码后的逻辑路径判断，否则较长中文路径会因编码膨胀被误判为普通链接。
  const trimmed = safeDecodeURI(text.trim());
  
  // 排除 URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('//')) {
    return false;
  }
  
  // 排除过长的文本（可能是句子）
  if (trimmed.length > 200) return false;
  
  // 优先检查文件扩展名（确保 "大熊猫.png" 等中文文件名也能被识别）
  const ext = trimmed.split('.').pop()?.toLowerCase();
  if (ext && FILE_EXTENSIONS.includes(ext)) {
    return true;
  }
  
  // 排除纯中文且无路径分隔符、无已知扩展名的文本
  if (/[\u4e00-\u9fa5]/.test(trimmed) && !trimmed.includes('/')) {
    return false;
  }
  
  // 检查是否包含路径分隔符且看起来像路径
  if ((trimmed.includes('/') || trimmed.includes('\\')) && 
      !trimmed.includes(' ') && 
      trimmed.length < 100) {
    // 检查最后一段是否有扩展名
    const lastPart = trimmed.split(/[/\\]/).pop() || '';
    const lastExt = lastPart.split('.').pop()?.toLowerCase();
    if (lastExt && FILE_EXTENSIONS.includes(lastExt)) {
      return true;
    }
  }
  
  return false;
};

const isInternalRawTempPath = (text: string): boolean => {
  if (!text || typeof text !== 'string') return false;

  const normalized = safeDecodeURI(text.trim())
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');

  return normalized.startsWith('tmp/qila_raw/') || normalized.includes('/tmp/qila_raw/');
};

// 从路径中提取文件名
const getFileName = (path: string): string => {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
};

function parseSkillFilePath(rawPath: string): { skillId: string; filePath: string } | null {
  const normalized = safeDecodeURI(rawPath.trim()).replace(/\\/g, '/').replace(/^\/+/, '');
  const prefixes = ['workspace/skills/', 'skills/'];
  for (const prefix of prefixes) {
    if (!normalized.startsWith(prefix)) continue;
    const rest = normalized.slice(prefix.length);
    const slashIndex = rest.indexOf('/');
    if (slashIndex <= 0) return null;
    const skillId = rest.slice(0, slashIndex);
    const filePath = rest.slice(slashIndex + 1);
    if (!skillId || !filePath) return null;
    if (filePath === 'SKILL.md' || filePath.startsWith('scripts/') || filePath.startsWith('references/')) {
      return { skillId, filePath };
    }
    return null;
  }
  return null;
}

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico']);

function isRelativeImagePath(src: string | undefined): boolean {
  if (!src) return false;
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:') || src.startsWith('blob:')) {
    return false;
  }
  if (src.startsWith('/api/')) return false;
  const ext = src.split('.').pop()?.toLowerCase().split('?')[0];
  return ext ? IMAGE_EXTENSIONS.has(ext) : false;
}

function safeDecodeURI(s: string): string {
  try { return decodeURIComponent(s); } catch { return s; }
}

function encodeFilePath(path: string): string {
  const decoded = safeDecodeURI(path);
  return decoded.split('/').map(seg => encodeURIComponent(seg)).join('/');
}

function buildAgentFileUrl(
  actualPath: string,
  level: 'session' | 'agent-shared',
  agentId: string | null,
  sessionId: string | null,
): string {
  if (!agentId) return actualPath;
  const encodedPath = encodeFilePath(actualPath);
  if (level === 'session' && sessionId) {
    return `/api/v1/agents/${agentId}/sessions/${sessionId}/files/${encodedPath}`;
  }
  return `/api/v1/agents/${agentId}/files/${encodedPath}`;
}

const InlineImage: React.FC<{
  src: string;
  alt: string;
  onClickOpen?: (path: string) => void;
}> = ({ src, alt, onClickOpen }) => {
  const [error, setError] = useState(false);
  const mediaSrc = useMediaUrl(src);

  return (
    <span className="block my-3 relative">
      {error ? (
        <span
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer hover:opacity-80 transition-opacity"
          style={{
            background: 'var(--inline-code-bg)',
            color: 'var(--file-link-color)',
            border: '1px solid var(--border-subtle)',
          }}
          onClick={() => onClickOpen?.(alt || src)}
          title="点击在我的文件中预览"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          {alt || src.split('/').pop()}
        </span>
      ) : (
        <img
          src={mediaSrc}
          alt={alt || ''}
          className="rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
          style={{
            maxWidth: 520,
            maxHeight: 480,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
          onError={() => setError(true)}
          onClick={() => onClickOpen?.(alt || src)}
          title="点击在我的文件中预览"
        />
      )}
    </span>
  );
};

interface MarkdownContentProps {
  content: string;
  className?: string;
  realtime?: boolean;
}

// 复制按钮组件
const CopyButton: React.FC<{ code: string }> = ({ code }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 px-2 py-1 text-xs rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-400 hover:text-zinc-200 transition-colors"
    >
      {copied ? '已复制' : '复制'}
    </button>
  );
};

export const MarkdownContent: React.FC<MarkdownContentProps> = memo(({
  content,
  className = '',
  realtime = false,
}) => {
  const { theme } = useTheme();
  const syntaxTheme = theme === 'light' ? oneLight : oneDark;
  const openFile = usePreviewStore(s => s.openFile);
  const openFolder = usePreviewStore(s => s.openFolder);
  const selectedAgentId = useAgentContextStore((s) => s.currentAgentId);
  const currentSessionId = useAgentStore((s) => s.currentSessionId);
  const tenantId = useTenantStore((s) => s.currentWorkspace?.tenantId);

  // 流式场景下 content 每帧都在变，remark-gfm + Prism 整树重算成本高。
  // useDeferredValue 把 markdown 重渲染标记为低优先级——若上一次 AST 重建尚未
  // commit，后续 rAF 送来的更新会被 React 跳过中间态，只渲染最新 content。
  // 效果：字符揭示不被长渲染阻塞，感官上更丝滑；CPU 占用也显著下降。
  const deferredContent = useDeferredValue(content);
  const renderContent = realtime ? content : deferredContent;
  const extractedContent = useMemo(
    () => extractOversizedCodeBlocks(renderContent),
    [renderContent],
  );
  const normalizedContent = useMemo(
    () => normalizeMarkdownTables(
      normalizeIsolatedListMarkers(
        normalizeCjkEmphasis(normalizeLooseEmphasis(extractedContent.markdown)),
      ),
    ),
    [extractedContent.markdown],
  );

  // 在工作室中打开文件：
  // - 会话文件链接即使位于子目录，也直接打开文件预览
  // - 其他子目录文件保持 openFolder（文件夹标签 + initialFile 选中）
  // - 根目录裸文件 → openFile（单文件标签）
  const openInWorkspace = useCallback((actualPath: string, level: 'session' | 'agent-shared' | 'user-file') => {
    const parts = actualPath.split('/');
    if (level === 'user-file' || (level === 'session' && isFilePath(actualPath)) || parts.length < 2) {
      openFile({
        name: getFileName(actualPath),
        path: actualPath,
        level,
      });
      return;
    }

    if (parts.length >= 2) {
      const folderName = parts[0];
      openFolder({
        name: folderName,
        path: folderName,
        assetType: 'folder',
        level,
        initialFile: actualPath,
      });
    }
  }, [openFile, openFolder]);

  const resolveWorkspaceFileTarget = useCallback((rawPath: string): { actualPath: string; level: 'session' | 'agent-shared' | 'user-file' } => {
    const filePath = safeDecodeURI(rawPath.trim());
    const stripped = filePath.replace(/^\/+/, '');
    let actualPath = stripped;
    // Generated file links are usually emitted as bare relative paths, while
    // personal files are explicitly addressed with the files/ prefix.
    let level: 'session' | 'agent-shared' | 'user-file' = 'session';

    const sessionFilesMatch = filePath.match(/\/sessions\/[^/]+\/files\/(.+)$/);
    if (sessionFilesMatch) {
      actualPath = sessionFilesMatch[1];
      level = 'session';
      return { actualPath, level };
    }

    const sharedFilesMatch = filePath.match(/\/agents\/[^/]+\/files\/(.+)$/);
    if (sharedFilesMatch) {
      actualPath = sharedFilesMatch[1];
      level = 'agent-shared';
      return { actualPath, level };
    }

    const userFilesMatch = filePath.match(/\/users\/[^/]+\/files\/(.+)$/);
    if (userFilesMatch) {
      actualPath = userFilesMatch[1];
      level = 'user-file';
      return { actualPath, level };
    }

    if (stripped.startsWith('files/')) {
      actualPath = stripped.slice(6);
      level = 'user-file';
      return { actualPath, level };
    }

    if (stripped.startsWith('shared/')) {
      actualPath = stripped.slice(7);
      level = 'agent-shared';
      return { actualPath, level };
    }

    if (stripped.startsWith('users/')) {
      const parts = stripped.split('/');
      if (parts.length >= 4 && parts[2] === 'files') {
        actualPath = parts.slice(3).join('/');
        level = 'user-file';
        return { actualPath, level };
      }
    }

    if (stripped.startsWith('sessions/')) {
      const parts = stripped.split('/');
      if (parts.length >= 4 && parts[2] === 'files') {
        actualPath = parts.slice(3).join('/');
      }
      level = 'session';
      return { actualPath, level };
    }

    return { actualPath, level };
  }, []);
  
  // 处理文件路径点击
  const handleFileClick = useCallback((rawPath: string) => {
    const filePath = safeDecodeURI(rawPath.trim());
    const skillFile = parseSkillFilePath(filePath);
    if (skillFile) {
      const detail = { ...skillFile, handled: false };
      window.dispatchEvent(new CustomEvent('open-skill-file', { detail }));
      if (detail.handled) return;
    }
    const { actualPath, level } = resolveWorkspaceFileTarget(filePath);
    openInWorkspace(actualPath, level);
  }, [openInWorkspace, resolveWorkspaceFileTarget]);
  
  const mdComponents = useMemo(() => ({
    code({ node, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : '';
      const codeString = String(children).replace(/\n$/, '');
      const isCodeBlock = match || codeString.includes('\n');
      const oversizedBlock = extractedContent.blocks.get(codeString.trim());

      if (oversizedBlock) {
        return (
          <OversizedCodeBlock
            code={oversizedBlock.code}
            language={oversizedBlock.language || language}
          />
        );
      }
      
      if (language === 'charts' || language === 'chart') {
        return <ChartRenderer data={codeString} />;
      }

      if (isCodeBlock) {
        return (
          <div className="relative group my-3 rounded-lg overflow-hidden code-block-container" style={{ background: 'var(--code-block-bg)', border: '1px solid var(--code-block-border)' }}>
            {language && (
              <div className="flex items-center justify-between px-4 py-2" style={{ background: 'var(--code-block-header)', borderBottom: '1px solid var(--code-block-border)' }}>
                <span className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>{language}</span>
              </div>
            )}
            <CopyButton code={codeString} />
            <SyntaxHighlighter
              style={syntaxTheme}
              language={language || 'text'}
              PreTag="div"
              customStyle={{
                margin: 0,
                padding: '1rem',
                background: 'transparent',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              {codeString}
            </SyntaxHighlighter>
          </div>
        );
      }

      const codeText = String(children);
      const isFile = isFilePath(codeText);
      
      if (isFile && !isInternalRawTempPath(codeText)) {
        return (
          <code
            className="px-1.5 py-0.5 mx-0.5 rounded font-mono text-sm inline-code cursor-pointer hover:opacity-80 transition-opacity"
            style={{ 
              background: 'var(--inline-code-bg)', 
              color: 'var(--file-link-color)',
              textDecoration: 'underline',
              textDecorationStyle: 'dotted' as const,
              textUnderlineOffset: '2px',
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleFileClick(codeText);
            }}
            title="点击在我的文件中预览"
            {...props}
          >
            {children}
          </code>
        );
      }
      
      return (
        <code
          className="px-1.5 py-0.5 mx-0.5 rounded font-mono text-sm inline-code"
          style={{ background: 'var(--inline-code-bg)', color: 'var(--inline-code-color)' }}
          {...props}
        >
          {children}
        </code>
      );
    },

    p({ children }: any) {
      return <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>;
    },

    h1({ children }: any) {
      return <h1 className="text-xl font-bold mb-3 mt-4 first:mt-0" style={{ color: 'var(--text-primary)' }}>{children}</h1>;
    },
    h2({ children }: any) {
      return <h2 className="text-lg font-bold mb-2 mt-4 first:mt-0" style={{ color: 'var(--text-primary)' }}>{children}</h2>;
    },
    h3({ children }: any) {
      return <h3 className="text-base font-semibold mb-2 mt-3 first:mt-0" style={{ color: 'var(--text-primary)' }}>{children}</h3>;
    },
    h4({ children }: any) {
      return <h4 className="text-sm font-semibold mb-2 mt-3 first:mt-0" style={{ color: 'var(--text-secondary)' }}>{children}</h4>;
    },

    ul({ children }: any) {
      return <ul className="mb-3 space-y-1" style={{ listStyleType: 'disc', listStylePosition: 'outside', paddingLeft: '1.5rem' }}>{children}</ul>;
    },
    ol({ children }: any) {
      return <ol className="mb-3 space-y-1" style={{ listStyleType: 'decimal', listStylePosition: 'outside', paddingLeft: '1.5rem' }}>{children}</ol>;
    },
    li({ children }: any) {
      return <li style={{ color: 'var(--text-secondary)', paddingLeft: 4 }}>{children}</li>;
    },

    blockquote({ children }: any) {
      return (
        <blockquote className="border-l-4 border-zinc-600 pl-4 my-3 italic" style={{ color: 'var(--text-tertiary)' }}>
          {children}
        </blockquote>
      );
    },

    a({ href, children }: any) {
      const hrefStr = href || '';
      const isExternal = /^https?:\/\//.test(hrefStr) || hrefStr.startsWith('//') || hrefStr.startsWith('mailto:');
      const childText = typeof children === 'string' ? children : Array.isArray(children) ? children.map((c: any) => (typeof c === 'string' ? c : '')).join('') : '';
      const isHiddenTempFile = isInternalRawTempPath(hrefStr) || isInternalRawTempPath(childText);
      const looksLikeFile = !isExternal && (isFilePath(hrefStr) || isFilePath(childText));

      if (isHiddenTempFile) {
        return <span>{children}</span>;
      }

      if (looksLikeFile) {
        return (
          <span
            className="underline underline-offset-2 cursor-pointer hover:opacity-80 transition-opacity"
            data-file-path={safeDecodeURI(hrefStr || childText)}
            style={{ color: 'var(--file-link-color, var(--text-secondary))' }}
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              handleFileClick(hrefStr || childText);
            }}
            title="点击在我的文件中预览"
          >
            {children}
          </span>
        );
      }

      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2"
          style={{ color: 'var(--text-secondary)' }}
        >
          {children}
        </a>
      );
    },

    table({ children }: any) {
      return (
        <div className="overflow-x-auto my-3">
          <table className="min-w-full border-collapse rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
            {children}
          </table>
        </div>
      );
    },
    thead({ children }: any) {
      return <thead style={{ background: 'var(--table-header-bg)' }}>{children}</thead>;
    },
    tbody({ children }: any) {
      return <tbody className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>{children}</tbody>;
    },
    tr({ children }: any) {
      return <tr className="hover:bg-zinc-800/30 transition-colors">{children}</tr>;
    },
    th({ children }: any) {
      return (
        <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
          {children}
        </th>
      );
    },
    td({ children }: any) {
      return <td className="px-4 py-2 text-sm" style={{ color: 'var(--text-tertiary)' }}>{children}</td>;
    },

    hr() {
      return <hr className="my-4" style={{ borderColor: 'var(--border-subtle)' }} />;
    },

    strong({ children }: any) {
      return <strong className="font-semibold" style={{ color: 'var(--text-primary)' }}>{children}</strong>;
    },
    em({ children }: any) {
      return <em className="italic" style={{ color: 'var(--text-secondary)' }}>{children}</em>;
    },

    del({ children }: any) {
      return <del className="line-through" style={{ color: 'var(--text-muted)' }}>{children}</del>;
    },

    img({ src, alt }: any) {
      let resolvedSrc = src || '';
      const rawPath = src || '';
      const { actualPath, level } = resolveWorkspaceFileTarget(rawPath);

      if (isRelativeImagePath(rawPath)) {
        if (level === 'user-file') {
          resolvedSrc = userFileDownloadUrl({ tenantId: tenantId ?? undefined, path: actualPath, disposition: 'inline', thumb: true });
        } else {
          const baseUrl = buildAgentFileUrl(actualPath, level, selectedAgentId, currentSessionId);
          resolvedSrc = baseUrl.includes('?') ? `${baseUrl}&thumb=true` : `${baseUrl}?thumb=true`;
        }
      }

      return (
        <InlineImage
          src={resolvedSrc}
          alt={alt || ''}
          onClickOpen={() => {
            openInWorkspace(actualPath, level);
          }}
        />
      );
    },

    input({ checked, ...props }: any) {
      return (
        <input
          type="checkbox"
          checked={checked}
          readOnly
          className="mr-2 rounded border-zinc-600"
          {...props}
        />
      );
    },
  }), [syntaxTheme, handleFileClick, openInWorkspace, resolveWorkspaceFileTarget, selectedAgentId, currentSessionId, tenantId, extractedContent.blocks]);

  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={remarkPluginsStable}
        components={mdComponents}
      >
        {normalizedContent}
      </ReactMarkdown>
    </div>
  );
});

MarkdownContent.displayName = 'MarkdownContent';
