/**
 * 聊天容器组件 - 主聊天界面
 */

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { AnimatePresence } from '../../lib/motion';
import { kernelApiFetch } from '../../api/gateway';
import { ChannelBar, EmptyChannelPanel, extractChannels } from './ChannelBar';
import { ChannelChatPanel } from './ChannelChatPanel';
import { getRoundtable } from '../../api/roundtable';
import { clearFollowUpQuestions } from '../../api/followUp';
import { ensureRoundtableChannelCacheListeners } from '../../lib/roundtableChannelCache';
import type { SpeakingMode } from './ChannelBar';
import type { ComposerAttachmentPreview, RoundtablePromptTag } from './InputBar';
import type { AnswerSource, ChatMessage, FollowUpQuestionItem, FollowUpQuestionsData } from '../../types';
import type { ToolCallVM } from '../../conversation/model/viewTypes';
import { useBeforeUnload } from '../../hooks/useBeforeUnload';

// PRD 430：圆桌讨论入口暂不上线，整块屏蔽（含 ChannelBar 入口按钮 + 创建/频道浮层）
const ROUNDTABLE_ENABLED = false;
const STRUCTURED_DOCUMENT_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'pptx'];


import { AgentHome } from './Home';
import { ChatSessionHeader } from './ChatSessionHeader';
import { ChatThreadPane } from './ChatThreadPane';
import { AnswerSourcesDrawer } from './AnswerSourcesDrawer';
import { InputBar } from './InputBar';
import { ShareDialog } from './ShareDialog';
import { TodoDrawer, type TodoItem } from './TodoDrawer';
import { SkillCreatorCardStrip } from './SkillCreatorCardStrip';
import { useRestoreSkillDraftCards } from '../../hooks/useRestoreSkillDraftCards';
import { useAgentStore } from '../../stores/agentStore';
import { useSessionRuntimeStore } from '../../stores/sessionRuntimeStore';
import { useAgentContextStore } from '../../stores/agentContextStore';
import { usePreviewStore } from '../../stores/previewStore';
import { useAgent } from '../../hooks/useAgent';
import { useJobConversation } from '../../hooks/useJobConversation';
import { getAgentDisplayName, parseRecommendedQuestions } from '../../types/platform';
import { useBillingStore } from '../../stores/billingStore';
import { useTenantStore } from '../../stores/tenantStore';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';
import { useFrontendConfigStore } from '../../stores/frontendConfigStore';
import { NEW_SESSION_BOARD_DRAFT_SESSION_ID, useBoardDraftStore } from '../../stores/boardDraftStore';
import { useDashboardStore } from '../../stores/dashboardStore';
import { markSendTaskSession } from '../../lib/sendTaskGuard';
import { resolveDashboardInsightPrompt } from '../../utils/dashboardInsight';
import { supportsBoard } from '../../pages/boards/boardAvailability';
import { resolveWorkspaceBillingUiState } from '../../utils/billingUiState';
import { canManageBilling } from '../../utils/billingAccess';
import { notifyError } from '../../api/notify';
import { agentFilesApi } from '../../api/agentFiles';
import { trackRecommendedQuestionClick } from '../../api/platformAgent';
import { useLocation, useNavigate } from 'react-router-dom';
import type { AgentHomeQuestionSelectMeta } from './Home';
import { TenantAdminNewSessionHint } from './TenantAdminNewSessionHint';
import { parseUserContent } from './MessageBubble';
import {
  clearPendingOnboardingHandoff,
  clearOnboardingDraft,
  markOnboardingDefaultSession,
  notifyOnboardingHandoffCompleted,
  readPendingOnboardingHandoff,
} from '../../pages/onboarding/onboardingHandoff';

interface ChatContainerProps {
  onSwitchToProject?: () => void;
  onSwitchToGraph?: () => void;
  onOpenRoundtable?: (sessionId: string) => void;
}

type FollowUpClearSource = {
  messageId: string;
  localMessageId?: string;
  itemId?: string | null;
};

type PendingRecommendedQuestionClick = {
  agentId: string;
  question: string;
  eventPromise: Promise<string | null>;
};

type BoardResultAskEvent = CustomEvent<{
  boardName?: string;
  dashboardKey?: string | null;
  prompt?: string;
  snapshotId?: string | null;
}>;

function isTemporaryDashboardSessionId(sessionId: string | null | undefined): boolean {
  return Boolean(
    sessionId &&
    (sessionId.startsWith('dashboard-refresh-') || sessionId.startsWith('dashboard-draft-')),
  );
}

const DASHBOARD_CONTEXT_TOOL_KEYS = new Set([
  'enterprise-360',
  'bidding-query',
  'company-filter',
  'industry-chain',
  'batch-query',
  'visit-preparation',
  'customer-profile',
  'relation-mining',
  'key-account-operations',
  'enterprise-risk',
]);

function dashboardContextToolArg(dashboardKey: string | null | undefined): string {
  const normalized = String(dashboardKey || '').trim();
  return DASHBOARD_CONTEXT_TOOL_KEYS.has(normalized) ? normalized : 'current';
}

// 维护提示：智能看板发起的追问入口已改名为“MOSS洞察”，聊天里也要保持同一套展示文案。
function dashboardAskDisplayContent(boardName = '智能看板'): string {
  return `智能看板·${boardName} MOSS洞察`;
}

function buildDashboardAskPayload(
  prompt: string,
  options: {
    boardName?: string;
    dashboardKey?: string | null;
    snapshotId?: string | null;
    sourceSessionId?: string | null;
    viewStateRevision?: number | null;
    viewStateSnapshotId?: string | null;
  },
): string {
  const boardName = options.boardName || '智能看板';
  const subDashboard = dashboardContextToolArg(options.dashboardKey);
  const lockedDashboardContext = JSON.stringify({
    sub_dashboard: subDashboard,
    snapshot_id: options.snapshotId || null,
    source_session_id: options.sourceSessionId || null,
    view_state_revision: options.viewStateRevision || null,
    view_state_snapshot_id: options.viewStateSnapshotId || null,
  });
  const snapshotLine = options.snapshotId
    ? `- 当前页面快照 ID：${options.snapshotId}。`
    : '- 当前页面快照 ID 未显式传入，以当前会话最新快照为准。';

  return `${prompt.trim()}

---
固定附加要求：
- 这是来自智能看板「${boardName}」的自动洞察请求；当前看板内容是快照，不是实时数据库全量。
- 内部锁定上下文：MOSS_DASHBOARD_CONTEXT: ${lockedDashboardContext}
${snapshotLine}
- 回答前必须主动调用一次 get_current_dashboard_context 读取当前看板上下文，调用输入必须使用 {"sub_dashboard":"${subDashboard}"}；不要改成 current，也不要根据右侧当前打开的 tab 改成其他子看板。
- 读取结果只代表当前会话当前快照；分页、截断或缺失的数据需要按快照局限说明，不要编造未出现在快照中的事实。
- 不要要求用户重新提供看板数据；直接基于读取结果和当前页面可视化内容给出判断、依据和下一步动作。`;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function firstNonEmptyObject(...values: unknown[]): Record<string, unknown> {
  for (const value of values) {
    const object = objectValue(value);
    if (Object.keys(object).length > 0) return object;
  }
  return {};
}

function toolPayloadArguments(payload: Record<string, unknown>): Record<string, unknown> {
  const invocation = objectValue(payload.invocation);
  const patch = objectValue(payload.patch);
  return firstNonEmptyObject(
    invocation.arguments,
    patch.arguments,
    patch.arguments_preview,
    payload.arguments,
    payload.fields,
  );
}

function fileReadToolForPath(path: string): 'read' | 'read_document' {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  return STRUCTURED_DOCUMENT_EXTENSIONS.includes(ext) ? 'read_document' : 'read';
}

function attachDashboardSnapshotToSessionInBackground(
  targetSessionId: string,
  options?: Parameters<ReturnType<typeof useDashboardStore.getState>['attachCurrentSnapshotToSession']>[1],
): void {
  void useDashboardStore.getState().attachCurrentSnapshotToSession(targetSessionId, options).then((attached) => {
    if (!attached) {
      console.warn('[Chat] dashboard snapshot attach skipped or still pending');
    }
  });
}

function todoItems(value: unknown): TodoItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is TodoItem => {
    const record = objectValue(item);
    return typeof record.id === 'string'
      && typeof record.content === 'string'
      && ['pending', 'in_progress', 'completed', 'cancelled'].includes(String(record.status));
  });
}

