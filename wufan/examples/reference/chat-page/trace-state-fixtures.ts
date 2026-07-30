import type {
  WufanReasoningTrace,
  WufanTraceStatus,
  WufanTraceStepStatus,
} from './types';

function stepStatusFor(
  status: WufanTraceStatus,
): WufanTraceStepStatus {
  if (status === 'pending') return 'pending';
  if (status === 'running') return 'running';
  if (status === 'completed') return 'completed';
  if (status === 'failed') return 'failed';
  if (status === 'cancelled') return 'cancelled';
  return 'timeout';
}

export function makeTraceStateFixture(
  status: WufanTraceStatus,
): WufanReasoningTrace {
  const stepStatus = stepStatusFor(status);
  const isActive = status === 'pending' || status === 'running';
  const terminalSummary = {
    completed: 'MOSS-企业列表搜索',
    failed: 'MOSS-企业列表搜索 · 企业服务暂时不可用',
    cancelled: 'MOSS-企业列表搜索 · 已取消',
    timeout: 'MOSS-企业列表搜索 · 已超时',
    pending: 'MOSS-企业列表搜索 · 等待执行',
    running: 'MOSS-企业列表搜索',
  }[status];
  return {
    id: `trace_fixture_${status}`,
    status,
    durationMs: isActive ? undefined : status === 'completed' ? 521000 : 86000,
    initialExpanded: true,
    steps: [
      {
        id: `note_fixture_${status}`,
        kind: 'note',
        seq: 10,
        content:
          status === 'pending'
            ? '任务已进入执行队列，正在准备企业主体核验。'
            : status === 'running'
              ? '正在并行核验企业主体，结果会按完成顺序持续更新。'
              : status === 'completed'
                ? '主体已锁定，三个企业信息均已核验完成。'
                : status === 'failed'
                  ? '主体核验未完成，企业信息服务返回异常。'
                  : status === 'cancelled'
                    ? '用户终止了本轮主体核验。'
                    : '主体核验超过执行时限，任务已停止。',
        status:
          status === 'pending' || status === 'running'
            ? 'running'
            : status,
      },
      {
        id: `tool_fixture_${status}`,
        kind: 'tool',
        seq: 11,
        toolName: 'enterprise_search',
        displayName: 'MOSS-企业列表搜索',
        summary: terminalSummary,
        status: stepStatus,
        icon: 'search',
        durationMs: isActive ? undefined : 2200,
      },
    ],
    sources:
      status === 'completed'
        ? [
            {
              id: 'fixture_source_01',
              title: '企业基本信息',
              url: 'https://example.com/company',
              domain: 'example.com',
            },
          ]
        : [],
  };
}

export const traceStateFixtures = {
  pending: makeTraceStateFixture('pending'),
  running: makeTraceStateFixture('running'),
  completed: makeTraceStateFixture('completed'),
  failed: makeTraceStateFixture('failed'),
  cancelled: makeTraceStateFixture('cancelled'),
  timeout: makeTraceStateFixture('timeout'),
} satisfies Record<WufanTraceStatus, WufanReasoningTrace>;
