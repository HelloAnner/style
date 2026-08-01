/**
 * agents.md 编辑组件
 * 
 * agents.md 是 Agent 的系统提示词配置文件，存在于 workspace 中。
 * Agent 可以通过 edit 工具自行编辑此文件来自我优化。
 * 
 * 支持两种模式：
 * - 内核模式：数据库内容为空，使用内置系统提示词
 * - 自定义模式：数据库保存用户/Agent 自定义系统提示词
 * 
 * 用户体验设计：
 * - 内核模式下显示内核提示词预览（只读）
 * - 用户点击"自定义"切换到自定义模式
 * - 可随时切换回内核模式
 * - Agent 可通过 edit 工具直接编辑 agents.md 文件
 */

import React, { useEffect, useState, useCallback } from 'react';
import { kernelApiFetch } from '../../api/gateway';
import { useAgentContextStore } from '../../stores/agentContextStore';
import type { AgentsMdResponse } from '../../types';
import { isDefaultAgentsMdTemplate } from '../../utils/agentsMd';
import { SidebarIcon } from './icons/SidebarIcon';

export const AgentsMd: React.FC = () => {
  const selectedAgentId = useAgentContextStore((s) => s.currentAgentId);
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [useKernelPrompt, setUseKernelPrompt] = useState(true);
  const [kernelPromptPreview, setKernelPromptPreview] = useState<string | null>(null);
  const [defaultAgentsMdTemplate, setDefaultAgentsMdTemplate] = useState<string>('');
  const [modifiedAt, setModifiedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  
  const hasChanges = content !== originalContent;
  
  // 获取 agents.md 内容
  useEffect(() => {
    if (!selectedAgentId) return;
    
    const fetchAgentsMd = async () => {
      setIsLoading(true);
      try {
        const response = await kernelApiFetch(`/api/v1/agents/${selectedAgentId}/agents-md`);
        if (response.ok) {
          const data: AgentsMdResponse = await response.json();
          setContent(data.content);
          setOriginalContent(data.content);
          setKernelPromptPreview(data.kernel_prompt_preview || null);
          setDefaultAgentsMdTemplate(data.default_agents_md_template || '');
          setUseKernelPrompt(isDefaultAgentsMdTemplate(data.content, data.default_agents_md_template || ''));
          setModifiedAt(data.modified_at || null);
        }
      } catch (error) {
        console.error('获取 agents.md 失败:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchAgentsMd();
  }, [selectedAgentId]);
  
  // 保存
  const handleSave = useCallback(async () => {
    if (!selectedAgentId || isSaving) return;
    
    // 在自定义模式下，没有更改就不保存
    if (!useKernelPrompt && !hasChanges) return;
    
    setIsSaving(true);
    setSaveStatus('idle');
    
    try {
      const response = await kernelApiFetch(`/api/v1/agents/${selectedAgentId}/agents-md`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
        }),
      });
      
      if (response.ok) {
        const data: AgentsMdResponse = await response.json();
        setContent(data.content);
        setOriginalContent(data.content);
        setUseKernelPrompt(isDefaultAgentsMdTemplate(data.content, data.default_agents_md_template || ''));
        setKernelPromptPreview(data.kernel_prompt_preview || null);
        setModifiedAt(data.modified_at || null);
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        setSaveStatus('error');
      }
    } catch (error) {
      console.error('保存 agents.md 失败:', error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  }, [selectedAgentId, content, defaultAgentsMdTemplate, useKernelPrompt, isSaving, hasChanges]);
  
  // 切换到自定义模式
  const switchToCustomMode = useCallback(() => {
    setUseKernelPrompt(false);
    // 如果当前没有自定义内容，用默认模板预填充。
    if (isDefaultAgentsMdTemplate(content, defaultAgentsMdTemplate)) {
      setContent(defaultAgentsMdTemplate || '');
    }
  }, [content, defaultAgentsMdTemplate]);
  
  // 切换回内核模式
  const switchToKernelMode = useCallback(async () => {
    setUseKernelPrompt(true);
    // 保存切换：清空自定义内容。
    setIsSaving(true);
    try {
      const response = await kernelApiFetch(`/api/v1/agents/${selectedAgentId}/agents-md`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: defaultAgentsMdTemplate,
        }),
      });
      
      if (response.ok) {
        const data: AgentsMdResponse = await response.json();
        setContent(data.content);
        setOriginalContent(data.content);
        setUseKernelPrompt(isDefaultAgentsMdTemplate(data.content, data.default_agents_md_template || ''));
        setKernelPromptPreview(data.kernel_prompt_preview || null);
        setModifiedAt(data.modified_at || null);
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 2000);
      }
    } catch (error) {
      console.error('切换模式失败:', error);
      setUseKernelPrompt(false);  // 回滚
    } finally {
      setIsSaving(false);
    }
  }, [selectedAgentId]);
  
  // 快捷键保存
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);
  
  return (
    <div className="flex flex-col h-full" data-testid="agents-md">
      {/* 标题栏 */}
      <div className="px-3 py-3 border-b border-surface-200 flex items-center justify-between" data-testid="agents-md-header">
        <div className="flex items-center gap-2">
          <SidebarIcon name="doc" size={14} testId="agents-md-header-icon" />
          <span className="text-xs text-zinc-400">系统提示词</span>
        </div>
        
        {/* 模式切换 */}
        <div className="flex items-center gap-2">
          {useKernelPrompt ? (
            <button
              data-testid="agents-md-switch-custom"
              onClick={switchToCustomMode}
              className="px-2 py-1 rounded text-[10px] font-medium flex items-center gap-1 
                         bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
              title="切换到自定义模式"
            >
              <SidebarIcon name="kernel" size={10} testId="agents-md-kernel-mode-icon" />
              内核模式
            </button>
          ) : (
            <>
              <button
                data-testid="agents-md-restore-kernel"
                onClick={switchToKernelMode}
                className="px-2 py-1 rounded text-[10px] font-medium flex items-center gap-1 
                           bg-surface-200 text-zinc-400 hover:bg-surface-300 transition-colors"
                title="切换回内核模式"
              >
                <SidebarIcon name="refresh" size={10} testId="agents-md-restore-kernel-icon" />
                恢复内核
              </button>
              <button
                data-testid="agents-md-save"
                onClick={handleSave}
                disabled={!hasChanges || isSaving}
                className={`px-2 py-1 rounded text-[10px] font-medium flex items-center gap-1 transition-colors
                            ${hasChanges 
                              ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30' 
                              : 'bg-surface-200 text-zinc-500 cursor-not-allowed'
                            }
                            ${saveStatus === 'success' ? 'bg-emerald-500/30 text-emerald-400' : ''}
                            ${saveStatus === 'error' ? 'bg-red-500/20 text-red-400' : ''}`}
              >
                {isSaving ? (
                  <div className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <SidebarIcon name="save" size={10} testId="agents-md-save-icon" />
                )}
                {saveStatus === 'success' ? '已保存' : saveStatus === 'error' ? '失败' : '保存'}
              </button>
            </>
          )}
        </div>
      </div>
      
      {/* 模式说明 */}
      <div className="px-3 py-2 border-b border-surface-200 bg-surface-100/50" data-testid="agents-md-mode-help">
        {useKernelPrompt ? (
          <div className="flex items-start gap-2">
            <SidebarIcon name="kernel" size={12} testId="agents-md-mode-help-icon" />
            <p className="text-[10px] text-zinc-500 leading-relaxed">
              <span className="text-emerald-400 font-medium">内核模式</span>
              <span className="mx-1">·</span>
              使用内置系统提示词，可随内核升级自动更新
              <span className="mx-1">·</span>
              <button
                data-testid="agents-md-help-switch-custom"
                onClick={switchToCustomMode}
                className="text-amber-400 hover:text-amber-300 underline underline-offset-2"
              >
                点击自定义
              </button>
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-2">
            <SidebarIcon name="edit" size={12} testId="agents-md-mode-help-icon" />
            <p className="text-[10px] text-zinc-500 leading-relaxed">
              <span className="text-amber-400 font-medium">自定义模式</span>
              <span className="mx-1">·</span>
              您的修改将完全替代内核提示词
              <span className="mx-1">·</span>
              <span className="text-zinc-600">⌘S 保存</span>
            </p>
          </div>
        )}
      </div>
      
      {/* 编辑区域 */}
      <div className="flex-1 overflow-hidden" data-testid="agents-md-body">
        {isLoading ? (
          <div className="flex items-center justify-center h-full" data-testid="agents-md-loading">
            <div className="animate-spin w-6 h-6 border-2 border-zinc-600 border-t-emerald-500 rounded-full" />
          </div>
        ) : useKernelPrompt ? (
          // 内核模式：只读预览
          <div className="h-full overflow-auto" data-testid="agents-md-kernel-preview">
            <pre className="px-3 py-3 text-xs text-zinc-400 font-mono leading-relaxed whitespace-pre-wrap" data-testid="agents-md-kernel-preview-content">
              {kernelPromptPreview || '加载中...'}
            </pre>
          </div>
        ) : (
          // 自定义模式：可编辑
          <textarea
            data-testid="agents-md-textarea"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="在此编辑自定义系统提示词...

定义 Agent 的：
• 身份和角色
• 专业领域
• 行为准则
• 语气风格
• 工具使用策略"
            className="w-full h-full px-3 py-3 bg-transparent text-xs text-zinc-300 
                       placeholder-zinc-600 resize-none focus:outline-none
                       font-mono leading-relaxed"
            spellCheck={false}
          />
        )}
      </div>
      
      {/* 底部状态 */}
      <div className="px-3 py-2 border-t border-surface-200 flex items-center justify-between" data-testid="agents-md-footer">
        <div className="text-[10px] text-zinc-600" data-testid="agents-md-status">
          {useKernelPrompt ? (
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              跟随内核更新
            </span>
          ) : (
            hasChanges ? (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                未保存更改
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-500"></span>
                自定义提示词
              </span>
            )
          )}
        </div>
        {modifiedAt && !useKernelPrompt && (
          <span className="text-[10px] text-zinc-600" data-testid="agents-md-modified-at">
            修改于 {new Date(modifiedAt).toLocaleString('zh-CN', { 
              month: 'numeric', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
        )}
      </div>
    </div>
  );
};
