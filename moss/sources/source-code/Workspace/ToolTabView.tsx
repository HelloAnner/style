/**
 * 工具标签页视图组件
 * 
 * 用于展示工具的详细定义信息：
 * - 工具名称和中文描述
 * - 参数列表（名称、类型、是否必填、描述）
 * - 完整的 JSON Schema 定义
 */

import React from 'react';
import { Wrench, Code, AlertCircle, CheckCircle } from 'lucide-react';
import type { WorkspaceTab } from '../../stores/previewStore';

// 工具参数信息
interface ToolParameter {
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

// 工具详情数据（通过 tab.metadata 传递）
interface ToolDetails {
  name: string;
  displayName: string;
  descriptionZh: string;
  description: string;
  category: string;
  enabled: boolean;
  source?: 'builtin' | 'workspace';
  parameters: {
    properties?: Record<string, { type?: string; description?: string }>;
    required?: string[];
  };
}

// Props for ToolTabView component
interface ToolTabViewProps {
  tab: WorkspaceTab;
}

// 类型颜色映射
const typeColors: Record<string, { text: string; bg: string }> = {
  string: { text: 'text-green-400', bg: 'bg-green-500/10' },
  integer: { text: 'text-blue-400', bg: 'bg-blue-500/10' },
  number: { text: 'text-blue-400', bg: 'bg-blue-500/10' },
  boolean: { text: 'text-amber-400', bg: 'bg-amber-500/10' },
  array: { text: 'text-purple-400', bg: 'bg-purple-500/10' },
  object: { text: 'text-cyan-400', bg: 'bg-cyan-500/10' },
};

// 分类颜色映射
const categoryColors: Record<string, { text: string; bg: string }> = {
  file: { text: 'text-amber-400', bg: 'bg-amber-500/10' },
  search: { text: 'text-blue-400', bg: 'bg-blue-500/10' },
  terminal: { text: 'text-slate-400', bg: 'bg-slate-500/10' },
  code: { text: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  task: { text: 'text-purple-400', bg: 'bg-purple-500/10' },
  memory: { text: 'text-pink-400', bg: 'bg-pink-500/10' },
  browser: { text: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  other: { text: 'text-zinc-400', bg: 'bg-zinc-500/10' },
};

// 分类中文名称
const categoryNames: Record<string, string> = {
  file: '文件操作',
  search: '搜索查询',
  terminal: '终端命令',
  code: '代码执行',
  task: '任务规划',
  memory: '记忆存储',
  browser: '浏览器',
  other: '其他',
};

export const ToolTabView: React.FC<ToolTabViewProps> = ({ tab }) => {
  const tool = tab.metadata as ToolDetails | undefined;
  
  if (!tool) {
    return (
      <div className="tool-tab-view-error h-full flex items-center justify-center">
        <div className="text-center">
          <AlertCircle size={40} className="mx-auto mb-3 text-zinc-600" />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>工具信息加载失败</p>
        </div>
      </div>
    );
  }
  
  // 提取参数列表
  const parameters: ToolParameter[] = Object.entries(tool.parameters?.properties || {}).map(
    ([name, schema]) => ({
      name,
      type: schema?.type || 'any',
      required: tool.parameters?.required?.includes(name) || false,
      description: schema?.description,
    })
  );
  
  // 按必填优先排序
  parameters.sort((a, b) => {
    if (a.required === b.required) return 0;
    return a.required ? -1 : 1;
  });
  
  const categoryColor = categoryColors[tool.category] || categoryColors.other;
  
  return (
    <div className="tool-tab-view h-full overflow-y-auto">
      {/* 工具头部信息 */}
      <div 
        className="tool-tab-view-header px-6 py-5 border-b"
        style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}
      >
        <div className="flex items-start gap-4">
          {/* 工具图标 */}
          <div 
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--bg-tertiary)' }}
          >
            <Wrench size={24} className="text-zinc-400" />
          </div>
          
          {/* 工具基本信息 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {tool.displayName}
              </h2>
              {tool.enabled ? (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-500/10 text-emerald-400">
                  <CheckCircle size={12} />
                  已启用
                </span>
              ) : (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-zinc-500/10 text-zinc-400">
                  已禁用
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-3 mb-3">
              <code 
                className="px-2 py-0.5 rounded text-xs font-mono"
                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
              >
                {tool.name}
              </code>
              <span className={`px-2 py-0.5 rounded text-xs ${categoryColor.bg} ${categoryColor.text}`}>
                {categoryNames[tool.category] || tool.category}
              </span>
              <span 
                className={`px-2 py-0.5 rounded text-xs ${
                  tool.source === 'builtin' || !tool.source
                    ? 'bg-zinc-500/10 text-zinc-400' 
                    : 'bg-emerald-500/10 text-emerald-400'
                }`}
              >
                {tool.source === 'builtin' || !tool.source ? '内核级' : '已安装'}
              </span>
            </div>
            
            <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {tool.descriptionZh || tool.description}
            </p>
          </div>
        </div>
      </div>
      
      {/* 参数列表 */}
      <div className="tool-tab-view-parameters px-6 py-5">
        <h3 className="text-sm font-medium mb-4" style={{ color: 'var(--text-primary)' }}>
          参数 ({parameters.length})
        </h3>
        
        {parameters.length === 0 ? (
          <div 
            className="tool-tab-view-parameters-empty py-8 text-center rounded-lg"
            style={{ background: 'var(--bg-tertiary)' }}
          >
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>此工具不需要参数</p>
          </div>
        ) : (
          <div className="tool-tab-view-parameters-list space-y-3">
            {parameters.map((param) => {
              const typeColor = typeColors[param.type] || { text: 'text-zinc-400', bg: 'bg-zinc-500/10' };
              
              return (
                <div 
                  key={param.name}
                  className="tool-tab-view-parameter p-4 rounded-lg"
                  data-testid={`tool-tab-view-parameter-${param.name}`}
                  style={{ background: 'var(--bg-tertiary)' }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span 
                      className="font-mono text-sm font-medium"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {param.name}
                    </span>
                    {param.required && (
                      <span className="text-red-400 text-xs">*必填</span>
                    )}
                    <span className={`px-1.5 py-0.5 rounded text-xs ${typeColor.bg} ${typeColor.text}`}>
                      {param.type}
                    </span>
                  </div>
                  {param.description && (
                    <p className="text-sm" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
                      {param.description}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {/* JSON Schema */}
      <div className="tool-tab-view-schema px-6 py-5 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Code size={16} className="text-zinc-500" />
          <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            工具定义 (JSON Schema)
          </h3>
        </div>
        
        <pre 
          className="tool-tab-view-schema-content p-4 rounded-lg overflow-x-auto text-xs font-mono"
          style={{ 
            background: 'var(--bg-tertiary)', 
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
          }}
        >
          {JSON.stringify({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          }, null, 2)}
        </pre>
      </div>
    </div>
  );
};

export default ToolTabView;
