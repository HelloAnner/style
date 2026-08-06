/**
 * 代码块组件 - 支持语法高亮和复制功能
 * 
 * 使用 react-syntax-highlighter 提供真正的语法高亮
 */

import React, { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { AnimatePresence } from '../../lib/motion';
import { SyntaxHighlighter } from '../../lib/syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { CopyIcon, CheckIcon } from './Icons';

interface CodeBlockProps {
  children: string;
  language?: string;
  title?: string;
  maxHeight?: number;
  showLineNumbers?: boolean;
  copyable?: boolean;
  className?: string;
  testId?: string;
  headerTestId?: string;
  contentTestId?: string;
  copyButtonTestId?: string;
}

// 文件扩展名到语言的映射
const extensionToLanguage: Record<string, string> = {
  // 代码文件
  'py': 'python',
  'js': 'javascript',
  'jsx': 'jsx',
  'ts': 'typescript',
  'tsx': 'tsx',
  'go': 'go',
  'rs': 'rust',
  'rb': 'ruby',
  'java': 'java',
  'c': 'c',
  'cpp': 'cpp',
  'cs': 'csharp',
  'php': 'php',
  'swift': 'swift',
  'kt': 'kotlin',
  'scala': 'scala',
  'sh': 'bash',
  'bash': 'bash',
  'zsh': 'bash',
  // 数据/配置文件
  'json': 'json',
  'yaml': 'yaml',
  'yml': 'yaml',
  'toml': 'toml',
  'xml': 'xml',
  'csv': 'csv',
  // 文档文件
  'md': 'markdown',
  'markdown': 'markdown',
  'txt': 'text',
  // Web 文件
  'html': 'html',
  'htm': 'html',
  'css': 'css',
  'scss': 'scss',
  'sass': 'sass',
  'less': 'less',
  // 其他
  'sql': 'sql',
  'graphql': 'graphql',
  'dockerfile': 'dockerfile',
  'makefile': 'makefile',
  'ini': 'ini',
  'properties': 'properties',
};

/**
 * 根据文件名或扩展名获取语言
 */
export const getLanguageFromPath = (filePath: string): string => {
  if (!filePath) return 'text';
  
  // 提取文件名
  const fileName = filePath.split('/').pop() || filePath;
  
  // 特殊文件名处理
  const lowerFileName = fileName.toLowerCase();
  if (lowerFileName === 'dockerfile') return 'dockerfile';
  if (lowerFileName === 'makefile') return 'makefile';
  if (lowerFileName.startsWith('.env')) return 'bash';
  if (lowerFileName === '.gitignore') return 'gitignore';
  
  // 提取扩展名
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return extensionToLanguage[ext] || 'text';
};

/**
 * 自定义暗色主题（与 Agent Core UI 保持一致）
 */
const customStyle: React.CSSProperties = {
  margin: 0,
  padding: '12px',
  background: '#1a1a2e',
  fontSize: '12px',
  lineHeight: '1.6',
  borderRadius: 0,
};

export const CodeBlock: React.FC<CodeBlockProps> = ({
  children,
  language = 'text',
  title,
  maxHeight = 400,
  showLineNumbers = false,
  copyable = true,
  className = '',
  testId,
  headerTestId,
  contentTestId,
  copyButtonTestId,
}) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  }, [children]);
  
  // 规范化语言名称
  const normalizedLanguage = useMemo(() => {
    const lang = language.toLowerCase();
    // 处理一些常见别名
    if (lang === 'js') return 'javascript';
    if (lang === 'ts') return 'typescript';
    if (lang === 'py') return 'python';
    if (lang === 'rb') return 'ruby';
    if (lang === 'yml') return 'yaml';
    if (lang === 'sh' || lang === 'shell') return 'bash';
    return lang;
  }, [language]);
  
  return (
    <div
      className={`code-block rounded-lg overflow-hidden bg-[#1a1a2e] border border-surface-200 ${className}`}
      data-testid={testId}
    >
      {/* 头部 */}
      {(title || copyable) && (
        <div
          className="code-block-header flex items-center justify-between px-3 py-2 bg-surface-100 border-b border-surface-200"
          data-testid={headerTestId}
        >
          <div className="flex items-center gap-2">
            {language && language !== 'text' && (
              <span className="px-2 py-0.5 text-xs font-mono rounded bg-surface-200 text-zinc-400">
                {normalizedLanguage}
              </span>
            )}
            {title && (
              <span className="text-xs text-zinc-500">{title}</span>
            )}
          </div>
          
          {copyable && (
            <button
              onClick={handleCopy}
              className="code-block-copy-button p-1.5 rounded hover:bg-surface-200 transition-colors"
              data-testid={copyButtonTestId}
              title="复制代码"
            >
              <AnimatePresence mode="wait">
                {copied ? (
                  <motion.div
                    key="check"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                  >
                    <CheckIcon size={14} className="text-success" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="copy"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                  >
                    <CopyIcon size={14} className="text-zinc-500" />
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          )}
        </div>
      )}
      
      {/* 代码内容 - 使用 react-syntax-highlighter */}
      <div
        className="code-block-content overflow-auto"
        data-testid={contentTestId}
        style={{ maxHeight }}
      >
        <SyntaxHighlighter
          language={normalizedLanguage}
          style={oneDark}
          showLineNumbers={showLineNumbers}
          customStyle={customStyle}
          wrapLines={true}
          wrapLongLines={true}
          lineNumberStyle={{
            color: '#4a4a6a',
            paddingRight: '16px',
            minWidth: '40px',
            textAlign: 'right',
          }}
        >
          {children}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};
