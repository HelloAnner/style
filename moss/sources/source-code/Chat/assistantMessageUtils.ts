import type {
  ConversationExecution,
  PendingToolCall,
  ToolCallDetail,
  WidgetRenderData,
} from '../../types';
import type { ToolCallVM } from '../../conversation/model/viewTypes';
import type { ActionItemData } from './ActionFeed';
import { parseWidgetRender } from '../../lib/wsContentParsers';

export function detailToActionItem(detail: ToolCallDetail, iteration: number): ActionItemData {
  const inferred = inferTaskDelegateDisplay(detail.name, detail.arguments || {});
  return {
    id: detail.id,
    toolName: detail.name,
    displayName: detail.display_name,
    arguments: detail.arguments || {},
    status: detail.status,
    iteration,
    durationMs: detail.duration_ms,
    delegateKind: detail.delegate_kind ?? inferred.delegateKind,
    delegateLabel: detail.delegate_label ?? inferred.delegateLabel,
    taskPreview: detail.task_preview ?? inferred.taskPreview,
    taskPreviews: detail.task_previews ?? inferred.taskPreviews,
  };
}

export function toolVmToActionItem(tool: ToolCallVM): ActionItemData {
  const display = objectValue(tool.payload.display);
  const patch = objectValue(tool.payload.patch);
  const argumentsPreview = objectValue(patch.arguments_preview);
  const args = toolArguments(tool.payload);
  const inferred = inferTaskDelegateDisplay(tool.name, args);
  return {
    id: tool.id,
    toolName: tool.name,
    displayName: tool.displayName,
    arguments: args,
    argumentsPreview: Object.keys(argumentsPreview).length > 0 ? argumentsPreview : undefined,
    status: tool.status,
    iteration: numberValue(tool.payload.iteration) ?? 1,
    traceEventSeq: tool.eventSeq,
    durationMs: tool.durationMs,
    delegateKind: delegateKindValue(display.delegate_kind) ?? inferred.delegateKind,
    delegateLabel: stringValue(display.delegate_label) ?? inferred.delegateLabel,
    taskPreview: stringValue(display.task_preview) ?? inferred.taskPreview,
    taskPreviews: stringArray(display.task_previews) ?? inferred.taskPreviews,
  };
}

export function toolVmToPendingToolCall(tool: ToolCallVM): PendingToolCall {
  const invocation = objectValue(tool.payload.invocation);
  const display = objectValue(tool.payload.display);
  const patch = objectValue(tool.payload.patch);
  const preview = objectValue(patch.arguments_preview);
  const uiHint = objectValue(patch.ui_hint);
  const previewFields = Object.keys(uiHint).length > 0 ? uiHint : preview;
  return {
    id: tool.id,
    name: tool.name,
    display_name: tool.displayName,
    iteration: numberValue(tool.payload.iteration) ?? 1,
    status: tool.status === 'completed' ? 'completed' : tool.status === 'running' ? 'running' : 'pending',
    started_at: tool.startedAt || stringValue(invocation.started_at) || new Date().toISOString(),
    delegate_kind: delegateKindValue(display.delegate_kind),
    delegate_label: stringValue(display.delegate_label),
    task_preview: stringValue(display.task_preview),
    task_previews: stringArray(display.task_previews),
    argPreview: Object.keys(previewFields).length > 0
      ? previewFields as { title?: string; loading_messages?: string[] }
      : undefined,
    widgetStream: tool.widgetStream,
  };
}

export function toolVmHasWidgetResult(tool: ToolCallVM): boolean {
  const output = toolResultOutput(tool.payload);
  return output.includes('[[WIDGET_RENDER]]') && Boolean(parseWidgetRender(output).widgetData);
}

export function actionItemsFromExecution(execution?: ConversationExecution): ActionItemData[] {
  if (!execution) return [];
  const items: ActionItemData[] = [];
  for (const iteration of execution.iterations) {
    for (const toolCall of iteration.tool_calls) {
      items.push(detailToActionItem(toolCall, iteration.iteration));
    }
  }
  return items;
}

export function visibleReasoningActionItems(
  runtimeTools: ToolCallVM[] | undefined,
  execution?: ConversationExecution,
): ActionItemData[] {
  const items = runtimeTools?.length
    ? runtimeTools.map(toolVmToActionItem)
    : actionItemsFromExecution(execution);
  return items.filter(item => item.toolName !== 'ask_user_question');
}

export function mergeWidgetData(
  runtimeWidget: WidgetRenderData | undefined,
  runtimeWidgets: WidgetRenderData[] | undefined,
  messageWidgets: WidgetRenderData[] | undefined,
): WidgetRenderData[] {
  const widgets: WidgetRenderData[] = [];
  const seen = new Set<string>();
  for (const widget of [runtimeWidget, ...(runtimeWidgets ?? []), ...(messageWidgets ?? [])]) {
    if (!widget) continue;
    const key = `${widget.title}\n${widget.code}`;
    if (seen.has(key)) continue;
    seen.add(key);
    widgets.push(widget);
  }
  return widgets;
}

