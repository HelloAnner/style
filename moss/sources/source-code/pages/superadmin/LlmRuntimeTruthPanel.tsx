import React from 'react';
import { Activity, Brain, Check, Loader2, RefreshCw, Server, Zap } from 'lucide-react';
import { type SaLlmRuntimeConfig } from '../../api/superadminLlmConfigApi';

export interface LlmRuntimeTruthPanelProps {
  config: SaLlmRuntimeConfig | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

const iconSize = 14;

function formatTime(value: string | null): string {
  if (!value) return '未知';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function runningMode(thinkingMode: string): { label: string; icon: React.ReactNode; color: string } {
  if (thinkingMode === 'enabled') {
    return { label: '深度思考', icon: <Brain size={iconSize} />, color: 'var(--info)' };
  }
  if (thinkingMode === 'disabled') {
    return { label: '快速模式', icon: <Zap size={iconSize} />, color: 'var(--text-muted)' };
  }
  return { label: '自动', icon: <Activity size={iconSize} />, color: 'var(--warning)' };
}

function MetricCard({
  label,
  value,
  subtitle,
  accent,
  children,
}: {
  label: string;
  value?: React.ReactNode;
  subtitle?: React.ReactNode;
  accent?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      data-testid="superadmin-llm-runtime-truth-panel"
      style={{
        flex: 1,
        minWidth: 0,
        borderRadius: 10,
        border: `1px solid ${accent ? 'var(--info-border-soft)' : 'var(--border-subtle)'}`,
        background: accent ? 'var(--info-bg-soft)' : 'var(--bg-tertiary)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
      {value !== undefined && (
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: accent ? 'var(--info)' : 'var(--text-primary)',
            lineHeight: 1.3,
            wordBreak: 'break-word',
          }}
        >
          {value}
        </div>
      )}
      {children}
      {subtitle !== undefined && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{subtitle}</div>}
    </div>
  );
}

export const LlmRuntimeTruthPanel: React.FC<LlmRuntimeTruthPanelProps> = ({ config, loading, error, onRefresh }) => {
  const actual = config?.actual_request_parameters;
  const mode = runningMode(config?.thinking_mode || 'auto');

  return (
    <div
      style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: 12,
        background: 'var(--bg-card)',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div data-testid="superadmin-llm-runtime-truth-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Server size={18} style={{ color: 'var(--info)', flexShrink: 0 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>当前真实请求参数</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>来自 Kernel 运行时解析，反映真正发往模型的参数</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          title="刷新"
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-tertiary)',
            color: 'var(--text-secondary)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? <Loader2 size={iconSize} /> : <RefreshCw size={iconSize} />}
        </button>
      </div>

      {error && (
        <div
          style={{
            border: '1px solid var(--danger-border-soft)',
            background: 'var(--danger-bg-soft)',
            color: 'var(--danger)',
            borderRadius: 8,
            padding: '9px 10px',
            fontSize: 13,
          }}
        >
          获取真实参数失败：{error}
        </div>
      )}

      {!config && !loading && !error && (
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>点击刷新获取当前真实请求参数</div>
      )}

      {config && actual && (
        <>
          <div data-testid="superadmin-llm-runtime-truth-metrics" style={{ display: 'flex', gap: 12 }}>
            <MetricCard
              label="真实模型"
              value={actual.model}
              subtitle={`provider: ${config.provider}`}
              accent
            />
            <MetricCard label="运行模式" subtitle={mode.label}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: mode.color, fontSize: 16, fontWeight: 600 }}>
                {mode.icon}
                {mode.label}
              </div>
            </MetricCard>
            <MetricCard label="Temperature" value={actual.temperature} />
            <MetricCard label="Max Tokens" value={actual.max_tokens.toLocaleString()} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  borderRadius: 999,
                  padding: '3px 10px',
                  fontSize: 12,
                  border: `1px solid ${actual.stream ? 'var(--success-border-soft)' : 'var(--border-subtle)'}`,
                  background: actual.stream ? 'var(--success-bg-soft)' : 'var(--bg-tertiary)',
                  color: actual.stream ? 'var(--success)' : 'var(--text-muted)',
                }}
              >
                <Check size={12} />
                Stream {actual.stream ? '开启' : '关闭'}
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>解析于 {formatTime(config.resolved_at)}</div>
          </div>
        </>
      )}
    </div>
  );
};

export default LlmRuntimeTruthPanel;
