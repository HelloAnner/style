/**
 * PipelineCreator — 全屏管道创建/编辑面板
 *
 * 视觉上与 AutomationStudio 完全一致，但保存到 Pipeline API (DB 实体)
 * 而非 Template API (文件系统模版)。
 */

import React, { useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  createPipeline, updatePipeline, getTemplate, listPipelines,
  type AutomationPipeline, type AutomationTemplate,
} from '../../api/automations';
import {
  AutomationCronPolicyError,
  isSpecificDatetimeCron,
  normalizeAutomationTriggerConfig,
} from './automationCronPolicy';
import { validateCronExpr } from './cronValidation';
import {
  formatLocalDateTime,
  formatPickerDateTime,
  getDateTimePartsInTimezone,
  isCompleteLocalDateTime,
  localDateTimeToIso,
  parseLocalDateTime,
} from './automationTime';
import { cronToHuman } from './automationSchedule';
import { agentApi } from '../../api/platform';
import { Select, type SelectOption } from '../common/Select';
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

const CalendarIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="16" rx="2"/><line x1="16" y1="3" x2="16" y2="7"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="3" y1="11" x2="21" y2="11"/>
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

interface PipelineFormData {
  name: string;
  description: string;
  triggerType: string;
  cronExpr: string;
  timezone: string;
  firstRunAt: string;
  intervalValue: number;
  intervalUnit: 'hour' | 'day' | 'week' | 'month';
  once: boolean;
  endAt: string;
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
const MAX_AUTOMATION_ITERATIONS = 60;

const DEFAULT_TASK_MD = `# 任务目标

请描述任务的目标和背景。

## 执行步骤

1. 步骤一
2. 步骤二

## 输出要求

- 将结果保存到个人文件
- 通知用户完成`;

const EMPTY_FORM: PipelineFormData = {
  name: '',
  description: '',
  triggerType: 'interval',
  cronExpr: '0 9 * * *',
  timezone: 'Asia/Shanghai',
  firstRunAt: '',
  intervalValue: 1,
  intervalUnit: 'day',
  once: false,
  endAt: '',
  eventType: '',
  eventFilters: [],
  eventDebounce: 0,
  eventCooldown: 0,
  variables: [],
  taskMd: DEFAULT_TASK_MD,
  maxIterations: MAX_AUTOMATION_ITERATIONS,
  timeoutMinutes: 30,
  notifyComplete: true,
  notifyFailure: true,
};

function legacyCronFirstRunAt(cronExpr: string, timezone: string): string {
  const [minute, hour] = cronExpr.trim().split(/\s+/);
  if (!/^\d+$/.test(minute) || !/^\d+$/.test(hour)) return '';
  const minuteValue = Number(minute);
  const hourValue = Number(hour);
  if (minuteValue > 59 || hourValue > 23) return '';
  const today = getDateTimePartsInTimezone(new Date(), timezone);
  return formatLocalDateTime({ ...today, hour: hourValue, minute: minuteValue });
}

const TIMEZONE_OPTIONS: SelectOption[] = [
  { value: 'Asia/Shanghai', label: '中国标准时间' },
  { value: 'Asia/Tokyo', label: '日本标准时间' },
  { value: 'Asia/Singapore', label: '新加坡时间' },
  { value: 'America/Los_Angeles', label: '美国西部时间' },
  { value: 'America/New_York', label: '美国东部时间' },
  { value: 'Europe/London', label: '英国时间' },
];

const TimeOptionColumn: React.FC<{
  value: number;
  count: number;
  onChange: (value: number) => void;
  label: string;
}> = ({ value, count, onChange, label }) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const itemHeight = 30;

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: Math.max(0, value * itemHeight - itemHeight * 3), behavior: 'auto' });
  }, [value]);

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div ref={scrollerRef} className="pipeline-time-options" style={{ height: itemHeight * 7, overflowY: 'auto', scrollbarWidth: 'none', overscrollBehavior: 'contain' }}>
        {Array.from({ length: count }, (_, option) => <button type="button" key={option} onClick={() => onChange(option)} style={{ width: '100%', height: itemHeight, display: 'block', borderRadius: 6, border: option === value ? '1px solid var(--input-border)' : '1px solid transparent', background: option === value ? 'var(--hover-bg)' : 'transparent', color: option === value ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: option === value ? 17 : 13, fontWeight: option === value ? 600 : 400 }}>{String(option).padStart(2, '0')}</button>)}
      </div>
    </div>
  );
};

