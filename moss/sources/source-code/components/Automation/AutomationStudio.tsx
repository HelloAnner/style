/**
 * AutomationStudio — 团队模版创建/编辑器
 *
 * 设计原则：
 * - 全屏弹窗 (createPortal)，对标 ToolStudio 品质
 * - 纯黑白灰配色，适配明暗主题，不使用彩色元素
 * - 精致 SVG 图标，杜绝 emoji
 * - 左栏「基本信息 + 触发配置 + 变量」/ 右栏「任务设计 + 执行配置」
 */

import React, { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  getTemplate, createTemplate, updateTemplate, listPipelines,
  type AutomationAsset,
} from '../../api/automations';
import { agentApi } from '../../api/platform';
import { Select, type SelectOption } from '../common/Select';
export { cronToHuman } from './automationSchedule';
import { cronToHuman } from './automationSchedule';
import { CorevoDesignButton } from '../common/CorevoDesignButton';
import { validateCronExpr } from './cronValidation';
import { getAgentDisplayName } from '../../types/platform';

/* ── SVG Icons ── */

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

const ClockIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/>
  </svg>
);

const WebhookIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 012 17c.01-.7.2-1.4.57-2"/><path d="M6 17a4 4 0 004-4V5.5a2.5 2.5 0 015 0V8"/><path d="M14.5 8H22a2 2 0 010 4h-7.5"/>
  </svg>
);

const BoltIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
  </svg>
);

/* ── Types ── */

interface VariableDef {
  key: string;
  type: string;
  default: string;
  label: string;
  description: string;
}

interface EventFilterEntry {
  key: string;
  value: string;
}

interface AutomationFormData {
  name: string;
  displayName: string;
  description: string;
  triggerType: string;
  cronExpr: string;
  timezone: string;
  once: boolean;
  endAt: string;
  webhookSecret: string;
  eventType: string;
  eventFilters: EventFilterEntry[];
  eventDebounce: number;
  eventCooldown: number;
  variables: VariableDef[];
  taskMd: string;
  maxIterations: number;
  timeoutMinutes: number;
  notifyComplete: boolean;
  notifyFailure: boolean;
}

// Webhook / event trigger chains are not product-ready yet:
// webhook lacks signing/idempotency/rate-limit semantics, and event triggers
// do not have a durable cross-pod subscription path. Keep the code paths for
// later rollout, but hide the create/edit entry points for now.
const HIDE_UNSTABLE_TRIGGER_TYPES = true;
const UNSTABLE_TRIGGER_TYPES = new Set(['webhook', 'event']);

type TriggerOption = {
  key: string;
  label: string;
  desc: string;
  icon: React.ReactNode;
  disabled?: boolean;
  hidden?: boolean;
};

const EMPTY_FORM: AutomationFormData = {
  name: '',
  displayName: '',
  description: '',
  triggerType: 'cron',
  cronExpr: '0 9 * * *',
  timezone: 'Asia/Shanghai',
  once: false,
  endAt: '',
  webhookSecret: '',
  eventType: '',
  eventFilters: [],
  eventDebounce: 0,
  eventCooldown: 0,
  variables: [],
  taskMd: `---
name: my-automation
description: 自动化任务描述
---

# 任务目标

请描述任务的目标和背景。

## 执行步骤

1. 步骤一
2. 步骤二

## 输出要求

- 将结果保存到个人文件
- 通知用户完成
`,
  maxIterations: 30,
  timeoutMinutes: 30,
  notifyComplete: true,
  notifyFailure: true,
};

const CRON_PRESETS = [
  { label: '每小时', value: '0 * * * *' },
  { label: '每天 9:00', value: '0 9 * * *' },
  { label: '每天 18:00', value: '0 18 * * *' },
  { label: '每周一 9:00', value: '0 9 * * 1' },
  { label: '每月 1 号 9:00', value: '0 9 1 * *' },
];

const TIMEZONES = [
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai (CST +8)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST +9)' },
  { value: 'America/New_York', label: 'America/New_York (EST -5)' },
  { value: 'Europe/London', label: 'Europe/London (GMT)' },
  { value: 'UTC', label: 'UTC' },
];

/* ── Event Catalog ── */

interface FilterFieldDef {
  key: string;
  label: string;
  type: 'text' | 'select' | 'pipeline_select' | 'agent_select';
  placeholder?: string;
  hint?: string;
  options?: string[];
}

interface EventDef {
  value: string;
  label: string;
  group: string;
  description: string;
  scenario: string;
  filters: FilterFieldDef[];
}

