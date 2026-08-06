/**
 * ReplayEngine — 回放引擎
 *
 * 核心流序：user_message → agent_placeholder → tool_calls (逐个落入) → tools_collapse → agent_text
 */

import type { ChatMessage, ConversationExecution, SubAgentExecution } from '../../types';
import { stripAllMarkers } from '../../lib/wsContentParsers';

// ---------------------------------------------------------------------------
// Event types
// ---------------------------------------------------------------------------

export type ReplayEventType =
  | 'user_message'
  | 'agent_placeholder'
  | 'agent_text'
  | 'tool_call'
  | 'tools_collapse'
  | 'file_created'
  | 'questionnaire'
  | 'questionnaire_reply'
  | 'plan_enter'
  | 'plan_review'
  | 'plan_exit'
  | 'sub_agent_start'
  | 'sub_agent_complete'
  | 'roundtable_created'
  | 'roundtable_conclude'
  | 'todo_update'
  | 'widget_render'
  | 'follow_up_questions'
  | 'execution_gap';

export interface ReplayEvent {
  type: ReplayEventType;
  duration: number;
  payload: any;
}

export interface TodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
}

export interface SubAgentState extends SubAgentExecution {
  sourceToolCallId?: string;
  executionId?: string;
  messageId?: string;
}

export interface ReplayFileItem {
  name: string;
  path: string;
  type: string;
  size?: number;
}

// ---------------------------------------------------------------------------
// Replay State
// ---------------------------------------------------------------------------

export interface ReplayState {
  events: ReplayEvent[];
  currentIndex: number;
  displayedMessages: ChatMessage[];
  typingMessageId: string | null;
  typingText: string;
  typingFullText: string;
  displayedToolCalls: Map<string, any[]>;
  /** Execution IDs whose tools are currently expanded (showing one-by-one) */
  expandedToolExecIds: Set<string>;
  activeFiles: ReplayFileItem[];
  workspaceOpen: boolean;
  workspaceDismissed: boolean;
  isPlaying: boolean;
  speed: 1 | 2;
  planModeActive: boolean;
  globalTodos: TodoItem[];
  todoExpanded: boolean;
  activeSubAgents: SubAgentState[];
  visibleWidgets: Map<string, any[]>;
  visibleRoundtables: Map<string, any[]>;
  isComplete: boolean;
}

export function createInitialState(): ReplayState {
  return {
    events: [],
    currentIndex: -1,
    displayedMessages: [],
    typingMessageId: null,
    typingText: '',
    typingFullText: '',
    displayedToolCalls: new Map(),
    expandedToolExecIds: new Set(),
    activeFiles: [],
    workspaceOpen: false,
    workspaceDismissed: false,
    isPlaying: false,
    speed: 1,
    planModeActive: false,
    globalTodos: [],
    todoExpanded: false,
    activeSubAgents: [],
    visibleWidgets: new Map(),
    visibleRoundtables: new Map(),
    isComplete: false,
  };
}

function finalizeTyping(state: ReplayState): ReplayState {
  if (!state.typingMessageId) {
    return { ...state, typingText: '', typingFullText: '' };
  }
  return {
    ...state,
    displayedMessages: state.displayedMessages.map((m) =>
      m.id === state.typingMessageId ? { ...m, content: state.typingFullText } : m,
    ),
    typingMessageId: null,
    typingText: '',
    typingFullText: '',
  };
}

// ---------------------------------------------------------------------------
// File-related tool detection
// ---------------------------------------------------------------------------

const FILE_TOOLS = new Set([
  'write', 'write_file', 'create_file', 'edit', 'edit_file', 'multi_edit',
  'save_file', 'write_to_file', 'create_document', 'create_visualization',
]);

function isFileCreationTool(toolName: string): boolean {
  if (FILE_TOOLS.has(toolName)) return true;
  if (toolName.includes('file') && (toolName.includes('write') || toolName.includes('create'))) return true;
  return false;
}

function extractFileName(tc: any): string | null {
  const args = tc.arguments || {};
  return args.path || args.file_path || args.filename || null;
}

// ---------------------------------------------------------------------------
// Build event sequence
// ---------------------------------------------------------------------------

