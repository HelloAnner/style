/**
 * 超大 fenced code block 的轻量查看器。
 *
 * 大块原始数据不进入 Prism，也不一次性创建全量 DOM；默认提供摘要，用户可按页浏览和复制完整原文。
 */

import React, { memo, useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Copy, Maximize2, Minimize2 } from 'lucide-react';

export const OVERSIZED_CODE_BLOCK_MIN_CHARS = 100_000;

const PREVIEW_MAX_LINES = 1_000;
const PREVIEW_MAX_CHARS = 128 * 1024;
const PAGE_MAX_LINES = 2_000;
const PAGE_MAX_CHARS = 256 * 1024;

const OVERSIZED_FENCE_RE = /(^|\n)([ \t]{0,3})(?:(`{3,})([^`\r\n]*)\r?\n([\s\S]*?)\r?\n[ \t]{0,3}\3`*[ \t]*|(~{3,})([^\r\n]*)\r?\n([\s\S]*?)\r?\n[ \t]{0,3}\6~*[ \t]*)(?=\r?\n|$)/g;

interface OversizedCodeBlockData {
  code: string;
  language: string;
}

export interface ExtractedOversizedCodeBlocks {
  markdown: string;
  blocks: Map<string, OversizedCodeBlockData>;
}

interface CodePage {
  start: number;
  end: number;
  startLine: number;
  endLine: number;
}

interface OversizedCodeBlockProps {
  code: string;
  language?: string;
}

/**
 * 在 Markdown 解析前把超大 fenced code block 替换为占位符，避免完整原文进入 remark 和 Prism。
 */
export function extractOversizedCodeBlocks(markdown: string): ExtractedOversizedCodeBlocks {
  const blocks = new Map<string, OversizedCodeBlockData>();
  if (markdown.length <= OVERSIZED_CODE_BLOCK_MIN_CHARS) {
    return { markdown, blocks };
  }

  const compacted = markdown.replace(
    OVERSIZED_FENCE_RE,
    (
      whole,
      prefix: string,
      indent: string,
      backtickFence: string | undefined,
      backtickInfo: string | undefined,
      backtickCode: string | undefined,
      tildeFence: string | undefined,
      tildeInfo: string | undefined,
      tildeCode: string | undefined,
    ) => {
      const fence = backtickFence ?? tildeFence ?? '```';
      const info = backtickInfo ?? tildeInfo ?? '';
      const code = backtickCode ?? tildeCode ?? '';
      if (code.length <= OVERSIZED_CODE_BLOCK_MIN_CHARS) {
        return whole;
      }

      const token = `MOSS_OVERSIZED_CODE_BLOCK_${blocks.size}_${code.length}`;
      blocks.set(token, {
        code,
        language: info.trim().split(/\s+/, 1)[0] || '',
      });
      return `${prefix}${indent}${fence}${info}\n${token}\n${indent}${fence}`;
    },
  );

  return { markdown: compacted, blocks };
}

function buildCodePages(
  code: string,
  maxLines: number,
  maxChars: number,
  pageLimit = Number.POSITIVE_INFINITY,
): CodePage[] {
  if (!code) {
    return [{ start: 0, end: 0, startLine: 1, endLine: 1 }];
  }

  const pages: CodePage[] = [];
  let pageStart = 0;
  let pageStartLine = 1;
  let cursor = 0;
  let currentLine = 1;
  let linesInPage = 0;

  while (cursor < code.length) {
    const newlineIndex = code.indexOf('\n', cursor);
    const lineEnd = newlineIndex === -1 ? code.length : newlineIndex + 1;

    if (cursor > pageStart && lineEnd - pageStart > maxChars) {
      pages.push({
        start: pageStart,
        end: cursor,
        startLine: pageStartLine,
        endLine: Math.max(pageStartLine, currentLine - 1),
      });
      if (pages.length >= pageLimit) return pages;
      pageStart = cursor;
      pageStartLine = currentLine;
      linesInPage = 0;
      continue;
    }

    if (cursor === pageStart && lineEnd - pageStart > maxChars) {
      const splitEnd = pageStart + maxChars;
      pages.push({
        start: pageStart,
        end: splitEnd,
        startLine: currentLine,
        endLine: currentLine,
      });
      if (pages.length >= pageLimit) return pages;
      pageStart = splitEnd;
      cursor = splitEnd;
      pageStartLine = currentLine;
      linesInPage = 0;
      continue;
    }

    cursor = lineEnd;
    linesInPage += 1;
    const reachedBoundary = linesInPage >= maxLines || cursor - pageStart >= maxChars;
    const reachedEnd = cursor >= code.length;
    if (reachedBoundary || reachedEnd) {
      pages.push({
        start: pageStart,
        end: cursor,
        startLine: pageStartLine,
        endLine: currentLine,
      });
      if (pages.length >= pageLimit) return pages;
      pageStart = cursor;
      pageStartLine = currentLine + 1;
      linesInPage = 0;
    }
    currentLine += 1;
  }

  return pages;
}

const iconButtonStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid var(--border-subtle)',
  borderRadius: 6,
  color: 'var(--text-secondary)',
  background: 'var(--bg-secondary)',
};

export const OversizedCodeBlock: React.FC<OversizedCodeBlockProps> = memo(({ code, language = '' }) => {
  const [expanded, setExpanded] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const pages = useMemo(() => buildCodePages(code, PAGE_MAX_LINES, PAGE_MAX_CHARS), [code]);
  const totalLines = pages[pages.length - 1]?.endLine ?? 0;
  const previewPage = useMemo(
    () => buildCodePages(code, PREVIEW_MAX_LINES, PREVIEW_MAX_CHARS, 1)[0],
    [code],
  );
  const activePage = expanded ? pages[pageIndex] ?? pages[0] : previewPage;
  const visibleCode = code.slice(activePage.start, activePage.end);

  useEffect(() => {
    setExpanded(false);
    setPageIndex(0);
  }, [code]);

  const copyFullContent = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2_000);
  };

  const goToPage = (nextPage: number) => {
    setPageIndex(Math.max(0, Math.min(nextPage, pages.length - 1)));
  };

  return (
    <div
      className="my-3 overflow-hidden code-block-container"
      data-testid="oversized-code-block"
      style={{
        border: '1px solid var(--code-block-border)',
        borderRadius: 8,
        background: 'var(--code-block-bg)',
      }}
    >
      <div
        style={{
          minHeight: 44,
          padding: '7px 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          flexWrap: 'wrap',
          borderBottom: '1px solid var(--code-block-border)',
          background: 'var(--code-block-header)',
        }}
      >
        <div style={{ minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          {language && (
            <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: 12 }}>
              {language}
            </span>
          )}
          <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
            {totalLines.toLocaleString()} 行 · {code.length.toLocaleString()} 字符
          </span>
          {!expanded && (
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
              预览至第 {activePage.endLine.toLocaleString()} 行
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {expanded && (
            <>
              <button
                type="button"
                aria-label="上一页"
                title="上一页"
                disabled={pageIndex === 0}
                onClick={() => goToPage(pageIndex - 1)}
                style={{ ...iconButtonStyle, opacity: pageIndex === 0 ? 0.45 : 1 }}
              >
                <ChevronLeft size={15} />
              </button>
              <input
                type="number"
                aria-label="跳转页码"
                min={1}
                max={pages.length}
                value={pageIndex + 1}
                onChange={(event) => goToPage(Number(event.target.value) - 1)}
                style={{
                  width: 54,
                  height: 28,
                  padding: '0 6px',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 6,
                  color: 'var(--text-primary)',
                  background: 'var(--bg-secondary)',
                  fontSize: 12,
                  textAlign: 'center',
                }}
              />
              <span aria-live="polite" style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
                / {pages.length.toLocaleString()}
              </span>
              <button
                type="button"
                aria-label="下一页"
                title="下一页"
                disabled={pageIndex >= pages.length - 1}
                onClick={() => goToPage(pageIndex + 1)}
                style={{ ...iconButtonStyle, opacity: pageIndex >= pages.length - 1 ? 0.45 : 1 }}
              >
                <ChevronRight size={15} />
              </button>
            </>
          )}
          <button
            type="button"
            aria-label={expanded ? '收起完整内容' : '分页查看完整内容'}
            title={expanded ? '收起完整内容' : '分页查看完整内容'}
            onClick={() => {
              setExpanded((value) => !value);
              setPageIndex(0);
            }}
            style={iconButtonStyle}
          >
            {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
          <button
            type="button"
            aria-label="复制完整内容"
            title="复制完整内容"
            onClick={copyFullContent}
            style={iconButtonStyle}
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div
          data-testid="oversized-code-block-page-range"
          style={{
            padding: '6px 12px',
            borderBottom: '1px solid var(--code-block-border)',
            color: 'var(--text-muted)',
            background: 'var(--bg-secondary)',
            fontSize: 12,
          }}
        >
          第 {activePage.startLine.toLocaleString()}-{activePage.endLine.toLocaleString()} 行
        </div>
      )}

      <pre
        data-testid="oversized-code-block-content"
        style={{
          maxHeight: 520,
          margin: 0,
          padding: 16,
          overflow: 'auto',
          color: 'var(--text-secondary)',
          background: 'transparent',
          fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
          fontSize: 13,
          fontWeight: 500,
          lineHeight: 1.6,
          whiteSpace: 'pre',
        }}
      >
        <code>{visibleCode}</code>
      </pre>
    </div>
  );
});

OversizedCodeBlock.displayName = 'OversizedCodeBlock';
