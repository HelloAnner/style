import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import type {
  WufanProcessNoteStep,
  WufanReasoningTrace as WufanReasoningTraceData,
  WufanToolCallStep,
  WufanTraceIcon,
} from './types';

const PREVIEW_TEXT_MAX_WIDTH = 96;

const TOOL_ICON_PATHS: Record<
  WufanTraceIcon,
  { width: number; height: number; viewBox: string; d: string }
> = {
  read: {
    width: 12.5,
    height: 14,
    viewBox: '0 0 12.5 14',
    d: 'M10.5 0C11.6046 0 12.5.895431 12.5 2V12C12.5 13.1046 11.6046 14 10.5 14H2C.895431 14 0 13.1046 0 12V2C0 .895431.895431 0 2 0H10.5ZM2.125 1.125C1.57272 1.125 1.125 1.57272 1.125 2.125V11.875C1.125 12.4273 1.57272 12.875 2.125 12.875H3.25V1.125H2.125ZM4.375 12.875H10.375C10.9273 12.875 11.375 12.4273 11.375 11.875V2.125C11.375 1.57272 10.9273 1.125 10.375 1.125H4.375V12.875ZM9.3125 5.875C9.62316 5.875 9.875 6.12684 9.875 6.4375C9.875 6.74816 9.62316 7 9.3125 7H6.4375C6.12684 7 5.875 6.74816 5.875 6.4375C5.875 6.12684 6.12684 5.875 6.4375 5.875H9.3125ZM9.3125 3.25C9.62316 3.25 9.875 3.50184 9.875 3.8125C9.875 4.12316 9.62316 4.375 9.3125 4.375H6.4375C6.12684 4.375 5.875 4.12316 5.875 3.8125C5.875 3.50184 6.12684 3.25 6.4375 3.25H9.3125Z',
  },
  search: {
    width: 13.1413,
    height: 13.0021,
    viewBox: '0 0 13.1413 13.0021',
    d: 'M3.32065.871903C6.26543-.828269 9.9875.0377366 11.8977 2.77598L12.2974 2.54518C12.5665 2.38985 12.9105 2.48203 13.0658 2.75107C13.2212 3.02011 13.129 3.36413 12.8599 3.51946L12.4602 3.75026C13.8765 6.77365 12.7654 10.4301 9.82065 12.1302C6.87586 13.8304 3.15379 12.9644 1.24361 10.2262L.843844 10.457C.574804 10.6123.230785 10.5201.0754546 10.2511C-.0798755 9.98203.0123043 9.63801.281344 9.48268L.681109 9.25187C-.735191 6.22848.37586 2.57208 3.32065.871903ZM5.45422 7.79515C6.22611 9.01897 7.08917 9.97165 7.86282 10.5561C8.30094 10.887 8.66496 11.0656 8.92927 11.1364C9.05711 11.1706 9.14283 11.1746 9.19246 11.171C9.2378 11.1677 9.25412 11.1583 9.25815 11.156C9.26217 11.1536 9.27844 11.1442 9.30399 11.1066C9.33195 11.0654 9.37135 10.9892 9.40563 10.8613C9.47648 10.5971 9.50386 10.1925 9.4363 9.64764C9.317 8.68541 8.92348 7.46164 8.24957 6.18126L5.45422 7.79515ZM2.22227 9.66112C3.47547 11.39 5.61584 12.1822 7.6426 11.7695C6.60158 11.1219 5.45517 9.91506 4.47931 8.35802L2.22227 9.66112ZM9.22448 5.6184C10.085 7.24205 10.5569 8.83828 10.5972 10.0637C11.968 8.51475 12.3522 6.26504 11.4815 4.31529L9.22448 5.6184ZM2.544 2.93846C1.17323 4.48736.78913 6.73711 1.65977 8.68684L3.91681 7.38374C3.05629 5.76008 2.58435 4.16384 2.544 2.93846ZM3.88315 1.84618C3.87912 1.84851 3.86285 1.85795 3.8373 1.89556C3.80934 1.93672 3.76994 2.01296 3.73567 2.14079C3.66481 2.40508 3.63743 2.8096 3.70499 3.3545C3.82429 4.31672 4.21781 5.54049 4.89172 6.82087L7.68707 5.20698C6.91518 3.98317 6.05212 3.03048 5.27846 2.44605C4.84035 2.11509 4.47633 1.93655 4.21202 1.86576C4.08418 1.83153 3.99846 1.82753 3.94883 1.83116C3.90349 1.83448 3.88717 1.84386 3.88315 1.84618ZM5.4986 1.23262C6.53964 1.88024 7.6861 3.08704 8.66198 4.64412L10.919 3.34102C9.66581 1.61213 7.52539.819919 5.4986 1.23262Z',
  },
  draw: {
    width: 12.6922,
    height: 12.9905,
    viewBox: '0 0 12.6922 12.9905',
    d: 'M3.52533 5.99049C3.83598 5.99049 4.08782 6.24234 4.08783 6.55299C4.08783 6.86365 3.83599 7.11549 3.52533 7.11549H2.09375C1.55873 7.11549 1.12501 7.54922 1.125 8.08424C1.125 8.61927 1.55872 9.05299 2.09375 9.05299H10.7188C11.8061 9.05299 12.6875 9.93444 12.6875 11.0217C12.6875 12.109 11.8061 12.9905 10.7188 12.9905H5.49585C5.18519 12.9905 4.93335 12.7386 4.93335 12.428C4.93336 12.1173 5.18519 11.8655 5.49585 11.8655H10.7188C11.1847 11.8655 11.5625 11.4877 11.5625 11.0217C11.5625 10.5558 11.1847 10.178 10.7188 10.178H2.09375C.937403 10.178 0 9.24058 0 8.08424C0 6.9279.937409 5.99049 2.09375 5.99049H3.52533ZM8.89917.458262C9.50892-.152416 10.498-.152807 11.1082.457408L12.2344 1.58363C12.8445 2.1938 12.8449 3.18344 12.2352 3.79408L9.16394 6.87013C8.87191 7.1626 8.47596 7.32738 8.06281 7.32838L6.93469 7.33113C6.06955 7.33321 5.36749 6.63115 5.36896 5.76539L5.37091 4.63636C5.37162 4.22298 5.53597 3.82674 5.82794 3.53431L8.89917.458262ZM10.3133 1.25349C10.1424 1.08263 9.86543 1.0827 9.6947 1.25367L6.62347 4.32972C6.54172 4.4116 6.49568 4.52263 6.49548 4.63838L6.49365 5.76728C6.49324 6.00969 6.68977 6.20628 6.93201 6.2057L8.06012 6.20295C8.17579 6.20266 8.28665 6.15654 8.36841 6.07466L11.4396 2.99861C11.6104 2.82763 11.6103 2.5505 11.4395 2.37965L10.3133 1.25349Z',
  },
  warning: {
    width: 14,
    height: 14,
    viewBox: '0 0 14 14',
    d: 'M7 0C10.866 0 14 3.13401 14 7C14 10.866 10.866 14 7 14C3.13401 14 0 10.866 0 7C0 3.13401 3.13401 0 7 0ZM7 1.125C3.75533 1.125 1.125 3.75533 1.125 7C1.125 10.2447 3.75533 12.875 7 12.875C10.2447 12.875 12.875 10.2447 12.875 7C12.875 3.75533 10.2447 1.125 7 1.125ZM7 9.375C7.55228 9.375 8 9.82272 8 10.375C8 10.9273 7.55228 11.375 7 11.375C6.44772 11.375 6 10.9273 6 10.375C6 9.82272 6.44772 9.375 7 9.375ZM7 2.625C7.41421 2.625 7.75 2.96079 7.75 3.375V6.875C7.75 7.28921 7.41421 7.625 7 7.625C6.58579 7.625 6.25 7.28921 6.25 6.875V3.375C6.25 2.96079 6.58579 2.625 7 2.625Z',
  },
};

