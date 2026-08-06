/**
 * Agent Studio — Full-screen agent builder
 *
 * Ultra-minimal theme with accent-adaptive coloring.
 * All neutral colors use --studio-* CSS variables for light/dark theme support.
 * Accent colors are computed at runtime from the selected avatar gradient.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { kernelApiFetch } from '../../api/gateway';
import type { Agent, AgentCreate, AgentUpdate } from '../../types/platform';
import { BUILT_IN_AVATARS, getAvatarById, parseAvatarUrl, buildAvatarUrl } from '../../types/platform';
import { useAgentContextStore } from '../../stores/agentContextStore';
import { Select, type SelectOption } from '../common/Select';
import { putAgentSkillBindings, putAgentToolBindings } from '../../api/platformAgent';
import { AssetBindingPanel, type AssetBindingPayload } from './AssetBindingPanel';
import { toast } from '../../utils/toast';
import { isDefaultAgentsMdTemplate, isKernelPromptContent } from '../../utils/agentsMd';

const MORPH_ANIMATIONS = [
  { id: 'wild', label: '狂放', duration: '4s', timing: 'ease-in-out', keyframes: `0%{border-radius:60% 40% 30% 70%/60% 30% 70% 40%;transform:rotate(0) scale(1)}25%{border-radius:20% 80% 70% 30%/80% 20% 80% 20%;transform:rotate(90deg) scale(1.1)}50%{border-radius:70% 30% 50% 50%/30% 70% 30% 70%;transform:rotate(180deg) scale(.9)}75%{border-radius:40% 60% 20% 80%/60% 40% 80% 20%;transform:rotate(270deg) scale(1.05)}100%{border-radius:60% 40% 30% 70%/60% 30% 70% 40%;transform:rotate(360deg) scale(1)}` },
  { id: 'serene', label: '沉静', duration: '6s', timing: 'cubic-bezier(0.4,0,0.2,1)', keyframes: `0%,100%{border-radius:50%;transform:scale(1)}50%{border-radius:40% 60% 60% 40%/60% 40% 40% 60%;transform:scale(1.15)}` },
  { id: 'fluid', label: '灵动', duration: '5s', timing: 'ease-in-out', keyframes: `0%{border-radius:50%;transform:scaleY(1) scaleX(1)}25%{border-radius:60% 60% 40% 40%/70% 70% 30% 30%;transform:scaleY(1.2) scaleX(.85)}50%{border-radius:50%;transform:scaleY(.85) scaleX(1.15)}75%{border-radius:40% 40% 60% 60%/30% 30% 70% 70%;transform:scaleY(1.15) scaleX(.9)}100%{border-radius:50%;transform:scaleY(1) scaleX(1)}` },
  { id: 'electric', label: '锐利', duration: '3s', timing: 'linear', keyframes: `0%{border-radius:50%;transform:rotate(0)}10%{border-radius:20% 80% 20% 80%;transform:rotate(15deg)}30%{border-radius:30% 70% 70% 30%;transform:rotate(20deg)}50%{border-radius:25% 75% 50% 50%;transform:rotate(10deg)}70%{border-radius:50% 50% 25% 75%;transform:rotate(15deg)}100%{border-radius:50%;transform:rotate(0)}` },
  { id: 'dreamy', label: '空灵', duration: '8s', timing: 'ease-in-out', keyframes: `0%,100%{border-radius:60% 40% 55% 45%/55% 45% 60% 40%;transform:translateY(0) rotate(0)}33%{border-radius:45% 55% 40% 60%/40% 60% 45% 55%;transform:translateY(-8px) rotate(3deg)}66%{border-radius:55% 45% 60% 40%/60% 40% 55% 45%;transform:translateY(5px) rotate(-2deg)}` },
  { id: 'fierce', label: '炽烈', duration: '4s', timing: 'cubic-bezier(0.68,-0.55,0.27,1.55)', keyframes: `0%,100%{border-radius:50%;transform:scale(1)}15%{border-radius:20% 80% 80% 20%;transform:scale(1.2)}30%{border-radius:80% 20% 20% 80%;transform:scale(.85)}45%{border-radius:30% 70% 50% 50%;transform:scale(1.15)}60%{border-radius:70% 30% 50% 50%;transform:scale(.9)}75%{border-radius:50% 50% 30% 70%;transform:scale(1.1)}` },
  { id: 'zen', label: '禅意', duration: '10s', timing: 'linear', keyframes: `0%{border-radius:55% 45% 50% 50%/50% 50% 55% 45%;transform:rotate(0) scale(1)}50%{border-radius:45% 55% 50% 50%/50% 50% 45% 55%;transform:rotate(180deg) scale(.98)}100%{border-radius:55% 45% 50% 50%/50% 50% 55% 45%;transform:rotate(360deg) scale(1)}` },
  { id: 'playful', label: '顽趣', duration: '2.5s', timing: 'cubic-bezier(0.34,1.56,0.64,1)', keyframes: `0%,100%{border-radius:50%;transform:scaleX(1) scaleY(1)}25%{border-radius:45% 55% 55% 45%;transform:scaleX(1.15) scaleY(.88)}50%{border-radius:50%;transform:scaleX(.9) scaleY(1.12)}75%{border-radius:55% 45% 45% 55%;transform:scaleX(1.08) scaleY(.94)}` },
];

/* ── Helpers ── */

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function extractAccentColors(gradient: string): { primary: string; secondary: string } {
  const hexes = gradient.match(/#[0-9A-Fa-f]{6}/g) || [];
  return {
    primary: hexes[0] || '#A855F7',
    secondary: hexes.length > 1 ? hexes[1] : (hexes[0] || '#EC4899'),
  };
}

/* ── Icons ── */

const CloseIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
);
const SparkleIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.8 5.4L19.2 10l-5.4 1.6L12 17l-1.8-5.4L4.8 10l5.4-1.6z" />
  </svg>
);
const CheckIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
);

