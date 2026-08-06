/**
 * ToolStudio — 全屏工具创建/编辑面板
 *
 * 设计理念：
 * - 全屏弹窗（createPortal），风格对标 AgentForm 的 Studio 全屏体验
 * - 克制的创意：黑白灰基调，大量留白，微动效仅用在状态切换
 * - 渐进式流程（非分步向导）：左侧「工具身份」+ 右侧「工具运行」
 * - 右侧双 Tab 切换：「连接 API」↔「编写逻辑 (CoreX)」
 * - 明暗主题适配
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { tenantAssetsApi, type SecretDeclaration, type ToolConfig } from '../../api/tenants';
import { useAuthStore } from '../../stores/authStore';
import { fetchMedia } from '../../lib/media';
import { SecretConfigPanel } from './SecretConfigPanel';
import { CorevoDesignButton } from '../common/CorevoDesignButton';
import { ToolIconPicker } from './ToolIconPicker';

/* ── Icons ── */

const CloseIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const BackIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12,19 5,12 12,5"/>
  </svg>
);

const PlusIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const TrashIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
  </svg>
);

/* ── Types ── */

type RuntimeMode = 'api' | 'corex';

interface ParamDef {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  description: string;
}

type DisplayStyle = 'default' | 'card';

interface ToolFormData {
  name: string;
  displayName: string;
  descriptionAgent: string;
  descriptionUser: string;
  params: ParamDef[];
  runtimeMode: RuntimeMode;
  apiUrl: string;
  apiMethod: string;
  apiAuthType: string;
  apiAuthKey: string;
  apiParamsMapping: Record<string, string>;
  apiHeaders: Record<string, string>;
  script: string;
  secrets: SecretDeclaration[];
  timeout: number;
  retry: number;
  maxResultSize: number;
  dependencies: string;
  displayStyle: DisplayStyle;
  displayIcon: string;
  displayActionText: string;
  displayCardDescription: string;
  displayCardImagePreview: string;
  displayCardImageFile: string | null;
}

const EMPTY_FORM: ToolFormData = {
  name: '',
  displayName: '',
  descriptionAgent: '',
  descriptionUser: '',
  params: [],
  runtimeMode: 'api',
  apiUrl: '',
  apiMethod: 'GET',
  apiAuthType: 'none',
  apiAuthKey: '',
  apiParamsMapping: {},
  apiHeaders: {},
  script: `async def execute(ctx, **params):
    """
    CoreX 工具入口函数
    ctx: ToolContext — 可用 API:
      ctx.secrets      — 已解析的密钥字典
      ctx.http          — 复用连接池的 HTTP 客户端 (httpx.AsyncClient)
      ctx.call_llm()    — 调用大模型 (支持多模态、json_mode)
      ctx.create_agent() — 创建 Agent 节点 (支持调用已有伙伴 / 临时创建 / 派生分身)
      ctx.call_tool()   — 调用其他已注册工具
      ctx.save_file()   — 保存文件到会话目录
      ctx.read_file()   — 读取文件
      ctx.cache         — 会话级缓存字典
      ctx.report_progress() — 向前端报告执行进度
    params: 用户传入的参数
    """
    result = {}
    return result
`,
  secrets: [],
  timeout: 120,
  retry: 0,
  maxResultSize: 25000,
  dependencies: '',
  displayStyle: 'default',
  displayIcon: 'wrench',
  displayActionText: '',
  displayCardDescription: '',
  displayCardImagePreview: '',
  displayCardImageFile: null,
};

export interface ToolStudioProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  onDesign?: (prompt: string) => void;
  editTool?: ToolConfig | null;
  packName?: string;
}

/* ── Helpers ── */

