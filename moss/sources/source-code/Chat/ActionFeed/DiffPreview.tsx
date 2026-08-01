/**
 * DiffPreview - 文件内容变更预览组件
 * 
 * 【设计理念】
 * - 简洁优雅：一目了然的增删统计
 * - 信息丰富：显示文件名、变更行数、内容预览
 * - 可收起展开：默认展示 4 行，可展开查看全部
 * - 主题适配：支持深色/浅色主题
 * - 智能分组：同一文件的多处修改合并展示
 * 
 * 【支持模式】
 * - edit/multi_edit：显示删除和新增
 * - write：只显示新增内容
 */

import React, { useState, useMemo, memo, useCallback } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

// ========== 类型定义 ==========

interface DiffLine {
  type: 'add' | 'remove' | 'context' | 'separator';
  content: string;
}

interface EditInfo {
  path: string;
  oldStr?: string;
  newStr?: string;
  /** 写入模式（只有新增，无删除） */
  isWrite?: boolean;
}

interface DiffPreviewProps {
  /** 文件路径 */
  path?: string;
  /** 旧内容（编辑模式） */
  oldStr?: string;
  /** 新内容 */
  newStr?: string;
  /** 是否是写入模式（只显示新增） */
  isWrite?: boolean;
  /** 批量编辑数据 */
  edits?: EditInfo[];
  /** 是否默认展开 */
  defaultExpanded?: boolean;
}

// ========== 辅助函数 ==========

/** 提取文件名 */
function getFileName(path: string): string {
  if (!path) return '未命名文件';
  const parts = path.split('/');
  return parts[parts.length - 1] || path;
}

/** 计算单个编辑的差异统计 */
function computeEditStats(
  oldStr: string | undefined, 
  newStr: string | undefined,
  isWrite?: boolean
): { added: number; removed: number } {
  if (isWrite) {
    const newLines = newStr ? newStr.split('\n').length : 0;
    return { added: newLines, removed: 0 };
  }
  
  const oldLines = oldStr ? oldStr.split('\n').length : 0;
  const newLines = newStr ? newStr.split('\n').length : 0;
  
  return { added: newLines, removed: oldLines };
}

/** 生成单个编辑的差异行 */
function generateEditDiffLines(
  oldStr: string | undefined, 
  newStr: string | undefined,
  isWrite?: boolean
): DiffLine[] {
  const lines: DiffLine[] = [];
  
  // 删除的内容（写入模式不显示）
  if (!isWrite && oldStr) {
    oldStr.split('\n').forEach((line) => {
      lines.push({ type: 'remove', content: line });
    });
  }
  
  // 新增的内容
  if (newStr) {
    newStr.split('\n').forEach((line) => {
      lines.push({ type: 'add', content: line });
    });
  }
  
  return lines;
}

/** 按文件路径分组 edits */
function groupEditsByFile(edits: EditInfo[]): Map<string, EditInfo[]> {
  const groups = new Map<string, EditInfo[]>();
  
  for (const edit of edits) {
    const path = edit.path || '未命名文件';
    const existing = groups.get(path) || [];
    existing.push(edit);
    groups.set(path, existing);
  }
  
  return groups;
}

// ========== 样式常量（主题适配） ==========

const COLORS = {
  addBg: 'var(--diff-add-bg, rgba(34, 197, 94, 0.1))',
  addText: 'var(--diff-add-text, #22c55e)',
  addMark: 'var(--diff-add-mark, #22c55e)',
  removeBg: 'var(--diff-remove-bg, rgba(239, 68, 68, 0.1))',
  removeText: 'var(--diff-remove-text, #ef4444)',
  removeMark: 'var(--diff-remove-mark, #ef4444)',
};

// ========== 常量 ==========

const MAX_COLLAPSED_LINES = 4;

// ========== 子组件 ==========