export function resolveAssistantDurationSeconds(
  metricsPayload: Record<string, unknown> | undefined,
  messageDurationSeconds: number | undefined,
): number | undefined {
  const metrics = objectValue(metricsPayload?.metrics);
  const metricTotalMs = numberValue(metrics.total_ms) ?? numberValue(metricsPayload?.total_ms);
  if (metricTotalMs !== undefined) return metricTotalMs / 1000;
  return numberValue(messageDurationSeconds);
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function toolArguments(payload: Record<string, unknown>): Record<string, unknown> {
  const invocation = objectValue(payload.invocation);
  const patch = objectValue(payload.patch);
  const args = firstNonEmptyObject(
    invocation.arguments,
    objectValue(patch).arguments,
    objectValue(patch).arguments_preview,
    payload.arguments,
    payload.fields,
  );
  const result = toolResultObject(payload);
  const resolvedSubDashboard = stringValue(result.resolved_sub_dashboard);
  const resolvedSubDashboardName = stringValue(result.resolved_sub_dashboard_name);
  if (!resolvedSubDashboard && !resolvedSubDashboardName) return args;
  return {
    ...args,
    ...(resolvedSubDashboard ? { sub_dashboard: resolvedSubDashboard } : {}),
    ...(resolvedSubDashboardName ? { __dashboardDisplayName: resolvedSubDashboardName } : {}),
  };
}

function toolResultOutput(payload: Record<string, unknown>): string {
  const result = toolResultObject(payload);
  return typeof result.output === 'string'
    ? result.output
    : typeof payload.result === 'string'
      ? payload.result
      : '';
}

function toolResultObject(payload: Record<string, unknown>): Record<string, unknown> {
  const result = objectValue(payload.result);
  if (Object.keys(result).length > 0) return result;
  if (typeof payload.result !== 'string') return {};
  try {
    return objectValue(JSON.parse(payload.result));
  } catch {
    return {};
  }
}

function firstNonEmptyObject(...values: unknown[]): Record<string, unknown> {
  for (const value of values) {
    const object = objectValue(value);
    if (Object.keys(object).length > 0) return object;
  }
  return {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function stringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

interface TaskDelegateDisplay {
  delegateKind?: ActionItemData['delegateKind'];
  delegateLabel?: string;
  taskPreview?: string;
  taskPreviews?: string[];
}

export function inferTaskDelegateDisplay(
  toolName: string,
  args: Record<string, unknown>,
): TaskDelegateDisplay {
  if (toolName !== 'task') return {};
  const parsedTasks = parseMaybeJson(args.tasks);
  const items = Array.isArray(parsedTasks)
    ? parsedTasks
    : parsedTasks && typeof parsedTasks === 'object'
      ? [parsedTasks]
      : parsedTasks !== undefined
        ? [parsedTasks]
        : [args];
  const taskPreviews = items
    .map(taskItemText)
    .filter((item): item is string => Boolean(item));
  const kinds = new Set(
    items.map((item) => taskItemDelegateKind(objectValue(item), args)),
  );
  const labels = new Set(
    items
      .map((item) => taskItemDelegateLabel(objectValue(item), args))
      .filter((item): item is string => Boolean(item)),
  );

  return {
    delegateKind: kinds.size === 1
      ? Array.from(kinds)[0]
      : kinds.size > 1
        ? 'auto'
        : undefined,
    delegateLabel: labels.size === 1 ? Array.from(labels)[0] : undefined,
    taskPreview: taskPreviews[0],
    taskPreviews: taskPreviews.length > 0 ? taskPreviews : undefined,
  };
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function taskItemText(item: unknown): string | undefined {
  if (typeof item === 'string') return item.trim() || undefined;
  const object = objectValue(item);
  for (const key of ['task', 'description', 'prompt', 'tasks']) {
    const value = stringValue(object[key]);
    if (value) return value;
  }
  return undefined;
}

function taskItemDelegateKind(
  item: Record<string, unknown>,
  defaults: Record<string, unknown>,
): ActionItemData['delegateKind'] {
  const agent = stringValue(item.agent) ?? stringValue(defaults.agent);
  const subagent = stringValue(item.subagent) ?? stringValue(defaults.subagent);
  const capabilities = item.capabilities ?? defaults.capabilities;
  if (subagent) return 'subagent';
  if (agent === 'self') return 'derived';
  if (agent) return 'main';
  if (capabilities) return 'derived';
  return 'auto';
}

function taskItemDelegateLabel(
  item: Record<string, unknown>,
  defaults: Record<string, unknown>,
): string | undefined {
  const subagent = stringValue(item.subagent) ?? stringValue(defaults.subagent);
  if (subagent) return subagent;
  const agent = stringValue(item.agent) ?? stringValue(defaults.agent);
  return agent && agent !== 'self' ? agent : undefined;
}

function delegateKindValue(value: unknown): ActionItemData['delegateKind'] {
  return value === 'auto' || value === 'subagent' || value === 'derived' || value === 'main' || value === 'temp'
    ? value
    : undefined;
}