/* ── Styles (all using CSS variables for theme support) ── */

const LABEL: React.CSSProperties = {
  fontSize: 11, fontWeight: 500, letterSpacing: 1,
  color: 'var(--studio-text-label)',
  display: 'block', marginBottom: 6,
};

const FIELD_LINE: React.CSSProperties = {
  borderBottom: '1px solid var(--studio-border-input)',
  paddingBottom: 10,
};

const INPUT: React.CSSProperties = {
  width: '100%', background: 'transparent',
  fontSize: 15, color: 'var(--studio-text-input)',
  border: 'none', outline: 'none',
};

/* ── Component ── */

interface AgentFormProps {
  agent?: Agent | null;
  onSave: (data: AgentCreate | AgentUpdate) => Promise<void>;
  onClose: () => void;
}

export const AgentForm: React.FC<AgentFormProps> = ({ agent, onSave, onClose }) => {
  const { llmConfigs, fetchLLMConfigs } = useAgentContextStore();
  const isEditing = !!agent;

  const [name, setName] = useState(agent?.name || '');
  const [description, setDescription] = useState(agent?.description || '');
  const parsed = parseAvatarUrl(agent?.avatar_url);
  const [avatarId, setAvatarId] = useState(parsed.avatarId);
  const [animIdx, setAnimIdx] = useState(parsed.animIdx);
  const [llmConfigId, setLlmConfigId] = useState(agent?.llm_config_id || '');

  const existingIsKernel = isKernelPromptContent(agent?.agents_md);
  const [useKernelPrompt, setUseKernelPrompt] = useState(isEditing ? existingIsKernel : true);
  const [agentsMd, setAgentsMd] = useState(isEditing && agent?.agents_md && !existingIsKernel ? agent.agents_md : '');
  const [kernelPrompt, setKernelPrompt] = useState<string>('');
  const [defaultAgentsMdTemplate, setDefaultAgentsMdTemplate] = useState<string>('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingBindings, setPendingBindings] = useState<AssetBindingPayload | null>(null);

  const avatar = getAvatarById(avatarId);
  const anim = MORPH_ANIMATIONS[animIdx];
  const animName = `studioBlob${animIdx}`;
  const accent = useMemo(() => extractAccentColors(avatar.gradient), [avatar.gradient]);

  const llmConfigOptions: SelectOption[] = useMemo(() => {
    const personal = llmConfigs.filter(c => !c.is_system);
    const official = llmConfigs.filter(c => c.is_system);
    const opts: SelectOption[] = [];
    if (personal.length) {
      opts.push({ value: '__p', label: '个人接入', groupHeader: true, disabled: true });
      personal.forEach(c => opts.push({
        value: c.id, label: c.name.replace(' (个人)', ''),
        description: `${c.provider}/${c.model}`, badge: '个人',
      }));
    }
    opts.push({ value: '__o', label: '官方提供', groupHeader: true, disabled: true });
    opts.push({ value: '', label: '使用默认配置' });
    official.forEach(c => opts.push({
      value: c.id,
      label: `${c.name}${c.is_default ? ' (默认)' : ''}`,
      description: `${c.provider}/${c.model}`,
    }));
    return opts;
  }, [llmConfigs]);

  useEffect(() => { fetchLLMConfigs(); }, [fetchLLMConfigs]);
  useEffect(() => {
    (async () => {
      try {
        const r = await kernelApiFetch('/api/v1/agents/kernel-prompt-preview');
        if (r.ok) { const d = await r.json(); setKernelPrompt(d.content); }
        if (agent?.id) {
          const r2 = await kernelApiFetch(`/api/v1/agents/${agent.id}/agents-md`);
          if (r2.ok) {
            const d2 = await r2.json();
            const template = d2.default_agents_md_template || '';
            if (d2.kernel_prompt_preview) setKernelPrompt(d2.kernel_prompt_preview);
            setDefaultAgentsMdTemplate(template);
            setUseKernelPrompt(isDefaultAgentsMdTemplate(d2.content || '', template));
            setAgentsMd(isDefaultAgentsMdTemplate(d2.content || '', template) ? '' : (d2.content || ''));
          }
        }
      } catch {}
    })();
  }, []);
  useEffect(() => {
    if (!llmConfigId && llmConfigs.length) {
      const d = llmConfigs.find(c => c.is_default);
      if (d) setLlmConfigId(d.id);
    }
  }, [llmConfigs, llmConfigId]);

  const handleSwitchToCustom = () => {
    setUseKernelPrompt(false);
    if (!agentsMd.trim()) setAgentsMd(defaultAgentsMdTemplate || kernelPrompt);
  };

  const handleSubmit = async () => {
    if (!name.trim()) { setError('请输入名称'); return; }
    setSaving(true); setError(null);
    try {
      await onSave({
        name: name.trim(), description: description.trim() || undefined,
        avatar_url: buildAvatarUrl(avatarId, animIdx),
        agents_md: useKernelPrompt ? defaultAgentsMdTemplate : agentsMd,
        llm_config_id: llmConfigId || undefined,
      } as AgentCreate | AgentUpdate);

      if (agent?.id && pendingBindings) {
        await Promise.all([
          putAgentSkillBindings(agent.id, pendingBindings.skillItems),
          putAgentToolBindings(agent.id, pendingBindings.toolItems),
        ]);
        toast.info('配置变更一般秒级生效，极端异常下最长 5 分钟生效');
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally { setSaving(false); }
  };

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] agent-studio"
      data-testid="agent-form"
      style={{ background: 'var(--studio-bg)' }}
    >
      {/* Ambient radial glow from avatar area */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `radial-gradient(ellipse 60% 70% at 20% 30%, ${hexToRgba(accent.primary, 0.024)}, transparent)`,
      }} />

      {/* ═══ Header — floating, transparent so glow bleeds through ═══ */}
      <header
        data-testid="agent-form-header"
        style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
        display: 'flex', alignItems: 'center', height: 56, padding: '0 32px',
        pointerEvents: 'none',
      }}
      >
        <button
          onClick={onClose}
          data-testid="agent-form-close"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 30, height: 30, borderRadius: 8,
            background: 'transparent', border: 'none',
            cursor: 'pointer', color: 'var(--text-muted)',
            pointerEvents: 'auto',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          <CloseIcon />
        </button>

        <div style={{ flex: 1 }} />

        {error && (
          <span
            className="agent-form-error"
            data-testid="agent-form-error"
            style={{
            fontSize: 12, color: 'var(--studio-text-muted)',
            padding: '5px 12px', borderRadius: 8,
            background: 'var(--studio-surface)', marginRight: 10,
            pointerEvents: 'auto',
          }}
          >
            {error}
          </span>
        )}

        <button onClick={handleSubmit} disabled={saving || !name.trim()} data-testid="agent-form-submit" style={{
          display: 'flex', alignItems: 'center', gap: 6,
          height: 36, padding: '0 20px', borderRadius: 999,
          background: `linear-gradient(135deg, ${accent.primary}, ${accent.secondary})`,
          border: 'none', cursor: saving ? 'wait' : 'pointer',
          color: '#fff', fontSize: 13, fontWeight: 500,
          opacity: !name.trim() ? 0.3 : 1,
          transition: 'opacity 0.15s',
          pointerEvents: 'auto',
          marginTop: 3,
        }}>
          {isEditing ? <CheckIcon /> : <SparkleIcon />}
          <span>{saving ? '保存中...' : isEditing ? '保存' : '创建'}</span>
        </button>
      </header>

      {/* ═══ Body — full viewport height, columns handle own top padding ═══ */}
      <div
        className="agent-form-body"
        data-testid="agent-form-body"
        style={{
        position: 'relative', zIndex: 10,
        display: 'flex', height: '100vh', minHeight: 0,
      }}
      >

        {/* ─── Left: Identity (borderless, blends with page) ─── */}
        <aside
          className="agent-form-identity-panel"
          data-testid="agent-form-identity-panel"
          style={{
          width: 400, flexShrink: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 28, padding: '44px 44px 40px',
          overflowY: 'auto',
        }}
        >
          {/* Blob */}
          <div style={{ position: 'relative', width: 200, height: 200, flexShrink: 0 }}>
            {/* 静态光晕层（不参与动画，避免 boxShadow 重绘） */}
            <div style={{
              position: 'absolute', left: -10, top: -10, width: 220, height: 220,
              borderRadius: '50%',
              background: avatar.gradient,
              filter: 'blur(50px)',
              opacity: 0.08,
            }} />
            {/* 变形头像 */}
            <div style={{
              position: 'absolute', left: 25, top: 25, width: 150, height: 150,
              borderRadius: 44,
              background: avatar.gradient,
              animation: `${animName} ${anim.duration} ${anim.timing} infinite`,
              willChange: 'border-radius, transform',
              backfaceVisibility: 'hidden',
            }} />
          </div>

          {/* Avatar color picker - PRD 430: 前台不展示头像编辑，已隐藏 */}
          {false && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              {BUILT_IN_AVATARS.map(av => (
                <button key={av.id} onClick={() => setAvatarId(av.id)} style={{
                  width: 24, height: 24, borderRadius: 8,
                  background: av.gradient, border: 'none', cursor: 'pointer',
                  outline: avatarId === av.id ? '1.5px solid var(--studio-avatar-ring)' : '1.5px solid transparent',
                  outlineOffset: 2, transition: 'all 0.15s',
                }} />
              ))}
            </div>
          )}

          {/* Mood selector - PRD 430: 前台不展示形象编辑，已隐藏 */}
          {false && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexWrap: 'wrap', gap: '4px 0',
            }}>
              {MORPH_ANIMATIONS.map((m, i) => (
                <button key={m.id} onClick={() => setAnimIdx(i)} style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '0 11px', height: 30,
                  background: 'none', border: 'none', cursor: 'pointer',
                }}>
                  <span style={{
                    fontSize: 13,
                    fontWeight: animIdx === i ? 500 : 400,
                    color: animIdx === i ? 'var(--studio-text-bright)' : 'var(--studio-text-faint)',
                    transition: 'color 0.15s',
                  }}>
                    {m.label}
                  </span>
                  {animIdx === i && (
                    <span style={{
                      width: 4, height: 4, borderRadius: 2,
                      background: accent.primary,
                    }} />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Fields — underline style */}
          <div className="agent-form-fields" data-testid="agent-form-fields" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 28 }}>
            <div className="agent-form-name-field">
              <span style={LABEL}>名称</span>
              <div style={FIELD_LINE}>
                <input value={name} onChange={e => setName(e.target.value)}
                  data-testid="agent-form-name-input"
                  placeholder="给 Agent 起个名字" style={INPUT} readOnly />
              </div>
            </div>
            <div className="agent-form-description-field">
              <span style={LABEL}>描述</span>
              <div style={FIELD_LINE}>
                <input value={description} onChange={e => setDescription(e.target.value)}
                  data-testid="agent-form-description-input"
                  placeholder="一句话介绍" style={INPUT} readOnly />
              </div>
            </div>
            {/* 模型选择 - PRD 430: 前台不展示模型选择，已隐藏 */}
            {false && (
              <div>
                <span style={LABEL}>模型</span>
                <Select
                  options={llmConfigOptions}
                  value={llmConfigId}
                  onChange={setLlmConfigId}
                  placeholder="选择模型"
                  variant="underline"
                  testId="agent-form-llm-select"
                  triggerTestId="agent-form-llm-select-trigger"
                  menuTestId="agent-form-llm-select-menu"
                  optionTestIdPrefix="agent-form-llm-select-option"
                />
              </div>
            )}
          </div>

        </aside>

        {/* ─── Center: System Prompt ─── */}
        <main
          className="agent-form-prompt-panel"
          data-testid="agent-form-prompt-panel"
          style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          gap: 14, padding: '68px 0 12px', minWidth: 0,
        }}
        >
          {/* Tab bar — title + frosted pill switcher */}
          <div className="agent-form-prompt-header" data-testid="agent-form-prompt-header" style={{ display: 'flex', alignItems: 'center', gap: 16, height: 36, padding: '0 8px' }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--studio-text-primary)' }}>
              系统提示词
            </span>
            <div className="agent-form-prompt-mode-switch" data-testid="agent-form-prompt-mode-switch" style={{
              display: 'inline-flex', borderRadius: 8, padding: 3,
              background: 'var(--studio-pill-bg)',
              backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            }}>
              <button type="button" onClick={() => setUseKernelPrompt(true)} data-testid="agent-form-kernel-mode" style={{
                padding: '4px 14px', fontSize: 12, fontWeight: 500, borderRadius: 6,
                border: 'none', cursor: 'pointer',
                background: useKernelPrompt ? 'var(--studio-pill-active)' : 'transparent',
                color: useKernelPrompt ? 'var(--studio-text-secondary)' : 'var(--studio-text-inactive)',
                transition: 'all 0.18s',
              }}>
                内核
              </button>
              <button type="button" onClick={handleSwitchToCustom} data-testid="agent-form-custom-mode" style={{
                padding: '4px 14px', fontSize: 12, fontWeight: 500, borderRadius: 6,
                border: 'none', cursor: 'pointer',
                background: !useKernelPrompt ? 'var(--studio-pill-active)' : 'transparent',
                color: !useKernelPrompt ? 'var(--studio-text-secondary)' : 'var(--studio-text-inactive)',
                transition: 'all 0.18s',
              }}>
                自定义
              </button>
            </div>
          </div>

          {/* Content */}
          {useKernelPrompt ? (
            <div
              className="agent-form-kernel-prompt"
              data-testid="agent-form-kernel-prompt"
              style={{
              flex: 1, overflow: 'auto', borderRadius: 16,
              background: 'var(--studio-surface)', padding: 24, minHeight: 0,
            }}
            >
              <p style={{ fontSize: 11, color: 'var(--studio-text-faint)', margin: '0 0 16px' }}>
                内核模式 · 随版本升级自动更新
              </p>
              <pre style={{
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                fontSize: 13, lineHeight: 1.75, color: 'var(--studio-text-body)',
                fontFamily: 'inherit', margin: 0,
              }}>
                {kernelPrompt || '加载中...'}
              </pre>
            </div>
          ) : (
            <textarea value={agentsMd} onChange={e => setAgentsMd(e.target.value)}
              data-testid="agent-form-custom-prompt"
              placeholder="定义 Agent 的角色、能力和行为..."
              style={{
                flex: 1, borderRadius: 16,
                background: 'var(--studio-surface)',
                padding: 24, minHeight: 0,
                fontSize: 13, lineHeight: 1.75, color: 'var(--studio-text-input)',
                border: 'none', outline: 'none', resize: 'none',
                fontFamily: 'inherit',
              }}
            />
          )}
        </main>

        {/* ─── Right: Capabilities (subtle background, no card) ─── */}
        <aside
          className="agent-form-capabilities-panel"
          data-testid="agent-form-capabilities-panel"
          style={{
          width: 440, flexShrink: 0,
          overflowY: 'auto',
          padding: '68px 28px 24px',
          background: 'var(--studio-surface-right)',
        }}
        >
          <div
            className="agent-form-capabilities-header"
            data-testid="agent-form-capabilities-header"
            style={{ marginBottom: 18, fontSize: 13, fontWeight: 600, color: 'var(--studio-text-primary)' }}
          >
            能力配置
          </div>
          <AssetBindingPanel
            agentId={agent?.id}
            accentColors={accent}
            onChange={setPendingBindings}
          />
        </aside>
      </div>

      <style>{`
        .agent-studio input::placeholder,
        .agent-studio textarea::placeholder {
          color: var(--studio-text-placeholder);
        }
        @keyframes ${animName} { ${anim.keyframes} }
      `}</style>
    </motion.div>,
    document.body
  );
};
