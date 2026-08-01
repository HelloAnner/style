/**
 * AgentMessage - Agent 消息复合组件
 * 
 * 【性能优化 v3】
 * - 历史消息（非末条）不订阅实时状态（activeSubAgents）
 * - ActionFeed 懒加载：历史会话默认收起且不渲染内部组件树
 * - 展开时按需实例化 ActionItem，收起后 60s 自动释放 DOM
 * - LRU 缓存：最多同时保留 3 个展开的 ActionFeed
 */

import React, { memo, useMemo } from 'react';
import { MarkdownContent } from './MarkdownContent';
import { QuestionCard } from './QuestionCard';
import { PlanReviewCard } from './PlanReviewCard';
import { ToolApprovalCard } from './ToolApprovalCard';
import DislikeModal from './DislikeModal';
import { AssistantMessageFrame } from './AssistantMessageFrame';
import { AssistantResponseBody } from './AssistantResponseBody';
import { AssistantPostActions } from './AssistantPostActions';
import { ReasoningTraceSection } from './ReasoningTraceSection';
import { AssistantErrorDetails } from './AssistantErrorDetails';
import {
  mergeWidgetData,
  resolveAssistantDurationSeconds,
  toolVmToPendingToolCall,
  visibleReasoningActionItems,
} from './assistantMessageUtils';
import { useMessageFeedbackState } from './useMessageFeedbackState';

import { useSessionRuntimeStore, type SessionRuntimeStore } from '../../stores/sessionRuntimeStore';
import { useAgentContextStore } from '../../stores/agentContextStore';
import { useAgentStore } from '../../stores/agentStore';
import { stripAllMarkers, closeOpenCodeFences, stripTaskComplete } from '../../lib/wsContentParsers';
import {
  isTerminalStatus,
  type AnswerSource,
  type ChatMessage,
  type FollowUpQuestionItem,
  type FollowUpQuestionsData,
  type PendingToolCall,
  type ToolUsePendingPayload,
} from '../../types';
import type { ChatAgentDisplay } from './chatDisplayContext';
import type { ChatMessageVM } from '../../conversation/model/viewTypes';

// Stable empty references for historical messages (avoids Zustand re-render on every store change)
const _EMPTY_MAP: Map<string, any> = new Map();

// ========== 类型定义 ==========

interface AgentMessageProps {
  message: ChatMessage;
  runtimeMessage?: ChatMessageVM;
  isLast: boolean;
  runtimeStore?: SessionRuntimeStore;
  agentDisplay?: ChatAgentDisplay;
  sessionIdOverride?: string | null;
  onQuestionSubmit?: (answers: Record<string, string | string[]>, questionData?: import('../../types').QuestionData) => boolean | void | Promise<boolean | void>;
  onPlanApprove?: () => void;
  onPlanFeedback?: (feedback: string) => void;
  /** 重试（重新生成回答） */
  onRetry?: (messageId: string) => void;
  retryDisabled?: boolean;
  retryDisabledTitle?: string;
  onSourcesOpen?: (message: ChatMessage, sources: AnswerSource[]) => void;
  /** 技能编辑助手 tool_use_pending 卡片的决议回调 */
  onToolApproval?: (requestId: string, decision: { approved: boolean | 'refine'; refine_comment?: string }) => void;
  /** 查看 skill 详情（打开 SkillStudio preview 模式） */
  onViewSkillDetail?: (payload: ToolUsePendingPayload) => void;
  onFollowUpSelect?: (message: ChatMessage, item: FollowUpQuestionItem, followUpQuestions?: FollowUpQuestionsData) => void;
  /** 渲染在正文与反馈/追问之间的消息级交互卡片（如 AI 技能创建器草稿卡片）。 */
  bodyExtra?: React.ReactNode;
}

// ========== 辅助函数 ==========

function formatErrorLikeContent(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return '⚠️ **错误**';
  return trimmed.startsWith('⚠️') ? trimmed : `⚠️ **错误**\n\n${trimmed}`;
}