function emitAssistantContentEvents(
  events: ReplayEvent[],
  msg: ChatMessage,
  sf: number,
  speed: number,
  emittedAssistantIds: Set<string>,
) {
  const content = String((msg as any).replayContent ?? msg.content ?? '');
  let emittedText = false;
  if (content) {
    const cleanContent = stripAllMarkers(content);
    if (cleanContent) {
      const typingDuration = Math.max(300, (cleanContent.length / (60 * speed)) * 1000) * sf;
      events.push({ type: 'agent_text', duration: typingDuration, payload: { message: msg, text: cleanContent } });
      emittedText = true;
    }
  }
  if (!emittedText && hasMessageLevelSurface(msg)) {
    events.push({ type: 'agent_text', duration: 50 * sf, payload: { message: msg, text: '' } });
    emittedText = true;
  }
  const widgetList = (msg as any).widgetDataList;
  const hasWidgets = Array.isArray(widgetList) && widgetList.length > 0;
  if ((msg as any).questionData && !hasWidgets) {
    events.push({ type: 'questionnaire', duration: 300 * sf, payload: { message: msg } });
  }
  if ((msg as any).planReviewData) {
    events.push({ type: 'plan_review', duration: 400 * sf, payload: { message: msg } });
  }

  if (hasWidgets) {
    for (const wd of widgetList) {
      events.push({
        type: 'widget_render',
        duration: 600 * sf,
        payload: { messageId: msg.id, widgetData: wd },
      });
    }
  }
  if ((msg as any).questionData && hasWidgets) {
    events.push({ type: 'questionnaire', duration: 300 * sf, payload: { message: msg } });
  }

  if ((msg as any).followUpQuestions?.items?.length) {
    events.push({
      type: 'follow_up_questions',
      duration: 200 * sf,
      payload: { message: msg, followUpQuestions: (msg as any).followUpQuestions },
    });
  }

  emittedAssistantIds.add(msg.id);
  events.push({ type: 'execution_gap', duration: 100 * sf, payload: {} });
}

function hasMessageLevelSurface(msg: ChatMessage): boolean {
  const anyMsg = msg as any;
  return Boolean(
    anyMsg.toolApprovalData
    || anyMsg.toolApprovalDecided
    || anyMsg.sources?.length
    || anyMsg.followUpQuestions?.items?.length
    || anyMsg.subagentResults?.length
    || anyMsg.roundtableData
    || anyMsg.roundtableDataList?.length,
  );
}

function withoutDeferredSurfaces(message: ChatMessage): ChatMessage {
  const msg = { ...message };
  delete (msg as any).followUpQuestions;
  delete (msg as any).follow_up_questions;
  delete (msg as any).subagentResults;
  delete (msg as any).subagent_results;
  return msg;
}

export function buildEventSequence(
  messages: ChatMessage[],
  executions: ConversationExecution[],
  speed: number = 1,
): ReplayEvent[] {
  const events: ReplayEvent[] = [];
  const sf = 1 / speed;

  const executionMap = new Map<string, ConversationExecution>();
  for (const exec of executions) executionMap.set(exec.id, exec);

  const sortedMessages = [...messages].sort((a: any, b: any) => (a.seq ?? 0) - (b.seq ?? 0));

  const assistantByExecId = new Map<string, ChatMessage>();
  for (const m of sortedMessages) {
    if (m.role === 'assistant' && (m as any).executionId) {
      assistantByExecId.set((m as any).executionId, m);
    }
  }

  const execQueue = [...executions];
  let execIdx = 0;
  const processedExecs = new Set<string>();
  const emittedAssistantIds = new Set<string>();

  function processExecution(exec: ConversationExecution, assistantMsg: ChatMessage | undefined) {
    if (assistantMsg) {
      events.push({
        type: 'agent_placeholder',
        duration: 150 * sf,
        payload: { message: assistantMsg, executionId: exec.id },
      });
    }
    const toolCount = emitExecutionEvents(events, exec, assistantMsg, sf);
    const hasSubagentResults = Boolean(assistantMsg?.subagentResults?.length);
    if ((toolCount > 0 || hasSubagentResults) && assistantMsg) {
      events.push({ type: 'tools_collapse', duration: 200 * sf, payload: { executionId: exec.id } });
    }
    processedExecs.add(exec.id);
  }

  for (const msg of sortedMessages) {
    if (msg.role === 'user') {
      const content = (msg.content || '') as string;
      const isSystemReminder = content.includes('<system_reminder>') || content.includes('</system_reminder>');

      if (isSystemReminder) {
        if (execIdx < execQueue.length) {
          const exec = execQueue[execIdx];
          const assistantMsg = assistantByExecId.get(exec.id);
          processExecution(exec, assistantMsg);
          execIdx++;
        }
        continue;
      }

      if ((msg as any).questionnaireReply) {
        events.push({ type: 'questionnaire_reply', duration: 200 * sf, payload: { message: msg } });
      } else {
        events.push({ type: 'user_message', duration: 250 * sf, payload: { message: msg } });
      }

      if (execIdx < execQueue.length) {
        const exec = execQueue[execIdx];
        const assistantMsg = assistantByExecId.get(exec.id);
        processExecution(exec, assistantMsg);
        execIdx++;
      }
    } else if (msg.role === 'assistant') {
      const eid = (msg as any).executionId;

      if (eid && !processedExecs.has(eid) && executionMap.has(eid)) {
        const exec = executionMap.get(eid)!;
        processExecution(exec, msg);
        while (execIdx < execQueue.length && processedExecs.has(execQueue[execIdx].id)) execIdx++;
      } else if (!eid && execIdx < execQueue.length && !processedExecs.has(execQueue[execIdx].id)) {
        const exec = execQueue[execIdx];
        (msg as any).executionId = exec.id;
        processExecution(exec, msg);
        execIdx++;
      }

      emitAssistantContentEvents(events, msg, sf, speed, emittedAssistantIds);
    }
  }

  for (; execIdx < execQueue.length; execIdx++) {
    const exec = execQueue[execIdx];
    if (!processedExecs.has(exec.id)) {
      const aMsg = assistantByExecId.get(exec.id);
      processExecution(exec, aMsg);
      if (aMsg && !emittedAssistantIds.has(aMsg.id)) {
        emitAssistantContentEvents(events, aMsg, sf, speed, emittedAssistantIds);
      }
    }
  }

  return events;
}

