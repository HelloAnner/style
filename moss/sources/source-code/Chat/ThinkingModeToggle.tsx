/**
 * 深度思考模式切换组件 — Capabilities-Driven
 *
 * 根据模型 capabilities.reasoning 动态渲染：
 *   adaptive  → "自适应思考" 标签，无需用户干预
 *   budgeted  → 开/关 + 预算滑块
 *   toggle    → 自动 / 深度思考 / 快速 三选一
 *   effort    → 低 / 中 / 高 三档
 *   native    → "推理模式" 标签，不可关闭
 *   null      → 不显示
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AnimatePresence } from '../../lib/motion';
import { Brain, Sparkles, Zap, ChevronUp, Gauge, SlidersHorizontal } from 'lucide-react';
import { useAgentStore, type ThinkingMode } from '../../stores/agentStore';
import { useAgentContextStore } from '../../stores/agentContextStore';
import type { ReasoningConfig, ReasoningStrategy } from '../../types/platform';

/**
 * 全局开关：是否启用深度思考模式切换 UI。
 * 设为 false 时整个组件隐藏，但代码逻辑完整保留。
 * 待前端对 reasoning 输出有更好的展现方案后，改回 true 即可。
 */
const THINKING_MODE_ENABLED = false;

/* ── 当前模型的 reasoning 配置 ────────────────────────── */

function useReasoningConfig(): ReasoningConfig | null {
  const currentAgentId = useAgentContextStore((s) => s.currentAgentId);
  const agents = useAgentContextStore((s) => s.agents);
  const llmConfigs = useAgentContextStore((s) => s.llmConfigs);

  const agent = agents.find((a) => a.id === currentAgentId);
  if (!agent) return null;

  let config;
  if (agent.llm_config_id) {
    config = llmConfigs.find((c) => c.id === agent.llm_config_id);
  } else {
    config = llmConfigs.find((c) => c.is_default);
  }

  return config?.capabilities?.reasoning ?? null;
}

/* ── Toggle 模式选项（用于 toggle 策略）────────────── */

