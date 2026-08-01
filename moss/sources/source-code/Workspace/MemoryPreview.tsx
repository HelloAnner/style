/**
 * 记忆预览组件
 * 
 * 将记忆 JSON 数据以卡片形式优雅展示
 * 支持预览模式和编辑模式切换
 * 
 * 设计风格：黑白灰极简风格，简洁优雅
 */

import React, { useState, useMemo, useCallback } from 'react';
import { 
  Edit2, Save, X, Clock, Tag, Star, 
  ChevronDown, ChevronUp, AlertCircle,
  Search, Filter
} from 'lucide-react';

// 记忆条目类型
interface MemoryEntry {
  id: string;
  content: string;
  tags: string[];
  category: string;
  created_at: string;
  updated_at: string;
  importance: number;
}

// 记忆数据结构
interface MemoryData {
  entries: MemoryEntry[];
}

interface MemoryPreviewProps {
  content: string;
  onSave: (content: string) => Promise<void>;
  isReadonly?: boolean;
}

// 格式化日期
const formatDate = (dateStr: string): string => {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return '今天';
    if (diffDays === 1) return '昨天';
    if (diffDays < 7) return `${diffDays}天前`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`;
    
    return date.toLocaleDateString('zh-CN', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  } catch {
    return dateStr;
  }
};

// 重要性星级显示
const ImportanceStars: React.FC<{ level: number; size?: number }> = ({ level, size = 10 }) => {
  const stars = Math.min(Math.max(Math.ceil(level / 2), 1), 5);
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star 
          key={i} 
          size={size} 
          className={i < stars ? 'fill-current' : 'opacity-20'}
          style={{ color: i < stars ? 'var(--text-tertiary)' : 'var(--text-muted)' }}
        />
      ))}
    </div>
  );
};

// 标签组件
const TagBadge: React.FC<{ tag: string }> = ({ tag }) => (
  <span 
    className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium"
    style={{ 
      background: 'var(--bg-tertiary)', 
      color: 'var(--text-muted)',
      border: '1px solid var(--border-subtle)',
    }}
  >
    {tag}
  </span>
);

// 类别标签
const CategoryBadge: React.FC<{ category: string }> = ({ category }) => {
  const categoryConfig: Record<string, { label: string; style: string }> = {
    fact: { label: '事实', style: 'bg-zinc-700/50 text-zinc-300' },
    preference: { label: '偏好', style: 'bg-zinc-600/30 text-zinc-400' },
    instruction: { label: '指令', style: 'bg-zinc-500/20 text-zinc-400' },
    context: { label: '上下文', style: 'bg-zinc-800/50 text-zinc-400' },
  };
  
  const config = categoryConfig[category] || { label: category, style: 'bg-zinc-700/30 text-zinc-400' };
  
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ${config.style}`}>
      {config.label}
    </span>
  );
};

// 单个记忆卡片
const MemoryCard: React.FC<{ 
  entry: MemoryEntry; 
  isExpanded: boolean;
  onToggle: () => void;
}> = ({ entry, isExpanded, onToggle }) => {
  // 预览内容（折叠时显示前100字符）
  const previewContent = useMemo(() => {
    if (isExpanded) return entry.content;
    const lines = entry.content.split('\n');
    if (lines.length > 3 || entry.content.length > 120) {
      return entry.content.slice(0, 120) + '...';
    }
    return entry.content;
  }, [entry.content, isExpanded]);
  
  const needsExpand = entry.content.length > 120 || entry.content.split('\n').length > 3;
  
  return (
    <div 
      className="memory-card group rounded-xl transition-all duration-200"
      data-testid={`memory-card-${entry.id}`}
      style={{ 
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-subtle)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }}
    >
      {/* 卡片头部 */}
      <div 
        className="memory-card-header flex items-start justify-between px-4 pt-4 pb-2"
        style={{ borderBottom: isExpanded ? '1px solid var(--border-subtle)' : 'none' }}
      >
        <div className="flex items-center gap-2">
          <CategoryBadge category={entry.category} />
          <ImportanceStars level={entry.importance} />
        </div>
        <div 
          className="flex items-center gap-1.5 text-[11px]"
          style={{ color: 'var(--text-muted)' }}
        >
          <Clock size={10} />
          {formatDate(entry.updated_at)}
        </div>
      </div>
      
      {/* 卡片内容 */}
      <div className="px-4 py-3">
        <div 
          className="text-[13px] leading-relaxed whitespace-pre-wrap"
          style={{ color: 'var(--text-secondary)' }}
        >
          {previewContent}
        </div>
        
        {/* 展开/折叠按钮 */}
        {needsExpand && (
          <button
            onClick={onToggle}
            className="memory-card-toggle mt-2 flex items-center gap-1 text-[11px] transition-colors"
            data-testid={`memory-card-toggle-${entry.id}`}
            style={{ color: 'var(--text-muted)' }}
          >
            {isExpanded ? (
              <>
                <ChevronUp size={12} />
                收起
              </>
            ) : (
              <>
                <ChevronDown size={12} />
                展开全部
              </>
            )}
          </button>
        )}
      </div>
      
      {/* 卡片底部 - 标签 */}
      {entry.tags.length > 0 && (
        <div 
          className="memory-card-tags px-4 pb-3 flex items-center gap-1.5 flex-wrap"
        >
          <Tag size={10} style={{ color: 'var(--text-muted)' }} />
          {entry.tags.map((tag, i) => (
            <TagBadge key={i} tag={tag} />
          ))}
        </div>
      )}
    </div>
  );
};

