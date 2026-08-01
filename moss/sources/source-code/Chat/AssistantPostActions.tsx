import { memo } from 'react';
import type {
  ChatMessage,
  FollowUpQuestionItem,
  FollowUpQuestionsData,
  ThumbsState,
} from '../../types';
import type { FeedbackChoice } from '../../api/feedback';
import { FollowUpQuestions } from './FollowUpQuestions';
import MessageActions from './MessageActions';

interface AssistantPostActionsProps {
  message: ChatMessage;
  content: string;
  isMessageRunning: boolean;
  isStreaming: boolean;
  canRetry: boolean;
  retryDisabled?: boolean;
  retryDisabledTitle?: string;
  onRetry?: () => void;
  feedbackCardVisible: boolean;
  feedbackDone: boolean;
  feedbackSessionId?: string;
  feedbackMessageId: string;
  feedbackRunId?: string;
  thumbsState: ThumbsState;
  onThumbsUp: () => void;
  onThumbsDown: (anchorRect?: DOMRect | null) => void;
  onFeedbackSubmitted: (choice: FeedbackChoice) => void;
  followUpQuestions?: FollowUpQuestionsData;
  followUpDisabled?: boolean;
  onFollowUpSelect?: (message: ChatMessage, item: FollowUpQuestionItem, followUpQuestions?: FollowUpQuestionsData) => void;
}

export const AssistantPostActions = memo(function AssistantPostActions({
  message,
  content,
  isMessageRunning,
  isStreaming,
  canRetry,
  retryDisabled = false,
  retryDisabledTitle,
  onRetry,
  feedbackCardVisible,
  feedbackDone,
  feedbackSessionId,
  feedbackMessageId,
  feedbackRunId,
  thumbsState,
  onThumbsUp,
  onThumbsDown,
  onFeedbackSubmitted,
  followUpQuestions,
  followUpDisabled = false,
  onFollowUpSelect,
}: AssistantPostActionsProps) {
  const hasFollowUpQuestions = Boolean(followUpQuestions?.items?.length);

  return (
    <>
      {!isMessageRunning && content && (
        <MessageActions
          content={content}
          canRetry={canRetry}
          retryDisabled={retryDisabled}
          retryDisabledTitle={retryDisabledTitle}
          onRetry={onRetry}
          feedbackCardVisible={feedbackCardVisible}
          feedbackDone={feedbackDone}
          feedbackSessionId={feedbackSessionId}
          feedbackMessageId={feedbackMessageId}
          feedbackRunId={feedbackRunId}
          thumbsState={thumbsState}
          onThumbsUp={onThumbsUp}
          onThumbsDown={onThumbsDown}
          onFeedbackSubmitted={onFeedbackSubmitted}
          testId="assistant-post-actions-message-actions"
        />
      )}
      {!isStreaming && hasFollowUpQuestions && followUpQuestions && (
        <FollowUpQuestions
          data={followUpQuestions}
          disabled={followUpDisabled}
          onSelect={(item) => onFollowUpSelect?.(message, item, followUpQuestions)}
          testId="assistant-post-actions-follow-up"
        />
      )}
    </>
  );
});