interface ToggleModeOption {
  value: ThinkingMode;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const TOGGLE_OPTIONS: ToggleModeOption[] = [
  {
    value: 'auto',
    label: '自动',
    description: '由模型自行判断是否需要深度思考',
    icon: <Sparkles size={14} />,
  },
  {
    value: 'enabled',
    label: '深度思考',
    description: '强制启用深度思考，推理更准确',
    icon: <Brain size={14} />,
  },
  {
    value: 'disabled',
    label: '快速',
    description: '跳过深度思考，响应更快',
    icon: <Zap size={14} />,
  },
];

/* ── Effort 选项（用于 o1/o3 的 effort 策略）────────── */

interface EffortOption {
  value: 'low' | 'medium' | 'high';
  label: string;
  icon: React.ReactNode;
}

const EFFORT_OPTIONS: EffortOption[] = [
  { value: 'low', label: '低', icon: <Zap size={14} /> },
  { value: 'medium', label: '中', icon: <SlidersHorizontal size={14} /> },
  { value: 'high', label: '高', icon: <Brain size={14} /> },
];

/* ── 共用颜色 ─────────────────────────────────────── */

function getModeColor(mode: string, active: boolean) {
  if (!active) return 'var(--text-muted)';
  if (mode === 'enabled' || mode === 'high') return 'var(--thinking-enabled-icon)';
  if (mode === 'disabled' || mode === 'low') return 'var(--thinking-disabled-icon)';
  return 'var(--thinking-auto-icon)';
}

/* ── 公共 Props ───────────────────────────────────── */

interface ThinkingModeToggleProps {
  disabled?: boolean;
}

/* ── Toggle 策略 UI（三选一下拉）──────────────────── */

const ToggleStrategyUI: React.FC<ThinkingModeToggleProps> = ({ disabled = false }) => {
  const thinkingMode = useAgentStore((s) => s.thinkingMode);
  const setThinkingMode = useAgentStore((s) => s.setThinkingMode);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node))
        setIsOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const currentOption = TOGGLE_OPTIONS.find((o) => o.value === thinkingMode)!;

  return (
    <div ref={containerRef} className="relative" data-testid="thinking-mode-toggle">
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        data-testid="thinking-mode-toggle-trigger"
        className="flex items-center transition-all duration-150
                   disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          height: 36, padding: '0 12px', gap: 6,
          borderRadius: 12, border: '1px solid var(--border-subtle)',
          background: 'transparent',
        }}
      >
        <span style={{ color: getModeColor(thinkingMode, true) }}>{currentOption.icon}</span>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{currentOption.label}</span>
        <ChevronUp
          size={12}
          style={{
            color: 'var(--text-muted)',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform 0.2s',
          }}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            data-testid="thinking-mode-toggle-menu"
            className="absolute bottom-full left-0 mb-2 z-50"
            style={{
              minWidth: 240, background: 'var(--dropdown-bg)',
              border: '1px solid var(--dropdown-border)', borderRadius: 12,
              boxShadow: 'var(--shadow-lg)', overflow: 'hidden',
            }}
          >
            <div style={{ padding: 6 }}>
              {TOGGLE_OPTIONS.map((option) => {
                const isSelected = thinkingMode === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => { setThinkingMode(option.value); setIsOpen(false); }}
                    data-testid={`thinking-mode-option-${option.value}`}
                    className="thinking-mode-option w-full flex items-center gap-3 rounded-lg transition-all duration-150 text-left"
                    style={{
                      padding: '10px 12px',
                      background: isSelected ? 'rgba(255,255,255,0.06)' : 'transparent',
                    }}
                  >
                    <span style={{ color: getModeColor(option.value, isSelected) }}>{option.icon}</span>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                        {option.label}
                      </span>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                        {option.description}
                      </p>
                    </div>
                    {isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: getModeColor(option.value, true) }} />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ── Effort 策略 UI（三档选择）─────────────────────── */

const EffortStrategyUI: React.FC<ThinkingModeToggleProps> = ({ disabled = false }) => {
  const thinkingMode = useAgentStore((s) => s.thinkingMode);
  const setThinkingMode = useAgentStore((s) => s.setThinkingMode);

  const effortMap: Record<string, 'low' | 'medium' | 'high'> = {
    disabled: 'low', auto: 'medium', enabled: 'high',
  };
  const reverseMap: Record<string, ThinkingMode> = {
    low: 'disabled', medium: 'auto', high: 'enabled',
  };
  const current = effortMap[thinkingMode] ?? 'medium';

  return (
    <div className="flex items-center gap-1" data-testid="thinking-mode-effort" style={{
      height: 36, padding: '0 4px', borderRadius: 12,
      border: '1px solid var(--border-subtle)',
    }}>
      <Gauge size={14} style={{ color: 'var(--text-muted)', marginLeft: 8, marginRight: 4 }} />
      {EFFORT_OPTIONS.map((opt) => {
        const isActive = current === opt.value;
        return (
          <button
            key={opt.value}
            disabled={disabled}
            onClick={() => setThinkingMode(reverseMap[opt.value])}
            data-testid={`thinking-mode-effort-${opt.value}`}
            className="thinking-mode-effort-option flex items-center gap-1 transition-all duration-150
                       disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              padding: '4px 10px', borderRadius: 8, fontSize: 13,
              background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
              fontWeight: isActive ? 500 : 400,
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};

/* ── 信息标签（adaptive / native）────────────────── */

const InfoBadge: React.FC<{ label: string; icon: React.ReactNode }> = ({ label, icon }) => (
  <div
    data-testid="thinking-mode-info"
    className="flex items-center gap-1.5"
    style={{
      height: 36, padding: '0 12px', borderRadius: 12,
      border: '1px solid var(--border-subtle)',
      color: 'var(--text-secondary)', fontSize: 13,
    }}
  >
    {icon}
    <span>{label}</span>
  </div>
);

/* ── 主组件 ───────────────────────────────────────── */

export const ThinkingModeToggle: React.FC<ThinkingModeToggleProps> = ({ disabled = false }) => {
  if (!THINKING_MODE_ENABLED) return null;

  const reasoning = useReasoningConfig();

  if (!reasoning) return null;

  const strategyUI: Record<ReasoningStrategy, React.ReactNode> = {
    toggle: <ToggleStrategyUI disabled={disabled} />,
    effort: <EffortStrategyUI disabled={disabled} />,
    adaptive: <InfoBadge label="自适应思考" icon={<Sparkles size={14} />} />,
    native: <InfoBadge label="推理模式" icon={<Brain size={14} />} />,
    budgeted: <ToggleStrategyUI disabled={disabled} />,
  };

  return <>{strategyUI[reasoning.strategy]}</>;
};