const EVENT_CATALOG: EventDef[] = [
  {
    value: 'task.completed', label: 'Agent 完成任务', group: '任务事件',
    description: '当 Agent 成功完成一次对话任务时触发',
    scenario: '适合做任务完成后的自动汇总、通知或后续流程触发',
    filters: [
      { key: 'source.agent_id', label: '指定 Agent', type: 'agent_select', hint: '只监听某个 Agent 的任务完成' },
    ],
  },
  {
    value: 'task.failed', label: 'Agent 任务失败', group: '任务事件',
    description: '当 Agent 任务执行出错时触发',
    scenario: '适合做失败告警、自动重试或错误诊断',
    filters: [
      { key: 'source.agent_id', label: '指定 Agent', type: 'agent_select', hint: '只监听某个 Agent 的任务失败' },
    ],
  },
  {
    value: 'automation.run.completed', label: '自动化执行完成', group: '自动化事件',
    description: '当某个自动化管道成功执行完毕时触发',
    scenario: '适合做管道接力——上游管道完成后自动启动下游管道',
    filters: [
      { key: 'source.pipeline_id', label: '来源管道', type: 'pipeline_select', hint: '选择要监听的上游管道' },
    ],
  },
  {
    value: 'automation.run.failed', label: '自动化执行失败', group: '自动化事件',
    description: '当某个自动化管道执行失败时触发',
    scenario: '适合做失败补偿、告警或自动回滚',
    filters: [
      { key: 'source.pipeline_id', label: '来源管道', type: 'pipeline_select', hint: '选择要监听的上游管道' },
    ],
  },
  {
    value: 'file.created', label: '文件创建', group: '文件事件',
    description: '当 Agent 创建新文件（文档、图片、代码等）时触发',
    scenario: '适合做文件创建后的自动审阅、归档或分发',
    filters: [
      { key: 'payload.extension', label: '文件类型', type: 'select', options: ['.md', '.csv', '.json', '.txt', '.py', '.xlsx', '.png', '.pdf'], hint: '只监听特定类型的文件' },
      { key: 'payload.path', label: '文件路径包含', type: 'text', placeholder: '如 research/*', hint: '支持通配符 *' },
      { key: 'payload.scope', label: '文件范围', type: 'select', options: ['shared', 'session'], hint: 'shared=团队共享文件，session=会话文件' },
    ],
  },
  {
    value: 'file.updated', label: '文件更新', group: '文件事件',
    description: '当 Agent 编辑已有文件时触发',
    scenario: '适合做文件变更后的自动检查、同步或通知',
    filters: [
      { key: 'payload.extension', label: '文件类型', type: 'select', options: ['.md', '.csv', '.json', '.txt', '.py', '.xlsx', '.png', '.pdf'], hint: '只监听特定类型的文件' },
      { key: 'payload.path', label: '文件路径包含', type: 'text', placeholder: '如 reports/*', hint: '支持通配符 *' },
      { key: 'payload.scope', label: '文件范围', type: 'select', options: ['shared', 'session'], hint: 'shared=团队共享文件，session=会话文件' },
    ],
  },
  {
    value: 'file.deleted', label: '文件删除', group: '文件事件',
    description: '当 Agent 删除文件时触发',
    scenario: '适合做文件删除后的备份或审计',
    filters: [
      { key: 'payload.extension', label: '文件类型', type: 'select', options: ['.md', '.csv', '.json', '.txt', '.py', '.xlsx', '.png', '.pdf'], hint: '只监听特定类型的文件' },
      { key: 'payload.path', label: '文件路径包含', type: 'text', placeholder: '如 archive/*', hint: '支持通配符 *' },
    ],
  },
  {
    value: 'tool.executed', label: '工具被调用', group: '工具事件',
    description: '当 Agent 调用任意工具时触发',
    scenario: '适合做工具调用后的审计、统计或自动诊断',
    filters: [
      { key: 'payload.tool_name', label: '工具名称', type: 'text', placeholder: '如 web_search', hint: '只监听某个工具的调用' },
    ],
  },
  {
    value: 'roundtable.concluded', label: '圆桌讨论结束', group: '协作事件',
    description: '当一场圆桌讨论达成结论时触发',
    scenario: '适合讨论结束后自动执行决议、生成报告或通知相关方',
    filters: [
      { key: 'source.session_id', label: '会话 ID', type: 'text', placeholder: '留空匹配全部', hint: '只监听特定会话的圆桌' },
    ],
  },
  {
    value: 'project.stage.completed', label: '项目阶段完成', group: '项目事件',
    description: '当项目中的某个阶段执行完成时触发',
    scenario: '适合做阶段间的自动流转或完成通知',
    filters: [
      { key: 'source.project_id', label: '项目 ID', type: 'text', placeholder: '留空匹配全部项目', hint: '只监听特定项目' },
      { key: 'payload.stage_key', label: '阶段标识', type: 'text', placeholder: '如 research', hint: '只监听特定阶段' },
    ],
  },
  {
    value: 'project.stage.awaiting_review', label: '项目阶段待审阅', group: '项目事件',
    description: '当项目阶段产出需要人工审阅时触发',
    scenario: '适合做审阅提醒或自动预检',
    filters: [
      { key: 'source.project_id', label: '项目 ID', type: 'text', placeholder: '留空匹配全部项目', hint: '只监听特定项目' },
    ],
  },
  {
    value: 'project.checkpoint.approved', label: '项目检查点通过', group: '项目事件',
    description: '当人工批准项目检查点时触发',
    scenario: '适合审批通过后自动推进下一阶段',
    filters: [
      { key: 'source.project_id', label: '项目 ID', type: 'text', placeholder: '留空匹配全部项目', hint: '只监听特定项目' },
    ],
  },
  {
    value: 'custom', label: '自定义事件', group: '自定义',
    description: '监听工具或技能通过 emit_event 发出的自定义事件',
    scenario: '适合对接自定义工具的业务流程',
    filters: [],
  },
];