// 空状态
const EmptyState: React.FC = () => (
  <div className="memory-preview-empty flex flex-col items-center justify-center py-16 text-center">
    <div 
      className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
      style={{ background: 'var(--bg-tertiary)' }}
    >
      <Star size={24} style={{ color: 'var(--text-muted)' }} />
    </div>
    <h3 
      className="text-base font-medium mb-2"
      style={{ color: 'var(--text-secondary)' }}
    >
      暂无记忆
    </h3>
    <p 
      className="text-sm max-w-xs"
      style={{ color: 'var(--text-muted)' }}
    >
      Agent 会在对话中自动学习和记忆重要信息
    </p>
  </div>
);

// JSON 编辑器
const JsonEditor: React.FC<{
  content: string;
  onChange: (content: string) => void;
  error?: string | null;
}> = ({ content, onChange, error }) => (
  <div className="memory-preview-editor h-full flex flex-col">
    {error && (
      <div 
        className="memory-preview-editor-error flex items-center gap-2 px-4 py-2 text-sm"
        data-testid="memory-preview-editor-error"
        style={{ 
          background: 'rgba(239, 68, 68, 0.1)', 
          color: '#f87171',
          borderBottom: '1px solid rgba(239, 68, 68, 0.2)',
        }}
      >
        <AlertCircle size={14} />
        {error}
      </div>
    )}
    <textarea
      value={content}
      onChange={(e) => onChange(e.target.value)}
      className="memory-preview-editor-textarea flex-1 w-full p-4 resize-none outline-none font-mono text-[13px]"
      data-testid="memory-preview-editor-textarea"
      style={{
        background: 'var(--bg-primary)',
        color: 'var(--text-secondary)',
        border: 'none',
        lineHeight: 1.7,
      }}
      placeholder="输入 JSON 内容..."
      spellCheck={false}
    />
  </div>
);