function runtimeStatusToAgentStatus(status: string | undefined): ChatMessage['status'] {
  if (status === 'succeeded') return 'completed';
  if (status === 'failed' || status === 'cancelled' || status === 'timeout') return status;
  return undefined;
}

// ========== 主组件 ==========

export const AgentMessage: React.FC<AgentMessageProps> = memo(({
  message,
  runtimeMessage,
  isLast,
  runtimeStore,
  agentDisplay,
  sessionIdOverride,
  onQuestionSubmit,
  onPlanApprove,
  onPlanFeedback,
  onRetry,
  retryDisabled = false,
  retryDisabledTitle,
  onSourcesOpen,
  onToolApproval,
  onViewSkillDetail,
  bodyExtra,
  onFollowUpSelect,
}) => {
  const currentAgent = useAgentContextStore((s) => s.getCurrentAgent());
  const storeSessionId = useAgentStore((s) => s.currentSessionId);
  const currentSessionId = sessionIdOverride !== undefined ? sessionIdOverride : storeSessionId;
  const effectiveAgent = agentDisplay ?? currentAgent ?? { name: 'Moss', avatar_url: null };
  const runtime = runtimeStore ?? useSessionRuntimeStore;
  const assistantVm = runtimeMessage?.assistant;

  // 精确订阅 sessionRuntimeStore（步骤 010）
  const relatedExecution = runtime((s) => {
    if (message.executionId) return s.executionMap.get(message.executionId);
    if (isLast && (message.isStreaming || message.status === 'running' || message.status === 'cancelling')) {
      return undefined;
    }
    return s.executions[s.executions.length - 1];
  });
  const liveSubAgents = runtime((s) => isLast ? s.activeSubAgents : _EMPTY_MAP);
  const persistedSubAgentResults = message.subagentResults;
  const mergedSubAgents = useMemo(() => {
    if (liveSubAgents.size > 0) return Array.from(liveSubAgents.values());
    if (persistedSubAgentResults?.length) return persistedSubAgentResults;
    return [];
  }, [liveSubAgents, persistedSubAgentResults]);
  const isRuntimeBlocking = assistantVm?.phase === 'running' || assistantVm?.phase === 'execution_terminal_waiting_job';
  const isRunning = isLast
    ? (assistantVm ? isRuntimeBlocking : Boolean(message.isStreaming || message.status === 'running' || message.status === 'cancelling'))
    : false;
  const useRuntimeTools = Boolean(assistantVm?.tools?.length);

  const questionData = assistantVm?.questionData ?? message.questionData;
  const planReviewData = assistantVm?.planReviewData ?? message.planReviewData;
  const widgetDataList = mergeWidgetData(assistantVm?.widgetData, assistantVm?.widgetDataList, message.widgetDataList);
  const followUpQuestions = assistantVm?.followUpQuestions ?? message.followUpQuestions;
  const answerSources = assistantVm?.sources ?? message.sources ?? [];
  const messageStatus = runtimeStatusToAgentStatus(assistantVm?.status) ?? message.status;
  const errorCode = assistantVm?.errorCode ?? message.errorCode;
  const errorOrigin = assistantVm?.errorOrigin ?? message.errorOrigin;
  const errorCategory = assistantVm?.errorCategory ?? message.errorCategory;
  const errorStepId = assistantVm?.errorStepId ?? message.errorStepId;
  const errorDiagnostics = assistantVm?.errorDiagnostics ?? message.errorDiagnostics;
  const hasQuestionData = Boolean(questionData);
  const hasPlanReviewData = Boolean(planReviewData);
  const hasToolApprovalData = Boolean(message.toolApprovalData);
  const hasWidgetData = widgetDataList.length > 0;
  const isTerminalMessage = messageStatus ? isTerminalStatus(messageStatus) : false;
  const isMessageRunning = isLast && isRunning && !isTerminalMessage;
  const followUpDisabled = (
    followUpQuestions?.used === true
    || (isLast && !isTerminalMessage && (isRunning || isRuntimeBlocking))
  );

  const activeStreamingWidget = useMemo<PendingToolCall | null>(() => {
    if (messageStatus === 'cancelling') return null;
    if (useRuntimeTools && assistantVm?.tools) {
      const widgetTools = assistantVm.tools.filter(tool => (
        tool.name === 'show_widget' || tool.name === 'graph_3d'
      ));
      if (isMessageRunning) {
        for (const tool of widgetTools) {
          if (tool.status !== 'completed') {
            return toolVmToPendingToolCall(tool);
          }
        }
      }
      if (!hasWidgetData) {
        for (let i = widgetTools.length - 1; i >= 0; i -= 1) {
          const tool = widgetTools[i];
          if (tool.widgetStream?.completed && !tool.widgetStream.aborted) {
            return toolVmToPendingToolCall(tool);
          }
        }
      }
      return null;
    }
    return null;
  }, [assistantVm?.tools, hasWidgetData, isMessageRunning, messageStatus, useRuntimeTools]);
  const activeStreamingWidgetId = activeStreamingWidget?.id ?? null;

  const isWidgetPending = Boolean(activeStreamingWidgetId) && !hasWidgetData;
  
  const displayContent = useMemo(() => {
    const rawContent = assistantVm ? assistantVm.content : message.content;
    const currentContent = assistantVm ? rawContent : stripAllMarkers(rawContent);
    const anchoredContent = assistantVm ? assistantVm.anchoredContent : message.anchoredContent;
    const merged = anchoredContent
      ? (() => {
          const anchoredClean = stripAllMarkers(anchoredContent);
          return currentContent ? anchoredClean + '\n\n---\n\n' + currentContent : anchoredClean;
        })()
      : currentContent;
    const normalized = closeOpenCodeFences(merged);
    const isTimeout = message.status === 'timeout' || relatedExecution?.status === 'timeout';
    if (isTimeout) {
      return formatErrorLikeContent(normalized || '任务执行超时');
    }
    if (!normalized.trim() && messageStatus === 'completed' && !hasQuestionData) {
      return '任务已完成，但未返回内容。';
    }
    return normalized;
  }, [assistantVm, hasQuestionData, message.content, message.anchoredContent, message.status, messageStatus, relatedExecution?.status]);

  const isStreaming = Boolean((assistantVm?.isStreaming ?? message.isStreaming) && isLast && !isTerminalMessage);
  const reasoningDurationSeconds = resolveAssistantDurationSeconds(
    assistantVm?.metrics,
    message.duration_seconds,
  );
  const reasoningTraceKey = useMemo(() => [
    currentSessionId || 'session',
    assistantVm?.jobId || message.job_id || message.executionId || message.id,
    assistantVm?.responseMessageId || message.backendMessageId || message.id,
  ].join(':'), [
    assistantVm?.jobId,
    assistantVm?.responseMessageId,
    currentSessionId,
    message.backendMessageId,
    message.executionId,
    message.id,
    message.job_id,
  ]);

  const thinkingDisplay = useMemo(() => {
    return stripTaskComplete(assistantVm?.thinkingContent || message.thinkingContent || '');
  }, [assistantVm?.thinkingContent, message.thinkingContent]);
  const questionnaireIntroContent = thinkingDisplay || displayContent;

  const hasAnswerContent = displayContent.trim().length > 0;
  const showErrorDetails = messageStatus === 'failed' || messageStatus === 'timeout';
  const showGeneratingHint = false;
  const useRealtimeMarkdown = isMessageRunning;
  const hasThinkingTrace = thinkingDisplay.trim().length > 0;
  const hasVisibleReasoningTrace = hasThinkingTrace
    || Boolean(assistantVm?.processTraceNotes?.length)
    || mergedSubAgents.length > 0
    || visibleReasoningActionItems(
      useRuntimeTools ? assistantVm?.tools : undefined,
      relatedExecution,
    ).length > 0;
  const isQuestionnairePreparing = isMessageRunning && !hasQuestionData && (
    useRuntimeTools
      ? Boolean(assistantVm?.tools?.some(tool => tool.name === 'ask_user_question'))
      : Boolean(relatedExecution?.iterations.some(iteration => (
        iteration.tool_calls.some(tool => tool.name === 'ask_user_question')
      )))
  );
  const processTraceAnimationId = assistantVm?.responseSegmentId;
  const showEmptyRunningBody = isMessageRunning
    && !hasAnswerContent
    && !hasWidgetData
    && !isWidgetPending
    && !hasVisibleReasoningTrace;
  const questionnaireWidgetBody = hasQuestionData && (hasWidgetData || isWidgetPending) ? (
    <AssistantResponseBody
      content=""
      widgets={widgetDataList}
      showStreamingWidgetSlot={isWidgetPending}
      activeStreamingWidget={activeStreamingWidget}
      activeStreamingWidgetId={activeStreamingWidgetId}
      messageId={message.id}
    />
  ) : null;
  
  // ========== 反馈/点赞/点踩 状态 ==========
  const feedbackMessageId = message.backendMessageId || message.id;
  const feedbackState = useMessageFeedbackState({
    sessionId: currentSessionId,
    messageId: feedbackMessageId,
    localMessageId: message.id,
    feedbackData: assistantVm?.feedbackData ?? message.feedbackData,
  });

  // ========== 渲染 ==========

  return (
    <AssistantMessageFrame
      agentDisplay={effectiveAgent}
      timestamp={message.timestamp}
      wide={hasWidgetData || isWidgetPending}
      dataTestId="agent-message"
      bodyTestId="agent-message-body"
    >
      <ReasoningTraceSection
        messageId={message.id}
        traceKey={reasoningTraceKey}
        isLast={isLast}
        isRunning={isMessageRunning}
        thinkingContent={thinkingDisplay}
        processTraceNotes={assistantVm?.processTraceNotes}
        useRuntimeTools={useRuntimeTools}
        runtimeTools={assistantVm?.tools}
        relatedExecution={relatedExecution}
        terminalStatus={messageStatus}
        durationSeconds={hasQuestionData ? undefined : reasoningDurationSeconds}
        processingStarted={hasAnswerContent && !isQuestionnairePreparing}
        sourceCount={answerSources.length}
        onSourcesClick={answerSources.length > 0 ? () => onSourcesOpen?.(message, answerSources) : undefined}
        subAgents={mergedSubAgents}
      />

        {hasQuestionData && questionData ? (
          questionData.submitted || questionData.skipped || !isLast ? (
            /* 已终结的问卷：Agent thought 气泡 + 下方状态卡片 */
            <div className="flex flex-col" style={{ gap: 8, width: '100%', maxWidth: '100%' }} data-testid="agent-message-question-completed">
              {displayContent && (
                <div
                  className="relative"
                  style={{
                    padding: 14, borderRadius: 16,
                    background: 'var(--bubble-agent)',
                    border: '1px solid var(--border-muted)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <div className="break-words" style={{ fontSize: 14, lineHeight: 1.6 }}>
                    <MarkdownContent content={displayContent} realtime={useRealtimeMarkdown} />
                  </div>
                </div>
              )}
              {questionnaireWidgetBody}
              <QuestionCard
                data={questionData}
                messageId={message.id}
                onSubmit={(answers) => onQuestionSubmit?.(answers, questionData)}
                disabled={true}
              />
            </div>
          ) : (
            /* 活跃问卷：说明文字沿用普通正文样式，问卷卡片只承载问卷内容 */
            <div className="flex flex-col" style={{ gap: 8, width: '100%', maxWidth: '100%' }}>
              {questionnaireIntroContent && (
                <AssistantResponseBody
                  content={questionnaireIntroContent}
                  realtime={useRealtimeMarkdown}
                  isMessageRunning={isMessageRunning}
                  messageIsStreaming={message.isStreaming}
                  widgets={[]}
                  messageId={message.id}
                  processTraceAnimationId={processTraceAnimationId}
                />
              )}
              {questionnaireWidgetBody}
              <QuestionCard
                data={questionData}
                messageId={message.id}
                onSubmit={(answers) => onQuestionSubmit?.(answers, questionData)}
                disabled={false}
                testId="agent-message-question-active"
              />
            </div>
          )
        ) : hasPlanReviewData && planReviewData ? (
          <div className="flex flex-col" style={{ gap: 8, maxWidth: '100%' }} data-testid="agent-message-plan-review">
            <PlanReviewCard
              data={planReviewData}
              onApprove={() => { onPlanApprove?.(); }}
              onRequestChanges={(feedback) => { onPlanFeedback?.(feedback); }}
              disabled={!isLast}
            />
          </div>
        ) : hasToolApprovalData && message.toolApprovalData ? (
          <ToolApprovalCard
            data={message.toolApprovalData}
            onResolve={(requestId, decision) => onToolApproval?.(requestId, decision)}
            onViewDetail={onViewSkillDetail}
            isLast={isLast}
            decided={message.toolApprovalDecided}
            testId="agent-message-tool-approval"
          />
        ) : (
          <>
            {showGeneratingHint && (
              <div
                className="agent-generating-hint"
                data-testid="agent-message-generating-hint"
                style={{ marginBottom: hasAnswerContent ? 8 : 0 }}
              >
                正在处理中...
              </div>
            )}
            <AssistantResponseBody
              content={displayContent}
              realtime={useRealtimeMarkdown}
              isMessageRunning={isMessageRunning}
              messageIsStreaming={message.isStreaming}
              widgets={widgetDataList}
              showStreamingWidgetSlot={isWidgetPending}
              activeStreamingWidget={activeStreamingWidget}
              activeStreamingWidgetId={activeStreamingWidgetId}
              emptyRunningText={showEmptyRunningBody && !isQuestionnairePreparing ? '正在思考...' : undefined}
              messageId={message.id}
              processTraceAnimationId={processTraceAnimationId}
            />
            {isQuestionnairePreparing && (
              <AssistantResponseBody
                content=""
                isMessageRunning
                widgets={[]}
                emptyRunningText="正在生成问卷..."
                messageId={message.id}
              />
            )}
            {showErrorDetails && (
              <AssistantErrorDetails
                code={errorCode}
                origin={errorOrigin}
                category={errorCategory}
                stepId={errorStepId}
                diagnostics={errorDiagnostics}
              />
            )}
            {bodyExtra}
            <AssistantPostActions
              message={message}
              content={displayContent}
              isMessageRunning={isMessageRunning}
              isStreaming={isStreaming}
              canRetry={!!isLast && !isMessageRunning && !!onRetry}
              retryDisabled={retryDisabled}
              retryDisabledTitle={retryDisabledTitle}
              onRetry={onRetry ? () => onRetry(message.id) : undefined}
              feedbackCardVisible={feedbackState.feedbackCardVisible}
              feedbackDone={feedbackState.feedbackDone}
              feedbackSessionId={currentSessionId || undefined}
              feedbackMessageId={feedbackMessageId}
              feedbackRunId={assistantVm?.feedbackData?.run_id ?? message.feedbackData?.run_id}
              thumbsState={feedbackState.thumbsState}
              onThumbsUp={feedbackState.handleThumbsUp}
              onThumbsDown={feedbackState.handleThumbsDown}
              onFeedbackSubmitted={feedbackState.handleFeedbackSubmitted}
              followUpQuestions={isLast ? followUpQuestions : undefined}
              followUpDisabled={followUpDisabled}
              onFollowUpSelect={onFollowUpSelect}
            />
          </>
        )}

      <DislikeModal
        isOpen={feedbackState.dislikeModalOpen}
        anchorRect={feedbackState.dislikeAnchorRect}
        onClose={() => feedbackState.setDislikeModalOpen(false)}
        onSubmit={feedbackState.handleDislikeSubmit}
      />

    </AssistantMessageFrame>
  );
});

AgentMessage.displayName = 'AgentMessage';