/** 差异行渲染 */
const DiffLineRow: React.FC<{ line: DiffLine }> = memo(({ line }) => {
  if (line.type === 'separator') {
    return (
      <div 
        className="flex items-center gap-2 px-2 py-1"
        style={{ 
          background: 'var(--bg-tertiary)',
          borderTop: '1px dashed var(--border-muted)',
          borderBottom: '1px dashed var(--border-muted)',
        }}
      >
        <span 
          className="text-[10px]"
          style={{ color: 'var(--text-muted)' }}
        >
          ···
        </span>
      </div>
    );
  }

  const isAdd = line.type === 'add';
  const isRemove = line.type === 'remove';
  
  return (
    <div 
      className="flex"
      style={{
        background: isAdd 
          ? COLORS.addBg
          : isRemove 
            ? COLORS.removeBg 
            : 'transparent',
      }}
    >
      <div 
        className="w-6 flex-shrink-0 text-center select-none font-medium"
        style={{ 
          color: isAdd 
            ? COLORS.addMark 
            : isRemove 
              ? COLORS.removeMark 
              : 'var(--text-muted)',
        }}
      >
        {isAdd ? '+' : isRemove ? '-' : ' '}
      </div>
      <div 
        className="flex-1 pr-2 whitespace-pre overflow-hidden text-ellipsis"
        style={{ 
          color: isAdd 
            ? COLORS.addText
            : isRemove 
              ? COLORS.removeText
              : 'var(--text-tertiary)',
        }}
      >
        {line.content || ' '}
      </div>
    </div>
  );
});

DiffLineRow.displayName = 'DiffLineRow';