function _extractSubTasks(tc: any): { task: string; agentType: string; agentKind?: string; displayName?: string }[] {
  const args = tc.arguments || {};
  const fallbackKind = args.delegate_kind || args.agent_kind || 'main';
  const fallbackLabel = args.delegate_label || args.display_name || args.subagent || args.agent || args.agent_type || '';
  let rawTasks = args.tasks;
  if (typeof rawTasks === 'string') {
    try { rawTasks = JSON.parse(rawTasks); } catch { /* ignore */ }
  }
  if (Array.isArray(rawTasks)) {
    return rawTasks.map((t: any) => {
      if (typeof t === 'string') return { task: t, agentType: fallbackLabel, agentKind: fallbackKind, displayName: fallbackLabel };
      const agentType = t.subagent || t.agent || t.agent_type || t.type || fallbackLabel;
      return {
        task: t.task || t.description || t.prompt || '',
        agentType,
        agentKind: t.delegate_kind || t.agent_kind || fallbackKind,
        displayName: t.delegate_label || t.display_name || agentType,
      };
    });
  }
  if (typeof rawTasks === 'object' && rawTasks) {
    const agentType = rawTasks.subagent || rawTasks.agent || rawTasks.agent_type || fallbackLabel;
    return [{
      task: rawTasks.task || rawTasks.description || '',
      agentType,
      agentKind: rawTasks.delegate_kind || rawTasks.agent_kind || fallbackKind,
      displayName: rawTasks.delegate_label || rawTasks.display_name || agentType,
    }];
  }
  const agentType = fallbackLabel;
  return [{
    task: args.task || args.description || args.prompt || args.task_preview || '',
    agentType,
    agentKind: fallbackKind,
    displayName: fallbackLabel,
  }];
}

function replayToolCallId(exec: ConversationExecution, iterationIndex: number, toolIndex: number, tc: any): string {
  return String(tc.id || `${exec.id || 'execution'}-i${iterationIndex}-t${toolIndex}`);
}

function withReplayToolCallId(tc: any, sourceToolCallId: string): any {
  if (tc && typeof tc === 'object' && tc.__replayToolCallId === sourceToolCallId) return tc;
  return { ...tc, __replayToolCallId: sourceToolCallId };
}

function replayTerminalStatus(status: unknown): 'failed' | 'timeout' | 'cancelled' | undefined {
  if (typeof status !== 'string') return undefined;
  switch (status.trim().toLowerCase()) {
    case 'failed':
    case 'job.failed':
    case 'execution.failed':
      return 'failed';
    case 'timeout':
    case 'job.timeout':
    case 'execution.timed_out':
      return 'timeout';
    case 'cancelled':
    case 'canceled':
    case 'job.cancelled':
    case 'job.canceled':
    case 'execution.cancelled':
    case 'execution.canceled':
      return 'cancelled';
    default:
      return undefined;
  }
}

function hasReplayToolCompletionEvidence(tc: any): boolean {
  return Boolean(
    tc?.duration_ms != null
    || tc?.durationMs != null
    || tc?.result != null
    || tc?.result_raw != null
    || tc?.error != null,
  );
}

function replayInterruptedToolError(status: 'failed' | 'timeout' | 'cancelled') {
  if (status === 'timeout') {
    return { code: 'EXECUTION_TIMEOUT', message: '任务执行超时，工具未返回结果' };
  }
  if (status === 'cancelled') {
    return { code: 'EXECUTION_CANCELLED', message: '任务已取消，工具未返回结果' };
  }
  return { code: 'EXECUTION_FAILED', message: '任务执行失败，工具未返回结果' };
}

