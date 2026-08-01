import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  revokeFeedback,
  submitThumbsDown,
  submitThumbsUp,
  type FeedbackChoice,
} from '../../api/feedback';
import type { FeedbackEventData, ThumbsState } from '../../types';

export interface FeedbackPopoverAnchorRect {
  top: number;
  left: number;
  bottom: number;
  width: number;
  height: number;
}

interface UseMessageFeedbackStateOptions {
  sessionId?: string | null;
  messageId: string;
  localMessageId: string;
  feedbackData?: FeedbackEventData;
}

function storageGet(key: string): string | null {
  return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
}

function storageSet(key: string, value: string) {
  if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
}

function storageRemove(key: string) {
  if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
}

function thumbsStateFromStored(stored: string | null): ThumbsState {
  if (stored === 'thumbs_up') return 'liked';
  if (stored === 'thumbs_down') return 'disliked';
  return 'none';
}

export function useMessageFeedbackState({
  sessionId,
  messageId,
  localMessageId,
  feedbackData,
}: UseMessageFeedbackStateOptions) {
  const storageKey = useMemo(
    () => `moss:feedback:v1:${sessionId || ''}:${messageId}`,
    [messageId, sessionId],
  );
  const feedbackCardKey = useMemo(
    () => `moss:feedback-card:v1:${sessionId || ''}:${localMessageId}`,
    [localMessageId, sessionId],
  );
  const [storedChoice, setStoredChoice] = useState(() => storageGet(storageKey));
  const [dislikeModalOpen, setDislikeModalOpen] = useState(false);
  const [dislikeAnchorRect, setDislikeAnchorRect] = useState<FeedbackPopoverAnchorRect | null>(null);

  useEffect(() => {
    setStoredChoice(storageGet(storageKey));
  }, [storageKey]);

  const thumbsState = thumbsStateFromStored(storedChoice);
  const feedbackDone = storedChoice === 'solved' || storedChoice === 'partial' || storedChoice === 'unsolved';
  const feedbackCardVisible = !storedChoice && (
    !!feedbackData?.visible || !!storageGet(feedbackCardKey)
  );

  const handleThumbsUp = useCallback(() => {
    const sid = sessionId || '';
    if (thumbsState === 'liked') {
      storageRemove(storageKey);
      setStoredChoice(null);
      revokeFeedback(sid, messageId).catch(() => {});
      return;
    }
    storageSet(storageKey, 'thumbs_up');
    setStoredChoice('thumbs_up');
    submitThumbsUp(sid, messageId, feedbackData?.run_id).catch(() => {});
  }, [feedbackData?.run_id, messageId, sessionId, storageKey, thumbsState]);

  const handleThumbsDown = useCallback((anchorRect?: DOMRect | null) => {
    const sid = sessionId || '';
    if (thumbsState === 'disliked') {
      storageRemove(storageKey);
      setStoredChoice(null);
      setDislikeAnchorRect(null);
      revokeFeedback(sid, messageId).catch(() => {});
      return;
    }
    setDislikeAnchorRect(anchorRect ? {
      top: anchorRect.top,
      left: anchorRect.left,
      bottom: anchorRect.bottom,
      width: anchorRect.width,
      height: anchorRect.height,
    } : null);
    setDislikeModalOpen(true);
  }, [messageId, sessionId, storageKey, thumbsState]);

  const handleDislikeSubmit = useCallback(async (reasons: string[], comment: string) => {
    const sid = sessionId || '';
    storageSet(storageKey, 'thumbs_down');
    setStoredChoice('thumbs_down');
    setDislikeModalOpen(false);
    setDislikeAnchorRect(null);
    try {
      await submitThumbsDown(sid, messageId, reasons, comment || undefined, feedbackData?.run_id);
    } catch {
      // 维持现有乐观提交行为：API 失败不清 localStorage。
    }
  }, [feedbackData?.run_id, messageId, sessionId, storageKey]);

  const handleFeedbackSubmitted = useCallback((choice: FeedbackChoice) => {
    storageSet(storageKey, choice);
    storageRemove(feedbackCardKey);
    setStoredChoice(choice);
  }, [feedbackCardKey, storageKey]);

  return {
    thumbsState,
    feedbackCardVisible,
    feedbackDone,
    dislikeModalOpen,
    dislikeAnchorRect,
    setDislikeModalOpen,
    handleThumbsUp,
    handleThumbsDown,
    handleDislikeSubmit,
    handleFeedbackSubmitted,
  };
}
