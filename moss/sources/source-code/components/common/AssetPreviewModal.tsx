/**
 * 通用资产预览/编辑模态框
 *
 * 用于 SubAgent、Skill、Tool 等资产的预览和编辑
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { AnimatePresence } from '../../lib/motion';
import { SyntaxHighlighter } from '../../lib/syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { MarkdownContent } from '../Chat/MarkdownContent';
import { toast } from '../../utils/toast';

// 图标组件
const CloseIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const MaximizeIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const MinimizeIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const EyeIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const EditIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const FileIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const FolderIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M3 18V6a2 2 0 012-2h4.586a1 1 0 01.707.293l1.414 1.414a1 1 0 00.707.293H19a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const LockIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2"/>
    <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

// 资产类型
export type AssetType = 'subagent' | 'skill' | 'tool';

// 文件结构
export interface AssetFile {
  name: string;
  path: string;
  content?: string;
  isMain?: boolean;  // 是否是主文件
}

// 模态框属性
export interface AssetPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  assetType: AssetType;
  assetName: string;
  files: AssetFile[];
  isReadonly?: boolean;  // 是否只读（builtin 资产）
  source?: 'builtin' | 'workspace';
  onSave?: (fileName: string, content: string) => Promise<void>;
}

// 获取文件语言
function getFileLanguage(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop() || '';
  const langMap: Record<string, string> = {
    'py': 'python',
    'js': 'javascript',
    'ts': 'typescript',
    'tsx': 'tsx',
    'jsx': 'jsx',
    'json': 'json',
    'yaml': 'yaml',
    'yml': 'yaml',
    'md': 'markdown',
    'sh': 'bash',
    'html': 'html',
    'css': 'css',
  };
  return langMap[ext] || 'text';
}

// 判断是否是 Markdown 文件
function isMarkdownFile(fileName: string): boolean {
  return fileName.toLowerCase().endsWith('.md') || fileName.toLowerCase().endsWith('.markdown');
}

export const AssetPreviewModal: React.FC<AssetPreviewModalProps> = ({
  isOpen,
  onClose,
  assetType,
  assetName,
  files,
  isReadonly = false,
  source,
  onSave,
}) => {
  const [selectedFile, setSelectedFile] = useState<AssetFile | null>(null);
  const [mode, setMode] = useState<'preview' | 'edit'>('preview');
  const [editContent, setEditContent] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 初始化选中主文件
  useEffect(() => {
    if (files.length > 0) {
      const mainFile = files.find(f => f.isMain) || files[0];
      setSelectedFile(mainFile);
      setEditContent(mainFile.content || '');
    }
  }, [files]);

  // 切换文件时更新编辑内容
  useEffect(() => {
    if (selectedFile) {
      setEditContent(selectedFile.content || '');
      setMode('preview');  // 切换文件时重置为预览模式
    }
  }, [selectedFile]);

  // 保存文件
  const handleSave = async () => {
    if (!selectedFile || !onSave || isReadonly) return;
    
    setIsSaving(true);
    try {
      await onSave(selectedFile.path, editContent);
      // 更新本地状态
      selectedFile.content = editContent;
      setMode('preview');
    } catch (error) {
      console.error('保存失败:', error);
      toast.error('保存失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  // 资产类型图标和颜色
  const assetConfig = {
    subagent: { icon: '🤖', label: '伙伴', color: 'accent' },
    skill: { icon: '⚡', label: '技能', color: 'secondary' },
    tool: { icon: '🔧', label: '工具', color: 'accent' },
  };

  const config = assetConfig[assetType];

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-4"
          data-testid="asset-preview-modal"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className={`bg-surface-100 rounded-xl flex flex-col overflow-hidden ${
              isFullscreen
                ? 'w-full h-full max-w-none max-h-none m-0'
                : 'w-full max-w-5xl h-[85vh]'
            }`}
            data-testid="asset-preview-modal-panel"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 头部工具栏 */}
            <div className="px-4 py-3 border-b border-surface-200 flex items-center justify-between bg-surface-50 flex-shrink-0" data-testid="asset-preview-modal-header">
              <div className="flex items-center gap-3">
                <span className="text-lg">{config.icon}</span>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-zinc-300 font-medium">
                      {assetName}
                    </span>
                    {source && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        source === 'builtin' 
                          ? 'bg-zinc-700 text-zinc-400' 
                          : 'bg-accent/20 text-accent'
                      }`}>
                        {source === 'builtin' ? '内核级' : 'workspace'}
                      </span>
                    )}
                    {isReadonly && (
                      <LockIcon size={12} className="text-zinc-500" />
                    )}
                  </div>
                  <span className="text-xs text-zinc-500">{config.label}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* 预览/编辑切换 */}
                {selectedFile && !isReadonly && (
                  <div className="flex items-center bg-surface-200 rounded-lg p-0.5">
                    <button
                      onClick={() => setMode('preview')}
                      className={`px-3 py-1 text-xs rounded-md transition-colors ${
                        mode === 'preview'
                          ? 'bg-accent text-white'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      <EyeIcon size={12} className="inline mr-1" />
                      预览
                    </button>
                    <button
                      onClick={() => setMode('edit')}
                      className={`px-3 py-1 text-xs rounded-md transition-colors ${
                        mode === 'edit'
                          ? 'bg-accent text-white'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      <EditIcon size={12} className="inline mr-1" />
                      编辑
                    </button>
                  </div>
                )}

                {/* 全屏切换 */}
                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="p-1.5 rounded hover:bg-surface-200 transition-colors"
                  title={isFullscreen ? '退出全屏' : '全屏'}
                >
                  {isFullscreen ? (
                    <MinimizeIcon size={14} className="text-zinc-400" />
                  ) : (
                    <MaximizeIcon size={14} className="text-zinc-400" />
                  )}
                </button>

                {/* 保存按钮 */}
                {mode === 'edit' && !isReadonly && (
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-3 py-1.5 text-xs bg-accent text-white rounded-lg hover:bg-accent/80 transition-colors disabled:opacity-50"
                  >
                    {isSaving ? '保存中...' : '保存'}
                  </button>
                )}

                {/* 关闭按钮 */}
                <button
                  onClick={onClose}
                  className="p-1.5 rounded hover:bg-surface-200 transition-colors"
                  title="关闭"
                >
                  <CloseIcon size={14} className="text-zinc-400" />
                </button>
              </div>
            </div>

            {/* 内容区域 */}
            <div className="flex-1 flex overflow-hidden" data-testid="asset-preview-modal-body">
              {/* 文件列表（多文件时显示） */}
              {files.length > 1 && (
                <div className="w-56 border-r border-surface-200 bg-surface-50 overflow-y-auto flex-shrink-0" data-testid="asset-preview-modal-file-list">
                  <div className="p-2">
                    <div className="text-xs text-zinc-500 px-2 py-1 mb-1">
                      文件 ({files.length})
                    </div>
                    <div className="space-y-0.5">
                      {files.map((file) => (
                        <button
                          key={file.path}
                          onClick={() => setSelectedFile(file)}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors ${
                            selectedFile?.path === file.path
                              ? 'bg-accent/20 text-accent'
                              : 'hover:bg-surface-100 text-zinc-400'
                          }`}
                        >
                          {file.name.includes('/') ? (
                            <FolderIcon size={12} className="flex-shrink-0" />
                          ) : (
                            <FileIcon size={12} className="flex-shrink-0" />
                          )}
                          <span className="text-xs truncate flex-1">{file.name}</span>
                          {file.isMain && (
                            <span className="text-[10px] px-1 bg-surface-200 rounded text-zinc-500">
                              主
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 文件内容 */}
              <div className="flex-1 overflow-auto" data-testid="asset-preview-modal-content">
                {selectedFile ? (
                  mode === 'preview' ? (
                    // 预览模式
                    isMarkdownFile(selectedFile.name) ? (
                      <div className="p-6">
                        <MarkdownContent 
                          content={selectedFile.content || ''} 
                          className="prose prose-invert max-w-none" 
                        />
                      </div>
                    ) : (
                      <div className="p-4">
                        <SyntaxHighlighter
                          language={getFileLanguage(selectedFile.name)}
                          style={oneDark}
                          customStyle={{
                            margin: 0,
                            padding: '1rem',
                            borderRadius: '0.5rem',
                            fontSize: '0.875rem',
                            lineHeight: '1.5',
                            background: 'transparent',
                          }}
                          showLineNumbers
                          lineNumberStyle={{
                            minWidth: '3em',
                            paddingRight: '1em',
                            color: '#6b7280',
                            userSelect: 'none',
                          }}
                        >
                          {selectedFile.content || ''}
                        </SyntaxHighlighter>
                      </div>
                    )
                  ) : (
                    // 编辑模式
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full h-full p-4 bg-surface-50 text-zinc-300 text-sm font-mono resize-none focus:outline-none"
                      spellCheck={false}
                      placeholder="在此编辑文件内容..."
                    />
                  )
                ) : (
                  <div className="flex items-center justify-center h-full text-zinc-500">
                    请选择一个文件
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default AssetPreviewModal;