function normalizeReplayToolCall(tc: any, exec: ConversationExecution): any {
  const terminalStatus = replayTerminalStatus((exec as any).status);
  if (!terminalStatus || tc?.status === 'failed' || hasReplayToolCompletionEvidence(tc)) {
    return tc;
  }
  return {
    ...tc,
    status: 'failed',
    error: replayInterruptedToolError(terminalStatus),
  };
}

function isSubAgentToolName(name: string): boolean {
  return name.startsWith('sub_agent')
    || name === 'delegate_task'
    || name === 'run_subagent'
    || name === 'task';
}

function persistedSubAgentSourceToolCallId(subAgent: SubAgentExecution): string | undefined {
  if (subAgent.anchorToolCallId) return subAgent.anchorToolCallId;
  if (subAgent.parentStepId?.startsWith('tool:')) return subAgent.parentStepId.slice('tool:'.length);
  if (subAgent.parentStepId?.startsWith('tool_call:')) return subAgent.parentStepId.slice('tool_call:'.length);
  const parentTaskId = subAgent.parentTaskId || '';
  for (const prefix of ['delegation_', 'delegation-', 'delegation:']) {
    if (parentTaskId.startsWith(prefix)) return parentTaskId.slice(prefix.length);
  }
  return undefined;
}

function persistedSubAgentStartSnapshot(
  subAgent: SubAgentExecution,
  sourceToolCallId: string | undefined,
): SubAgentExecution {
  const terminal = ['completed', 'failed', 'cancelled', 'timed_out'].includes(subAgent.status);
  return {
    taskId: subAgent.taskId,
    task: subAgent.task,
    agentType: subAgent.agentType,
    agentKind: subAgent.agentKind,
    displayName: subAgent.displayName,
    status: terminal ? 'running' : subAgent.status,
    iteration: terminal ? 0 : subAgent.iteration,
    startedAt: subAgent.startedAt,
    parentTaskId: subAgent.parentTaskId,
    parentStepId: subAgent.parentStepId,
    anchorToolCallId: subAgent.anchorToolCallId || sourceToolCallId,
    startedEventSeq: subAgent.startedEventSeq,
    attributionDegraded: subAgent.attributionDegraded,
    registryId: subAgent.registryId,
    registryVersion: subAgent.registryVersion,
    runtimeTools: subAgent.runtimeTools,
    runtimeSkills: subAgent.runtimeSkills,
    retryCount: terminal ? undefined : subAgent.retryCount,
    retryReason: terminal ? undefined : subAgent.retryReason,
  };
}

function emitPersistedSubAgentEvents(
  events: ReplayEvent[],
  subAgents: SubAgentExecution[],
  exec: ConversationExecution,
  assistantMsg: ChatMessage | undefined,
  sf: number,
  sourceToolCallId?: string,
  toolCall?: any,
) {
  const entries = subAgents.map((subAgent) => ({
    subAgent,
    context: {
      sourceToolCallId: sourceToolCallId || persistedSubAgentSourceToolCallId(subAgent),
      executionId: exec.id,
      messageId: assistantMsg?.id,
    },
  }));
  for (const { subAgent, context } of entries) {
    events.push({
      type: 'sub_agent_start',
      duration: 400 * sf,
      payload: {
        ...context,
        toolCall,
        subAgent: persistedSubAgentStartSnapshot(subAgent, context.sourceToolCallId),
      },
    });
  }
  for (let index = 0; index < entries.length; index++) {
    const { subAgent, context } = entries[index];
    events.push({
      type: 'sub_agent_complete',
      duration: (800 + index * 600) * sf,
      payload: { ...context, toolCall, subAgent },
    });
  }
}