function formToToolConfig(form: ToolFormData, packName?: string): { config: Record<string, unknown>; script?: string; pack?: string } {
  const config: Record<string, unknown> = {
    name: form.name,
    display_name: form.displayName || undefined,
    description: form.descriptionAgent,
    description_zh: form.descriptionUser || undefined,
    params: Object.fromEntries(
      form.params.map(p => [p.name, {
        type: p.type,
        required: p.required,
        description: p.description,
      }])
    ),
    secrets: form.secrets.length > 0 ? form.secrets : undefined,
  };

  if (form.runtimeMode === 'api') {
    config.api = {
      url: form.apiUrl,
      method: form.apiMethod,
      ...(form.apiAuthType !== 'none' && { auth: { type: form.apiAuthType, key: form.apiAuthKey } }),
      ...(Object.keys(form.apiParamsMapping).length > 0 && { params_mapping: form.apiParamsMapping }),
      ...(Object.keys(form.apiHeaders).length > 0 && { headers: form.apiHeaders }),
    };
  }

  if (form.runtimeMode === 'corex') {
    if (form.timeout !== 120) config.timeout = form.timeout;
    if (form.retry > 0) config.retry = form.retry;
    if (form.maxResultSize !== 25000) config.max_result_size = form.maxResultSize;
    const deps = form.dependencies.split(',').map(d => d.trim()).filter(Boolean);
    if (deps.length > 0) config.dependencies = deps;
  }

  const display: Record<string, unknown> = { style: form.displayStyle };
  if (form.displayIcon && form.displayIcon !== 'wrench') display.icon = form.displayIcon;
  if (form.displayActionText) display.action_text = form.displayActionText;
  if (form.displayStyle === 'card') {
    if (form.displayCardDescription) display.card_description = form.displayCardDescription;
    if (form.displayCardImagePreview) display.card_image = 'display_card.png';
  }
  const hasDisplayConfig = Object.keys(display).length > 1 || display.style !== 'default';
  if (hasDisplayConfig) config.display = display;

  return {
    config,
    script: form.runtimeMode === 'corex' ? form.script : undefined,
    pack: packName || undefined,
  };
}

function normalizeDependencies(rawDeps: unknown): string {
  if (Array.isArray(rawDeps)) {
    return rawDeps.map(item => String(item).trim()).filter(Boolean).join(', ');
  }
  if (typeof rawDeps === 'string') {
    return rawDeps.trim();
  }
  return '';
}

function toolConfigToForm(tool: ToolConfig): ToolFormData {
  const params: ParamDef[] = [];
  const raw = tool as Record<string, any>;
  const paramsObj = (tool.params || raw['config']?.params || {}) as Record<string, any>;
  for (const [name, def] of Object.entries(paramsObj)) {
    params.push({
      name,
      type: def?.type || 'string',
      required: def?.required ?? false,
      description: def?.description || '',
    });
  }

  const api = (tool.api || raw['config']?.api || {}) as any;
  const hasScript = tool._has_script ?? false;

  return {
    name: tool.name || '',
    displayName: tool.display_name || '',
    descriptionAgent: tool.description || '',
    descriptionUser: tool.description_zh || '',
    params,
    runtimeMode: hasScript ? 'corex' : 'api',
    apiUrl: api?.url || '',
    apiMethod: api?.method || 'GET',
    apiAuthType: api?.auth?.type || 'none',
    apiAuthKey: api?.auth?.key || '',
    apiParamsMapping: api?.params_mapping || {},
    apiHeaders: api?.headers || {},
    script: EMPTY_FORM.script,
    secrets: (tool.secrets || []) as SecretDeclaration[],
    timeout: raw['config']?.timeout ?? raw['timeout'] ?? 120,
    retry: raw['config']?.retry ?? raw['retry'] ?? 0,
    maxResultSize: raw['config']?.max_result_size ?? raw['max_result_size'] ?? 25000,
    dependencies: normalizeDependencies(raw['config']?.dependencies ?? raw['dependencies']),
    displayStyle: (tool.display?.style ?? raw['config']?.display?.style ?? 'default') as DisplayStyle,
    displayIcon: tool.display?.icon ?? raw['config']?.display?.icon ?? 'wrench',
    displayActionText: tool.display?.action_text ?? raw['config']?.display?.action_text ?? '',
    displayCardDescription: tool.display?.card_description ?? raw['config']?.display?.card_description ?? '',
    displayCardImagePreview: '',
    displayCardImageFile: null,
  };
}