const DateTimePicker: React.FC<{
  value: string;
  onChange: (value: string) => void;
  testIdPrefix: string;
  timezone: string;
}> = ({ value, onChange, testIdPrefix, timezone }) => {
  const parts = parseLocalDateTime(value);
  const now = getDateTimePartsInTimezone(new Date(), timezone);
  const [open, setOpen] = useState(false);
  const [panelPosition, setPanelPosition] = useState<{ left: number; top: number } | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(parts?.year ?? now.year, (parts?.month ?? now.month) - 1, 1));
  const selectedHour = parts?.hour ?? now.hour;
  const selectedMinute = parts?.minute ?? now.minute;
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dateCells = Array.from({ length: Math.ceil((firstWeekday + daysInMonth) / 7) * 7 }, (_, index) => index - firstWeekday + 1);
  const setTime = (hour: number, minute: number) => {
    const base = parts ?? now;
    onChange(formatLocalDateTime({ ...base, hour, minute }));
  };
  const setDate = (day: number) => {
    onChange(formatLocalDateTime({ year, month: month + 1, day, hour: selectedHour, minute: selectedMinute }));
  };
  const selectToday = () => {
    const today = getDateTimePartsInTimezone(new Date(), timezone);
    setVisibleMonth(new Date(today.year, today.month - 1, 1));
    onChange(formatLocalDateTime(today));
  };

  const updatePanelPosition = useCallback(() => {
    const triggerRect = pickerRef.current?.getBoundingClientRect();
    if (!triggerRect) return;

    const viewportMargin = 12;
    const gap = 6;
    const panelWidth = panelRef.current?.offsetWidth ?? Math.min(420, window.innerWidth - viewportMargin * 2);
    const panelHeight = panelRef.current?.offsetHeight ?? 320;
    const belowSpace = window.innerHeight - triggerRect.bottom - gap;
    const aboveSpace = triggerRect.top - gap;
    const openAbove = belowSpace < panelHeight && aboveSpace > belowSpace;
    const left = Math.min(Math.max(viewportMargin, triggerRect.left), window.innerWidth - panelWidth - viewportMargin);
    const top = openAbove
      ? Math.max(viewportMargin, triggerRect.top - panelHeight - gap)
      : Math.min(window.innerHeight - panelHeight - viewportMargin, triggerRect.bottom + gap);

    setPanelPosition({ left, top });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;

    updatePanelPosition();
    const frame = window.requestAnimationFrame(updatePanelPosition);
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!pickerRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false);
    };

    window.addEventListener('resize', updatePanelPosition);
    window.addEventListener('scroll', updatePanelPosition, true);
    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', updatePanelPosition);
      window.removeEventListener('scroll', updatePanelPosition, true);
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [open, updatePanelPosition]);

  return (
    <div ref={pickerRef} data-testid={testIdPrefix} onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }} style={{ position: 'relative', width: '100%', maxWidth: 300 }}>
      <button type="button" data-testid={`${testIdPrefix}-datetime-picker`} onClick={() => { setPanelPosition(null); setOpen(current => !current); }} style={{ width: '100%', minHeight: 32, padding: '5px 9px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderRadius: 8, border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: parts ? 'var(--text-primary)' : 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}>
        <span>{parts ? `${String(parts.month).padStart(2, '0')}月${String(parts.day).padStart(2, '0')}日 ${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}` : '月/日 --:--'}</span>
        <CalendarIcon size={15} />
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div ref={panelRef} data-testid={`${testIdPrefix}-datetime-panel`} onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }} style={{ position: 'fixed', left: panelPosition?.left ?? 0, top: panelPosition?.top ?? 0, zIndex: 210, display: 'flex', width: 420, maxWidth: 'calc(100vw - 24px)', padding: 12, borderRadius: 8, boxSizing: 'border-box', visibility: panelPosition ? 'visible' : 'hidden', background: 'var(--input-bg)', border: '1px solid var(--input-border)', boxShadow: 'var(--modal-shadow)' }}>
          <div style={{ flex: 1, minWidth: 0, paddingRight: 12, borderRight: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, color: 'var(--text-primary)', fontSize: 12, fontWeight: 600 }}>
              <button type="button" aria-label="上个月" onClick={() => setVisibleMonth(current => new Date(current.getFullYear(), current.getMonth() - 1, 1))} style={{ border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 16 }}>‹</button>
              <span>{year}年{String(month + 1).padStart(2, '0')}月</span>
              <button type="button" aria-label="下个月" onClick={() => setVisibleMonth(current => new Date(current.getFullYear(), current.getMonth() + 1, 1))} style={{ border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 16 }}>›</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, textAlign: 'center' }}>
              {'日一二三四五六'.split('').map(day => <span key={day} style={{ padding: '4px 0', color: 'var(--text-secondary)', fontSize: 11 }}>{day}</span>)}
              {dateCells.map((day, index) => day < 1 || day > daysInMonth ? <span key={`empty-${index}`} /> : (
                <button type="button" key={day} onClick={() => setDate(day)} style={{ height: 26, border: parts?.year === year && parts.month === month + 1 && parts.day === day ? '1px solid var(--input-border)' : '1px solid transparent', borderRadius: 4, background: parts?.year === year && parts.month === month + 1 && parts.day === day ? 'var(--hover-bg)' : 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 11 }}>{day}</button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 11 }}>
              <button type="button" onClick={() => onChange('')} style={{ border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>清除</button>
              <button type="button" onClick={selectToday} style={{ border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>今天</button>
            </div>
          </div>
          <div style={{ flex: '0 0 126px', paddingLeft: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <TimeOptionColumn value={selectedHour} count={24} label="时" onChange={hour => setTime(hour, selectedMinute)} />
              <TimeOptionColumn value={selectedMinute} count={60} label="分" onChange={minute => setTime(selectedHour, minute)} />
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};

/* ── Event Catalog: 所有平台事件 + 过滤维度 ── */

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

export const EVENT_CATALOG: EventDef[] = [
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
    description: '当某个自动化任务成功执行完毕时触发',
    scenario: '适合做自动化接力——上游自动化完成后自动启动下游自动化',
    filters: [
      { key: 'source.pipeline_id', label: '来源自动化', type: 'pipeline_select', hint: '选择要监听的上游自动化' },
    ],
  },
  {
    value: 'automation.run.failed', label: '自动化执行失败', group: '自动化事件',
    description: '当某个自动化任务执行失败时触发',
    scenario: '适合做失败补偿、告警或自动回滚',
    filters: [
      { key: 'source.pipeline_id', label: '来源自动化', type: 'pipeline_select', hint: '选择要监听的上游自动化' },
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
  // project.* 和 roundtable.* 事件已从 v11 版本中移除（430 不交付）
  {
    value: 'custom', label: '自定义事件', group: '自定义',
    description: '监听工具或技能通过 emit_event 发出的自定义事件',
    scenario: '适合对接自定义工具的业务流程',
    filters: [],
  },
];

const EVENT_GROUPS = Array.from(new Set(EVENT_CATALOG.map(e => e.group)));

export interface PipelineCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (pipeline?: AutomationPipeline) => void | Promise<void>;
  onBack?: () => void;
  agentId: string;
  editPipeline?: AutomationPipeline | null;
  prefillTemplate?: AutomationTemplate | null;
}

/* ── Component ── */

export const PipelineCreator: React.FC<PipelineCreatorProps> = ({
  isOpen, onClose, onCreated, onBack, agentId, editPipeline, prefillTemplate,
}) => {
  const navigate = useNavigate();
  const isEdit = !!editPipeline;
  const isFromTemplate = !!prefillTemplate && !isEdit;

  const [form, setForm] = useState<PipelineFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [webhookResult, setWebhookResult] = useState<{ id: string; url: string } | null>(null);
  const [webhookCopied, setWebhookCopied] = useState(false);
  const [pipelineOptions, setPipelineOptions] = useState<{ id: string; label: string }[]>([]);
  const [agentOptions, setAgentOptions] = useState<{ id: string; name: string }[]>([]);
  const [customEventName, setCustomEventName] = useState('');
  const [isEditingLegacySchedule, setIsEditingLegacySchedule] = useState(false);

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
    setIsEditingLegacySchedule(false);

    if (editPipeline) {
      const tc = editPipeline.trigger_config || {};
      const ec = editPipeline.execution_config || {};
      const notif = (ec as any).notification || {};
      const vars: VariableDef[] = [];
      if (editPipeline.variables_schema) {
        for (const [k, v] of Object.entries(editPipeline.variables_schema)) {
          vars.push({
            key: k,
            type: v.type || 'string',
            default: String(v.default ?? ''),
            label: v.label || '',
            description: v.description || '',
          });
        }
      }
      const evtCfg = (tc as any).event_config || {};
      const evtCond = (evtCfg.conditions || [])[0] || {};
      const evtFilters: EventFilterEntry[] = Object.entries(evtCond.filters || {}).map(([key, value]) => ({ key, value: String(value) }));

      const rawEvtType = evtCond.event_type || '';
      const isCustomEvt = rawEvtType.startsWith('custom.') && !EVENT_CATALOG.some(e => e.value === rawEvtType);

      setForm({
        name: editPipeline.name || '',
        description: editPipeline.description || '',
        triggerType: (tc as any).type || 'cron',
        cronExpr: (tc as any).cron_expr || '0 9 * * *',
        timezone: (tc as any).timezone || 'Asia/Shanghai',
        firstRunAt: formatPickerDateTime((tc as any).first_run_at, (tc as any).timezone || 'Asia/Shanghai')
          || ((tc as any).type === 'cron' ? legacyCronFirstRunAt((tc as any).cron_expr || '0 9 * * *', (tc as any).timezone || 'Asia/Shanghai') : ''),
        intervalValue: Number((tc as any).interval_value || 1),
        intervalUnit: (tc as any).interval_unit || 'day',
        once: (tc as any).once || false,
        endAt: formatPickerDateTime(editPipeline.end_at || (tc as any).end_at, (tc as any).timezone || 'Asia/Shanghai'),
        eventType: isCustomEvt ? 'custom' : rawEvtType,
        eventFilters: evtFilters,
        eventDebounce: evtCfg.debounce_seconds || 0,
        eventCooldown: evtCfg.cooldown_seconds || 0,
        variables: vars,
        taskMd: editPipeline.task_design || '',
        maxIterations: (ec as any).max_iterations || MAX_AUTOMATION_ITERATIONS,
        timeoutMinutes: (ec as any).timeout_minutes || 30,
        notifyComplete: notif.on_complete ?? true,
        notifyFailure: notif.on_failure ?? true,
      });
      if (isCustomEvt) setCustomEventName(rawEvtType);
    } else if (prefillTemplate) {
      getTemplate(prefillTemplate.name).then(detail => {
        const cfg = (detail as any).config || {};
        const vars: VariableDef[] = [];
        const varsSource = cfg.variables || prefillTemplate.variables;
        if (varsSource) {
          for (const [k, v] of Object.entries(varsSource)) {
            vars.push({
              key: k,
              type: (v as any).type || 'string',
              default: String((v as any).default ?? ''),
              label: (v as any).label || '',
              description: (v as any).description || '',
            });
          }
        }
        const evtCfg = cfg.trigger?.event_config;
        setForm({
          name: prefillTemplate.name || '',
          description: prefillTemplate.description || '',
          triggerType: cfg.trigger?.type || prefillTemplate.trigger_type || 'interval',
          cronExpr: cfg.trigger?.cron_expr || prefillTemplate.cron_expr || '0 9 * * *',
          timezone: cfg.trigger?.timezone || prefillTemplate.timezone || 'Asia/Shanghai',
          firstRunAt: formatPickerDateTime(cfg.trigger?.first_run_at, cfg.trigger?.timezone || prefillTemplate.timezone || 'Asia/Shanghai')
            || (cfg.trigger?.type === 'cron' ? legacyCronFirstRunAt(cfg.trigger?.cron_expr || prefillTemplate.cron_expr || '0 9 * * *', cfg.trigger?.timezone || prefillTemplate.timezone || 'Asia/Shanghai') : ''),
          intervalValue: Number(cfg.trigger?.interval_value || 1),
          intervalUnit: cfg.trigger?.interval_unit || 'day',
          once: cfg.trigger?.once || false,
          endAt: formatPickerDateTime(cfg.trigger?.end_at, cfg.trigger?.timezone || prefillTemplate.timezone || 'Asia/Shanghai'),
          variables: vars,
          taskMd: (detail as any).task_md || '',
          maxIterations: cfg.execution?.max_iterations || MAX_AUTOMATION_ITERATIONS,
          timeoutMinutes: cfg.execution?.timeout_minutes || 30,
          notifyComplete: cfg.execution?.notification?.on_complete ?? true,
          notifyFailure: cfg.execution?.notification?.on_failure ?? true,
          eventType: evtCfg?.conditions?.[0]?.event_type || '',
          eventFilters: evtCfg?.conditions?.[0]?.filters || {},
          eventDebounce: evtCfg?.debounce_seconds || 0,
          eventCooldown: evtCfg?.cooldown_seconds || 0,
        });
      }).catch(() => setForm({ ...EMPTY_FORM }));
    } else {
      setForm({ ...EMPTY_FORM });
    }
  }, [isOpen, editPipeline, prefillTemplate]);

  const update = useCallback(<K extends keyof PipelineFormData>(key: K, value: PipelineFormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  const updateSchedule = useCallback(<K extends 'firstRunAt' | 'timezone' | 'intervalValue' | 'intervalUnit' | 'once'>(key: K, value: PipelineFormData[K]) => {
    if (form.triggerType === 'cron') setIsEditingLegacySchedule(true);
    update(key, value);
  }, [form.triggerType, update]);

  const usesIntervalSchedule = form.triggerType === 'interval' || isEditingLegacySchedule;
  const isSpecificCron = form.triggerType === 'cron' && !isEditingLegacySchedule && isSpecificDatetimeCron(form.cronExpr);
  const legacyCronScheduleLabel = cronToHuman(form.cronExpr, form.once);

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
    if (usesIntervalSchedule && !isCompleteLocalDateTime(form.firstRunAt)) { setError('请选择完整的执行时间'); return; }
    if (form.endAt && !isCompleteLocalDateTime(form.endAt)) { setError('请填写完整的活动停止时间'); return; }
    if (usesIntervalSchedule && (!Number.isInteger(form.intervalValue) || form.intervalValue < 1 || form.intervalValue > 30)) {
      setError('执行周期请输入 1 到 30 之间的整数'); return;
    }
    if (form.triggerType === 'cron' && !isEditingLegacySchedule) {
      const cronError = validateCronExpr(form.cronExpr);
      if (cronError) { setError(cronError); return; }
    }

    setSaving(true);
    setError(null);

    const varsObj: Record<string, unknown> = {};
    for (const v of form.variables) {
      if (v.key.trim()) {
        varsObj[v.key.trim()] = {
          type: v.type, default: v.default || null, label: v.label, description: v.description,
        };
      }
    }

    try {
      const buildTriggerConfig = () => {
        const triggerType = usesIntervalSchedule ? 'interval' : form.triggerType;
        const tc: Record<string, unknown> = {
          type: triggerType,
          timezone: form.timezone,
          once: form.once,
        };
        if (triggerType === 'interval') {
          tc.first_run_at = localDateTimeToIso(form.firstRunAt, form.timezone);
          tc.interval_value = form.intervalValue;
          tc.interval_unit = form.intervalUnit;
        } else if (triggerType === 'cron') {
          tc.cron_expr = form.cronExpr;
        } else if (form.triggerType === 'event' && form.eventType) {
          const resolvedEventType = form.eventType === 'custom' ? customEventName : form.eventType;
          if (resolvedEventType) {
            const filters: Record<string, string> = {};
            form.eventFilters.forEach(f => { if (f.key && f.value) filters[f.key] = f.value; });
            tc.event_config = {
              conditions: [{ event_type: resolvedEventType, filters }],
              match: 'any',
              debounce_seconds: form.eventDebounce,
              cooldown_seconds: form.eventCooldown,
            };
          }
        }
        if (form.endAt) tc.end_at = localDateTimeToIso(form.endAt, form.timezone);
        return normalizeAutomationTriggerConfig(tc) ?? tc;
      };

      let savedPipeline: AutomationPipeline;
      if (isEdit) {
        savedPipeline = await updatePipeline(editPipeline!.id, {
          description: form.description,
          trigger_config: buildTriggerConfig(),
          task_design: form.taskMd,
          variables_schema: varsObj,
          execution_config: {
            max_iterations: form.maxIterations,
            timeout_minutes: form.timeoutMinutes,
            notification: { on_complete: form.notifyComplete, on_failure: form.notifyFailure },
          },
          end_at: form.endAt || undefined,
        });
      } else {
        const resolvedAgentId = agentId.trim();
        if (!resolvedAgentId) {
          setError('请先选择工作台中的智能体');
          setSaving(false);
          return;
        }

        const created = await createPipeline({
          agent_id: resolvedAgentId,
          display_name: form.name,
          description: form.description,
          source_template: isFromTemplate ? prefillTemplate!.name : undefined,
          trigger_config: buildTriggerConfig(),
          task_design: form.taskMd,
          variables_schema: varsObj,
          execution_config: {
            max_iterations: form.maxIterations,
            timeout_minutes: form.timeoutMinutes,
            notification: { on_complete: form.notifyComplete, on_failure: form.notifyFailure },
          },
          end_at: form.endAt || undefined,
        });

        savedPipeline = created;
        if (form.triggerType === 'webhook' && created.id) {
          setWebhookResult({ id: created.id, url: `${window.location.origin}/api/automations/hooks/${created.id}` });
        }
      }
      window.dispatchEvent(new CustomEvent('asset-changed', { detail: { type: 'automations' } }));
      if (isEdit) {
        await onCreated?.(savedPipeline);
        onClose();
      } else if (form.triggerType !== 'webhook') {
        await onCreated?.(savedPipeline);
        onClose();
      }
    } catch (err: any) {
      if (err instanceof AutomationCronPolicyError) {
        setError(err.message);
      } else {
        setError(err.message || '保存失败');
      }
    } finally {
      setSaving(false);
    }
  };

  if (webhookResult) {
    return createPortal(
      <div style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      }}>
        <div style={{
          width: 460, borderRadius: 16, padding: '28px 32px',
          background: 'var(--sidebar-bg)',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 16px 64px rgba(0,0,0,0.4)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-primary)' }}>
              <path d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 012 17c.01-.7.2-1.4.57-2"/><path d="M6 17a4 4 0 004-4V5.5a2.5 2.5 0 015 0V8"/><path d="M14.5 8H22a2 2 0 010 4h-7.5"/>
            </svg>
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Webhook 已就绪</span>
          </div>

          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.6 }}>
            外部系统向以下 URL 发送 POST 请求即可触发自动化执行。请求 body 为 JSON，字段可在任务设计中通过 {'{{payload.xxx}}'} 引用。
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 14px', borderRadius: 10,
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-subtle)',
            marginBottom: 20,
          }}>
            <code style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)', wordBreak: 'break-all', fontFamily: '"JetBrains Mono", monospace' }}>
              {webhookResult.url}
            </code>
            <button
              onClick={() => { navigator.clipboard.writeText(webhookResult.url); setWebhookCopied(true); setTimeout(() => setWebhookCopied(false), 2000); }}
              style={{
                flexShrink: 0, padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                background: webhookCopied ? 'var(--bg-tertiary)' : 'var(--text-primary)',
                color: webhookCopied ? 'var(--text-secondary)' : 'var(--sidebar-bg)',
                border: '1px solid var(--border-subtle)', cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {webhookCopied ? '已复制' : '复制'}
            </button>
          </div>

          <button
            onClick={() => { setWebhookResult(null); onCreated?.(); onClose(); }}
            style={{
              width: '100%', padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 500,
              background: 'none', border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)', cursor: 'pointer', transition: 'opacity 0.15s',
            }}
          >
            完成
          </button>
        </div>
      </div>,
      document.body
    );
  }

  if (!isOpen) return null;

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 11px', fontSize: 13, borderRadius: 9,
    border: '1px solid var(--input-border)', background: 'var(--input-bg)',
    color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12, color: 'var(--text-muted)', marginBottom: 2, display: 'block',
  };

  const sectionTitle: React.CSSProperties = {
    fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
    letterSpacing: 0,
    paddingBottom: 6, borderBottom: '1px solid var(--border-subtle)',
    marginBottom: 2,
  };

  const headerTitle = isEdit
    ? `编辑自动化: ${editPipeline?.display_name || editPipeline?.name || ''}`
    : isFromTemplate
      ? '从模版创建自动化'
      : '创建自动化任务';

  return createPortal(
    <>
      <style>{`
        .as-backdrop { animation: asFadeIn 0.15s ease-out; }
        .as-panel { animation: asScaleIn 0.18s ease-out; }
        .pipeline-time-options::-webkit-scrollbar { display: none; }
        .pipeline-section-tab { position: relative; }
        .pipeline-section-tab:hover { color: var(--text-primary) !important; }
        .pipeline-section-tab::after {
          content: ''; position: absolute; left: 0; right: 0; bottom: -1px; height: 2px;
          background: transparent; transition: background 0.15s ease;
        }
        .pipeline-section-tab:hover::after,
        .pipeline-section-tab[data-active='true']::after { background: var(--text-primary); }
        @keyframes asFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes asScaleIn { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
        @media (max-width: 600px) {
          .as-panel { width: calc(100vw - 16px) !important; height: calc(100vh - 16px) !important; border-radius: 14px !important; }
          .pipeline-creator-body { flex-direction: column !important; }
          .pipeline-creator-left-panel { border-right: none !important; border-bottom: 1px solid var(--border-subtle); }
        }
      `}</style>

      <div
        className="fixed inset-0 z-[200] flex items-center justify-center as-backdrop"
        data-testid="pipeline-creator-backdrop"
        style={{ background: 'var(--modal-backdrop)' }}
      >
        <div
          onClick={e => e.stopPropagation()}
          className="as-panel"
          data-testid="pipeline-creator-modal"
          data-edit-mode={isEdit ? 'true' : 'false'}
          style={{
            width: '92vw', maxWidth: 900, maxHeight: 'calc(100dvh - 32px)',
            background: 'var(--modal-bg)', borderRadius: 20,
            border: '1px solid var(--modal-border)',
            boxShadow: 'var(--modal-shadow)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}
        >
          {/* ── Header ── */}
          <div data-testid="pipeline-creator-header" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 24px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }} data-testid="pipeline-creator-header-left">
              <button
                onClick={isFromTemplate && onBack ? onBack : onClose}
                data-testid={isFromTemplate && onBack ? 'pipeline-creator-back' : 'pipeline-creator-nav-close'}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; }}
              ><BackIcon /></button>
              <span data-testid="pipeline-creator-title" style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                {headerTitle}
              </span>
              {!isEdit && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden' }}>
                  <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    建议直接让moss智能体帮你做，
                  </span>
                  <button
                    type="button"
                    className="pipeline-creator-try-agent"
                    onClick={() => {
                      onClose();
                      navigate('/app?prefillText=' + encodeURIComponent('帮我做一个自动定时任务：'));
                    }}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      padding: 0,
                      color: 'var(--moss-home-title-accent)',
                      fontSize: 12,
                      lineHeight: '18px',
                      cursor: 'pointer',
                      flexShrink: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      textDecoration: 'none',
                    }}
                    data-testid="pipeline-creator-try-agent"
                  >
                    <span data-try-agent-label>去试试</span>
                  </button>
                  <style>
                    {'.pipeline-creator-try-agent:hover [data-try-agent-label] { text-decoration: underline; }'}
                  </style>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }} data-testid="pipeline-creator-header-actions">
              {error && <span data-testid="pipeline-creator-error" style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</span>}
              <button
                onClick={handleSave} disabled={saving}
                data-testid="pipeline-creator-save"
                style={{
                  padding: '8px 22px', fontSize: 13, fontWeight: 500, borderRadius: 10,
                  background: 'var(--text-primary)', color: 'var(--bg-primary)',
                  border: 'none', cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.6 : 1,
                }}
              >{saving ? (isEdit ? '保存中...' : '创建中...') : (isEdit ? '保存' : '创建并激活')}</button>
              {isEdit && (
                <button
                  onClick={onClose}
                  data-testid="pipeline-creator-close"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                ><CloseIcon /></button>
              )}
            </div>
          </div>

          {/* <nav
            className="pipeline-creator-section-nav"
            data-testid="pipeline-creator-section-nav"
            aria-label="创建自动化步骤"
            style={{ display: 'flex', alignItems: 'center', gap: 22, padding: '0 24px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--modal-bg)', flexShrink: 0 }}
          >
            {([
              { key: 'basic', label: '基本信息' },
              { key: 'schedule', label: '执行时间' },
              { key: 'task', label: '具体任务' },
            ] as const).map(item => (
              <button
                type="button"
                key={item.key}
                className="pipeline-section-tab"
                data-active={activeSection === item.key ? 'true' : 'false'}
                data-testid={`pipeline-creator-nav-${item.key}`}
                onClick={() => setActiveSection(item.key)}
                style={{ padding: '11px 0 10px', border: 'none', background: 'transparent', color: activeSection === item.key ? 'var(--text-primary)' : 'var(--text-muted)', cursor: 'pointer', fontSize: 12, fontWeight: activeSection === item.key ? 600 : 500, whiteSpace: 'nowrap' }}
              >{item.label}</button>
            ))}
          </nav> */}

          {/* ── Body ── */}
          <div className="pipeline-creator-body" style={{ display: 'flex', flex: '1 1 auto', minHeight: 0, overflow: 'hidden' }} data-testid="pipeline-creator-body">

            {/* ─── Left Panel ─── */}
            {true && (
            <div style={{
              flex: '0 1 320px', maxWidth: 320, minWidth: 280,
              borderRight: '1px solid var(--border-subtle)',
              padding: '12px 20px 14px', minHeight: 0, overflowY: 'auto',
              display: 'flex', flexDirection: 'column', gap: 10,
            }} className="pipeline-creator-left-panel" data-testid="pipeline-creator-left-panel">

              {/* Basic Info */}
              {true && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-testid="pipeline-creator-basic-info">
                <div style={sectionTitle}>1. 基本信息</div>
                <div>
                  <label style={labelStyle}>任务名称</label>
                  <input
                    data-testid="pipeline-creator-name"
                    value={form.name}
                    onChange={e => update('name', e.target.value)}
                    placeholder="例如：每周工作总结"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>任务简介</label>
                  <input data-testid="pipeline-creator-description" value={form.description} onChange={e => update('description', e.target.value)} placeholder="例如：汇总本周工作进展、风险和下周计划" style={inputStyle} />
                </div>
              </div>
              )}

              {/* Trigger Config */}
              {true && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-testid="pipeline-creator-trigger-config">
                <div style={sectionTitle}>2. 执行时间</div>

                {form.triggerType === 'cron' && (
                  <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontSize: 12 }}>
                    <div>当前执行计划：{legacyCronScheduleLabel}</div>
                  </div>
                )}

                {(usesIntervalSchedule || form.triggerType === 'cron') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-testid="pipeline-creator-cron-config">
                    {isEditingLegacySchedule && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                        保存后将使用新的执行时间和执行周期。
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <label style={labelStyle}>执行时间</label>
                        <DateTimePicker value={form.firstRunAt} onChange={value => updateSchedule('firstRunAt', value)} testIdPrefix="pipeline-creator-first-run" timezone={form.timezone} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <label style={labelStyle}>时区</label>
                        <Select
                          value={form.timezone}
                          onChange={value => updateSchedule('timezone', value)}
                          options={TIMEZONE_OPTIONS}
                          density="compact"
                          ariaLabel="时区"
                          testId="pipeline-creator-timezone"
                          triggerTestId="pipeline-creator-timezone-trigger"
                        />
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>执行周期</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: 11, whiteSpace: 'nowrap' }}>每</span>
                        <input data-testid="pipeline-creator-interval-value" type="text" inputMode="numeric" pattern="[0-9]*" value={form.intervalValue} onChange={e => { const next = e.target.value; if (/^\d*$/.test(next)) updateSchedule('intervalValue', Number(next || 0)); }} style={{ ...inputStyle, flex: '0 0 56px', width: 56, minWidth: 56, maxWidth: 56, boxSizing: 'border-box', minHeight: 30, padding: '4px', borderRadius: 8, fontSize: 12 }} />
                        <select data-testid="pipeline-creator-interval-unit" value={form.intervalUnit} onChange={e => updateSchedule('intervalUnit', e.target.value as PipelineFormData['intervalUnit'])} style={{ ...inputStyle, flex: '0 0 56px', width: 56, minWidth: 56, maxWidth: 56, boxSizing: 'border-box', minHeight: 30, padding: '4px', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>
                          <option value="hour">小时</option><option value="day">天</option><option value="week">周</option><option value="month">月</option>
                        </select>
                        <span style={{ color: 'var(--text-secondary)', fontSize: 11, whiteSpace: 'nowrap' }}>执行一次</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Webhook config */}
                {!HIDE_UNSTABLE_TRIGGER_TYPES && form.triggerType === 'webhook' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 14px', borderRadius: 10, background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      外部系统向 Webhook URL 发送 POST 请求即可触发自动化执行。保存后将生成可用的 Webhook URL。
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
                    { value: '', label: '全部自动化' },
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
                          placeholder="全部自动化"
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
                    {/* Step 1: 选择事件类型 */}
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

                    {/* 自定义事件名称 */}
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

                    {/* Step 2: 事件说明卡片 */}
                    {selectedEvt && selectedEvt.value !== 'custom' && (
                      <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{selectedEvt.description}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>{selectedEvt.scenario}</div>
                      </div>
                    )}

                    {/* Step 3: 结构化过滤条件 */}
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

                    {/* Step 4: 高级设置 — 防抖 / 冷却 */}
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

                    {/* 摘要 */}
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }} data-testid="pipeline-creator-modifiers">
                  <div>
                    <label style={labelStyle}>活动停止时间 <span style={{ fontWeight: 400 }}>(可选)</span></label>
                    <DateTimePicker value={form.endAt} onChange={value => update('endAt', value)} testIdPrefix="pipeline-creator-end-at" timezone={form.timezone} />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                    <input
                      data-testid="pipeline-creator-once"
                      type="checkbox"
                      checked={isSpecificCron || form.once}
                      disabled={isSpecificCron}
                      onChange={e => updateSchedule('once', e.target.checked)}
                      style={{ accentColor: 'var(--text-primary)' }}
                    />
                    <span style={{ color: 'var(--text-primary)' }}>仅执行一次后自动停用</span>
                  </label>
                  {isSpecificCron && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', paddingLeft: 24 }}>
                      当前 Cron 指向具体日期，本次将自动视为一次性任务。
                    </div>
                  )}
                </div>
              </div>
              )}

              {/* Variables */}
              <div style={{ display: 'none' }} data-testid="pipeline-creator-variables">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={sectionTitle}>可配置变量</div>
                  <button data-testid="pipeline-creator-add-variable" onClick={addVariable} style={{
                    display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '4px 10px', borderRadius: 6,
                    background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', cursor: 'pointer',
                  }}><PlusIcon size={11} /> 添加</button>
                </div>

                {form.variables.map((v, idx) => (
                  <div key={idx} data-testid={`pipeline-creator-variable-${idx}`} style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input data-testid={`pipeline-creator-variable-key-${idx}`} value={v.key} onChange={e => updateVariable(idx, 'key', e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))} placeholder="变量名" style={{ ...inputStyle, flex: 1, padding: '6px 8px', fontSize: 12, fontFamily: 'monospace' }} />
                      <select data-testid={`pipeline-creator-variable-type-${idx}`} value={v.type} onChange={e => updateVariable(idx, 'type', e.target.value)} style={{ ...inputStyle, width: 90, padding: '6px 8px', fontSize: 12, cursor: 'pointer' }}>
                        <option value="string">string</option>
                        <option value="number">number</option>
                        <option value="boolean">boolean</option>
                      </select>
                      <button data-testid={`pipeline-creator-variable-remove-${idx}`} onClick={() => removeVariable(idx)} style={{ display: 'flex', padding: 4, borderRadius: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', opacity: 0.5 }}><TrashIcon size={13} /></button>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input data-testid={`pipeline-creator-variable-label-${idx}`} value={v.label} onChange={e => updateVariable(idx, 'label', e.target.value)} placeholder="显示名称" style={{ ...inputStyle, flex: 1, padding: '5px 8px', fontSize: 11 }} />
                      <input data-testid={`pipeline-creator-variable-default-${idx}`} value={v.default} onChange={e => updateVariable(idx, 'default', e.target.value)} placeholder="默认值" style={{ ...inputStyle, flex: 1, padding: '5px 8px', fontSize: 11 }} />
                    </div>
                    <input data-testid={`pipeline-creator-variable-description-${idx}`} value={v.description} onChange={e => updateVariable(idx, 'description', e.target.value)} placeholder="变量说明" style={{ ...inputStyle, padding: '5px 8px', fontSize: 11 }} />
                  </div>
                ))}

                {form.variables.length === 0 && (
                  <div data-testid="pipeline-creator-variables-empty" style={{ padding: 16, borderRadius: 10, textAlign: 'center', border: '1px dashed var(--border-subtle)', color: 'var(--text-muted)', fontSize: 12 }}>
                    暂无变量。变量可在 TASK.md 中通过 {'{{变量名}}'} 引用。
                  </div>
                )}
              </div>
            </div>
            )}

            {/* ─── Right Panel ─── */}
            {true && (
            <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', minWidth: 0 }} data-testid="pipeline-creator-right-panel">

              {/* Right content */}
              <div style={{ flex: '1 1 auto', minHeight: 0, display: 'flex', padding: '12px 20px 14px' }} data-testid="pipeline-creator-right-content">

                {/* TASK.md Editor */}
                  <div style={{ display: 'flex', flex: '1 1 auto', minHeight: 0, flexDirection: 'column', gap: 6 }} data-testid="pipeline-creator-task-panel">
                    <div style={{ ...sectionTitle, paddingBottom: 0, borderBottom: 'none' }}>3. 具体任务</div>
                    <div style={{ display: 'flex', flex: '1 1 auto', minHeight: 220 }}>
                    <textarea
                      data-testid="pipeline-creator-task-md"
                      value={form.taskMd}
                      onChange={e => update('taskMd', e.target.value)}
                      placeholder="请填写具体任务"
                      spellCheck={false}
                      style={{
                        width: '100%', height: '100%', minHeight: 220, padding: '12px 14px',
                        fontSize: 13, lineHeight: 1.7, borderRadius: 12,
                        border: '1px solid var(--input-border)', background: 'var(--input-bg)',
                        color: 'var(--text-primary)', outline: 'none',
                        fontFamily: 'inherit',
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
                    </div>
                    {form.variables.length > 0 && (
                      <div data-testid="pipeline-creator-task-variables" style={{ fontSize: 11, color: 'var(--text-muted)', padding: '4px 0' }}>
                        可用变量: {form.variables.filter(v => v.key).map(v => (
                          <code key={v.key} style={{ margin: '0 3px', padding: '1px 5px', borderRadius: 4, background: 'var(--hover-bg)', fontSize: 11 }}>{`{{${v.key}}}`}</code>
                        ))}
                      </div>
                    )}
                  </div>
              </div>
            </div>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
};