/** 单个文件的 diff 卡片（支持多处修改） */
const SingleFileDiff: React.FC<{
  path: string;
  /** 单个编辑（单处修改） */
  oldStr?: string;
  newStr?: string;
  isWrite?: boolean;
  /** 多处修改（同一文件） */
  multiEdits?: EditInfo[];
  defaultExpanded?: boolean;
}> = memo(({ path, oldStr, newStr, isWrite = false, multiEdits, defaultExpanded = false }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  
  const fileName = useMemo(() => getFileName(path), [path]);
  
  // 计算所有编辑的统计和差异行
  const { totalStats, allDiffLines } = useMemo(() => {
    let totalAdded = 0;
    let totalRemoved = 0;
    const lines: DiffLine[] = [];
    
    if (multiEdits && multiEdits.length > 0) {
      // 多处修改模式
      multiEdits.forEach((edit, idx) => {
        const stats = computeEditStats(edit.oldStr, edit.newStr, edit.isWrite);
        totalAdded += stats.added;
        totalRemoved += stats.removed;
        
        // 添加分隔线（非第一个修改）
        if (idx > 0) {
          lines.push({ type: 'separator', content: '' });
        }
        
        const editLines = generateEditDiffLines(edit.oldStr, edit.newStr, edit.isWrite);
        lines.push(...editLines);
      });
    } else {
      // 单处修改模式
      const stats = computeEditStats(oldStr, newStr, isWrite);
      totalAdded = stats.added;
      totalRemoved = stats.removed;
      lines.push(...generateEditDiffLines(oldStr, newStr, isWrite));
    }
    
    return {
      totalStats: { added: totalAdded, removed: totalRemoved },
      allDiffLines: lines,
    };
  }, [multiEdits, oldStr, newStr, isWrite]);
  
  const hasContent = allDiffLines.length > 0;
  const needsExpand = allDiffLines.length > MAX_COLLAPSED_LINES;
  const displayLines = isExpanded ? allDiffLines : allDiffLines.slice(0, MAX_COLLAPSED_LINES);
  const hiddenCount = allDiffLines.length - MAX_COLLAPSED_LINES;
  
  const handleToggle = useCallback(() => {
    if (needsExpand) {
      setIsExpanded(prev => !prev);
    }
  }, [needsExpand]);
  
  return (
    <div 
      className="diff-preview-file rounded-md overflow-hidden"
      style={{ 
        border: '1px solid var(--border-muted)',
        width: '480px',
        maxWidth: '100%',
      }}
      data-testid={`diff-preview-file-${path}`}
    >
      {/* 头部 */}
      <div 
        className={`flex items-center gap-2 px-2.5 py-1.5 ${needsExpand ? 'cursor-pointer hover:opacity-80' : ''}`}
        onClick={handleToggle}
        style={{
          background: 'var(--bg-tertiary)',
          borderRadius: hasContent ? '6px 6px 0 0' : '6px',
        }}
        data-testid="diff-preview-header"
      >
        {/* 文件图标 */}
        <svg 
          width={14} 
          height={14} 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
          style={{ color: 'var(--text-muted)', flexShrink: 0 }}
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M14 2v6h6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        
        {/* 文件名 */}
        <span 
          className="text-xs font-medium truncate flex-1"
          style={{ color: 'var(--text-secondary)' }}
        >
          {fileName}
        </span>
        
        {/* 增删统计 */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {totalStats.added > 0 && (
            <span 
              className="text-[11px] font-medium"
              style={{ color: COLORS.addMark }}
            >
              +{totalStats.added}
            </span>
          )}
          {totalStats.removed > 0 && (
            <span 
              className="text-[11px] font-medium"
              style={{ color: COLORS.removeMark }}
            >
              -{totalStats.removed}
            </span>
          )}
        </div>
        
        {/* 展开/收起图标 */}
        {needsExpand && (
          <div style={{ color: 'var(--text-muted)' }}>
            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </div>
        )}
      </div>
      
      {/* 内容区域 */}
      {hasContent && (
        <div 
          className="overflow-hidden"
          style={{
            background: 'var(--code-block-bg, var(--bg-secondary))',
            borderTop: '1px solid var(--border-muted)',
          }}
          data-testid="diff-preview-content"
        >
          {/* 差异行 */}
          <div className="text-[11px] font-mono leading-[1.6]">
            {displayLines.map((line, idx) => (
              <DiffLineRow key={idx} line={line} />
            ))}
          </div>
          
          {/* 收起状态的 "展开" 提示 */}
          {!isExpanded && needsExpand && (
            <div 
              className="px-3 py-1.5 text-[10px] text-center cursor-pointer hover:opacity-80"
              style={{ 
                color: 'var(--text-muted)',
                borderTop: '1px solid var(--border-muted)',
              }}
              onClick={handleToggle}
              data-testid="diff-preview-expand"
            >
              展开查看剩余 {hiddenCount} 行
            </div>
          )}
          
          {/* 展开状态的 "收起" 提示 */}
          {isExpanded && needsExpand && (
            <div 
              className="px-3 py-1.5 text-[10px] text-center cursor-pointer hover:opacity-80"
              style={{ 
                color: 'var(--text-muted)',
                borderTop: '1px solid var(--border-muted)',
              }}
              onClick={handleToggle}
              data-testid="diff-preview-collapse"
            >
              收起
            </div>
          )}
        </div>
      )}
    </div>
  );
});

SingleFileDiff.displayName = 'SingleFileDiff';

// ========== 主组件 ==========

export const DiffPreview: React.FC<DiffPreviewProps> = memo(({
  path,
  oldStr,
  newStr,
  isWrite = false,
  edits,
  defaultExpanded = false,
}) => {
  // 批量编辑模式 - 按文件分组
  if (edits && edits.length > 0) {
    const groupedEdits = groupEditsByFile(edits);
    
    // 如果只有一个文件（同一文件多处修改）
    if (groupedEdits.size === 1) {
      const [filePath, fileEdits] = Array.from(groupedEdits.entries())[0];
      return (
        <div className="mt-1.5" data-testid="diff-preview">
          <SingleFileDiff
            path={filePath}
            multiEdits={fileEdits}
            defaultExpanded={defaultExpanded}
          />
        </div>
      );
    }
    
    // 多个文件的修改
    return (
      <div className="space-y-2 mt-1.5" data-testid="diff-preview">
        {Array.from(groupedEdits.entries()).map(([filePath, fileEdits], idx) => (
          <SingleFileDiff
            key={idx}
            path={filePath}
            multiEdits={fileEdits}
            defaultExpanded={defaultExpanded}
          />
        ))}
      </div>
    );
  }
  
  // 单文件模式
  if (path && (oldStr || newStr)) {
    return (
      <div className="mt-1.5" data-testid="diff-preview">
        <SingleFileDiff
          path={path}
          oldStr={oldStr}
          newStr={newStr}
          isWrite={isWrite}
          defaultExpanded={defaultExpanded}
        />
      </div>
    );
  }
  
  return null;
});

DiffPreview.displayName = 'DiffPreview';

export default DiffPreview;
