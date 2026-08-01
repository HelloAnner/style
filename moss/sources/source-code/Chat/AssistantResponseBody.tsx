import { memo } from 'react';
import { Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { MarkdownContent } from './MarkdownContent';
import { WidgetPendingCard } from './WidgetPendingCard';
import { WidgetRenderer } from './WidgetRenderer';
import { WidgetStreamRenderer } from './WidgetStreamRenderer';
import type { PendingToolCall, WidgetRenderData } from '../../types';

interface AssistantResponseBodyProps {
  content: string;
  realtime?: boolean;
  isMessageRunning?: boolean;
  messageIsStreaming?: boolean;
  widgets: WidgetRenderData[];
  showStreamingWidgetSlot?: boolean;
  activeStreamingWidget?: PendingToolCall | null;
  activeStreamingWidgetId?: string | null;
  emptyRunningText?: string;
  messageId: string;
  processTraceAnimationId?: string;
}

export const AssistantResponseBody = memo(function AssistantResponseBody({
  content,
  realtime = false,
  isMessageRunning = false,
  messageIsStreaming = false,
  widgets,
  showStreamingWidgetSlot = false,
  activeStreamingWidget,
  activeStreamingWidgetId,
  emptyRunningText,
  messageId,
  processTraceAnimationId,
}: AssistantResponseBodyProps) {
  const hasAnswerContent = content.trim().length > 0;
  const hasWidgets = widgets.length > 0;
  const activeWidgetStream = activeStreamingWidget?.widgetStream;
  const shouldRenderWidgetStream = Boolean(activeWidgetStream && !activeWidgetStream.aborted);
  const shouldRenderEmptyRunningState = Boolean(
    emptyRunningText
    && isMessageRunning
    && !hasAnswerContent
    && !hasWidgets
    && !showStreamingWidgetSlot,
  );
  const showStreamingStatus = Boolean(isMessageRunning && hasAnswerContent && messageIsStreaming);

  return (
    <>
      <AnimatePresence initial={false}>
        {hasAnswerContent && (
          <motion.div
            key={processTraceAnimationId || 'assistant-response'}
            initial={false}
            animate={{ height: 'auto', opacity: 1, y: 0, marginTop: 8 }}
            exit={processTraceAnimationId
              ? { height: 0, opacity: 0, y: -12, marginTop: 0 }
              : undefined}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            style={{
              overflow: 'hidden',
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box',
            }}
          >
            <div
              className="relative assistant-response-body"
              style={{
                padding: showStreamingStatus ? '16px 18px 34px' : '16px 18px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 8,
                color: 'var(--text-secondary)',
                width: '100%',
                maxWidth: '100%',
                boxSizing: 'border-box',
              }}
              data-testid="assistant-response-body"
            >
              <div className="break-words" style={{ fontSize: 14, lineHeight: '22px' }}>
                <MarkdownContent content={content} realtime={realtime} />
              </div>
              {showStreamingStatus && (
                <div
                  className="assistant-streaming-status"
                  aria-live="polite"
                >
                  <span className="streaming-pulse-dot" aria-hidden="true" />
                  <span>生成中</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {shouldRenderEmptyRunningState && (
        <div
          className="inline-flex items-center"
          style={{
            height: 34,
            gap: 8,
            padding: '4px 8px',
            color: 'var(--text-muted)',
            fontSize: 14,
            lineHeight: '22px',
            fontWeight: 500,
          }}
          role="status"
          aria-live="polite"
          data-testid="assistant-empty-running-state"
        >
          <Loader2 size={15} className="animate-spin" aria-hidden="true" />
          <span>{emptyRunningText}</span>
        </div>
      )}

      {(hasWidgets || showStreamingWidgetSlot) && (
        <div style={{ alignSelf: 'stretch', marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }} data-testid="assistant-widget-list">
          {widgets.map((widget, index) => (
            <WidgetRenderer
              key={`widget-${messageId}-${index}`}
              data={widget}
            />
          ))}
          {showStreamingWidgetSlot && widgets.length === 0 && activeStreamingWidget && (
            shouldRenderWidgetStream && activeWidgetStream ? (
              <WidgetStreamRenderer
                key={`widget-stream-${messageId}-${activeStreamingWidgetId}`}
                tool={activeStreamingWidget}
                stream={activeWidgetStream}
              />
            ) : (
              <WidgetPendingCard
                key={`widget-pending-${messageId}-${activeStreamingWidgetId}`}
                toolName={activeStreamingWidget.name === 'graph_3d' ? 'graph_3d' : 'show_widget'}
                startedAt={activeStreamingWidget.started_at}
                argPreview={activeStreamingWidget.argPreview}
              />
            )
          )}
        </div>
      )}
    </>
  );
});
