import React from 'react';
import { MessageList } from './MessageList';
import type { AnswerSource, ChatMessage, FollowUpQuestionItem, FollowUpQuestionsData, QuestionData, ToolUsePendingPayload } from '../../types';
import type { SessionRuntimeStore } from '../../stores/sessionRuntimeStore';
import type { ChatAgentDisplay } from './chatDisplayContext';
import type { ChatMessageVM } from '../../conversation/model/viewTypes';
import { AgentHomeBackground } from './Home/AgentHomeBackground';

interface ChatThreadPaneProps {
  messages: ChatMessage[];
  sessionLoading?: boolean;
  loadingFallback?: React.ReactNode;
  emptyHeader?: React.ReactNode;
  emptyState: React.ReactNode;
  emptyFooter?: React.ReactNode;
  messageOverlay?: React.ReactNode;
  inputOverlay?: React.ReactNode;
  threadMessageFooter?: (message: ChatMessage, runtimeMessage?: ChatMessageVM) => React.ReactNode;
  threadFooter?: React.ReactNode;
  stickToBottomSignal?: number;
  stickToBottomDurationMs?: number;
  onHeaderGlassActiveChange?: (active: boolean) => void;
  inputArea: React.ReactNode;
  runtimeStore?: SessionRuntimeStore;
  runtimeMessages?: ChatMessageVM[];
  agentDisplay?: ChatAgentDisplay;
  messageListSessionKey?: string | null;
  sessionIdOverride?: string | null;
  connectionError?: string | null;
  onReconnect?: () => void;
  onQuestionSubmit?: (answers: Record<string, string | string[]>, questionData?: QuestionData) => boolean | void | Promise<boolean | void>;
  onPlanApprove?: () => void;
  onPlanFeedback?: (feedback: string) => void;
  onOpenRoundtablePanel?: (sessionId: string) => void;
  onToolApproval?: (requestId: string, decision: { approved: boolean | 'refine'; refine_comment?: string }) => void;
  onViewSkillDetail?: (payload: ToolUsePendingPayload) => void;
  onRetry?: (messageId: string) => void;
  retryDisabled?: boolean;
  retryDisabledTitle?: string;
  onSourcesOpen?: (message: ChatMessage, sources: AnswerSource[]) => void;
  onFollowUpSelect?: (message: ChatMessage, item: FollowUpQuestionItem, followUpQuestions?: FollowUpQuestionsData) => void;
}

export const ChatThreadPane: React.FC<ChatThreadPaneProps> = ({
  messages,
  sessionLoading = false,
  loadingFallback,
  emptyHeader,
  emptyState,
  emptyFooter,
  messageOverlay,
  inputOverlay,
  threadMessageFooter,
  threadFooter,
  stickToBottomSignal = 0,
  stickToBottomDurationMs = 500,
  onHeaderGlassActiveChange,
  inputArea,
  runtimeStore,
  runtimeMessages,
  agentDisplay,
  messageListSessionKey,
  sessionIdOverride,
  connectionError,
  onReconnect,
  onQuestionSubmit,
  onPlanApprove,
  onPlanFeedback,
  onOpenRoundtablePanel,
  onToolApproval,
  onViewSkillDetail,
  onRetry,
  retryDisabled = false,
  retryDisabledTitle,
  onSourcesOpen,
  onFollowUpSelect,
}) => {
  const isEmptyThread = !sessionLoading && messages.length === 0;
  const inputChrome = (
    <div style={{ position: 'relative' }} data-testid="chat-input-chrome">
      {connectionError && onReconnect && (
        <div
          style={{
            margin: '0 16px 8px 16px',
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid var(--danger-border-soft)',
            background: 'var(--danger-bg-soft)',
            color: 'var(--danger)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            fontSize: 13,
          }}
          data-testid="chat-connection-error"
        >
          <span>实时连接异常：{connectionError}</span>
          <button
            type="button"
            onClick={onReconnect}
            style={{
              border: '1px solid currentColor',
              background: 'transparent',
              color: 'inherit',
              borderRadius: 6,
              padding: '4px 10px',
              fontSize: 12,
              cursor: 'pointer',
            }}
            data-testid="chat-reconnect-btn"
          >
            重试连接
          </button>
        </div>
      )}

      {inputOverlay}
      {inputArea}
    </div>
  );

  if (isEmptyThread) {
    return (
      <AgentHomeBackground
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {emptyHeader}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 64,
            padding: 32,
            boxSizing: 'border-box',
          }}
          data-testid="chat-empty-thread"
        >
          <div style={{ width: '100%' }}>
            {emptyState}
          </div>
          <div style={{ width: '100%' }}>
            {inputChrome}
          </div>
        </div>
        {messageOverlay}
      </AgentHomeBackground>
    );
  }

  const content = (
    <>
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
          {sessionLoading && messages.length === 0 ? (
            loadingFallback ?? null
          ) : messages.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
              <div style={{ flex: 1 }}>{emptyState}</div>
              {emptyFooter}
            </div>
          ) : (
            <MessageList
              key={messageListSessionKey ?? sessionIdOverride ?? 'message-list'}
              messages={messages}
              runtimeStore={runtimeStore}
              runtimeMessages={runtimeMessages}
              agentDisplay={agentDisplay}
              sessionIdOverride={sessionIdOverride}
              onQuestionSubmit={onQuestionSubmit}
              onPlanApprove={onPlanApprove}
              onPlanFeedback={onPlanFeedback}
              onOpenRoundtablePanel={onOpenRoundtablePanel}
              onToolApproval={onToolApproval}
              onViewSkillDetail={onViewSkillDetail}
              onRetry={onRetry}
              retryDisabled={retryDisabled}
              retryDisabledTitle={retryDisabledTitle}
              onSourcesOpen={onSourcesOpen}
              onFollowUpSelect={onFollowUpSelect}
              messageTrailingContent={threadMessageFooter}
              trailingContent={threadFooter}
              stickToBottomSignal={stickToBottomSignal}
              stickToBottomDurationMs={stickToBottomDurationMs}
              onHeaderGlassActiveChange={onHeaderGlassActiveChange}
            />
          )}
        </div>
        {messageOverlay}
      </div>

      {inputChrome}
    </>
  );

  return content;
};
