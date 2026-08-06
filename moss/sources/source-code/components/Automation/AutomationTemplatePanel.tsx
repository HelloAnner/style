import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { listTemplates, createPipeline, type AutomationAsset } from '../../api/automations';
import { getAvatarById } from '../../types/platform';

import { cronToHuman, triggerToHuman } from './automationSchedule';

function extractAccentColors(gradient: string): { primary: string; secondary: string } {
  const hexes = gradient.match(/#[0-9A-Fa-f]{6}/g) || [];
  return {
    primary: hexes[0] || '#A855F7',
    secondary: hexes.length > 1 ? hexes[1] : (hexes[0] || '#EC4899'),
  };
}

interface Props {
  onClose: () => void;
  onCreated: (instanceId?: string) => void;
  onDesign?: () => void;
  onManualCreate?: () => void;
  onAdvancedCreate?: (template: AutomationAsset) => void;
  agentId: string;
  agentAvatarUrl?: string | null;
}

const AutomationTemplatePanel: React.FC<Props> = ({ onClose, onCreated, onDesign, onManualCreate, onAdvancedCreate, agentId, agentAvatarUrl }) => {
  const [assets, setAssets] = useState<AutomationAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AutomationAsset | null>(null);
  const [creating, setCreating] = useState(false);
  const [vars, setVars] = useState<Record<string, unknown>>({});

  const accent = useMemo(() => {
    const avatar = getAvatarById(agentAvatarUrl || null);
    return extractAccentColors(avatar.gradient);
  }, [agentAvatarUrl]);

  useEffect(() => {
    listTemplates().then(a => { setAssets(a); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const handleSelect = useCallback((asset: AutomationAsset) => {
    setSelected(asset);
    const defaults: Record<string, unknown> = {};
    if (asset.variables) {
      Object.entries(asset.variables).forEach(([k, v]) => { defaults[k] = v.default ?? ''; });
    }
    setVars(defaults);
  }, []);

  const handleCreate = useCallback(async () => {
    if (!selected || !agentId) return;
    setCreating(true);
    try {
      const pipeline = await createPipeline({ source_template: selected.name, agent_id: agentId, variable_overrides: vars });
      window.dispatchEvent(new CustomEvent('asset-changed', { detail: { type: 'automations' } }));
      onCreated(pipeline?.id);
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  }, [selected, agentId, vars, onCreated]);

  return createPortal(
    <>
      <style>{`
        @keyframes atpFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes atpScaleIn { from { opacity: 0; transform: scale(0.97) } to { opacity: 1; transform: scale(1) } }
      `}</style>
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center"
        data-testid="automation-template-panel"
        style={{ background: 'var(--modal-backdrop)', animation: 'atpFadeIn 0.15s ease-out' }}
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div
          data-testid="automation-template-panel-modal"
          style={{
            width: '90vw', maxWidth: 720, height: 520,
            background: 'var(--modal-bg, var(--bg-secondary))',
            border: '1px solid var(--modal-border, var(--border-subtle))',
            borderRadius: 20, display: 'flex', flexDirection: 'column',
            animation: 'atpScaleIn 0.18s ease-out',
            boxShadow: '0 24px 80px rgba(0,0,0,0.3)',
          }}
        >
          {/* Header */}
          <div data-testid="automation-template-panel-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" style={{ color: 'var(--text-primary)' }}>
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
                {selected ? '配置自动化任务' : '创建自动化任务'}
              </span>
            </div>
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          {/* Content */}
          <div data-testid="automation-template-panel-content" style={{ flex: 1, overflow: 'auto', padding: 24 }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>加载中...</div>
            ) : selected ? (
              /* Quick config for selected template */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{selected.display_name || selected.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{selected.description}</div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: 'var(--hover-bg)', color: 'var(--text-muted)' }}>
                      {triggerToHuman({ type: selected.trigger_type })}
                    </span>
                    {selected.cron_expr && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{cronToHuman(selected.cron_expr)}</span>}
                  </div>
                </div>
                {Object.keys(selected.variables).length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase' as const, letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 12 }}>变量配置</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {Object.entries(selected.variables).map(([key, schema]) => (
                        <div key={key}>
                          <label style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>{schema.label || key}</label>
                          <input
                            type={schema.type === 'number' ? 'number' : 'text'}
                            value={String(vars[key] ?? '')}
                            onChange={e => setVars(prev => ({ ...prev, [key]: schema.type === 'number' ? Number(e.target.value) : e.target.value }))}
                            placeholder={schema.description}
                            style={{
                              width: '100%', padding: '8px 0', fontSize: 13, color: 'var(--text-primary)',
                              background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-subtle)',
                              outline: 'none', transition: 'border-color 0.2s',
                            }}
                            onFocus={e => { e.currentTarget.style.borderBottomColor = 'var(--text-primary)'; }}
                            onBlur={e => { e.currentTarget.style.borderBottomColor = 'var(--border-subtle)'; }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8 }}>
                  <button
                    onClick={() => setSelected(null)}
                    style={{ padding: '8px 20px', fontSize: 13, borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}
                  >返回</button>
                  {onAdvancedCreate && (
                    <button
                      onClick={() => onAdvancedCreate(selected)}
                      style={{
                        padding: '8px 20px', fontSize: 13, borderRadius: 10,
                        border: '1px solid var(--border-subtle)', background: 'transparent',
                        color: 'var(--text-secondary)', cursor: 'pointer',
                      }}
                    >高级设置</button>
                  )}
                  <button
                    onClick={handleCreate}
                    disabled={creating}
                    style={{
                      padding: '8px 24px', fontSize: 13, fontWeight: 500, borderRadius: 10,
                      border: 'none', background: 'var(--text-primary)', color: 'var(--bg-primary)',
                      cursor: creating ? 'wait' : 'pointer', opacity: creating ? 0.6 : 1,
                    }}
                  >{creating ? '创建中...' : '创建并激活'}</button>
                </div>
              </div>
            ) : (
              /* Template gallery */
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignContent: 'flex-start' }}>
                {/* Create from scratch card */}
                <div
                  onClick={() => { onClose(); onManualCreate?.(); }}
                  style={{
                    flex: '0 0 auto', width: 200, minHeight: 120, borderRadius: 14, cursor: 'pointer',
                    border: '1.5px dashed var(--border-subtle)', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 8, padding: 20,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderStyle = 'solid'; e.currentTarget.style.borderColor = 'var(--text-muted)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderStyle = 'dashed'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                >
                  <svg width={24} height={24} viewBox="0 0 24 24" fill="none" style={{ color: 'var(--text-muted)' }}>
                    <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>从零开始</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', opacity: 0.6 }}>手动配置创建</span>
                </div>

                {assets.map(asset => (
                  <div
                    key={asset.name}
                    onClick={() => handleSelect(asset)}
                    style={{
                      flex: '0 0 auto', width: Math.min(280, Math.max(200, 200 + (asset.description?.length || 0) * 0.5)),
                      borderRadius: 14, cursor: 'pointer', padding: 18,
                      border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)',
                      transition: 'all 0.2s', display: 'flex', flexDirection: 'column', gap: 8,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,0.12)'; e.currentTarget.style.borderColor = 'var(--text-muted)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: 'var(--hover-bg)', color: 'var(--text-muted)', fontWeight: 500 }}>
                        {triggerToHuman({ type: asset.trigger_type })}
                      </span>
                      {asset.created_by_name && (
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', opacity: 0.6 }}>by {asset.created_by_name}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{asset.display_name || asset.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>
                      {asset.description || '暂无描述'}
                    </div>
                    {asset.cron_expr && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', opacity: 0.7, marginTop: 'auto' }}>
                        {cronToHuman(asset.cron_expr)}
                      </div>
                    )}
                  </div>
                ))}

                {false && assets.length === 0 && null}
              </div>
            )}
          </div>

          {/* 让 Corevo 帮你设计 — 底部入口（Agent 主色调渐变） */}
          {!selected && (
            <div style={{ padding: '0 24px 20px', flexShrink: 0 }}>
              <style>{`
                @keyframes atpGradientFlow {
                  0%   { background-position: 0% 50%; }
                  50%  { background-position: 100% 50%; }
                  100% { background-position: 0% 50%; }
                }
              `}</style>
              <button
                onClick={() => { onClose(); onDesign?.(); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                  padding: '16px 20px', borderRadius: 14, cursor: 'pointer',
                  border: 'none', position: 'relative', overflow: 'hidden',
                  background: `linear-gradient(135deg, ${accent.primary}18 0%, ${accent.secondary}18 50%, ${accent.primary}10 100%)`,
                  backgroundSize: '200% 200%',
                  animation: 'atpGradientFlow 6s ease infinite',
                  transition: 'transform 0.2s, box-shadow 0.3s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = `0 8px 32px ${accent.primary}20, 0 0 0 1px ${accent.primary}30`;
                  e.currentTarget.style.background = `linear-gradient(135deg, ${accent.primary}28 0%, ${accent.secondary}28 50%, ${accent.primary}18 100%)`;
                  e.currentTarget.style.backgroundSize = '200% 200%';
                  e.currentTarget.style.animation = 'atpGradientFlow 4s ease infinite';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.background = `linear-gradient(135deg, ${accent.primary}18 0%, ${accent.secondary}18 50%, ${accent.primary}10 100%)`;
                  e.currentTarget.style.backgroundSize = '200% 200%';
                  e.currentTarget.style.animation = 'atpGradientFlow 6s ease infinite';
                }}
              >
                {/* Sparkle icon with gradient fill */}
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: `linear-gradient(135deg, ${accent.primary}, ${accent.secondary})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: `0 4px 12px ${accent.primary}40`,
                }}>
                  <svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5L12 2z" fill="white" opacity="0.95"/>
                    <path d="M5 5l1.5 3L5 9.5 6.5 8 5 5z" fill="white" opacity="0.6"/>
                    <path d="M19 15l-1.5 3 1.5 1.5-1.5-1.5L19 15z" fill="white" opacity="0.5"/>
                  </svg>
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>让 Moss 帮你设计</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.4 }}>描述你的需求，Agent 会帮你创建最适合的自动化任务</div>
                </div>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" style={{ color: 'var(--text-muted)', flexShrink: 0, opacity: 0.5 }}>
                  <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
};

export default AutomationTemplatePanel;