function emitExecutionEvents(
  events: ReplayEvent[],
  exec: ConversationExecution,
  assistantMsg: ChatMessage | undefined,
  sf: number,
): number {
  let count = 0;
  const persistedSubAgents = (
    Array.isArray(assistantMsg?.subagentResults)
      ? assistantMsg.subagentResults
      : Array.isArray((assistantMsg as any)?.subagent_results)
        ? (assistantMsg as any).subagent_results
        : []
  ) as SubAgentExecution[];
  const emittedPersistedTaskIds = new Set<string>();
  const iterations = exec.iterations || [];
  for (let iterationIndex = 0; iterationIndex < iterations.length; iterationIndex++) {
    const iter = iterations[iterationIndex];
    const toolCalls = iter.tool_calls || [];
    for (let toolIndex = 0; toolIndex < toolCalls.length; toolIndex++) {
      const tc = normalizeReplayToolCall(toolCalls[toolIndex], exec);
      const name = tc.name || '';
      const sourceToolCallId = replayToolCallId(exec, iterationIndex, toolIndex, tc);
      const replayToolCall = withReplayToolCallId(tc, sourceToolCallId);

      events.push({ type: 'tool_call', duration: 220 * sf, payload: { toolCall: replayToolCall, executionId: exec.id } });
      count++;

      if (name === 'enter_plan_mode') {
        events.push({ type: 'plan_enter', duration: 50 * sf, payload: { toolCall: replayToolCall } });
      } else if (name === 'exit_plan_mode') {
        events.push({ type: 'plan_exit', duration: 50 * sf, payload: { toolCall: replayToolCall } });
      } else if (name === 'todo_write') {
        events.push({ type: 'todo_update', duration: 50 * sf, payload: { toolCall: replayToolCall } });
      } else if (name === 'roundtable' || name === 'create_roundtable') {
        events.push({ type: 'roundtable_created', duration: 100 * sf, payload: { toolCall: replayToolCall } });
        events.push({ type: 'roundtable_conclude', duration: 6000 * sf, payload: { toolCall: replayToolCall } });
      } else if (isSubAgentToolName(name)) {
        if (persistedSubAgents.length > 0) {
          const matchedSubAgents = persistedSubAgents.filter((subAgent) => (
            !emittedPersistedTaskIds.has(subAgent.taskId)
            && persistedSubAgentSourceToolCallId(subAgent) === sourceToolCallId
          ));
          if (matchedSubAgents.length > 0) {
            emitPersistedSubAgentEvents(
              events,
              matchedSubAgents,
              exec,
              assistantMsg,
              sf,
              sourceToolCallId,
              replayToolCall,
            );
          }
          for (const subAgent of matchedSubAgents) {
            emittedPersistedTaskIds.add(subAgent.taskId);
          }
        } else {
          const subTasks = _extractSubTasks(tc);
          for (let si = 0; si < subTasks.length; si++) {
            events.push({
              type: 'sub_agent_start',
              duration: 400 * sf,
              payload: {
                toolCall: replayToolCall,
                sourceToolCallId,
                subTask: subTasks[si],
                subIndex: si,
                subTotal: subTasks.length,
                executionId: exec.id,
                messageId: assistantMsg?.id,
              },
            });
          }
          for (let si = 0; si < subTasks.length; si++) {
            events.push({
              type: 'sub_agent_complete',
              duration: (800 + si * 600) * sf,
              payload: {
                toolCall: replayToolCall,
                sourceToolCallId,
                subTask: subTasks[si],
                subIndex: si,
                subTotal: subTasks.length,
                executionId: exec.id,
                messageId: assistantMsg?.id,
              },
            });
          }
        }
        const taskResult = String(tc.result || '');
        const taskFileRefs = taskResult.match(/files\/[\w\u4e00-\u9fff\u3000-\u303f/\-\.]+/g);
        if (taskFileRefs) {
          for (const fr of taskFileRefs) {
            const cleaned = fr.replace(/\.+$/, '');
            events.push({ type: 'file_created', duration: 300 * sf, payload: { toolCall: replayToolCall, fileName: cleaned } });
          }
        }
      }

      if (isFileCreationTool(name)) {
        const fileName = extractFileName(tc);
        if (fileName) {
          events.push({ type: 'file_created', duration: 300 * sf, payload: { toolCall: replayToolCall, fileName } });
        }
      }

      if (name === 'execute_python' || name === 'execute_code' || name === 'python_repl') {
        const result = String(tc.result || '');
        const fileRefs = result.match(/files\/[\w\u4e00-\u9fff\u3000-\u303f/\-\.]+/g);
        if (fileRefs) {
          for (const fr of fileRefs) {
            const cleaned = fr.replace(/\.+$/, '');
            events.push({ type: 'file_created', duration: 300 * sf, payload: { toolCall: replayToolCall, fileName: cleaned } });
          }
        }
      }

      // Widget events are handled in emitAssistantContentEvents via preprocessed widgetDataList
    }
  }
  const unmatchedSubAgents = persistedSubAgents.filter(
    (subAgent) => !emittedPersistedTaskIds.has(subAgent.taskId),
  );
  emitPersistedSubAgentEvents(events, unmatchedSubAgents, exec, assistantMsg, sf);
  for (const subAgent of unmatchedSubAgents) {
    emittedPersistedTaskIds.add(subAgent.taskId);
  }
  return count;
}

// ---------------------------------------------------------------------------
// State reducer
// ---------------------------------------------------------------------------

export type ReplayAction =
  | { type: 'INIT'; events: ReplayEvent[] }
  | { type: 'ADVANCE' }
  | { type: 'TYPING_PROGRESS'; text: string }
  | { type: 'TYPING_DONE' }
  | { type: 'SET_PLAYING'; isPlaying: boolean }
  | { type: 'SET_SPEED'; speed: 1 | 2 }
  | { type: 'JUMP_TO'; index: number }
  | { type: 'SET_SESSION_FILES'; files: ReplayFileItem[] }
  | { type: 'TOGGLE_WORKSPACE' }
  | { type: 'OPEN_WORKSPACE' }
  | { type: 'CLOSE_WORKSPACE' }
  | { type: 'TODO_TOGGLE' }
  | { type: 'TODO_COLLAPSE' }
  | { type: 'COMPLETE' };