function extractRuntimeTodos(tools: ToolCallVM[]): TodoItem[] {
  const merged = new Map<string, TodoItem>();
  for (const tool of tools) {
    if (tool.name !== 'todo_write') continue;
    const args = toolPayloadArguments(tool.payload);
    for (const todo of todoItems(args.todos)) {
      merged.set(todo.id, todo);
    }
  }
  return Array.from(merged.values());
}

function hasActiveTodo(todos: TodoItem[]): boolean {
  return todos.some(todo => todo.status === 'pending' || todo.status === 'in_progress');
}

function extractCurrentRuntimeTodos(
  messages: ReturnType<typeof useJobConversation>['viewModel']['messages'],
  activeJobId: string | null,
): TodoItem[] {
  const currentMessage = activeJobId
    ? messages.find(message => message.assistant.jobId === activeJobId)
    : [...messages].reverse().find(message => message.assistant.phase !== 'job_terminal');
  return extractRuntimeTodos(currentMessage?.assistant.tools || []);
}

export const ChatContainer: React.FC<ChatContainerProps> = ({
  onSwitchToProject: _onSwitchToProject,
  onSwitchToGraph: _onSwitchToGraph,
  onOpenRoundtable: _onOpenRoundtable,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareAnchorRect, setShareAnchorRect] = useState<DOMRect | null>(null);
  const [roundtableTag, setRoundtableTag] = useState<RoundtablePromptTag | null>(null);
  const [boardComposerFocusSignal] = useState(0);
  const [sourceDrawerSources, setSourceDrawerSources] = useState<AnswerSource[] | null>(null);
  const [sourceDrawerTraceId, setSourceDrawerTraceId] = useState<string | undefined>(undefined);
  // billingUiState 由 AppContent 传入或在此处计算（用于 handleSend 阻断）
  const billingStatus = useBillingStore((s) => s.billingStatus);
  const currentWorkspace = useTenantStore((s) => s.currentWorkspace);
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const billingUiState = resolveWorkspaceBillingUiState({
    billingStatus,
    role: currentWorkspace?.role ?? 'member',
  });

  useEffect(() => {
    ensureRoundtableChannelCacheListeners();
  }, []);

  useEffect(() => {
    if (!canManageBilling(currentWorkspace?.role)) return;
    // 延迟加载非关键计费数据，避免阻塞会话列表/详情的关键请求
    const timer = setTimeout(() => {
      useBillingStore.getState().fetchBillingStatus().catch((e) => {
        console.warn('[Chat] initial fetchBillingStatus failed', e);
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [currentWorkspace?.role]);

  const handleOpenRoundtable = useCallback((sessionId: string) => {
    setShowCreatePanel(false);
    setActiveChannelId(prev => prev === sessionId ? null : sessionId);
  }, []);

  const handleOpenCreatePanel = useCallback(() => {
    setShowCreatePanel(prev => {
      if (prev) return false;
      setActiveChannelId(null);
      return true;
    });
  }, []);

  const ROUNDTABLE_TEMPLATES: Record<string, RoundtablePromptTag> = useMemo(() => ({
    moderator: {
      mode: 'moderator',
      label: '圆桌 · 主持人模式',
      template: '发起圆桌讨论（主持人模式）：请围绕「这里填写讨论主题」展开讨论，由主持人控制节奏和方向',
    },
    ordered: {
      mode: 'ordered',
      label: '圆桌 · 轮流模式',
      template: '发起圆桌讨论（轮流模式）：请各方就「这里填写讨论主题」依次发表观点',
    },
    free: {
      mode: 'free',
      label: '圆桌 · 自由模式',
      template: '发起圆桌讨论（自由模式）：围绕「这里填写讨论主题」自由讨论，鼓励观点碰撞和追问',
    },
  }), []);

  const handleCreateRoundtable = useCallback((mode: SpeakingMode) => {
    setShowCreatePanel(false);
    setRoundtableTag(ROUNDTABLE_TEMPLATES[mode]);
  }, [ROUNDTABLE_TEMPLATES]);
  // session 执行态从 sessionRuntimeStore 读取（步骤 010）
  const {
    messages, executions,
    sessionLoading, removeMessages, removeExecutions, updateMessage,
    _activeSessionId: activeRuntimeSessionId,
  } = useSessionRuntimeStore();
  // agent 级状态从 agentStore 读取
  const {
    currentSessionId, setCurrentSessionId, sessions,
    isSessionStarred,
  } = useAgentStore();
  const { getCurrentAgent } = useAgentContextStore();
  const selectedAgentId = useAgentContextStore(s => s.currentAgentId);
  const jobConversation = useJobConversation();
  const openCanvas = usePreviewStore(s => s.openCanvas);
  const openBoard = useUiStore(s => s.openBoard);
  const openBoardMaximized = useUiStore(s => s.openBoardMaximized);
  const composerState = jobConversation.viewModel.composer;
  const conversationBusy = jobConversation.isBusy || Boolean(jobConversation.activeJobId) || composerState.disabled;
  const composerRunning = composerState.reason === 'running' || composerState.reason === 'finalizing';
  useBeforeUnload(conversationBusy);
  const { fetchSessions, loadSession, updateSessionStarState } = useAgent();
  // theme toggle removed — now accessible via account settings

  // 会话切换 / 页面刷新后,拉取该 session 下未过期的 AI 技能创建草稿,恢复到 skillDraftStore。
  useRestoreSkillDraftCards(currentSessionId);

  const currentAgent = getCurrentAgent();
  const currentAgentId = currentAgent?.id ?? selectedAgentId;
  const commandHistory = useMemo(() => messages.flatMap((message) => {
    if (message.role !== 'user' || message.questionnaireReply) return [];
    const text = message.displayContent?.trim()
      || parseUserContent(message.content).textParts.map((part) => part.content).join('\n\n').trim();
    return text ? [text] : [];
  }), [messages]);
  const frontendConfigLoaded = useFrontendConfigStore((state) => state.loaded);
  const dashboardEnabled = useFrontendConfigStore((state) => state.dashboardEnabled);
  const canOpenBoard = frontendConfigLoaded && dashboardEnabled && supportsBoard(currentAgent);
  const effectiveBoardDraftSessionId = currentSessionId ?? NEW_SESSION_BOARD_DRAFT_SESSION_ID;
  const boardDraftAttachment = useBoardDraftStore((state) => (
    currentAgentId
      ? state.drafts[`${currentAgentId}:${effectiveBoardDraftSessionId}`]?.attachment ?? null
      : null
  ));
  const boardAttachmentPreview = boardDraftAttachment as ComposerAttachmentPreview | null;
  const forceLoadRef = useRef<string | null>(null);
  const terminalRecoveryLoadRef = useRef<string | null>(null);
  const handleOpenBoard = useCallback(() => {
    if (currentSessionId) {
      openBoard();
      return;
    }
    openBoardMaximized();
  }, [currentSessionId, openBoard, openBoardMaximized]);
  const openSourcesDrawer = useCallback((message: ChatMessage, sources: AnswerSource[]) => {
    if (sources.length === 0) return;
    setSourceDrawerSources(sources);
    setSourceDrawerTraceId(message.backendMessageId || message.id);
  }, []);

  useEffect(() => {
    setSourceDrawerSources(null);
    setSourceDrawerTraceId(undefined);
  }, [currentSessionId]);

  useEffect(() => {
    if (!currentSessionId) {
      forceLoadRef.current = null;
      terminalRecoveryLoadRef.current = null;
      return;
    }

    if (messages.length === 0 && !sessionLoading && forceLoadRef.current !== currentSessionId) {
      forceLoadRef.current = currentSessionId;
      void loadSession(currentSessionId, { force: true }).then((ok) => {
        if (!ok && forceLoadRef.current === currentSessionId) {
          forceLoadRef.current = null;
        }
      });
    }
  }, [currentSessionId, loadSession, messages.length, sessionLoading]);

  useEffect(() => {
    if (!currentSessionId) return;
    const lastAssistant = [...messages].reverse().find((message) => message.role === 'assistant');
    if (!lastAssistant?.isStreaming) return;

    const assistantContent = [
      lastAssistant.content,
      lastAssistant.anchoredContent,
      lastAssistant.thinkingContent,
    ].filter(Boolean).join('').trim();
    if (!assistantContent) return;

    if (conversationBusy) return;

    const recoveryKey = `${currentSessionId}:${lastAssistant.id}`;
    if (terminalRecoveryLoadRef.current === recoveryKey) return;
    terminalRecoveryLoadRef.current = recoveryKey;

    void loadSession(currentSessionId, { force: true }).then((ok) => {
      if (!ok && terminalRecoveryLoadRef.current === recoveryKey) {
        terminalRecoveryLoadRef.current = null;
      }
    });
  }, [conversationBusy, currentSessionId, loadSession, messages]);

  useEffect(() => {
    if (!currentSessionId || sessionLoading) return;
    const lastAssistant = [...messages].reverse().find((message) => message.role === 'assistant');
    if (!lastAssistant?.job_id && !lastAssistant?.executionId) return;
    if (
      lastAssistant.isStreaming
      || lastAssistant.status === 'running'
      || lastAssistant.status === 'cancelling'
    ) {
      return;
    }

    const assistantContent = [
      lastAssistant.content,
      lastAssistant.anchoredContent,
      lastAssistant.thinkingContent,
    ].filter(Boolean).join('').trim();
    if (assistantContent) return;

    const recoveryKey = `${currentSessionId}:${lastAssistant.id}:blank`;
    if (terminalRecoveryLoadRef.current === recoveryKey) return;
    terminalRecoveryLoadRef.current = recoveryKey;

    void loadSession(currentSessionId, { force: true });
  }, [currentSessionId, loadSession, messages, sessionLoading]);

  // 推荐问数据：直接读 agent 对象上已有的字段（/agents 列表接口返回时已带）。
  // 后端 JSONB 字段会以字符串形式返回，需要解析；persist 缓存里也可能是旧字符串形态。
  const recommendedQuestions = messages.length === 0
    ? parseRecommendedQuestions(currentAgent?.recommended_questions)
    : [];
  // 推荐问点击 → 填入输入框（对标 V1: 不直接发送，由用户确认）
  const [prefillText, setPrefillText] = useState<string | null>(null);
  const pendingRecommendedQuestionClickRef = useRef<PendingRecommendedQuestionClick | null>(null);
  const onboardingHandoffConsumedRef = useRef<string | null>(null);
  const handlePrefillConsumed = useCallback(() => setPrefillText(null), []);
  const handleRecommendedQuestionSelect = useCallback((question: string, meta?: AgentHomeQuestionSelectMeta) => {
    setPrefillText(question);
    const agentId = currentAgent?.id;
    if (!agentId) {
      pendingRecommendedQuestionClickRef.current = null;
      return;
    }
    const sessionId = useAgentStore.getState().currentSessionId || undefined;
    const eventPromise = trackRecommendedQuestionClick(agentId, {
      question_group_name: meta?.groupName,
      question_index: meta?.questionIndex,
      question_content: question,
      session_id: sessionId,
      conversation_id: sessionId,
      source: 'agent_home',
      page_path: `${location.pathname}${location.search}`,
    })
      .then((response) => response.id)
      .catch((error) => {
        console.warn('[Chat] record recommended question click failed', error);
        return null;
      });
    pendingRecommendedQuestionClickRef.current = { agentId, question, eventPromise };
  }, [currentAgent?.id, location.pathname, location.search]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const rawPrefillText = params.get('prefillText');
    const intent = params.get('intent');
    if (!rawPrefillText && intent !== 'create-skill' && intent !== 'edit-skill') return;

    if (rawPrefillText) {
      setPrefillText(rawPrefillText);
    } else {
      const skillName = params.get('skillName')?.trim();
      setPrefillText(intent === 'edit-skill' && skillName
        ? `帮我编辑技能「${skillName}」`
        : '帮我创建一个技能');
    }

    params.delete('prefillText');
    params.delete('intent');
    params.delete('skillName');
    const search = params.toString();
    navigate(
      { pathname: location.pathname, search: search ? `?${search}` : '' },
      { replace: true },
    );
  }, [location.pathname, location.search, navigate]);

  const channelStatusOverrides = useRef<Record<string, string>>({});
  const [statusTick, setStatusTick] = useState(0);

  const channels = useMemo(() => {
    const raw = extractChannels(messages);
    const overrides = channelStatusOverrides.current;
    for (const ch of raw) {
      if (overrides[ch.sessionId]) {
        ch.status = overrides[ch.sessionId];
      }
    }
    return raw;
  }, [messages, statusTick]);

  useEffect(() => {
    const onStatus = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (!d?.session_id || !d?.status) return;
      channelStatusOverrides.current[d.session_id] = d.status;
      setStatusTick(t => t + 1);
    };
    window.addEventListener('roundtable-status', onStatus);
    return () => window.removeEventListener('roundtable-status', onStatus);
  }, []);

  // 页面加载时同步频道真实状态（消息快照中永远是 active，需要从后端获取实际 status）
  const syncedChannelIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    const toSync = channels.filter(
      ch => !syncedChannelIds.current.has(ch.sessionId) && !channelStatusOverrides.current[ch.sessionId]
    );
    if (toSync.length === 0) return;
    for (const ch of toSync) {
      syncedChannelIds.current.add(ch.sessionId);
      getRoundtable(ch.sessionId)
        .then(data => {
          if (data.status && data.status !== ch.status) {
            channelStatusOverrides.current[ch.sessionId] = data.status;
            setStatusTick(t => t + 1);
          }
        })
        .catch(() => {});
    }
  }, [channels]);

  // 从当前执行中提取全局任务清单（todos）
  const globalTodos = useMemo((): TodoItem[] => {
    const runtimeTodos = extractCurrentRuntimeTodos(
      jobConversation.viewModel.messages,
      jobConversation.activeJobId,
    );
    if (runtimeTodos.length > 0) {
      return runtimeTodos;
    }

    if (!conversationBusy) {
      return [];
    }

    const mergedTodos = new Map<string, TodoItem>();

    // 找到当前执行记录
    const currentExecution = executions[executions.length - 1];

    // 1. 从当前执行的迭代中提取
    if (currentExecution) {
      for (const iteration of currentExecution.iterations) {
        for (const toolCall of iteration.tool_calls) {
          if (toolCall.name === 'todo_write') {
            for (const todo of todoItems(toolCall.arguments?.todos)) {
              mergedTodos.set(todo.id, todo);
            }
          }
        }
      }
    }

    return Array.from(mergedTodos.values());
  }, [conversationBusy, executions, jobConversation.activeJobId, jobConversation.viewModel.messages]);
  const shouldShowTodoOverlay = hasActiveTodo(globalTodos);
  
  // 任务完成时刷新会话列表（标题可能已更新）
  useEffect(() => {
    if (conversationBusy) return;
    if (!currentSessionId || messages.length === 0) return;
    fetchSessions();
    // Job 完成后刷新 billing 状态（对标 V1: Home.tsx:709）
    if (canManageBilling(currentWorkspace?.role)) {
      useBillingStore.getState().fetchBillingStatus().catch((e) => {
        console.warn('[Chat] fetchBillingStatus after job complete failed', e);
      });
    }
  }, [conversationBusy, currentSessionId, messages.length, fetchSessions, currentWorkspace?.role]);

  // 频道触发状态提示（排队中 / 即将执行 / 执行完成）
  const [channelHint, setChannelHint] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const action = detail?.action as string | undefined;
      const targetSessionId = detail?.session_id as string | undefined;

      if (action === 'trigger_queued' && targetSessionId === currentSessionId) {
        setChannelHint('圆桌讨论已完成，等待当前任务结束后自动汇报…');
      } else if (action === 'trigger_starting' && targetSessionId === currentSessionId) {
        setChannelHint('正在汇报圆桌讨论结论…');
      } else if (action === 'trigger_completed') {
        setChannelHint(null);
        if (targetSessionId && targetSessionId === currentSessionId) {
          loadSession(targetSessionId);
        } else {
          fetchSessions();
        }
      }
    };
    window.addEventListener('roundtable-status', handler);
    return () => window.removeEventListener('roundtable-status', handler);
  }, [currentSessionId, loadSession, fetchSessions]);

  // Agent 运行结束时清除频道提示
  useEffect(() => {
    if (!conversationBusy) setChannelHint(null);
  }, [conversationBusy]);

  // 上下文压缩提示（压缩开始时显示，完成后自动消失）
  const [compressionHint, setCompressionHint] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const action = detail?.action as string | undefined;

      if (action === 'start') {
        setCompressionHint('Agent 正在压缩上下文，优化对话记忆…');
      } else if (action === 'complete') {
        setCompressionHint(null);
      }
    };
    window.addEventListener('context-compression', handler);
    return () => window.removeEventListener('context-compression', handler);
  }, []);

  useEffect(() => {
    if (!conversationBusy) setCompressionHint(null);
  }, [conversationBusy]);

  const clearVisibleFollowUp = (source: FollowUpClearSource) => {
    const agentId = currentAgent?.id;
    const sessionId = currentSessionId;
    if (!agentId || !sessionId) return;

    updateMessage(source.localMessageId || source.messageId, (existing) => {
      if (!existing.followUpQuestions) return existing;
      return { ...existing, followUpQuestions: undefined };
    });

    void clearFollowUpQuestions(agentId, sessionId, source.messageId, source.itemId).catch((error) => {
      console.warn('[Chat] clear follow-up questions failed', error);
    });
  };

  const latestVisibleFollowUp = (): FollowUpClearSource | null => {
    const message = [...messages].reverse().find((item) => (
      item.role === 'assistant'
      && item.followUpQuestions
      && item.followUpQuestions.used !== true
    ));
    return message ? { messageId: message.backendMessageId || message.id, localMessageId: message.id } : null;
  };
  const composerBlocked = !!billingUiState.billingBlockReason || conversationBusy;
  
  
  const handleSend = async (
    message: string,
    uploadedPaths?: string[],
    fileRefs?: import('../../stores/fileReferenceStore').FileReference[],
    stagingId?: string,
    options?: {
      followUpSource?: FollowUpClearSource;
      displayContent?: string;
      executionContent?: string;
      source?: 'onboarding_default_insight';
      sessionId?: string;
      idempotencyKey?: string;
    },
  ) => {
    const sendStartedSessionId = useAgentStore.getState().currentSessionId;
    const sendStartedAgentId = useAgentContextStore.getState().currentAgentId;
    const newSessionBoardDraftBeforeSend = !sendStartedSessionId && sendStartedAgentId
      ? useBoardDraftStore.getState().getDraft(sendStartedAgentId, NEW_SESSION_BOARD_DRAFT_SESSION_ID)
      : null;
    let fullMessage = message;

    if (fileRefs && fileRefs.length > 0) {
      const markers = fileRefs.map(ref => {
        const fid = ref.fileId || '';
        if (ref.type === 'segment' && ref.segment) {
          return fid
            ? `[[FILE_SEGMENT:${ref.fileName}:L${ref.segment.startLine}-${ref.segment.endLine}:${fid}]]`
            : `[[FILE_SEGMENT:${ref.fileName}:L${ref.segment.startLine}-${ref.segment.endLine}]]`;
        }
        return fid ? `[[FILE_REF:${ref.fileName}:${fid}]]` : `[[FILE_REF:${ref.fileName}]]`;
      }).join('\n');

      const contextEntries = fileRefs.map(ref => {
        let readPath: string;
        if (ref.level === 'user_file' || ref.level === 'shared') {
          readPath = `files/${ref.filePath}`;
        } else {
          readPath = ref.filePath;
        }
        const readTool = fileReadToolForPath(ref.fileName);
        if (ref.type === 'segment' && ref.segment) {
          return `[${ref.fileName} L${ref.segment.startLine}-${ref.segment.endLine}]\n${ref.segment.text}`;
        }
        return `${ref.fileName} → ${readTool}("${readPath}")`;
      }).join('\n');

      fullMessage = `${markers}\n[[REF_CONTEXT]]\n${contextEntries}\n[[/REF_CONTEXT]]${fullMessage ? '\n\n' + fullMessage : ''}`;
    }

    if (uploadedPaths && uploadedPaths.length > 0) {
      const fileInfos = uploadedPaths.map(p => {
        const virtualPath = p.startsWith('files/') ? p.slice('files/'.length) : p;
        const readTool = fileReadToolForPath(virtualPath);
        return `- ${virtualPath} → ${readTool}("${virtualPath}")`;
      });
      const fileMarker = `[[UPLOADED_FILES]]\n${fileInfos.join('\n')}`;
      fullMessage = fullMessage
        ? `${fullMessage}\n\n${fileMarker}`
        : fileMarker;
    }

    if (!fullMessage.trim()) return;

    // 计费阻断（对标 V1: ConversationPanel.tsx:1053-1055）
    if (billingUiState.billingBlockReason && options?.source !== 'onboarding_default_insight') {
      console.warn('[Chat] 计费阻断，原因:', billingUiState.billingBlockReason);
      return;
    }

    // staging commit：新会话暂存文件需在发送前移入正式目录
    // 关键：先 await commit，再同步设置 sessionId + 触发事件 + sendJob，
    // 避免 setCurrentSessionId 和 commit 之间出现 React 重渲染导致 Sidebar 过早 fetch 空列表
    let committedFiles: string[] = [];
    // 新会话的看板查询、暂存文件与首条消息共享同一个最终 session ID。
    // dashboard-draft-* 只作为旧页面/热更新残留的兼容输入，不再是正常创建路径。
    let pendingSessionId: string | null = options?.sessionId === sendStartedSessionId
      ? null
      : options?.sessionId
        ?? (sendStartedSessionId ? null : useAgentStore.getState().reserveNewSessionId());
    if (pendingSessionId && options?.source === 'onboarding_default_insight') {
      markOnboardingDefaultSession(pendingSessionId);
    }

    const stagingIds = Array.from(new Set((stagingId || '').split(',').map((value) => value.trim()).filter(Boolean)));
    if (stagingIds.length > 0) {
      pendingSessionId = useAgentStore.getState().currentSessionId;
      if (!pendingSessionId) {
        pendingSessionId = useAgentStore.getState().reserveNewSessionId();
      }
      const agentId = useAgentContextStore.getState().currentAgentId;
      if (agentId) {
        for (const currentStagingId of stagingIds) {
          try {
            const resp = await kernelApiFetch('/api/v1/files/commit-staging', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ staging_id: currentStagingId, session_id: pendingSessionId, agent_id: agentId }),
            });
            if (!resp.ok) {
              let message = '文件上传失败，请稍后重试';
              try {
                const errorData = objectValue(await resp.json());
                const errorMessage = errorData.message || errorData.error || errorData.detail;
                if (typeof errorMessage === 'string' && errorMessage.trim()) {
                  message = errorMessage;
                }
              } catch {
                // Ignore parse failure and use the fallback message.
              }
              throw new Error(message);
            }
            const data = await resp.json();
            committedFiles = [...committedFiles, ...(data.committed_files || [])];
          } catch (e) {
            console.error('[Chat] commit-staging 失败:', e);
            notifyError(e instanceof Error && e.message ? e.message : '文件上传失败，请稍后重试');
            return;
          }
        }
      }
    }

    const dashboardStateBeforeSessionSwitch = useDashboardStore.getState();
    const dashboardSnapshotBeforeSessionSwitch = dashboardStateBeforeSessionSwitch.snapshot;
    const shouldPromoteActiveDashboardQuery = Boolean(
      !sendStartedSessionId &&
      pendingSessionId &&
      dashboardStateBeforeSessionSwitch.agentId === sendStartedAgentId &&
      dashboardStateBeforeSessionSwitch.queryStreamActive &&
      isTemporaryDashboardSessionId(dashboardStateBeforeSessionSwitch.activeQuerySessionId),
    );
    const shouldAttachDashboardSnapshotForNewSession = Boolean(
      !sendStartedSessionId &&
      pendingSessionId &&
      dashboardStateBeforeSessionSwitch.agentId === sendStartedAgentId &&
      !dashboardStateBeforeSessionSwitch.queryStreamActive &&
      dashboardSnapshotBeforeSessionSwitch?.html &&
      (dashboardSnapshotBeforeSessionSwitch.scope ?? 'main') === 'main' &&
      isTemporaryDashboardSessionId(dashboardSnapshotBeforeSessionSwitch.session_id) &&
      dashboardSnapshotBeforeSessionSwitch.session_id === dashboardStateBeforeSessionSwitch.latestSessionId,
    );

    if (pendingSessionId && shouldPromoteActiveDashboardQuery) {
      const promoted = useDashboardStore.getState().promoteActiveQueryToSession(pendingSessionId);
      if (!promoted) {
        notifyError('当前看板查询状态已变化，请稍后重试发送。');
        return;
      }
    } else if (pendingSessionId && shouldAttachDashboardSnapshotForNewSession) {
      // 已完成的临时看板仍在切换 session 前归档；查询中的看板由 final 回调完成归档。
      const attachedDashboardSnapshot = await useDashboardStore.getState().attachCurrentSnapshotToSession(
        pendingSessionId,
        {
          dashboardKey: dashboardSnapshotBeforeSessionSwitch?.dashboard_key,
          snapshot: dashboardSnapshotBeforeSessionSwitch,
        },
      );
      if (!attachedDashboardSnapshot) {
        notifyError('当前看板结果绑定失败，请稍后重试 MOSS 洞察。');
        return;
      }
    }

    if (pendingSessionId) {
      if (sendStartedAgentId && newSessionBoardDraftBeforeSend) {
        useBoardDraftStore.getState().upsertDraft(sendStartedAgentId, pendingSessionId, {
          activeTab: newSessionBoardDraftBeforeSend.activeTab,
          customerName: newSessionBoardDraftBeforeSend.customerName,
          queryState: newSessionBoardDraftBeforeSend.queryState === 'loading'
            ? 'idle'
            : newSessionBoardDraftBeforeSend.queryState,
          attachment: null,
        });
      }
      if (sendStartedAgentId && newSessionBoardDraftBeforeSend) {
        useBoardDraftStore.getState().clearDraft(sendStartedAgentId, NEW_SESSION_BOARD_DRAFT_SESSION_ID, { deleteFile: false });
      }
    }

    const pendingRecommendedQuestionClick = pendingRecommendedQuestionClickRef.current;
    pendingRecommendedQuestionClickRef.current = null;
    const recommendedQuestionClickEventId = pendingRecommendedQuestionClick
      && pendingRecommendedQuestionClick.agentId === useAgentContextStore.getState().currentAgentId
      ? await pendingRecommendedQuestionClick.eventPromise
      : null;

    // 埋点等待必须发生在激活预留会话之前，避免 /app 在乐观消息写入前
    // 把短暂的空会话识别为新会话入口并清空 currentSessionId。
    // 激活时仍需先设置发送保护，避免 /jobs 落库前的 owner 查询 404 清空会话。
    if (pendingSessionId && !useAgentStore.getState().currentSessionId) {
      markSendTaskSession(pendingSessionId);
      setCurrentSessionId(pendingSessionId);
    }
    for (const name of committedFiles) {
      window.dispatchEvent(new CustomEvent('session-file-added', {
        detail: { name, path: name, is_dir: false },
      }));
    }

    const thinkingConfig = useAgentStore.getState().getThinkingConfig();
    const sent = await jobConversation.sendMessage(fullMessage, {
      thinking: thinkingConfig,
      ...(options?.displayContent ? { displayContent: options.displayContent } : {}),
      ...(options?.executionContent ? { executionContent: options.executionContent } : {}),
      ...(options?.source ? { source: options.source } : {}),
      ...(options?.idempotencyKey ? { idempotencyKey: options.idempotencyKey } : {}),
      ...(pendingSessionId ? { sessionId: pendingSessionId } : {}),
      ...(recommendedQuestionClickEventId
        ? { recommendedQuestionClickEventId }
        : {}),
    });
    if (sent) {
      const agentId = useAgentContextStore.getState().currentAgentId;
      const sessionId = useAgentStore.getState().currentSessionId;
      const referenceableRefs = Array.from(new Map(
        (fileRefs || [])
          .map((ref) => [`${ref.fileId || ''}:${ref.filePath}`, ref])
      ).values());
      if (agentId && sessionId && referenceableRefs.length > 0) {
        const jobId = typeof sent === 'object' && sent ? sent.jobId : undefined;
        const results = await Promise.allSettled(
          referenceableRefs.map((ref) => agentFilesApi.recordSessionFileReference(agentId, sessionId, ref, jobId))
        );
        if (results.some((result) => result.status === 'rejected')) {
          console.warn('[Chat] record file reference failed', results);
        }
      }

      const followUpSource = options?.followUpSource ?? latestVisibleFollowUp();
      if (followUpSource) {
        clearVisibleFollowUp(followUpSource);
      }

      // 立即向 Sidebar 插入乐观会话条目，避免用户看不到新会话
      const store = useAgentStore.getState();
      const sid = store.currentSessionId;
      if (sid && !store.sessions.some(s => s.id === sid)) {
        const now = new Date().toISOString();
        store.setSessions([
          { id: sid, title: undefined, created_at: now, updated_at: now, message_count: 1 },
          ...store.sessions,
        ]);
      }
      setTimeout(() => fetchSessions(), 3000);
    } else {
      console.log('[Chat] 消息发送失败');
    }
    return Boolean(sent);
  };

  useEffect(() => {
    if (conversationBusy || !currentUserId || !currentWorkspace?.tenantId) return;
    const handoff = readPendingOnboardingHandoff(currentUserId, currentWorkspace.tenantId);
    if (!handoff) return;
    if (handoff.agentId !== currentAgentId) return;
    const handoffKey = `${handoff.agentId}:${handoff.createdAt}`;
    if (onboardingHandoffConsumedRef.current === handoffKey) return;

    onboardingHandoffConsumedRef.current = handoffKey;
    void handleSend(handoff.displayMessage, undefined, undefined, undefined, {
      displayContent: handoff.displayMessage,
      source: handoff.source,
      sessionId: handoff.sessionId,
      idempotencyKey: handoff.idempotencyKey,
    }).then((sent) => {
      if (!sent) return;
      notifyOnboardingHandoffCompleted(currentUserId, currentWorkspace.tenantId);
      clearPendingOnboardingHandoff(currentUserId, currentWorkspace.tenantId);
      clearOnboardingDraft(currentUserId, currentWorkspace.tenantId);
    });
  }, [
    conversationBusy,
    currentAgentId,
    currentUserId,
    currentWorkspace?.tenantId,
  ]);

  useEffect(() => {
    const handleBoardResultAsk = async (event: Event) => {
      const detail = (event as BoardResultAskEvent).detail;
      const dashboardState = useDashboardStore.getState();
      const requestedDashboardKey = detail?.dashboardKey || dashboardState.currentKey;
      const board = dashboardState.dashboards.find((item) => item.key === requestedDashboardKey);
      const requestedBoardName = detail?.boardName || board?.name;
      const requestedSnapshot = dashboardState.snapshot;
      const requestedSnapshotId = detail?.snapshotId || requestedSnapshot?.snapshot_id || null;
      const requestedSnapshotSessionId = requestedSnapshot?.session_id || null;
      const prompt = resolveDashboardInsightPrompt(detail?.prompt || board?.insight_prompt_template, requestedBoardName);
      if (!prompt.trim()) return;
      if (billingUiState.billingBlockReason) {
        notifyError('当前工作区额度不足，暂时无法发起 MOSS 洞察。');
        return;
      }
      if (conversationBusy) {
        notifyError('当前会话正在生成中，请等待完成后再使用 MOSS 洞察。');
        return;
      }
      const agentSessionState = useAgentStore.getState();
      const activeSessionId = agentSessionState.currentSessionId;
      const reservedNewSessionId = agentSessionState.reservedNewSessionId;
      if (!requestedSnapshot?.html) {
        notifyError('当前没有可用的看板结果，请先查询看板。');
        return;
      }
      if (requestedDashboardKey && requestedSnapshot.dashboard_key !== requestedDashboardKey) {
        notifyError('当前看板结果已变化，请重新点击看板洞察。');
        return;
      }
      try {
        await useDashboardStore.getState().flushDashboardState();
      } catch (error) {
        console.error('[Chat] flush dashboard state before insight failed:', error);
        notifyError('看板筛选状态保存失败，请稍后重试。');
        return;
      }
      const lockedViewState = useDashboardStore.getState().dashboardState;
      const snapshotUsesReservedNewSession = Boolean(
        !activeSessionId
        && reservedNewSessionId
        && requestedSnapshot.session_id === reservedNewSessionId,
      );
      if (
        !activeSessionId
        && !snapshotUsesReservedNewSession
        && !isTemporaryDashboardSessionId(requestedSnapshot.session_id)
      ) {
        notifyError('当前看板结果不属于新会话，请重新查询看板后再提问。');
        return;
      }
      if (activeSessionId && requestedSnapshot.session_id !== activeSessionId) {
        if (!isTemporaryDashboardSessionId(requestedSnapshot.session_id)) {
          notifyError('当前会话没有可用的看板结果，请重新查询看板后再提问。');
          return;
        }
        useDashboardStore.setState({ latestSessionId: activeSessionId });
        attachDashboardSnapshotToSessionInBackground(activeSessionId, {
          dashboardKey: requestedDashboardKey,
          snapshot: requestedSnapshot,
        });
      }
      const payload = buildDashboardAskPayload(prompt, {
        boardName: requestedBoardName,
        dashboardKey: requestedDashboardKey,
        snapshotId: requestedSnapshotId,
        sourceSessionId: requestedSnapshotSessionId,
        viewStateRevision: lockedViewState?.revision || null,
        viewStateSnapshotId: lockedViewState?.snapshot_id || null,
      });
      const displayContent = dashboardAskDisplayContent(requestedBoardName);
      void handleSend(displayContent, undefined, undefined, undefined, {
        displayContent,
        executionContent: payload,
      });
    };
    window.addEventListener('board-result-ask', handleBoardResultAsk);
    return () => window.removeEventListener('board-result-ask', handleBoardResultAsk);
  });

  const handleFollowUpSelect = (
    message: ChatMessage,
    item: FollowUpQuestionItem,
    followUpQuestions?: FollowUpQuestionsData,
  ) => {
    const agentId = currentAgent?.id;
    const sessionId = currentSessionId;
    if (!agentId || !sessionId || composerBlocked) return;
    const effectiveFollowUpQuestions = followUpQuestions ?? message.followUpQuestions;
    if (!effectiveFollowUpQuestions || effectiveFollowUpQuestions.used) return;

    void handleSend(item.text, undefined, undefined, undefined, {
      followUpSource: {
        messageId: message.backendMessageId || message.id,
        localMessageId: message.id,
        itemId: item.id,
      },
    });
  };
  
  // 处理问卷回答提交：格式为「问题 + 填写内容」，并附带结构化数据供回复卡片与刷新恢复
  const handleQuestionSubmit = async (
    answers: Record<string, string | string[]>,
    questionData?: { questions: Array<{ id: string; question: string; required?: boolean }> },
  ): Promise<boolean> => {
    if (billingUiState.billingBlockReason) return false;
    if (!questionData?.questions?.length) {
      const formatted = Object.entries(answers)
        .map(([id, value]) => `${id}: ${Array.isArray(value) ? value.join(', ') : value}`)
        .join('\n');
      await handleSend(formatted);
      return true;
    }
    const items = questionData.questions
      .filter((q) => answers[q.id] != null)
      .map((q) => {
        const answer = answers[q.id]!;
        const omitted = Array.isArray(answer) ? answer.length === 0 : answer.trim().length === 0;
        return {
          id: q.id,
          question: q.question,
          answer,
          omitted,
          required: q.required !== false,
        };
      });
    const formattedText = items
      .map((i) => `${i.question}: ${i.omitted ? '未填写（可选）' : Array.isArray(i.answer) ? i.answer.join(', ') : i.answer}`)
      .join('\n');
    const questionnaireReply = { status: 'submitted' as const, items };
    const thinkingConfig = useAgentStore.getState().getThinkingConfig();
    const sent = await jobConversation.sendMessage(formattedText, { thinking: thinkingConfig, questionnaireReply });
    return Boolean(sent);
  };

  const handleRetry = useCallback((messageId: string) => {
    if (composerBlocked) {
      return;
    }
    const assistantIdx = messages.findIndex(m => m.id === messageId);
    if (assistantIdx < 0) return;
    let lastAssistantIdx = -1;
    for (let j = messages.length - 1; j >= 0; j--) {
      if (messages[j].role === 'assistant') {
        lastAssistantIdx = j;
        break;
      }
    }
    if (assistantIdx !== lastAssistantIdx) {
      notifyError('只支持重试最后一轮回答。');
      return;
    }
    for (let i = assistantIdx - 1; i >= 0; i--) {
      if (messages[i].role === 'user' && messages[i].content) {
        const executionIds = Array.from(new Set(
          messages
            .slice(assistantIdx)
            .map((msg) => msg.executionId)
            .filter((id): id is string => !!id),
        ));
        const assistantMessage = messages[assistantIdx];
        if (!assistantMessage.job_id) {
          notifyError('任务缺少 jobId，暂不支持重试，请刷新后重试。');
          return;
        }
        if (assistantIdx + 1 < messages.length) {
          removeMessages(assistantIdx + 1, messages.length - 1);
        }
        const retryPayload = { retryMessageId: assistantMessage.id };
        removeExecutions(executionIds);
        void jobConversation.retryMessage(assistantMessage.job_id || '', retryPayload.retryMessageId);
        return;
      }
    }
  }, [composerBlocked, jobConversation, messages, removeExecutions, removeMessages]);
  
  
  // 当前会话标题（优先使用智能摘要，回退到消息截取）
  const currentSession = sessions.find(s => s.id === currentSessionId);
  const rawTitle = currentSession?.title 
    || (messages.length > 0 
        ? messages[0].content.slice(0, 20) + (messages[0].content.length > 20 ? '...' : '')
        : '新任务');
  const isAutoSession = currentSession?.is_automation || rawTitle.startsWith('[自动化]');
  const sessionTitle = isAutoSession ? rawTitle.replace('[自动化] ', '').replace('[自动化]', '') : rawTitle;
  const retryBlockedByRunning = conversationBusy;
  const retryDisabled = !!billingUiState.billingBlockReason || retryBlockedByRunning;
  const retryDisabledTitle = billingUiState.billingBlockReason
    ? '额度不足，暂不能重试'
    : '当前任务运行中，暂不能重试';
  const hasActiveSession = Boolean(currentSessionId && messages.length > 0);
  const isNewSessionPage = !currentSessionId && messages.length === 0 && !sessionLoading;
  const [headerGlassActive, setHeaderGlassActive] = useState(false);
  const handleToggleCurrentSessionStar = useCallback(() => {
    if (!currentSessionId) return;
    const current = useAgentStore.getState().isSessionStarred(currentSessionId);
    void updateSessionStarState(currentSessionId, !current);
  }, [currentSessionId, updateSessionStarState]);
  const sessionHeader = (
    <ChatSessionHeader
      agentName={getAgentDisplayName(currentAgent)}
      sessionTitle={sessionTitle}
      isAutoSession={isAutoSession}
      hasActiveSession={hasActiveSession}
      isNewSession={isNewSessionPage}
      glassActive={headerGlassActive}
      starred={currentSessionId ? isSessionStarred(currentSessionId) : false}
      onToggleStar={currentSessionId ? handleToggleCurrentSessionStar : undefined}
      showBoardAction={canOpenBoard}
      showUtilityActions={true}
      onOpenBoard={handleOpenBoard}
      onShare={(rect) => {
        setShareAnchorRect(rect ?? null);
        setShareDialogOpen(true);
      }}
      onOpenFiles={openCanvas}
    />
  );
  
  return (
    <div
      className="flex flex-col h-full"
      style={{ background: 'transparent', position: 'relative' }}
      data-testid="chat-container"
    >
      {hasActiveSession ? sessionHeader : null}
      <TenantAdminNewSessionHint
        tenantId={currentWorkspace?.tenantId}
        userId={currentUserId}
        role={currentWorkspace?.role}
        isNewSession={isNewSessionPage}
      />
      <ShareDialog
        open={shareDialogOpen}
        anchorRect={shareAnchorRect}
        onClose={() => setShareDialogOpen(false)}
      />
      
      <ChatThreadPane
        messages={messages}
        runtimeMessages={jobConversation.viewModel.messages}
        sessionLoading={sessionLoading && !!currentSessionId}
        messageListSessionKey={activeRuntimeSessionId ?? currentSessionId}
        sessionIdOverride={currentSessionId}
        loadingFallback={<SessionLoadingSkeleton />}
        emptyHeader={!hasActiveSession ? sessionHeader : null}
        emptyState={(
          <EmptyState
            recommendedQuestions={recommendedQuestions}
            onSelectQuestion={handleRecommendedQuestionSelect}
          />
        )}
        messageOverlay={ROUNDTABLE_ENABLED ? (
          <ChannelBar
            channels={channels}
            activeChannelId={activeChannelId}
            onSelect={handleOpenRoundtable}
            onOpenCreatePanel={handleOpenCreatePanel}
            forceCollapsed={!!activeChannelId || showCreatePanel}
          />
        ) : null}
        threadMessageFooter={(message, runtimeMessage) => {
          const responseMessageId = runtimeMessage?.assistant.responseMessageId || message.id;
          const jobId = runtimeMessage?.assistant.jobId || message.job_id || null;
          return (
            <SkillCreatorCardStrip
              sessionId={currentSessionId}
              responseMessageId={responseMessageId}
              jobId={jobId}
              hidden={runtimeMessage?.assistant.isStreaming === true}
            />
          );
        }}
        threadFooter={<SkillCreatorCardStrip sessionId={currentSessionId} />}
        stickToBottomSignal={boardComposerFocusSignal}
        stickToBottomDurationMs={500}
        onHeaderGlassActiveChange={setHeaderGlassActive}
        inputOverlay={shouldShowTodoOverlay ? (
          <div
            style={{
              position: 'absolute',
              bottom: 'calc(100% + 2px)',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 20,
              maxWidth: 700,
              width: 'calc(100% - 32px)',
              pointerEvents: 'auto',
            }}
            data-testid="chat-todo-overlay"
          >
            <TodoDrawer todos={globalTodos} visible={true} />
          </div>
        ) : null}
        inputArea={(
          <div
            style={{
              position: 'relative',
              zIndex: 5,
            }}
            data-testid="chat-input-shell"
          >
            <InputBar
              onSend={handleSend}
              onCancel={jobConversation.cancelCurrentJob}
              isRunning={composerRunning}
              isCancelling={jobConversation.isCancelling}
              disabled={!!billingUiState.billingBlockReason}
              composerState={composerState}
              roundtableTag={roundtableTag}
              onClearRoundtableTag={() => setRoundtableTag(null)}
              channelHint={channelHint}
              compressionHint={compressionHint}
              commandHistory={commandHistory}
              prefillText={prefillText}
              onPrefillConsumed={handlePrefillConsumed}
              attachmentPreviews={boardAttachmentPreview ? [boardAttachmentPreview] : []}
              onAttachmentPreviewRemove={(id) => {
                if (currentAgentId && boardAttachmentPreview?.id === id) {
                  useBoardDraftStore.getState().removeAttachment(currentAgentId, effectiveBoardDraftSessionId, { deleteFile: false });
                  return;
                }
              }}
              onAttachmentPreviewsConsumed={() => {
                if (currentAgentId) {
                  useBoardDraftStore.getState().removeAttachment(currentAgentId, effectiveBoardDraftSessionId, { deleteFile: false });
                }
              }}
              autoFocusSignal={boardComposerFocusSignal}
              maxWidth={900}
            />
          </div>
        )}
        connectionError={null}
        onQuestionSubmit={handleQuestionSubmit}
        onPlanApprove={() => {
          if (composerBlocked) return;
          void jobConversation.sendMessage('批准方案，开始执行');
        }}
        onPlanFeedback={(feedback) => {
          if (composerBlocked) return;
          void jobConversation.sendMessage(`补充建议：${feedback}`);
        }}
        onOpenRoundtablePanel={handleOpenRoundtable}
        onRetry={handleRetry}
        retryDisabled={retryDisabled}
        retryDisabledTitle={retryDisabledTitle}
        onSourcesOpen={openSourcesDrawer}
        onFollowUpSelect={handleFollowUpSelect}
      />
      {sourceDrawerSources && (
        <AnswerSourcesDrawer
          sources={sourceDrawerSources}
          traceId={sourceDrawerTraceId}
          onClose={() => setSourceDrawerSources(null)}
        />
      )}

      {/* 圆桌面板 — absolute overlay，覆盖整个聊天区域（含输入框）（PRD 430 暂不上线） */}
      <AnimatePresence>
        {ROUNDTABLE_ENABLED && (activeChannelId || showCreatePanel) && (
          <motion.div
            key={activeChannelId || 'create'}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            style={{
              position: 'absolute',
              top: 8, right: 60, bottom: 8,
              width: 420,
              maxWidth: 'calc(100% - 76px)',
              borderRadius: activeChannelId ? 16 : 44,
              background: activeChannelId ? 'var(--ch-panel-bg)' : 'var(--ch-create-bg)',
              border: activeChannelId ? '1px solid var(--ch-panel-border)' : 'none',
              boxShadow: activeChannelId
                ? 'var(--ch-panel-shadow)'
                : 'var(--ch-create-shadow)',
              overflow: 'hidden', zIndex: 25,
              display: 'flex', flexDirection: 'column',
            }}
          >
            {activeChannelId ? (
              <ChannelChatPanel
                key={activeChannelId}
                sessionId={activeChannelId}
                onClose={() => setActiveChannelId(null)}
              />
            ) : (
              <EmptyChannelPanel
                onClose={() => setShowCreatePanel(false)}
                onCreateRoundtable={handleCreateRoundtable}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// 会话加载骨架屏 — 模拟真实对话布局（对齐 MessageList: maxWidth 880, px-6 py-4, space-y-4）
const SessionLoadingSkeleton: React.FC = () => (
  <div className="px-6 py-4" style={{
    display: 'flex', flexDirection: 'column',
    width: '100%', maxWidth: 880, margin: '0 auto',
    gap: 16,
  }}>
    {/* 用户消息骨架 — flex-row-reverse, gap 12, maxWidth 85% */}
    <div style={{ display: 'flex', flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 12 }}>
      <div className="sk-pulse" style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: 'var(--bg-tertiary)' }} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, maxWidth: '85%' }}>
        <div className="sk-pulse" style={{ width: 60, height: 10, borderRadius: 5, background: 'var(--bg-tertiary)', animationDelay: '0.05s' }} />
        <div className="sk-pulse" style={{ borderRadius: 16, padding: 14, background: 'var(--bg-tertiary)', animationDelay: '0.1s' }}>
          <div style={{ width: 180, height: 13, borderRadius: 6, background: 'var(--border-subtle)' }} />
        </div>
      </div>
    </div>

    {/* Agent 消息骨架 — flex-row, gap 12, maxWidth 85% */}
    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
      <div className="sk-pulse" style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: 'var(--bg-tertiary)', animationDelay: '0.15s' }} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, maxWidth: '85%' }}>
        <div className="sk-pulse" style={{ width: 80, height: 10, borderRadius: 5, background: 'var(--bg-tertiary)', animationDelay: '0.2s' }} />
        <div className="sk-pulse" style={{ borderRadius: 16, padding: 14, background: 'var(--bg-tertiary)', animationDelay: '0.25s', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ width: 360, height: 13, borderRadius: 6, background: 'var(--border-subtle)' }} />
          <div style={{ width: 280, height: 13, borderRadius: 6, background: 'var(--border-subtle)' }} />
          <div style={{ width: 220, height: 13, borderRadius: 6, background: 'var(--border-subtle)' }} />
        </div>
      </div>
    </div>

    {/* 第二组 */}
    <div style={{ display: 'flex', flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 12 }}>
      <div className="sk-pulse" style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: 'var(--bg-tertiary)', animationDelay: '0.3s' }} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, maxWidth: '85%' }}>
        <div className="sk-pulse" style={{ width: 60, height: 10, borderRadius: 5, background: 'var(--bg-tertiary)', animationDelay: '0.35s' }} />
        <div className="sk-pulse" style={{ borderRadius: 16, padding: 14, background: 'var(--bg-tertiary)', animationDelay: '0.4s' }}>
          <div style={{ width: 240, height: 13, borderRadius: 6, background: 'var(--border-subtle)' }} />
        </div>
      </div>
    </div>

    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
      <div className="sk-pulse" style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: 'var(--bg-tertiary)', animationDelay: '0.45s' }} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, maxWidth: '85%' }}>
        <div className="sk-pulse" style={{ width: 80, height: 10, borderRadius: 5, background: 'var(--bg-tertiary)', animationDelay: '0.5s' }} />
        <div className="sk-pulse" style={{ borderRadius: 16, padding: 14, background: 'var(--bg-tertiary)', animationDelay: '0.55s', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ width: 320, height: 13, borderRadius: 6, background: 'var(--border-subtle)' }} />
          <div style={{ width: 250, height: 13, borderRadius: 6, background: 'var(--border-subtle)' }} />
        </div>
      </div>
    </div>

    <style>{`
      .sk-pulse { animation: sk-pulse 1.5s ease-in-out infinite; }
      @keyframes sk-pulse { 0%,100% { opacity: 0.3; } 50% { opacity: 0.6; } }
    `}</style>
  </div>
);

type EmptyStateProps = {
  recommendedQuestions: ReturnType<typeof parseRecommendedQuestions>;
  onSelectQuestion: (question: string) => void;
};

const EmptyState: React.FC<EmptyStateProps> = ({
  recommendedQuestions,
  onSelectQuestion,
}) => {
  const currentAgent = useAgentContextStore((s) => s.getCurrentAgent());

  return (
    <AgentHome
      currentAgent={currentAgent}
      recommendedQuestions={recommendedQuestions}
      homeTitle={currentAgent?.home_title}
      highlightWords={currentAgent?.highlight_words}
      onQuestionSelect={onSelectQuestion}
      animationKey={currentAgent?.id ?? currentAgent?.name ?? 'agent-home'}
    />
  );
};