// 主组件
export const MemoryPreview: React.FC<MemoryPreviewProps> = ({ 
  content, 
  onSave,
  isReadonly = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  // 解析 JSON
  const memoryData = useMemo((): MemoryData | null => {
    try {
      const data = JSON.parse(content);
      return data;
    } catch {
      return null;
    }
  }, [content]);
  
  // 过滤和搜索
  const filteredEntries = useMemo(() => {
    if (!memoryData?.entries) return [];
    
    let entries = [...memoryData.entries];
    
    // 按类别过滤
    if (selectedCategory) {
      entries = entries.filter(e => e.category === selectedCategory);
    }
    
    // 搜索过滤
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      entries = entries.filter(e => 
        e.content.toLowerCase().includes(query) ||
        e.tags.some(t => t.toLowerCase().includes(query))
      );
    }
    
    // 按重要性和更新时间排序
    entries.sort((a, b) => {
      if (b.importance !== a.importance) return b.importance - a.importance;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
    
    return entries;
  }, [memoryData, searchQuery, selectedCategory]);
  
  // 获取所有类别
  const categories = useMemo(() => {
    if (!memoryData?.entries) return [];
    const cats = new Set(memoryData.entries.map(e => e.category));
    return Array.from(cats);
  }, [memoryData]);
  
  // 切换卡片展开状态
  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);
  
  // 进入编辑模式
  const handleStartEdit = () => {
    setEditContent(content);
    setIsEditing(true);
    setSaveError(null);
  };
  
  // 取消编辑
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditContent('');
    setSaveError(null);
  };
  
  // 保存
  const handleSave = async () => {
    // 验证 JSON
    try {
      JSON.parse(editContent);
    } catch (e) {
      setSaveError('JSON 格式无效，请检查语法');
      return;
    }
    
    setIsSaving(true);
    setSaveError(null);
    
    try {
      await onSave(editContent);
      setIsEditing(false);
      setEditContent('');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setIsSaving(false);
    }
  };
  
  // 如果 JSON 解析失败，显示原始内容
  if (!memoryData && !isEditing) {
    return (
      <div className="memory-preview memory-preview-invalid h-full flex flex-col">
        <div 
          className="memory-preview-invalid-header flex items-center justify-between px-4 py-3 border-b"
          data-testid="memory-preview-invalid-header"
          style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}
        >
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            <AlertCircle size={14} />
            无法解析 JSON 格式
          </div>
          {!isReadonly && (
            <button
              onClick={handleStartEdit}
              className="memory-preview-edit-button flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors"
              data-testid="memory-preview-edit-button"
              style={{ 
                background: 'var(--bg-tertiary)', 
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <Edit2 size={12} />
              编辑原始内容
            </button>
          )}
        </div>
        <div className="memory-preview-invalid-content flex-1 overflow-auto p-4">
          <pre 
            className="text-sm font-mono whitespace-pre-wrap"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {content}
          </pre>
        </div>
      </div>
    );
  }
  
  return (
    <div className="memory-preview h-full flex flex-col">
      {/* 工具栏 */}
      <div 
        className="memory-preview-toolbar flex items-center justify-between px-4 py-2.5 border-b"
        data-testid="memory-preview-toolbar"
        style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}
      >
        <div className="memory-preview-toolbar-left flex items-center gap-3">
          {!isEditing && (
            <>
              {/* 搜索框 */}
              <div 
                className="memory-preview-search flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
                data-testid="memory-preview-search"
                style={{ 
                  background: 'var(--bg-tertiary)', 
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <Search size={12} style={{ color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索记忆..."
                  className="memory-preview-search-input bg-transparent outline-none text-xs w-32"
                  data-testid="memory-preview-search-input"
                  style={{ color: 'var(--text-secondary)' }}
                />
              </div>
              
              {/* 类别筛选 */}
              {categories.length > 1 && (
                <div className="memory-preview-category-filters flex items-center gap-1">
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className={`px-2 py-1 rounded text-[11px] transition-colors ${
                      !selectedCategory 
                        ? 'bg-zinc-600/50 text-zinc-200' 
                        : 'text-zinc-400 hover:text-zinc-300'
                    }`}
                  >
                    全部
                  </button>
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
                      data-testid={`memory-preview-category-${cat}`}
                      className={`px-2 py-1 rounded text-[11px] transition-colors ${
                        selectedCategory === cat 
                          ? 'bg-zinc-600/50 text-zinc-200' 
                          : 'text-zinc-400 hover:text-zinc-300'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          
          {isEditing && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              编辑模式 · JSON
            </span>
          )}
        </div>
        
        <div className="memory-preview-toolbar-actions flex items-center gap-2">
          {saveError && !isEditing && (
            <span className="memory-preview-save-error text-xs text-red-400">{saveError}</span>
          )}
          
          {isEditing ? (
            <>
              <button
                onClick={handleCancelEdit}
                disabled={isSaving}
                className="memory-preview-cancel-button flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors disabled:opacity-50"
                data-testid="memory-preview-cancel-button"
                style={{ 
                  color: 'var(--text-muted)',
                }}
              >
                <X size={12} />
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="memory-preview-save-button flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors disabled:opacity-50"
                data-testid="memory-preview-save-button"
                style={{ 
                  background: 'var(--bg-tertiary)', 
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                {isSaving ? (
                  <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save size={12} />
                )}
                保存
              </button>
            </>
          ) : (
            <>
              {!isReadonly && (
                <button
                  onClick={handleStartEdit}
                  className="memory-preview-edit-button flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors"
                  data-testid="memory-preview-edit-button"
                  style={{ 
                    background: 'var(--bg-tertiary)', 
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <Edit2 size={12} />
                  编辑
                </button>
              )}
            </>
          )}
        </div>
      </div>
      
      {/* 内容区域 */}
      <div className="memory-preview-content flex-1 overflow-hidden">
        {isEditing ? (
          <JsonEditor 
            content={editContent} 
            onChange={setEditContent}
            error={saveError}
          />
        ) : (
          <div 
            className="memory-preview-list h-full overflow-auto"
            data-testid="memory-preview-list"
            style={{ background: 'var(--bg-primary)' }}
          >
            {filteredEntries.length === 0 ? (
              searchQuery || selectedCategory ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Filter size={24} style={{ color: 'var(--text-muted)' }} className="mb-3" />
                  <p style={{ color: 'var(--text-muted)' }} className="text-sm">
                    没有匹配的记忆
                  </p>
                </div>
              ) : (
                <EmptyState />
              )
            ) : (
              <div className="memory-preview-list-inner p-4 space-y-3">
                {/* 统计信息 */}
                <div 
                  className="memory-preview-stats flex items-center justify-between text-xs pb-2"
                  data-testid="memory-preview-stats"
                  style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}
                >
                  <span>
                    {filteredEntries.length} 条记忆
                    {searchQuery && ` · 搜索: "${searchQuery}"`}
                    {selectedCategory && ` · 类别: ${selectedCategory}`}
                  </span>
                </div>
                
                {/* 卡片列表 */}
                <div className="memory-preview-cards space-y-3">
                  {filteredEntries.map((entry) => (
                    <MemoryCard
                      key={entry.id}
                      entry={entry}
                      isExpanded={expandedIds.has(entry.id)}
                      onToggle={() => toggleExpand(entry.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MemoryPreview;