type TraceGroup = {
  note?: WufanProcessNoteStep;
  tools: WufanToolCallStep[];
};

function formatDuration(ms?: number): string | null {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return null;
  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${Math.max(1, Math.round(seconds))}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
}

function formatToolDuration(ms?: number): string | null {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return null;
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function terminalText(trace: WufanReasoningTraceData): string {
  if (trace.status === 'timeout') return '任务执行超时';
  if (trace.status === 'failed') return '任务执行失败';
  if (trace.status === 'cancelled') return '任务已取消';
  const duration = formatDuration(trace.durationMs);
  return duration ? `已完成，耗时${duration}` : '已完成';
}

function splitSentences(text: string): string[] {
  return text.match(/[^。！？!?；;]+[。！？!?；;]?/g)?.map((part) => part.trim()).filter(Boolean) ?? [];
}

function previewText(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (Array.from(normalized).length <= PREVIEW_TEXT_MAX_WIDTH) return normalized;
  let preview = '';
  for (const sentence of splitSentences(normalized)) {
    const next = `${preview}${sentence}`;
    if (Array.from(next).length > PREVIEW_TEXT_MAX_WIDTH) break;
    preview = next;
  }
  return preview || Array.from(normalized).slice(0, PREVIEW_TEXT_MAX_WIDTH).join('').trimEnd();
}

function buildGroups(trace: WufanReasoningTraceData): TraceGroup[] {
  const sorted = trace.steps.slice().sort((a, b) => a.seq - b.seq);
  const groups: TraceGroup[] = [];
  for (const step of sorted) {
    if (step.kind === 'note') {
      groups.push({ note: step, tools: [] });
      continue;
    }
    const current = groups[groups.length - 1];
    if (!current || (!current.note && current.tools.length > 0)) {
      groups.push({ tools: [step] });
    } else {
      current.tools.push(step);
    }
  }
  return groups;
}

function Chevron({ expanded }: { expanded: boolean }): React.ReactElement {
  return (
    <svg
      className="wufan-trace-chevron"
      data-expanded={expanded ? 'true' : 'false'}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M4.37944 4.37944C4.13536 4.62352 3.73964 4.62352 3.49556 4.37944L.183058 1.06694C-.0610195.822864-.0610194.427136.183058.183058C.427136-.0610195.822864-.0610194 1.06694.183058L3.9375 3.05362L6.80806.183059C7.05214-.0610189 7.44786-.0610188 7.69194.183059C7.93602.427137 7.93602.822865 7.69194 1.06694L4.37944 4.37944Z"
        fill="currentColor"
        opacity=".72"
        transform="translate(4.0625 5.6875)"
      />
    </svg>
  );
}

function ProcessStatusIcon({
  status,
}: {
  status: WufanProcessNoteStep['status'];
}): React.ReactElement {
  if (status === 'running') {
    return <span className="wufan-trace-spinner" aria-label="进行中" />;
  }
  if (status === 'failed' || status === 'cancelled' || status === 'timeout') {
    const icon = TOOL_ICON_PATHS.warning;
    return (
      <svg width={icon.width} height={icon.height} viewBox={icon.viewBox} fill="none" aria-label="失败">
        <path d={icon.d} fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-label="已完成">
      <circle cx="8" cy="8" r="8" fill="currentColor" />
      <path
        d="M4.25 8.1 6.75 10.5 11.75 5.5"
        stroke="var(--wf-bg-primary)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const ProcessNote = memo(function ProcessNote({
  note,
}: {
  note: WufanProcessNoteStep;
}): React.ReactElement {
  const [showFull, setShowFull] = useState(false);
  const preview = useMemo(() => previewText(note.content), [note.content]);
  const hasOverflow = Array.from(note.content.replace(/\s+/g, ' ').trim()).length > PREVIEW_TEXT_MAX_WIDTH;
  return (
    <div className="wufan-trace-note" data-status={note.status}>
      <span className="wufan-trace-note__icon">
        <ProcessStatusIcon status={note.status} />
      </span>
      <span className="wufan-trace-note__copy">
        <span>{showFull ? note.content : preview}</span>
        {hasOverflow && !showFull ? (
          <button type="button" onClick={() => setShowFull(true)} aria-label="展示完整过程说明">
            更多
          </button>
        ) : null}
      </span>
    </div>
  );
});

function resolveToolIcon(tool: WufanToolCallStep): WufanTraceIcon {
  if (
    tool.status === 'failed'
    || tool.status === 'cancelled'
    || tool.status === 'timeout'
  ) return 'warning';
  if (tool.icon) return tool.icon;
  const key = `${tool.toolName} ${tool.displayName} ${tool.summary}`.toLowerCase();
  if (key.includes('read') || key.includes('阅读')) return 'read';
  if (
    key.includes('write')
    || key.includes('edit')
    || key.includes('patch')
    || key.includes('写入')
    || key.includes('编辑')
    || key.includes('绘制')
  ) return 'draw';
  return 'search';
}

const ToolRow = memo(function ToolRow({
  tool,
  showDuration,
}: {
  tool: WufanToolCallStep;
  showDuration: boolean;
}): React.ReactElement {
  const running = tool.status === 'pending' || tool.status === 'running' || tool.status === 'streaming';
  const icon = TOOL_ICON_PATHS[resolveToolIcon(tool)];
  const duration = showDuration && !running ? formatToolDuration(tool.durationMs) : null;
  return (
    <div className="wufan-trace-tool" data-status={tool.status}>
      <span className="wufan-trace-tool__icon">
        {running ? (
          <span className="wufan-trace-spinner" aria-label="工具运行中" />
        ) : (
          <svg width={icon.width} height={icon.height} viewBox={icon.viewBox} fill="none" aria-hidden="true">
            <path d={icon.d} fill="currentColor" />
          </svg>
        )}
      </span>
      <span className="wufan-trace-tool__copy">{tool.summary || tool.displayName}</span>
      {duration ? <span className="wufan-trace-tool__duration">{duration}</span> : null}
    </div>
  );
});

export const WufanReasoningTrace = memo(function WufanReasoningTrace({
  trace,
  showToolDurations = false,
  onSourcesClick,
}: {
  trace: WufanReasoningTraceData;
  showToolDurations?: boolean;
  onSourcesClick?: () => void;
}): React.ReactElement | null {
  const running = trace.status === 'pending' || trace.status === 'running';
  const [expanded, setExpanded] = useState(running || Boolean(trace.initialExpanded));
  const previousRunning = useRef(running);
  const groups = useMemo(() => buildGroups(trace), [trace]);
  const sourceCount = trace.sources?.length ?? 0;

  useEffect(() => {
    if (running) setExpanded(true);
    if (previousRunning.current && !running) setExpanded(false);
    previousRunning.current = running;
  }, [running]);

  if (!groups.length && !running) return null;

  return (
    <section className="wufan-reasoning-trace" aria-label="工作过程">
      {running ? (
        <div className="wufan-trace-running">
          <span>正在处理中...</span>
        </div>
      ) : (
        <div className="wufan-trace-summary">
          <button
            type="button"
            className="wufan-trace-summary__toggle"
            aria-expanded={expanded}
            onClick={() => setExpanded((current) => !current)}
          >
            <span>{terminalText(trace)}</span>
            <Chevron expanded={expanded} />
          </button>
          {sourceCount > 0 && onSourcesClick ? (
            <button
              type="button"
              className="wufan-trace-summary__sources"
              onClick={onSourcesClick}
            >
              {sourceCount} 信息来源
            </button>
          ) : null}
        </div>
      )}

      {expanded ? (
        <div className="wufan-trace-chain" data-running={running ? 'true' : 'false'}>
          {groups.map((group, index) => {
            const hasFollowingNote = groups.slice(index + 1).some((item) => item.note);
            const showConnector = Boolean(group.note && (group.tools.length > 0 || hasFollowingNote));
            return (
              <div
                className={`wufan-trace-group${group.note ? ' has-note' : ''}`}
                key={group.note?.id ?? `tools-${index}`}
              >
                {showConnector ? (
                  <span
                    className="wufan-trace-group__connector"
                    data-continues={hasFollowingNote ? 'true' : 'false'}
                    aria-hidden="true"
                  />
                ) : null}
                {group.note ? <ProcessNote note={group.note} /> : null}
                {group.tools.length > 0 ? (
                  <div className={`wufan-trace-tools${group.note ? ' is-nested' : ''}`}>
                    {group.tools.map((tool) => (
                      <ToolRow
                        key={tool.id}
                        tool={tool}
                        showDuration={showToolDurations}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
});