/* ── Component ── */

export const ToolStudio: React.FC<ToolStudioProps> = ({
  isOpen,
  onClose,
  onSaved,
  onDesign,
  editTool,
  packName,
}) => {
  const { tenant } = useAuthStore();
  const tenantId = tenant?.id || '';
  const isEdit = !!editTool;

  const [form, setForm] = useState<ToolFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modeTransition, setModeTransition] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showDisplayStyle, setShowDisplayStyle] = useState(
    !!editTool?.display || !!(editTool as Record<string, any>)?.['config']?.display
  );
  const scriptRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const composingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      if (editTool) {
        const loaded = toolConfigToForm(editTool);
        setForm(loaded);
        if (editTool._has_script && tenantId && editTool.name) {
          tenantAssetsApi.getToolDetail(tenantId, editTool.name, packName).then(detail => {
            if (detail.script) {
              setForm(prev => ({ ...prev, script: detail.script! }));
            }
          }).catch(() => {});
        }
      } else {
        setForm({ ...EMPTY_FORM, secrets: [] });
      }
      setError(null);
    }
  }, [isOpen, editTool, tenantId, packName]);

  const update = useCallback(<K extends keyof ToolFormData>(key: K, value: ToolFormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleSwitchMode = useCallback((mode: RuntimeMode) => {
    if (mode === form.runtimeMode) return;
    setModeTransition(true);
    setTimeout(() => {
      update('runtimeMode', mode);
      setModeTransition(false);
    }, 150);
  }, [form.runtimeMode, update]);

  const addParam = useCallback(() => {
    setForm(prev => ({
      ...prev,
      params: [...prev.params, { name: '', type: 'string', required: false, description: '' }],
    }));
  }, []);

  const updateParam = useCallback((idx: number, field: keyof ParamDef, value: any) => {
    setForm(prev => ({
      ...prev,
      params: prev.params.map((p, i) => i === idx ? { ...p, [field]: value } : p),
    }));
  }, []);

  const removeParam = useCallback((idx: number) => {
    setForm(prev => ({ ...prev, params: prev.params.filter((_, i) => i !== idx) }));
  }, []);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setForm(prev => ({
        ...prev,
        displayCardImagePreview: dataUrl,
        displayCardImageFile: dataUrl,
      }));
    };
    reader.readAsDataURL(file);
  }, []);

  useEffect(() => {
    if (isOpen && editTool && tenantId && editTool.name) {
      const displayCfg = editTool.display ?? (editTool as Record<string, any>)['config']?.display;
      if (displayCfg?.card_image) {
        const imgUrl = tenantAssetsApi.getToolDisplayImageUrl(tenantId, editTool.name, packName);
        fetchMedia(imgUrl)
          .then(r => (r.ok ? r.blob() : null))
          .then(blob => {
            if (blob) {
              const blobUrl = URL.createObjectURL(blob);
              setForm(prev => ({ ...prev, displayCardImagePreview: blobUrl }));
            }
          })
          .catch(() => {});
      }
    }
  }, [isOpen, editTool, tenantId, packName]);

  const handleSave = async () => {
    if (!form.name.trim()) { setError('请填写工具名称'); return; }
    if (!form.descriptionAgent.trim()) { setError('请填写工具描述（给 Agent）'); return; }
    if (form.runtimeMode === 'api' && !form.apiUrl.trim()) { setError('请填写 API URL'); return; }
    if (form.runtimeMode === 'corex' && !form.script.includes('async def execute')) {
      setError('CoreX 脚本必须包含 async def execute 入口'); return;
    }

    setSaving(true);
    setError(null);

    try {
      const { config, script, pack } = formToToolConfig(form, packName);
      if (isEdit && editTool) {
        await tenantAssetsApi.update(tenantId, 'tools', editTool.name, {
          config,
          ...(script && { content: script }),
          ...(pack && { pack }),
        });
      } else {
        await tenantAssetsApi.create(tenantId, 'tools', {
          name: form.name,
          config,
          ...(script && { content: script }),
          ...(pack && { pack }),
        });
      }
      if (form.displayCardImageFile) {
        const toolName = isEdit ? editTool!.name : form.name;
        try {
          await tenantAssetsApi.uploadToolDisplayImage(tenantId, toolName, form.displayCardImageFile, packName);
        } catch (imgErr) {
          console.warn('Display image upload failed:', imgErr);
        }
      }
      onSaved?.();
      window.dispatchEvent(new CustomEvent('asset-changed', { detail: { type: 'tools' } }));
      onClose();
    } catch (err: any) {
      setError(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 10,
    border: '1px solid var(--input-border)', background: 'var(--input-bg)',
    color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, display: 'block',
  };

  return createPortal(
    <>
      <style>{`
        .tool-studio-backdrop {
          animation: tsFadeIn 0.15s ease-out;
        }
        .tool-studio-panel {
          animation: tsScaleIn 0.18s ease-out;
        }
        @keyframes tsFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes tsScaleIn {
          from { opacity: 0; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1); }
        }
        .ts-mode-fade {
          transition: opacity 0.15s ease;
        }
      `}</style>

      <div
        className="fixed inset-0 z-[200] flex items-center justify-center tool-studio-backdrop"
        data-testid="tool-studio"
        style={{ background: 'var(--modal-backdrop)' }}
        onClick={onClose}
      >
        <div
          onClick={e => e.stopPropagation()}
          className="tool-studio-panel"
          data-testid="tool-studio-panel"
          style={{
            width: '90vw', maxWidth: 1100, height: '85vh', maxHeight: 750,
            background: 'var(--modal-bg)', borderRadius: 20,
            border: '1px solid var(--modal-border)',
            boxShadow: 'var(--modal-shadow)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}
        >
          {/* ── Header ── */}
          <div data-testid="tool-studio-header" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={onClose}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 30, height: 30, borderRadius: 8,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                <BackIcon />
              </button>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                {isEdit ? `编辑: ${editTool?.display_name || editTool?.name || ''}` : '创建工具'}
              </span>
              {packName && (
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 8,
                  background: 'var(--hover-bg)', color: 'var(--text-muted)',
                }}>
                  {packName}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {onDesign && (
                <CorevoDesignButton
                  promptHint="帮我设计一个自定义工具，例如：一个企业 CRM 数据查询工具，支持按客户名搜索"
                  onDesign={(p) => { onClose(); onDesign(p); }}
                />
              )}
              {error && (
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{error}</span>
              )}
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: '8px 20px', fontSize: 13, fontWeight: 500, borderRadius: 10,
                  background: 'var(--text-primary)', color: 'var(--bg-primary)',
                  border: 'none', cursor: saving ? 'wait' : 'pointer',
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? '保存中...' : '保存'}
              </button>
              <button
                onClick={onClose}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 30, height: 30, borderRadius: 8,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                <CloseIcon />
              </button>
            </div>
          </div>

          {/* ── Body: Left + Right ── */}
          <div data-testid="tool-studio-body" style={{ display: 'flex', flex: 1, minHeight: 0 }}>

            {/* ─── Left: Identity ─── */}
            <div data-testid="tool-studio-identity-panel" style={{
              width: '40%', minWidth: 340, maxWidth: 420,
              borderRight: '1px solid var(--border-subtle)',
              padding: '24px', overflowY: 'auto',
              display: 'flex', flexDirection: 'column', gap: 20,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: -4 }}>
                工具身份
              </div>

              <div>
                <label style={labelStyle}>工具名称 <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(英文标识符)</span></label>
                <input
                  value={form.name}
                  onChange={e => update('name', e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                  placeholder="my_search_tool"
                  style={inputStyle}
                  disabled={isEdit}
                />
              </div>

              <div>
                <label style={labelStyle}>显示名称</label>
                <input
                  value={form.displayName}
                  onChange={e => update('displayName', e.target.value)}
                  placeholder="搜索数据"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>描述 <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(给 Agent)</span></label>
                <textarea
                  value={form.descriptionAgent}
                  onChange={e => update('descriptionAgent', e.target.value)}
                  placeholder="Search and filter business data from the enterprise data platform..."
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
                />
              </div>

              <div>
                <label style={labelStyle}>描述 <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(给用户)</span></label>
                <input
                  value={form.descriptionUser}
                  onChange={e => update('descriptionUser', e.target.value)}
                  placeholder="搜索和过滤企业数据"
                  style={inputStyle}
                />
              </div>

              {/* Parameters */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <label style={{ ...labelStyle, margin: 0 }}>参数定义</label>
                  <button
                    onClick={addParam}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      fontSize: 11, padding: '4px 10px', borderRadius: 6,
                      background: 'none', border: '1px solid var(--border-subtle)',
                      color: 'var(--text-muted)', cursor: 'pointer',
                    }}
                  >
                    <PlusIcon size={12} /> 添加
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {form.params.map((param, idx) => (
                    <div key={idx} style={{
                      padding: '10px 12px', borderRadius: 10,
                      background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)',
                      display: 'flex', flexDirection: 'column', gap: 6,
                    }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input
                          value={param.name}
                          onChange={e => updateParam(idx, 'name', e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                          placeholder="param_name"
                          style={{ ...inputStyle, flex: 1, padding: '6px 8px', fontSize: 12, fontFamily: 'monospace' }}
                        />
                        <select
                          value={param.type}
                          onChange={e => updateParam(idx, 'type', e.target.value)}
                          style={{ ...inputStyle, width: 90, padding: '6px 8px', fontSize: 12, cursor: 'pointer' }}
                        >
                          <option value="string">string</option>
                          <option value="number">number</option>
                          <option value="boolean">boolean</option>
                          <option value="array">array</option>
                          <option value="object">object</option>
                        </select>
                        <button
                          onClick={() => updateParam(idx, 'required', !param.required)}
                          style={{
                            fontSize: 10, padding: '4px 8px', borderRadius: 4,
                            background: param.required ? 'var(--hover-bg-strong)' : 'none',
                            border: `1px solid ${param.required ? 'var(--text-muted)' : 'var(--border-subtle)'}`,
                            color: param.required ? 'var(--text-primary)' : 'var(--text-muted)',
                            cursor: 'pointer', whiteSpace: 'nowrap',
                          }}
                        >必填</button>
                        <button
                          onClick={() => removeParam(idx)}
                          style={{
                            display: 'flex', padding: 4, borderRadius: 4,
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--text-muted)', opacity: 0.5,
                          }}
                        >
                          <TrashIcon size={13} />
                        </button>
                      </div>
                      <input
                        value={param.description}
                        onChange={e => updateParam(idx, 'description', e.target.value)}
                        placeholder="参数描述"
                        style={{ ...inputStyle, padding: '5px 8px', fontSize: 11 }}
                      />
                    </div>
                  ))}
                  {form.params.length === 0 && (
                    <div style={{
                      padding: '16px', borderRadius: 10, textAlign: 'center',
                      border: '1px dashed var(--border-subtle)', color: 'var(--text-muted)', fontSize: 12,
                    }}>
                      暂无参数，点击上方添加
                    </div>
                  )}
                </div>
              </div>

              {/* ── 展示样式 ── */}
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
                <button
                  onClick={() => setShowDisplayStyle(!showDisplayStyle)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, padding: 0,
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                    style={{ transform: showDisplayStyle ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}
                  >
                    <polyline points="3,1 7,5 3,9"/>
                  </svg>
                  展示样式
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 4 }}>
                    {form.displayStyle === 'card' ? '卡片模式' : '默认'}
                  </span>
                </button>

                {showDisplayStyle && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 12 }}>
                    {/* 模式切换 */}
                    <div>
                      <label style={labelStyle}>模式</label>
                      <div style={{ display: 'inline-flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                        {(['default', 'card'] as const).map(mode => (
                          <button
                            key={mode}
                            onClick={() => update('displayStyle', mode)}
                            style={{
                              padding: '5px 16px', fontSize: 12, border: 'none', cursor: 'pointer',
                              background: form.displayStyle === mode ? 'var(--hover-bg-strong)' : 'transparent',
                              color: form.displayStyle === mode ? 'var(--text-primary)' : 'var(--text-muted)',
                              fontWeight: form.displayStyle === mode ? 500 : 400,
                            }}
                          >
                            {mode === 'default' ? '默认' : '卡片'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 图标选择 */}
                    <div>
                      <label style={labelStyle}>图标</label>
                      <ToolIconPicker
                        value={form.displayIcon}
                        onChange={v => update('displayIcon', v)}
                      />
                    </div>

                    {/* 调用文案 */}
                    <div>
                      <label style={labelStyle}>调用文案 <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(可选)</span></label>
                      <input
                        value={form.displayActionText}
                        onChange={e => update('displayActionText', e.target.value)}
                        placeholder={form.displayName || form.name || '工具名称'}
                        style={{ ...inputStyle, fontSize: 12 }}
                      />
                    </div>

                    {/* 卡片模式额外字段 */}
                    {form.displayStyle === 'card' && (
                      <>
                        <div>
                          <label style={labelStyle}>卡片图片</label>
                          <input
                            ref={imageInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            style={{ display: 'none' }}
                          />
                          {form.displayCardImagePreview ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div
                                style={{
                                  width: 48, height: 48, borderRadius: 8, overflow: 'hidden',
                                  border: '1px solid var(--border-subtle)', flexShrink: 0,
                                }}
                              >
                                <img
                                  src={form.displayCardImagePreview}
                                  alt="card"
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                              </div>
                              <button
                                onClick={() => imageInputRef.current?.click()}
                                style={{
                                  fontSize: 11, padding: '4px 10px', borderRadius: 6,
                                  background: 'none', border: '1px solid var(--border-subtle)',
                                  color: 'var(--text-muted)', cursor: 'pointer',
                                }}
                              >
                                更换
                              </button>
                              <button
                                onClick={() => setForm(prev => ({ ...prev, displayCardImagePreview: '', displayCardImageFile: null }))}
                                style={{
                                  fontSize: 11, padding: '4px 10px', borderRadius: 6,
                                  background: 'none', border: '1px solid var(--border-subtle)',
                                  color: 'var(--text-muted)', cursor: 'pointer',
                                }}
                              >
                                移除
                              </button>
                            </div>
                          ) : (
                            <div
                              onClick={() => imageInputRef.current?.click()}
                              style={{
                                padding: '14px', borderRadius: 10, textAlign: 'center',
                                border: '1px dashed var(--border-subtle)', color: 'var(--text-muted)',
                                fontSize: 12, cursor: 'pointer',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text-muted)'; }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                            >
                              点击上传图片
                            </div>
                          )}
                        </div>

                        <div>
                          <label style={labelStyle}>
                            卡片描述
                            <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 4 }}>
                              {form.displayCardDescription.length}/8
                            </span>
                          </label>
                          <input
                            value={form.displayCardDescription}
                            onCompositionStart={() => { composingRef.current = true; }}
                            onCompositionEnd={e => {
                              composingRef.current = false;
                              const v = (e.target as HTMLInputElement).value;
                              update('displayCardDescription', v.slice(0, 8));
                            }}
                            onChange={e => {
                              const v = e.target.value;
                              if (composingRef.current) {
                                update('displayCardDescription', v);
                              } else {
                                update('displayCardDescription', v.slice(0, 8));
                              }
                            }}
                            placeholder="独家资质数据源"
                            style={{ ...inputStyle, fontSize: 12 }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ─── Right: Runtime ─── */}
            <div data-testid="tool-studio-runtime-panel" style={{
              flex: 1, padding: '24px', overflowY: 'auto',
              display: 'flex', flexDirection: 'column', gap: 20,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                  工具运行
                </div>
              </div>

              {/* Mode tabs */}
              <div style={{
                display: 'inline-flex', borderRadius: 10, overflow: 'hidden',
                border: '1px solid var(--border-subtle)', alignSelf: 'flex-start',
              }}>
                <button
                  onClick={() => handleSwitchMode('api')}
                  style={{
                    padding: '7px 18px', fontSize: 13, border: 'none', cursor: 'pointer',
                    background: form.runtimeMode === 'api' ? 'var(--hover-bg-strong)' : 'transparent',
                    color: form.runtimeMode === 'api' ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontWeight: form.runtimeMode === 'api' ? 500 : 400,
                  }}
                >
                  连接 API
                </button>
                <button
                  onClick={() => handleSwitchMode('corex')}
                  style={{
                    padding: '7px 18px', fontSize: 13, border: 'none', cursor: 'pointer',
                    background: form.runtimeMode === 'corex' ? 'var(--hover-bg-strong)' : 'transparent',
                    color: form.runtimeMode === 'corex' ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontWeight: form.runtimeMode === 'corex' ? 500 : 400,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  编写逻辑
                  <span style={{
                    fontSize: 9, padding: '1px 5px', borderRadius: 4,
                    background: 'var(--hover-bg)', color: 'var(--text-muted)',
                    fontWeight: 500, letterSpacing: '0.03em',
                  }}>CoreX</span>
                </button>
              </div>

              {/* Runtime content */}
              <div className="ts-mode-fade" style={{ opacity: modeTransition ? 0 : 1, flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>

                {form.runtimeMode === 'api' ? (
                  <>
                    <div>
                      <label style={labelStyle}>URL</label>
                      <input
                        value={form.apiUrl}
                        onChange={e => update('apiUrl', e.target.value)}
                        placeholder="https://api.example.com/v1/search"
                        style={inputStyle}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <label style={labelStyle}>Method</label>
                        <select
                          value={form.apiMethod}
                          onChange={e => update('apiMethod', e.target.value)}
                          style={{ ...inputStyle, cursor: 'pointer' }}
                        >
                          {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={labelStyle}>认证方式</label>
                        <select
                          value={form.apiAuthType}
                          onChange={e => update('apiAuthType', e.target.value)}
                          style={{ ...inputStyle, cursor: 'pointer' }}
                        >
                          <option value="none">无</option>
                          <option value="header">Header</option>
                          <option value="bearer">Bearer Token</option>
                          <option value="query">Query Param</option>
                        </select>
                      </div>
                    </div>

                    {form.apiAuthType !== 'none' && (
                      <div>
                        <label style={labelStyle}>
                          {form.apiAuthType === 'header' ? 'Header 名称' : form.apiAuthType === 'bearer' ? 'Token 密钥引用' : 'Query 参数名'}
                        </label>
                        <input
                          value={form.apiAuthKey}
                          onChange={e => update('apiAuthKey', e.target.value)}
                          placeholder={form.apiAuthType === 'header' ? 'X-API-Key' : form.apiAuthType === 'bearer' ? '{{API_KEY}}' : 'api_key'}
                          style={inputStyle}
                        />
                      </div>
                    )}

                    <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
                      <label style={labelStyle}>参数映射 <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(参数名 → API 字段路径)</span></label>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                        {form.params.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {form.params.map((p, idx) => (
                              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <code style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 100 }}>{p.name || '(unnamed)'}</code>
                                <span style={{ color: 'var(--text-muted)' }}>→</span>
                                <input
                                  value={form.apiParamsMapping[p.name] || ''}
                                  onChange={e => update('apiParamsMapping', { ...form.apiParamsMapping, [p.name]: e.target.value })}
                                  placeholder={p.name}
                                  style={{ ...inputStyle, flex: 1, padding: '5px 8px', fontSize: 12 }}
                                />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span>先在左侧定义参数后，此处可配置映射关系</span>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 200 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <label style={{ ...labelStyle, margin: 0 }}>main.py</label>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                          ctx: ToolContext — http, secrets, call_llm, create_agent, call_tool, save_file, cache
                        </span>
                      </div>
                      <textarea
                        ref={scriptRef}
                        value={form.script}
                        onChange={e => update('script', e.target.value)}
                        spellCheck={false}
                        style={{
                          flex: 1, width: '100%', minHeight: 240, padding: '14px 16px',
                          fontSize: 13, lineHeight: 1.6, borderRadius: 12,
                          border: '1px solid var(--input-border)', background: 'var(--input-bg)',
                          color: 'var(--text-primary)', outline: 'none',
                          fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
                          resize: 'vertical', tabSize: 4,
                          boxSizing: 'border-box',
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Tab') {
                            e.preventDefault();
                            const ta = e.currentTarget;
                            const start = ta.selectionStart;
                            const end = ta.selectionEnd;
                            const val = ta.value;
                            update('script', val.substring(0, start) + '    ' + val.substring(end));
                            requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = start + 4; });
                          }
                        }}
                      />
                    </div>

                    {/* CoreX Advanced Config */}
                    <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
                      <button
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--text-muted)', fontSize: 12, padding: 0,
                        }}
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                          style={{ transform: showAdvanced ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}
                        >
                          <polyline points="3,1 7,5 3,9"/>
                        </svg>
                        高级配置
                      </button>
                      {showAdvanced && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                          <div style={{ display: 'flex', gap: 12 }}>
                            <div style={{ flex: 1 }}>
                              <label style={labelStyle}>超时 (秒)</label>
                              <input
                                type="number" min={5} max={600}
                                value={form.timeout}
                                onChange={e => update('timeout', Math.min(600, Math.max(5, parseInt(e.target.value) || 120)))}
                                style={{ ...inputStyle, padding: '5px 8px', fontSize: 12 }}
                              />
                            </div>
                            <div style={{ flex: 1 }}>
                              <label style={labelStyle}>失败重试</label>
                              <input
                                type="number" min={0} max={5}
                                value={form.retry}
                                onChange={e => update('retry', Math.min(5, Math.max(0, parseInt(e.target.value) || 0)))}
                                style={{ ...inputStyle, padding: '5px 8px', fontSize: 12 }}
                              />
                            </div>
                            <div style={{ flex: 1 }}>
                              <label style={labelStyle}>结果上限 (字符)</label>
                              <input
                                type="number" min={1000} max={100000} step={1000}
                                value={form.maxResultSize}
                                onChange={e => update('maxResultSize', Math.min(100000, Math.max(1000, parseInt(e.target.value) || 25000)))}
                                style={{ ...inputStyle, padding: '5px 8px', fontSize: 12 }}
                              />
                            </div>
                          </div>
                          <div>
                            <label style={labelStyle}>Python 依赖 <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(逗号分隔)</span></label>
                            <input
                              value={form.dependencies}
                              onChange={e => update('dependencies', e.target.value)}
                              placeholder="例: pandas, beautifulsoup4, lxml"
                              style={{ ...inputStyle, padding: '5px 8px', fontSize: 12 }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Secrets */}
                <SecretConfigPanel
                  toolName={form.name}
                  packName={packName}
                  secrets={form.secrets}
                  onSecretsChange={s => update('secrets', s)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
};