export function replayReducer(state: ReplayState, action: ReplayAction): ReplayState {
  switch (action.type) {
    case 'INIT':
      return {
        ...createInitialState(),
        events: action.events,
        isPlaying: true,
      };

    case 'ADVANCE': {
      const nextIndex = state.currentIndex + 1;
      if (nextIndex >= state.events.length) {
        return { ...state, isComplete: true, isPlaying: false, typingMessageId: null };
      }
      return applyEvent({ ...state, currentIndex: nextIndex }, state.events[nextIndex]);
    }

    case 'TYPING_PROGRESS':
      return { ...state, typingText: action.text };

    case 'TYPING_DONE':
      return finalizeTyping(state);

    case 'SET_PLAYING':
      return { ...state, isPlaying: action.isPlaying };

    case 'SET_SPEED':
      return { ...state, speed: action.speed };

    case 'JUMP_TO': {
      let s = createInitialState();
      s.events = state.events;
      s.isPlaying = state.isPlaying;
      s.speed = state.speed;
      for (let i = 0; i <= Math.min(action.index, state.events.length - 1); i++) {
        s = finalizeTyping(s);
        s = applyEvent({ ...s, currentIndex: i }, state.events[i]);
      }
      // Finalize any in-progress typing so content isn't blank
      s = finalizeTyping(s);
      // Collapse all tool expansions
      s.expandedToolExecIds = new Set();
      if (action.index >= state.events.length) {
        s.isComplete = true;
        s.isPlaying = false;
      }
      s.workspaceDismissed = state.workspaceDismissed;
      if (state.workspaceDismissed) {
        s.workspaceOpen = false;
      } else {
        s.workspaceOpen = state.workspaceOpen;
      }
      return s;
    }

    case 'SET_SESSION_FILES': {
      const merged = [...state.activeFiles];
      for (const f of action.files) {
        if (!merged.some((e) => e.path === f.path)) merged.push(f);
      }
      return { ...state, activeFiles: merged };
    }

    case 'TOGGLE_WORKSPACE':
      return {
        ...state,
        workspaceOpen: !state.workspaceOpen,
        workspaceDismissed: state.workspaceOpen,
      };

    case 'OPEN_WORKSPACE':
      return { ...state, workspaceOpen: true, workspaceDismissed: false };

    case 'CLOSE_WORKSPACE':
      return { ...state, workspaceOpen: false, workspaceDismissed: true };

    case 'TODO_TOGGLE':
      return { ...state, todoExpanded: !state.todoExpanded };

    case 'TODO_COLLAPSE':
      return { ...state, todoExpanded: false };

    case 'COMPLETE':
      return { ...state, isComplete: true, isPlaying: false, typingMessageId: null };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Apply a single event
// ---------------------------------------------------------------------------

function toMessageSubAgentExecution(subAgent: SubAgentState): SubAgentExecution {
  const execution = { ...subAgent };
  delete execution.sourceToolCallId;
  delete execution.executionId;
  delete execution.messageId;
  return {
    ...execution,
    anchorToolCallId: execution.anchorToolCallId || subAgent.sourceToolCallId,
  };
}

function attachSubAgentToMessage(
  messages: ChatMessage[],
  subAgent: SubAgentState,
): ChatMessage[] {
  let targetIndex = subAgent.messageId
    ? messages.findIndex((message) => message.id === subAgent.messageId)
    : -1;
  if (targetIndex < 0 && subAgent.executionId) {
    targetIndex = messages.findIndex((message) => (
      message.role === 'assistant' && message.executionId === subAgent.executionId
    ));
  }
  if (targetIndex < 0) {
    for (let index = messages.length - 1; index >= 0; index--) {
      if (messages[index].role === 'assistant') {
        targetIndex = index;
        break;
      }
    }
  }
  if (targetIndex < 0) return messages;

  const target = messages[targetIndex];
  const existing = Array.isArray(target.subagentResults) ? target.subagentResults : [];
  const result = toMessageSubAgentExecution(subAgent);
  const resultIndex = existing.findIndex((item) => item.taskId === result.taskId);
  const nextResults = resultIndex >= 0
    ? existing.map((item, index) => index === resultIndex ? result : item)
    : [...existing, result];
  return messages.map((message, index) => (
    index === targetIndex ? { ...message, subagentResults: nextResults } : message
  ));
}

function applyEvent(state: ReplayState, event: ReplayEvent): ReplayState {
  const p = event.payload;

  switch (event.type) {
    case 'user_message':
    case 'questionnaire_reply':
      return { ...state, displayedMessages: [...state.displayedMessages, p.message] };

    case 'agent_placeholder': {
      const msg = {
        ...withoutDeferredSurfaces(p.message),
        content: '',
        executionId: p.executionId || (p.message as any).executionId,
      };
      delete (msg as any).planReviewData;
      delete (msg as any).questionData;
      const exists = state.displayedMessages.some((m) => m.id === msg.id);
      const newExpanded = new Set(state.expandedToolExecIds);
      if (p.executionId) newExpanded.add(p.executionId);
      return {
        ...state,
        displayedMessages: exists
          ? state.displayedMessages.map((m) => m.id === msg.id ? { ...m, executionId: msg.executionId } : m)
          : [...state.displayedMessages, msg],
        expandedToolExecIds: newExpanded,
      };
    }

    case 'agent_text': {
      const msg = { ...withoutDeferredSurfaces(p.message), content: '' };
      delete (msg as any).planReviewData;
      delete (msg as any).questionData;
      const exists = state.displayedMessages.some((m) => m.id === msg.id);
      if (!p.text) {
        return {
          ...state,
          displayedMessages: exists ? state.displayedMessages : [...state.displayedMessages, msg],
        };
      }
      return {
        ...state,
        displayedMessages: exists ? state.displayedMessages : [...state.displayedMessages, msg],
        typingMessageId: msg.id, typingText: '', typingFullText: p.text,
      };
    }

    case 'tools_collapse': {
      const newExpanded = new Set(state.expandedToolExecIds);
      newExpanded.delete(p.executionId);
      return { ...state, expandedToolExecIds: newExpanded };
    }

    case 'questionnaire': {
      const msg = p.message;
      const exists = state.displayedMessages.some((m) => m.id === msg.id);
      if (exists) {
        return { ...state, displayedMessages: state.displayedMessages.map((m) => m.id === msg.id ? { ...m, questionData: msg.questionData } : m) };
      }
      return { ...state, displayedMessages: [...state.displayedMessages, msg] };
    }

    case 'plan_review': {
      const msg = p.message;
      const exists = state.displayedMessages.some((m) => m.id === msg.id);
      if (exists) {
        return { ...state, displayedMessages: state.displayedMessages.map((m) => m.id === msg.id ? { ...m, planReviewData: msg.planReviewData } : m) };
      }
      return { ...state, displayedMessages: [...state.displayedMessages, msg] };
    }

    case 'tool_call': {
      const execId = p.executionId || 'default';
      const existing = state.displayedToolCalls.get(execId) || [];
      const newMap = new Map(state.displayedToolCalls);
      newMap.set(execId, [...existing, p.toolCall]);
      return { ...state, displayedToolCalls: newMap };
    }

    case 'file_created': {
      const file: ReplayFileItem = {
        name: p.fileName.split('/').pop() || p.fileName,
        path: p.fileName, type: 'file',
      };
      const exists = state.activeFiles.some((f) => f.path === file.path);
      return {
        ...state,
        activeFiles: exists ? state.activeFiles : [...state.activeFiles, file],
      };
    }

    case 'plan_enter':
      return { ...state, planModeActive: true };

    case 'plan_exit':
      return { ...state, planModeActive: false };

    case 'todo_update': {
      const args = p.toolCall.arguments || {};
      const items: TodoItem[] = args.todos || [];
      const wasEmpty = state.globalTodos.length === 0;
      if (args.merge !== false && state.globalTodos.length > 0) {
        const merged = [...state.globalTodos];
        for (const item of items) {
          const idx = merged.findIndex((t) => t.id === item.id);
          if (idx >= 0) merged[idx] = { ...merged[idx], ...item };
          else merged.push(item);
        }
        return { ...state, globalTodos: merged };
      }
      return { ...state, globalTodos: items, todoExpanded: wasEmpty ? true : state.todoExpanded };
    }

    case 'sub_agent_start': {
      const subTask = p.subTask || {};
      const subIndex = p.subIndex ?? 0;
      const tcId = p.sourceToolCallId || p.toolCall?.__replayToolCallId || p.toolCall?.id || 'tc';
      const taskId = p.subAgent?.taskId || `${tcId}-sa-${subIndex}`;
      const persistedSnapshot = p.subAgent
        ? {
            ...p.subAgent,
            sourceToolCallId: p.sourceToolCallId || p.subAgent.anchorToolCallId,
            executionId: p.executionId,
            messageId: p.messageId,
          } as SubAgentState
        : null;
      const exists = state.activeSubAgents.some(sa => sa.taskId === taskId);
      if (exists && persistedSnapshot) {
        return {
          ...state,
          activeSubAgents: state.activeSubAgents.map((subAgent) => (
            subAgent.taskId === taskId ? { ...subAgent, ...persistedSnapshot } : subAgent
          )),
        };
      }
      if (exists) return state;
      return {
        ...state,
        activeSubAgents: [
          ...state.activeSubAgents,
          persistedSnapshot || {
            taskId,
            sourceToolCallId: tcId,
            executionId: p.executionId,
            messageId: p.messageId,
            parentTaskId: (p.subTotal ?? 1) > 1 ? tcId : undefined,
            task: subTask.task || '',
            agentType: subTask.agentType || '',
            agentKind: subTask.agentKind || 'main',
            displayName: subTask.displayName || subTask.agentType || '',
            status: 'running' as const,
            iteration: 0,
            startedAt: new Date().toISOString(),
          },
        ],
      };
    }

    case 'sub_agent_complete': {
      const subIndex = p.subIndex ?? 0;
      const tcId = p.sourceToolCallId || p.toolCall?.__replayToolCallId || p.toolCall?.id || 'tc';
      const taskId = p.subAgent?.taskId || `${tcId}-sa-${subIndex}`;
      const current = state.activeSubAgents.find((subAgent) => subAgent.taskId === taskId);
      const completed = p.subAgent
        ? {
            ...current,
            ...p.subAgent,
            sourceToolCallId: p.sourceToolCallId || p.subAgent.anchorToolCallId || current?.sourceToolCallId,
            executionId: p.executionId || current?.executionId,
            messageId: p.messageId || current?.messageId,
          } as SubAgentState
        : current
          ? {
              ...current,
              status: 'completed' as const,
              completedAt: new Date().toISOString(),
              durationMs: typeof p.toolCall?.duration_ms === 'number'
                ? p.toolCall.duration_ms
                : current.durationMs,
            }
          : null;
      if (!completed) return state;
      const activeSubAgents = current
        ? state.activeSubAgents.map((subAgent) => subAgent.taskId === taskId ? completed : subAgent)
        : [...state.activeSubAgents, completed];
      return {
        ...state,
        activeSubAgents,
        displayedMessages: attachSubAgentToMessage(state.displayedMessages, completed),
      };
    }

    case 'widget_render': {
      const wd = p.widgetData;
      if (!wd) return state;
      let targetMsgId = p.messageId;
      if (!targetMsgId && p.executionId) {
        const match = state.displayedMessages.find((m: any) => m.executionId === p.executionId);
        targetMsgId = match?.id;
      }
      if (!targetMsgId) {
        const lastMsg = state.displayedMessages[state.displayedMessages.length - 1];
        targetMsgId = lastMsg?.id;
      }
      if (targetMsgId) {
        const existing = state.visibleWidgets.get(targetMsgId) || [];
        const isDuplicate = existing.some((w: any) => w.title === wd.title && w.code === wd.code);
        if (isDuplicate) return state;
        const newMap = new Map(state.visibleWidgets);
        newMap.set(targetMsgId, [...existing, wd]);
        return { ...state, visibleWidgets: newMap };
      }
      return state;
    }

    case 'follow_up_questions': {
      const msg = p.message;
      const followUpQuestions = p.followUpQuestions || msg?.followUpQuestions;
      if (!followUpQuestions?.items?.length) return state;
      const exists = state.displayedMessages.some((m) => m.id === msg.id);
      if (exists) {
        return {
          ...state,
          displayedMessages: state.displayedMessages.map((m) =>
            m.id === msg.id ? { ...m, followUpQuestions } : m,
          ),
        };
      }
      return {
        ...state,
        displayedMessages: [
          ...state.displayedMessages,
          { ...withoutDeferredSurfaces(msg), content: '', followUpQuestions },
        ],
      };
    }

    case 'roundtable_created': {
      const tc = p.toolCall;
      const lastMsg = state.displayedMessages[state.displayedMessages.length - 1];
      if (lastMsg) {
        const existing = state.visibleRoundtables.get(lastMsg.id) || [];
        const newMap = new Map(state.visibleRoundtables);
        let rtData: any = {};
        try {
          const result = tc.result || '';
          const match = result.match(/\[\[ROUNDTABLE_CREATED\]\]([\s\S]*?)\[\[\/ROUNDTABLE_CREATED\]\]/);
          if (match) rtData = JSON.parse(match[1]);
        } catch { /* ignore */ }
        newMap.set(lastMsg.id, [...existing, { ...rtData, _replayStatus: 'discussing' }]);
        return { ...state, visibleRoundtables: newMap };
      }
      return state;
    }

    case 'roundtable_conclude': {
      const newMap = new Map(state.visibleRoundtables);
      for (const [msgId, rts] of newMap.entries()) {
        const updated = rts.map((rt: any) => rt._replayStatus === 'discussing' ? { ...rt, _replayStatus: 'concluded' } : rt);
        newMap.set(msgId, updated);
      }
      return { ...state, visibleRoundtables: newMap };
    }

    case 'execution_gap':
      return state;

    default:
      return state;
  }
}
