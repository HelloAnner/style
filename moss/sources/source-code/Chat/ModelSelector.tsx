/**
 * 模型切换器 — 输入框内联样式
 *
 * 与 Agent 设置页完全同步：切换直接更新 Agent 的 llm_config_id，
 * 展示所有可用模型（官方 + 用户自定义）。
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { AnimatePresence } from '../../lib/motion';
import { useAgentContextStore } from '../../stores/agentContextStore';
import { agentApi } from '../../api/platform';
import type { LLMConfig } from '../../types/platform';

const MODEL_DISPLAY: Record<string, { label: string; badge?: string; desc: string }> = {
  'claude-sonnet-4-6': { label: 'Sonnet 4.6', badge: '均衡', desc: '速度与质量的最佳平衡' },
  'claude-opus-4-6':   { label: 'Opus 4.6', badge: '旗舰', desc: '最强推理，适合复杂任务' },
  'glm-5':             { label: 'GLM 5', desc: '智谱旗舰，中文理解出色' },
  'gpt-5.4':           { label: 'GPT 5.4', desc: 'OpenAI 最新，全能型选手' },
};

function getDisplayInfo(config: LLMConfig) {
  const mapped = MODEL_DISPLAY[config.model];
  if (mapped) return mapped;
  return {
    label: config.name.replace(' (个人)', ''),
    badge: config.is_system ? undefined : '个人',
    desc: `${config.provider}/${config.model}`,
  };
}

function getShortLabel(config: LLMConfig) {
  return MODEL_DISPLAY[config.model]?.label ?? config.name.replace(' (个人)', '');
}

const ChevronSvg: React.FC<{ open: boolean }> = ({ open }) => (
  <svg
    width={12} height={12} viewBox="0 0 16 16" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{
      transition: 'transform 180ms cubic-bezier(.23,1,.32,1)',
      transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
      flexShrink: 0,
    }}
  >
    <path d="M4 6l4 4 4-4" />
  </svg>
);

interface ModelSelectorProps {
  disabled?: boolean;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ disabled = false }) => {
  const [open, setOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentAgentId = useAgentContextStore(s => s.currentAgentId);
  const agents = useAgentContextStore(s => s.agents);
  const llmConfigs = useAgentContextStore(s => s.llmConfigs);
  const updateAgent = useAgentContextStore(s => s.updateAgent);

  const agent = agents.find(a => a.id === currentAgentId);

  const personalConfigs = llmConfigs.filter(c => !c.is_system);
  const officialConfigs = llmConfigs.filter(c => c.is_system);

  const resolvedConfig = (() => {
    if (agent?.llm_config_id) {
      const found = llmConfigs.find(c => c.id === agent.llm_config_id);
      if (found) return found;
    }
    return llmConfigs.find(c => c.is_default) ?? officialConfigs[0] ?? null;
  })();

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSelect = useCallback(async (config: LLMConfig) => {
    if (!currentAgentId || updating) return;
    if (config.id === resolvedConfig?.id) {
      setOpen(false);
      return;
    }
    setUpdating(true);
    try {
      const updated = await agentApi.update(currentAgentId, { llm_config_id: config.id });
      updateAgent(updated);
    } catch (e) {
      console.error('[ModelSelector] 更新模型失败:', e);
    } finally {
      setUpdating(false);
      setOpen(false);
    }
  }, [currentAgentId, resolvedConfig, updating, updateAgent]);

  if (!resolvedConfig || llmConfigs.length === 0) return null;

  const renderItem = (cfg: LLMConfig) => {
    const info = getDisplayInfo(cfg);
    const isActive = cfg.id === resolvedConfig.id;
    return (
      <button
        key={cfg.id}
        onClick={() => handleSelect(cfg)}
        data-testid={`model-selector-option-${cfg.id}`}
        className="w-full flex items-start gap-2.5 rounded-lg transition-colors duration-75"
        style={{
          padding: '8px 10px',
          background: isActive ? 'var(--hover-bg)' : 'transparent',
          border: 'none',
          cursor: updating ? 'wait' : 'pointer',
          textAlign: 'left',
          opacity: updating && !isActive ? 0.5 : 1,
        }}
        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--hover-bg)'; }}
        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
      >
        <span
          className="flex-shrink-0 flex items-center justify-center"
          style={{ width: 16, height: 16, marginTop: 1 }}
        >
          {isActive && (
            <motion.svg
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              width={14} height={14} viewBox="0 0 16 16" fill="none"
              stroke="var(--text-primary)" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M3 8.5l3.5 3.5 6.5-8" />
            </motion.svg>
          )}
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="flex items-center gap-1.5">
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>
              {info.label}
            </span>
            {info.badge && (
              <span style={{
                fontSize: 10, fontWeight: 600, padding: '1px 5px', borderRadius: 4,
                background: 'var(--bg-tertiary)', color: 'var(--text-muted)', lineHeight: 1.4,
              }}>
                {info.badge}
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.3 }}>
            {info.desc}
          </div>
        </div>
      </button>
    );
  };

  return (
    <div ref={containerRef} className="relative" style={{ zIndex: open ? 60 : 'auto' }} data-testid="model-selector">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(v => !v)}
        data-testid="model-selector-trigger"
        className="flex items-center transition-colors duration-100 disabled:opacity-40"
        style={{
          gap: 3, padding: '4px 6px', borderRadius: 6,
          cursor: disabled ? 'not-allowed' : 'pointer',
          background: 'transparent', color: 'var(--text-muted)',
          fontSize: 13, fontWeight: 500, lineHeight: 1,
          border: 'none', whiteSpace: 'nowrap',
        }}
        onMouseEnter={e => { if (!disabled) (e.currentTarget.style.background = 'var(--hover-bg)', e.currentTarget.style.color = 'var(--text-secondary)'); }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
      >
        {getShortLabel(resolvedConfig)}
        <ChevronSvg open={open} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
            data-testid="model-selector-menu"
            style={{
              position: 'absolute', bottom: '100%', left: 0,
              marginBottom: 6, minWidth: 220, maxWidth: 280,
              padding: 4, borderRadius: 12,
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)',
            }}
          >
            {personalConfigs.length > 0 && (
              <>
                <div
                  className="px-2.5 pt-1.5 pb-1"
                  data-testid="model-selector-group-personal"
                  style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.03em' }}
                >
                  个人接入
                </div>
                {personalConfigs.map(renderItem)}
                <div style={{ height: 1, margin: '4px 8px', background: 'var(--border-subtle)' }} />
              </>
            )}

            <div
              className="px-2.5 pt-1.5 pb-1"
              data-testid="model-selector-group-official"
              style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.03em' }}
            >
              官方提供
            </div>
            {officialConfigs.map(renderItem)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