const EVENT_GROUPS = Array.from(new Set(EVENT_CATALOG.map(e => e.group)));

export interface AutomationStudioProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  onDesign?: (prompt: string) => void;
  editAsset?: AutomationAsset | null;
}

/* ── Component ── */

export const AutomationStudio: React.FC<AutomationStudioProps> = ({
  isOpen, onClose, onSaved, onDesign, editAsset,
}) => {
  const isEdit = !!editAsset;

  const [form, setForm] = useState<AutomationFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<'task' | 'config'>('task');
  const [pipelineOptions, setPipelineOptions] = useState<{ id: string; label: string }[]>([]);
  const [agentOptions, setAgentOptions] = useState<{ id: string; name: string }[]>([]);
  const [customEventName, setCustomEventName] = useState('');

  useEffect(() => {
    listPipelines().then(list => {
      setPipelineOptions(list.map(p => ({ id: p.id, label: p.display_name || p.name || p.id })));
    }).catch(() => {});
    agentApi.list().then(list => {
      setAgentOptions(list
        .filter(agent => agent.visibility !== 'internal')
        .map(a => ({ id: a.id, name: getAgentDisplayName(a, a.id) })));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setRightTab('task');

    if (editAsset) {
      getTemplate(editAsset.name).then((raw) => {
        const detail = raw as Record<string, any>;
        const cfg = (detail.config || {}) as Record<string, any>;
        const vars: VariableDef[] = [];
        if (cfg?.variables) {
          for (const [k, v] of Object.entries(cfg.variables)) {
            vars.push({
              key: k,
              type: (v as any).type || 'string',
              default: String((v as any).default ?? ''),
              label: (v as any).label || '',
              description: (v as any).description || '',
            });
          }
        }
        const rawEvtType = cfg?.trigger?.event_config?.conditions?.[0]?.event_type || '';
        const isCustomEvt = rawEvtType.startsWith('custom.') && !EVENT_CATALOG.some(e => e.value === rawEvtType);

        setForm({
          name: String(detail.name ?? ''),
          displayName: String(detail.display_name ?? ''),
          description: String(detail.description ?? ''),
          triggerType: cfg?.trigger?.type || 'cron',
          cronExpr: cfg?.trigger?.cron_expr || '0 9 * * *',
          timezone: cfg?.trigger?.timezone || 'Asia/Shanghai',
          once: cfg?.trigger?.once || false,
          endAt: cfg?.trigger?.end_at || '',
          webhookSecret: '',
          eventType: isCustomEvt ? 'custom' : rawEvtType,
          eventFilters: Object.entries(cfg?.trigger?.event_config?.conditions?.[0]?.filters || {}).map(([key, value]) => ({ key, value: String(value) })),
          eventDebounce: cfg?.trigger?.event_config?.debounce_seconds || 0,
          eventCooldown: cfg?.trigger?.event_config?.cooldown_seconds || 0,
          variables: vars,
          taskMd: String(detail.task_md ?? ''),
          maxIterations: cfg?.execution?.max_iterations || 30,
          timeoutMinutes: cfg?.execution?.timeout_minutes || 30,
          notifyComplete: cfg?.execution?.notification?.on_complete ?? true,
          notifyFailure: cfg?.execution?.notification?.on_failure ?? true,
        });
        if (isCustomEvt) setCustomEventName(rawEvtType);
      }).catch(() => setForm({ ...EMPTY_FORM }));
    } else {
      setForm({ ...EMPTY_FORM });
    }
  }, [isOpen, editAsset]);

  const update = useCallback(<K extends keyof AutomationFormData>(key: K, value: AutomationFormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  const addVariable = useCallback(() => {
    setForm(prev => ({
      ...prev,
      variables: [...prev.variables, { key: '', type: 'string', default: '', label: '', description: '' }],
    }));
  }, []);

  const updateVariable = useCallback((idx: number, field: keyof VariableDef, value: string) => {
    setForm(prev => ({
      ...prev,
      variables: prev.variables.map((v, i) => i === idx ? { ...v, [field]: value } : v),
    }));
  }, []);

  const removeVariable = useCallback((idx: number) => {
    setForm(prev => ({ ...prev, variables: prev.variables.filter((_, i) => i !== idx) }));
  }, []);

  const handleSave = async () => {
    if (!form.name.trim()) { setError('请填写名称'); return; }
    if (HIDE_UNSTABLE_TRIGGER_TYPES && UNSTABLE_TRIGGER_TYPES.has(form.triggerType)) {
      setError('Webhook 和事件触发暂未开放，请先切换为定时触发');
      return;
    }
    if (form.triggerType === 'cron' && !form.cronExpr.trim()) { setError('请填写 Cron 表达式'); return; }
    if (form.triggerType === 'cron') {
      const cronError = validateCronExpr(form.cronExpr);
      if (cronError) { setError(cronError); return; }
    }

    setSaving(true);
    setError(null);

    const variablesObj: Record<string, unknown> = {};
    for (const v of form.variables) {
      if (v.key.trim()) {
        variablesObj[v.key.trim()] = {
          type: v.type, default: v.default || null, label: v.label, description: v.description,
        };
      }
    }

    let eventConfig = undefined;
    if (form.triggerType === 'event' && form.eventType) {
      const resolvedEventType = form.eventType === 'custom' ? customEventName : form.eventType;
      if (resolvedEventType) {
        const filters: Record<string, string> = {};
        form.eventFilters.forEach(f => { if (f.key && f.value) filters[f.key] = f.value; });
        eventConfig = {
          conditions: [{ event_type: resolvedEventType, filters }],
          match: 'any',
          debounce_seconds: form.eventDebounce,
          cooldown_seconds: form.eventCooldown,
        };
      }
    }

    const payload = {
      display_name: form.displayName,
      description: form.description,
      trigger_type: form.triggerType,
      cron_expr: form.triggerType === 'cron' ? form.cronExpr : null,
      timezone: form.timezone,
      once: form.once,
      event_config: eventConfig,
      variables: variablesObj,
      task_md: form.taskMd,
      max_iterations: form.maxIterations,
      timeout_minutes: form.timeoutMinutes,
      notification_on_complete: form.notifyComplete,
      notification_on_failure: form.notifyFailure,
    };

    try {
      if (isEdit) {
        await updateTemplate(editAsset!.name, payload);
      } else {
        await createTemplate({ name: form.name, ...payload });
      }
      onSaved?.();
      window.dispatchEvent(new CustomEvent('asset-changed', { detail: { type: 'automations' } }));
      onClose();
    } catch (err: any) {
      setError(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const cronError = form.triggerType === 'cron' && form.cronExpr.trim()
    ? validateCronExpr(form.cronExpr)
    : null;
  const cronHelperText = cronError || cronToHuman(form.cronExpr);
  const cronHelperColor = cronError ? 'var(--danger)' : 'var(--text-secondary)';
  const cronInputBorder = cronError ? 'var(--danger)' : 'var(--input-border)';

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 10,
    border: '1px solid var(--input-border)', background: 'var(--input-bg)',
    color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, display: 'block',
  };

  const sectionTitle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
    letterSpacing: '0.03em',
    paddingBottom: 8, borderBottom: '1px solid var(--border-subtle)',
    marginBottom: 4,
  };

  const triggerOptions: TriggerOption[] = [
    { key: 'cron', label: '定时触发', desc: '按 Cron 周期自动执行', icon: <ClockIcon size={15} /> },
    { key: 'webhook', label: 'Webhook', desc: '接收外部 HTTP 请求时触发', icon: <WebhookIcon size={15} />, hidden: HIDE_UNSTABLE_TRIGGER_TYPES },
    { key: 'event', label: '事件触发', desc: '平台内部事件驱动', icon: <BoltIcon size={15} />, hidden: HIDE_UNSTABLE_TRIGGER_TYPES },
  ].filter(opt => !opt.hidden);

  return createPortal(
    <>
      <style>{`
        .as-backdrop { animation: asFadeIn 0.15s ease-out; }
        .as-panel { animation: asScaleIn 0.18s ease-out; }
        @keyframes asFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes asScaleIn { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
      `}</style>

      <div
        className="fixed inset-0 z-[200] flex items-center justify-center as-backdrop"
        data-testid="automation-studio"
        style={{ background: 'var(--modal-backdrop)' }}
        onClick={onClose}
      >
        <div
          onClick={e => e.stopPropagation()}
          className="as-panel"
          data-testid="automation-studio-panel"
          style={{
            width: '92vw', maxWidth: 1200, height: '88vh', maxHeight: 820,
            background: 'var(--modal-bg)', borderRadius: 20,
            border: '1px solid var(--modal-border)',
            boxShadow: 'var(--modal-shadow)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}
        >
          {/* ── Header ── */}
          <div data-testid="automation-studio-header" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 24px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={onClose}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; }}
              ><BackIcon /></button>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                {isEdit ? `编辑: ${editAsset?.display_name || editAsset?.name || ''}` : '创建自动化'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {onDesign && (
                <CorevoDesignButton
                  promptHint="帮我设计一个自动化任务，例如：每周一早上8点收集上周 AI 新闻总结保存到个人文件"
                  onDesign={(p) => { onClose(); onDesign(p); }}
                />
              )}
              {error && <span style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</span>}
              <button
                onClick={handleSave} disabled={saving}
                style={{
                  padding: '8px 22px', fontSize: 13, fontWeight: 500, borderRadius: 10,
                  background: 'var(--text-primary)', color: 'var(--bg-primary)',
                  border: 'none', cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.6 : 1,
                }}
              >{saving ? '保存中...' : '保存'}</button>
              <button
                onClick={onClose}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; }}
              ><CloseIcon /></button>
            </div>
          </div>

          {/* ── Body ── */}
          <div data-testid="automation-studio-body" style={{ display: 'flex', flex: 1, minHeight: 0 }}>

            {/* ─── Left Panel ─── */}
            <div data-testid="automation-studio-config-panel" style={{
              width: '38%', minWidth: 340, maxWidth: 430,
              borderRight: '1px solid var(--border-subtle)',
              padding: '20px 24px', overflowY: 'auto',
              display: 'flex', flexDirection: 'column', gap: 22,
            }}>

              {/* Basic Info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={sectionTitle}>基本信息</div>
                <div>
                  <label style={labelStyle}>名称 <span style={{ fontWeight: 400 }}>(英文标识符)</span></label>
                  <input
                    value={form.name}
                    onChange={e => update('name', e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                    placeholder="gold-price-monitor"
                    style={inputStyle}
                    disabled={isEdit}
                  />
                </div>
                <div>
                  <label style={labelStyle}>显示名称</label>
                  <input value={form.displayName} onChange={e => update('displayName', e.target.value)} placeholder="金价监控提醒" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>描述</label>
                  <textarea value={form.description} onChange={e => update('description', e.target.value)} placeholder="实时监控金价，当价格超过设定阈值时发送投资分析通知" rows={2} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
                </div>
              </div>

              {/* Trigger Config */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={sectionTitle}>触发配置</div>

                {/* Trigger type selector */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {triggerOptions.map(opt => (
                    <label key={opt.key} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10,
                      border: `1px solid ${form.triggerType === opt.key ? 'var(--text-muted)' : 'var(--border-subtle)'}`,
                      background: form.triggerType === opt.key ? 'var(--hover-bg)' : 'transparent',
                      cursor: opt.disabled ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
                      opacity: opt.disabled ? 0.45 : 1,
                    }}>
                      <input type="radio" name="triggerType" checked={form.triggerType === opt.key}
                        onChange={() => { if (!opt.disabled) update('triggerType', opt.key); }}
                        disabled={opt.disabled}
                        style={{ accentColor: 'var(--text-primary)' }}
                      />
                      <span style={{ color: 'var(--text-muted)', display: 'flex' }}>{opt.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          {opt.label}
                          {opt.disabled && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontWeight: 400 }}>开发中</span>}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{opt.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>

                {/* Cron config */}
                {form.triggerType === 'cron' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 14px', borderRadius: 10, background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
                    <div>
                      <label style={labelStyle}>Cron 表达式</label>
                      <input
                        value={form.cronExpr}
                        onChange={e => update('cronExpr', e.target.value)}
                        placeholder="0 9 * * *"
                        style={{ ...inputStyle, borderColor: cronInputBorder, fontFamily: 'monospace' }}
                      />
                      {cronHelperText && (
                        <div style={{ fontSize: 12, color: cronHelperColor, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <ClockIcon size={12} />
                          <span>{cronHelperText}</span>
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {CRON_PRESETS.map(p => (
                        <button key={p.value} onClick={() => update('cronExpr', p.value)}
                          style={{
                            fontSize: 11, padding: '3px 10px', borderRadius: 6,
                            background: form.cronExpr === p.value ? 'var(--hover-bg-strong)' : 'transparent',
                            border: `1px solid ${form.cronExpr === p.value ? 'var(--text-muted)' : 'var(--border-subtle)'}`,
                            color: form.cronExpr === p.value ? 'var(--text-primary)' : 'var(--text-muted)',
                            cursor: 'pointer',
                          }}
                        >{p.label}</button>
                      ))}
                    </div>
                    <div>
                      <label style={labelStyle}>时区</label>
                      <select value={form.timezone} onChange={e => update('timezone', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                        {TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {/* Webhook config */}
                {!HIDE_UNSTABLE_TRIGGER_TYPES && form.triggerType === 'webhook' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 14px', borderRadius: 10, background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      外部系统向 Webhook URL 发送 POST 请求即可触发自动化任务执行。每个运行实例有独立的 URL。
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label style={labelStyle}>URL 格式</label>
                      <code style={{
                        display: 'block', padding: '8px 12px', borderRadius: 8, fontSize: 11,
                        background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
                        color: 'var(--text-muted)', fontFamily: 'monospace', wordBreak: 'break-all',
                      }}>
                        POST {window.location.origin}/api/automations/hooks/{'<pipeline_id>'}
                      </code>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        保存模版后，从模版创建管道即可获得独立的 Webhook URL。
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                      请求 Body (JSON) 中的字段将作为 payload 注入到任务变量中。
                    </div>
                  </div>
                )}

                {/* Event config */}
                {!HIDE_UNSTABLE_TRIGGER_TYPES && form.triggerType === 'event' && (() => {
                  const selectedEvt = EVENT_CATALOG.find(e => e.value === form.eventType);
                  const filterDefs = selectedEvt?.filters || [];

                  const updateFilter = (key: string, value: string) => {
                    const existing = form.eventFilters.findIndex(f => f.key === key);
                    const next = [...form.eventFilters];
                    if (existing >= 0) {
                      if (value) next[existing] = { key, value };
                      else next.splice(existing, 1);
                    } else if (value) {
                      next.push({ key, value });
                    }
                    update('eventFilters', next);
                  };

                  const getFilterValue = (key: string) =>
                    form.eventFilters.find(f => f.key === key)?.value || '';

                  const eventSelectOptions: SelectOption[] = EVENT_GROUPS.flatMap(group => [
                    { value: `__group_${group}`, label: group, groupHeader: true },
                    ...EVENT_CATALOG.filter(e => e.group === group).map(e => ({
                      value: e.value,
                      label: e.label,
                      description: e.description,
                    })),
                  ]);

                  const pipelineSelectOptions: SelectOption[] = [
                    { value: '', label: '全部管道' },
                    ...pipelineOptions.map(p => ({ value: p.id, label: p.label })),
                  ];

                  const agentSelectOptions: SelectOption[] = [
                    { value: '', label: '全部 Agent' },
                    ...agentOptions.map(a => ({ value: a.id, label: a.name })),
                  ];

                  const renderFilterField = (fd: FilterFieldDef) => {
                    if (fd.type === 'pipeline_select') {
                      return (
                        <Select
                          value={getFilterValue(fd.key)}
                          onChange={v => updateFilter(fd.key, v)}
                          options={pipelineSelectOptions}
                          placeholder="全部管道"
                        />
                      );
                    }
                    if (fd.type === 'agent_select') {
                      return (
                        <Select
                          value={getFilterValue(fd.key)}
                          onChange={v => updateFilter(fd.key, v)}
                          options={agentSelectOptions}
                          placeholder="全部 Agent"
                        />
                      );
                    }
                    if (fd.type === 'select' && fd.options) {
                      const selectOpts: SelectOption[] = [
                        { value: '', label: '全部' },
                        ...fd.options.map(o => ({ value: o, label: o })),
                      ];
                      return (
                        <Select
                          value={getFilterValue(fd.key)}
                          onChange={v => updateFilter(fd.key, v)}
                          options={selectOpts}
                          placeholder="全部"
                        />
                      );
                    }
                    return (
                      <input
                        value={getFilterValue(fd.key)}
                        onChange={e => updateFilter(fd.key, e.target.value)}
                        placeholder={fd.placeholder || ''}
                        style={{ ...inputStyle, fontSize: 12 }}
                      />
                    );
                  };

                  return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '12px 14px', borderRadius: 10, background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
                    <div>
                      <label style={labelStyle}>当以下事件发生时触发</label>
                      <Select
                        value={form.eventType}
                        onChange={v => {
                          update('eventType', v);
                          update('eventFilters', []);
                          if (v !== 'custom') setCustomEventName('');
                        }}
                        options={eventSelectOptions}
                        placeholder="请选择事件..."
                      />
                    </div>

                    {form.eventType === 'custom' && (
                      <div>
                        <label style={labelStyle}>自定义事件名称</label>
                        <input
                          value={customEventName}
                          onChange={e => {
                            const v = e.target.value;
                            setCustomEventName(v.startsWith('custom.') ? v : `custom.${v}`);
                          }}
                          placeholder="custom.my_event"
                          style={{ ...inputStyle, fontFamily: 'monospace' }}
                        />
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                          工具或技能通过 emit_event 发出的事件名称，自动添加 custom. 前缀
                        </div>
                      </div>
                    )}

                    {selectedEvt && selectedEvt.value !== 'custom' && (
                      <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{selectedEvt.description}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>{selectedEvt.scenario}</div>
                      </div>
                    )}

                    {filterDefs.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <label style={labelStyle}>过滤条件 <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(可选，留空匹配全部)</span></label>
                        {filterDefs.map(fd => (
                          <div key={fd.key}>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 500 }}>{fd.label}</div>
                            {renderFilterField(fd)}
                            {fd.hint && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{fd.hint}</div>}
                          </div>
                        ))}
                      </div>
                    )}

                    {form.eventType && form.eventType !== '' && (
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, cursor: 'pointer' }}
                          onClick={e => {
                            const el = (e.currentTarget.nextElementSibling as HTMLElement);
                            if (el) el.style.display = el.style.display === 'none' ? 'flex' : 'none';
                          }}
                        >
                          ▸ 高级设置（防抖与冷却）
                        </div>
                        <div style={{ display: 'none', gap: 12 }}>
                          <div style={{ flex: 1 }}>
                            <label style={labelStyle}>防抖 (秒)</label>
                            <input
                              type="number" min={0} value={form.eventDebounce}
                              onChange={e => update('eventDebounce', parseInt(e.target.value) || 0)}
                              style={inputStyle}
                            />
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>短时间内收到多个同类事件时，只触发最后一个</div>
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={labelStyle}>冷却 (秒)</label>
                            <input
                              type="number" min={0} value={form.eventCooldown}
                              onChange={e => update('eventCooldown', parseInt(e.target.value) || 0)}
                              style={inputStyle}
                            />
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>触发一次后，在此时间内不再响应同类事件</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {form.eventType && form.eventType !== '' && (
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '8px 10px', borderRadius: 6, background: 'var(--bg-secondary)', lineHeight: 1.6 }}>
                        当 <strong>{selectedEvt?.label || (form.eventType === 'custom' ? customEventName : form.eventType)}</strong> 发生时触发
                        {form.eventFilters.filter(f => f.key && f.value).length > 0 && (() => {
                          const activeFilters = form.eventFilters.filter(f => f.key && f.value);
                          const summaryParts = activeFilters.map(f => {
                            const fd = filterDefs.find(d => d.key === f.key);
                            if (!fd) return null;
                            let displayVal = f.value;
                            if (fd.type === 'pipeline_select') {
                              displayVal = pipelineOptions.find(p => p.id === f.value)?.label || f.value;
                            } else if (fd.type === 'agent_select') {
                              displayVal = agentOptions.find(a => a.id === f.value)?.name || f.value;
                            }
                            return `${fd.label}: ${displayVal}`;
                          }).filter(Boolean);
                          return summaryParts.length > 0 ? <span>（{summaryParts.join('，')}）</span> : null;
                        })()}
                        {form.eventCooldown > 0 && <span>，冷却 {form.eventCooldown}s</span>}
                        {form.eventDebounce > 0 && <span>，防抖 {form.eventDebounce}s</span>}
                      </div>
                    )}
                  </div>
                  );
                })()}

                {/* Modifiers */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                    <input type="checkbox" checked={form.once} onChange={e => update('once', e.target.checked)} style={{ accentColor: 'var(--text-primary)' }} />
                    <span style={{ color: 'var(--text-primary)' }}>仅执行一次后自动停用</span>
                  </label>
                  <div>
                    <label style={labelStyle}>自动停止时间 <span style={{ fontWeight: 400 }}>(可选)</span></label>
                    <input
                      type="datetime-local"
                      value={form.endAt}
                      onChange={e => update('endAt', e.target.value)}
                      style={{ ...inputStyle, cursor: 'pointer' }}
                    />
                  </div>
                </div>
              </div>

              {/* Variables */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={sectionTitle}>可配置变量</div>
                  <button onClick={addVariable} style={{
                    display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '4px 10px', borderRadius: 6,
                    background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', cursor: 'pointer',
                  }}><PlusIcon size={11} /> 添加</button>
                </div>

                {form.variables.map((v, idx) => (
                  <div key={idx} style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input value={v.key} onChange={e => updateVariable(idx, 'key', e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))} placeholder="变量名" style={{ ...inputStyle, flex: 1, padding: '6px 8px', fontSize: 12, fontFamily: 'monospace' }} />
                      <select value={v.type} onChange={e => updateVariable(idx, 'type', e.target.value)} style={{ ...inputStyle, width: 90, padding: '6px 8px', fontSize: 12, cursor: 'pointer' }}>
                        <option value="string">string</option>
                        <option value="number">number</option>
                        <option value="boolean">boolean</option>
                      </select>
                      <button onClick={() => removeVariable(idx)} style={{ display: 'flex', padding: 4, borderRadius: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', opacity: 0.5 }}><TrashIcon size={13} /></button>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input value={v.label} onChange={e => updateVariable(idx, 'label', e.target.value)} placeholder="显示名称" style={{ ...inputStyle, flex: 1, padding: '5px 8px', fontSize: 11 }} />
                      <input value={v.default} onChange={e => updateVariable(idx, 'default', e.target.value)} placeholder="默认值" style={{ ...inputStyle, flex: 1, padding: '5px 8px', fontSize: 11 }} />
                    </div>
                    <input value={v.description} onChange={e => updateVariable(idx, 'description', e.target.value)} placeholder="变量说明" style={{ ...inputStyle, padding: '5px 8px', fontSize: 11 }} />
                  </div>
                ))}

                {form.variables.length === 0 && (
                  <div style={{ padding: 16, borderRadius: 10, textAlign: 'center', border: '1px dashed var(--border-subtle)', color: 'var(--text-muted)', fontSize: 12 }}>
                    暂无变量。变量可在 TASK.md 中通过 {'{{变量名}}'} 引用。
                  </div>
                )}
              </div>
            </div>

            {/* ─── Right Panel ─── */}
            <div data-testid="automation-studio-task-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

              {/* Right tabs */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 0,
                padding: '0 24px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0,
              }}>
                {([
                  { key: 'task' as const, label: '任务设计' },
                  { key: 'config' as const, label: '执行配置' },
                ]).map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setRightTab(tab.key)}
                    style={{
                      padding: '12px 18px', fontSize: 13, border: 'none', cursor: 'pointer',
                      background: 'transparent',
                      color: rightTab === tab.key ? 'var(--text-primary)' : 'var(--text-muted)',
                      fontWeight: rightTab === tab.key ? 600 : 400,
                      borderBottom: rightTab === tab.key ? '2px solid var(--text-primary)' : '2px solid transparent',
                      transition: 'all 0.15s',
                    }}
                  >{tab.label}</button>
                ))}
              </div>

              {/* Right content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

                {/* TASK.md Editor */}
                {rightTab === 'task' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ ...labelStyle, margin: 0 }}>
                        TASK.md
                        <span style={{ fontWeight: 400, marginLeft: 6 }}>(任务设计文档，格式兼容 SKILL.md)</span>
                      </label>
                    </div>
                    <textarea
                      value={form.taskMd}
                      onChange={e => update('taskMd', e.target.value)}
                      spellCheck={false}
                      style={{
                        flex: 1, width: '100%', minHeight: 300, padding: '16px 18px',
                        fontSize: 13, lineHeight: 1.7, borderRadius: 12,
                        border: '1px solid var(--input-border)', background: 'var(--input-bg)',
                        color: 'var(--text-primary)', outline: 'none',
                        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                        resize: 'vertical', tabSize: 2, boxSizing: 'border-box',
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Tab') {
                          e.preventDefault();
                          const ta = e.currentTarget;
                          const s = ta.selectionStart, en = ta.selectionEnd;
                          update('taskMd', form.taskMd.substring(0, s) + '  ' + form.taskMd.substring(en));
                          requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = s + 2; });
                        }
                      }}
                    />
                    {form.variables.length > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '4px 0' }}>
                        可用变量: {form.variables.filter(v => v.key).map(v => (
                          <code key={v.key} style={{ margin: '0 3px', padding: '1px 5px', borderRadius: 4, background: 'var(--hover-bg)', fontSize: 11 }}>{`{{${v.key}}}`}</code>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Execution Config */}
                {rightTab === 'config' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div style={sectionTitle}>执行参数</div>
                    <div style={{ display: 'flex', gap: 16 }}>
                      <div style={{ flex: 1 }}>
                        <label style={labelStyle}>最大迭代次数</label>
                        <input type="number" min={1} max={100} value={form.maxIterations} onChange={e => update('maxIterations', Math.min(100, Math.max(1, parseInt(e.target.value) || 30)))} style={inputStyle} />
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Agent 单次执行的最大思考-行动循环数</div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={labelStyle}>超时时间 (分钟)</label>
                        <input type="number" min={1} max={60} value={form.timeoutMinutes} onChange={e => update('timeoutMinutes', Math.min(60, Math.max(1, parseInt(e.target.value) || 30)))} style={inputStyle} />
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>超过此时间自动终止执行</div>
                      </div>
                    </div>

                    <div style={sectionTitle}>通知</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                        <input type="checkbox" checked={form.notifyComplete} onChange={e => update('notifyComplete', e.target.checked)} style={{ accentColor: 'var(--text-primary)' }} />
                        <div>
                          <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>完成通知</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>任务成功完成时推送通知</div>
                        </div>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                        <input type="checkbox" checked={form.notifyFailure} onChange={e => update('notifyFailure', e.target.checked)} style={{ accentColor: 'var(--text-primary)' }} />
                        <div>
                          <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>失败通知</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>任务执行失败时推送通知</div>
                        </div>
                      </label>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
};
