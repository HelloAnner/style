/**
 * 管理后台「Agent 监管」- 会话记录 Tab
 *
 * 功能：
 * - 表格展示会话日志（Trace ID / 智能体名称 / 时间 / 类型 / 输入来源 / 用户名 /
 *   输入摘要 / 输出摘要 / 输出状态 / 消耗量 / 执行耗时 / Pipeline ID / 自动化触发方式）
 * - 通用筛选与对话专属筛选（chip 风格）
 * - 分页（每页 20/25/50/100，button chip 切换）
 * - 与看板记录共用分页、状态、金额、移动卡片和详情抽屉视觉
 *
 * @see src/api/billing.ts — listMessageLogs / getMessageLogDetail
 */

import React, { useEffect, useCallback, useState } from "react";
import { X } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  billingApi,
  type TenantMessageLogItem,
  type TenantMessageLogDetailResponse,
  type TenantMessageLogToolStep,
} from "../../../api/billing";
import { formatExecutionDuration } from "../../../utils/formatExecutionDuration";
import {
  CONVERSATION_STATUS_OPTIONS,
  formatUsageRecordAmount,
  formatUsageRecordTime,
  tdStyle,
  thStyle,
  UsageRecordsPagination,
  USAGE_RECORD_CHARGE_SOURCE_OPTIONS,
  UsageRecordStatusPill,
  usageRecordStatusLabel,
} from "./UsageRecordsControls";
import {
  AmountRangeField,
  DateRangeField,
  MultiSelectFilterField,
  ResetFilterButton,
  SelectFilterField,
  TextFilterField,
} from "./RecordFilterFields";
import "./usage-records.css";

// ── 工具函数 ──

function resolveTypeLabel(type: string | null | undefined): string {
  if (type === "user") return "消息";
  if (type === "automation") return "自动化";
  if (type === "mcp") return "mcp";
  if (type === "bot") return "机器人";
  return type ?? "-";
}

function resolveTriggerTypeLabel(
  type: string | null | undefined,
  triggerType: string | null | undefined,
): string {
  if (type !== "automation") return "非自动化";
  if (!triggerType) return "未记录";
  if (triggerType === "cron") return "定时";
  if (triggerType === "webhook") return "Webhook";
  if (triggerType === "event") return "Event";
  return triggerType;
}

function truncate(str: string | null | undefined, len = 40): string {
  if (!str) return "-";
  return str.length > len ? `${str.slice(0, len)}…` : str;
}

type ConversationRecordColumn = {
  key: string;
  label: string;
  width: number;
  feishuOnly?: boolean;
};

const CONVERSATION_RECORD_COLUMNS = [
  { key: "traceId", label: "Trace ID", width: 148 },
  { key: "agentName", label: "智能体名称", width: 120 },
  { key: "time", label: "时间", width: 156 },
  { key: "type", label: "类型", width: 70 },
  { key: "inputSource", label: "输入来源", width: 108 },
  { key: "userName", label: "用户名", width: 96 },
  { key: "inputSummary", label: "输入摘要", width: 190 },
  { key: "outputSummary", label: "输出摘要", width: 230 },
  { key: "outputStatus", label: "输出状态", width: 92 },
  { key: "chargeSource", label: "消耗来源", width: 104, feishuOnly: true },
  { key: "usageCredits", label: "消耗量", width: 84 },
  { key: "executionDuration", label: "执行耗时", width: 90 },
  { key: "pipelineId", label: "Pipeline ID", width: 120 },
  { key: "triggerType", label: "自动化触发方式", width: 124 },
] satisfies ConversationRecordColumn[];

function toIsoDateTime(value: string): string | null {
  if (!value) return null;
  const normalizedValue = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalizedValue);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

type ToolResultStatus =
  | "succeeded"
  | "failed"
  | "timeout"
  | "cancelled"
  | "running"
  | "unknown";

function normalizeToolResultStatus(status: string | null | undefined): ToolResultStatus {
  const normalized = status?.trim().toLowerCase();
  if (normalized === "success" || normalized === "succeeded" || normalized === "completed") {
    return "succeeded";
  }
  if (normalized === "error" || normalized === "failed") return "failed";
  if (normalized === "timeout" || normalized === "timed_out") return "timeout";
  if (normalized === "cancelled" || normalized === "canceled") return "cancelled";
  if (normalized === "running" || normalized === "started") return "running";
  return "unknown";
}

function resolveToolStatusPresentation(
  step: TenantMessageLogToolStep,
  apiPart: number | null | undefined,
): { label: string; tone: ToolResultStatus } {
  const status = normalizeToolResultStatus(step.status);
  if (status === "succeeded") {
    if (!step.billable) return { label: "调用成功", tone: status };
    return {
      label: (apiPart ?? 0) > 0 ? "调用成功 · 已计费" : "调用成功 · 未产生费用",
      tone: status,
    };
  }
  if (status === "failed") {
    return { label: step.billable ? "调用失败 · 未计费" : "调用失败", tone: status };
  }
  if (status === "timeout") {
    return { label: step.billable ? "调用超时 · 未计费" : "调用超时", tone: status };
  }
  if (status === "cancelled") {
    return { label: step.billable ? "调用取消 · 未计费" : "调用取消", tone: status };
  }
  if (status === "running") {
    return { label: step.billable ? "调用中 · 尚未计费" : "调用中", tone: status };
  }
  return { label: step.billable ? "状态未知 · 未计费" : "状态未知", tone: "unknown" };
}

function summarizeBillableTools(toolChain: TenantMessageLogToolStep[]): string | null {
  const billableSteps = toolChain.filter(step => step.billable);
  if (billableSteps.length === 0) return null;
  const succeeded = billableSteps.filter(
    step => normalizeToolResultStatus(step.status) === "succeeded",
  ).length;
  const failed = billableSteps.filter(step => {
    const status = normalizeToolResultStatus(step.status);
    return status === "failed" || status === "timeout" || status === "cancelled";
  }).length;
  const other = billableSteps.length - succeeded - failed;
  const otherSummary = other > 0 ? ` / 其他 ${other}` : "";
  return `${billableSteps.length} 次（成功 ${succeeded} / 失败 ${failed}${otherSummary}）`;
}

// ── 样式常量 ──

// ── 详情抽屉 ──

interface DetailDrawerProps {
  jobId: string | null;
  usageId: string | null;
  isFeishuProvider: boolean;
  onClose: () => void;
}

function DetailDrawer({ jobId, usageId, isFeishuProvider, onClose }: DetailDrawerProps) {
  const [detail, setDetail] = useState<TenantMessageLogDetailResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId && !usageId) {
      setDetail(null);
      return;
    }
    let canceled = false;
    setLoading(true);
    setError(null);
    const request = usageId
      ? billingApi.getUsageMessageLogDetail(usageId)
      : billingApi.getMessageLogDetail(jobId as string);
    request
      .then((res) => {
        if (!canceled) setDetail(res);
      })
      .catch(() => {
        if (!canceled) {
          setError(usageId ? "该使用详情不存在或不属于当前飞书租户" : "加载详情失败，请重试");
        }
      })
      .finally(() => {
        if (!canceled) setLoading(false);
      });
    return () => {
      canceled = true;
    };
  }, [jobId, usageId]);

  if (!jobId && !usageId) return null;

  const toolChain = detail?.toolChain ?? [];
  const billableToolSummary = summarizeBillableTools(toolChain);

  return (
    <div
      data-testid="agent-supervision-session-log-detail-drawer"
      className="usage-detail-backdrop"
      onMouseDown={onClose}
    >
      <aside
        data-testid="agent-supervision-session-log-detail-drawer-panel"
        className="usage-detail-drawer"
        aria-label="会话详情"
        onMouseDown={event => event.stopPropagation()}
      >
        <header>
          <div>
            <span className="usage-detail-kicker">对话使用详情</span>
            <h3>{detail?.agentName ?? (loading ? '加载中…' : '会话详情')}</h3>
          </div>
          <button type="button" aria-label="关闭详情" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="usage-detail-body">
          {loading && <div className="usage-detail-state">加载中…</div>}
          {error && <div className="usage-detail-state is-error">{error}</div>}
          {detail && !loading && (
            <>
              <section className="usage-detail-overview">
                <div><span>消耗量</span><strong>{formatUsageRecordAmount(detail.usageCredits, detail.usageUnit)}</strong></div>
                <div><span>执行耗时</span><strong>{formatExecutionDuration(detail.executionDurationMs, detail.outputStatus === 'running')}</strong></div>
                <div><span>状态</span><strong>{usageRecordStatusLabel(detail.outputStatus)}</strong></div>
              </section>

              <section>
                <h4>执行信息</h4>
                <dl>
                  <dt>Trace ID</dt><dd className="is-code">{detail.traceId}</dd>
                  <dt>Job ID</dt><dd className="is-code">{detail.jobId}</dd>
                  <dt>智能体</dt><dd>{detail.agentName}</dd>
                  <dt>用户</dt><dd>{detail.userName || '-'}</dd>
                  <dt>发生时间</dt><dd>{formatUsageRecordTime(detail.taskAt)}</dd>
                  <dt>类型</dt><dd>{resolveTypeLabel(detail.type)}</dd>
                  <dt>输入来源</dt><dd>{detail.inputSource || '-'}</dd>
                  <dt>自动化触发</dt><dd>{resolveTriggerTypeLabel(detail.type, detail.triggerType)}</dd>
                  <dt>Pipeline ID</dt><dd className="is-code">{detail.pipelineId || '-'}</dd>
                  {isFeishuProvider && <><dt>消耗来源</dt><dd>{detail.chargeSourceLabel || '-'}</dd></>}
                </dl>
              </section>

              <section>
                <h4>完整输入</h4>
                <pre className="usage-detail-pre session-log-detail-scroll">{detail.inputContent || '（无）'}</pre>
              </section>

              <section>
                <h4>完整输出</h4>
                <pre className="usage-detail-pre session-log-detail-scroll">{detail.outputContent || '（无）'}</pre>
              </section>

              <section>
                <h4>计费拆分</h4>
                <dl>
                  <dt>大模型 Token</dt><dd>{formatUsageRecordAmount(detail.tokenPart, detail.usageUnit)}</dd>
                  <dt>收费接口费用</dt><dd>{formatUsageRecordAmount(detail.apiPart, detail.usageUnit)}</dd>
                  {billableToolSummary && <><dt>收费工具调用</dt><dd>{billableToolSummary}</dd></>}
                </dl>
              </section>

              {toolChain.length > 0 && (
                <section>
                  <h4>执行链</h4>
                  <ol className="usage-tool-chain">
                    {toolChain.map((step, index) => {
                      const status = resolveToolStatusPresentation(step, detail.apiPart);
                      return (
                        <li key={`${step.toolName}-${index}`}>
                          <div className="usage-tool-chain-main">
                            <div className="usage-tool-chain-name">
                              <span>{step.toolName || '未知工具'}</span>
                              {step.billable && <span className="usage-tool-badge">收费工具</span>}
                            </div>
                            {step.errorMessage && (
                              <small className="usage-tool-chain-error">{step.errorMessage}</small>
                            )}
                          </div>
                          <div className="usage-tool-chain-meta">
                            <span className={`usage-tool-chain-status is-${status.tone}`}>
                              {status.label}
                            </span>
                            {step.durationMs != null && <small>{step.durationMs} ms</small>}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

// ── 主组件 ──

const TYPE_OPTIONS = [
  { label: "消息", value: "user" },
  { label: "自动化", value: "automation" },
  { label: "mcp", value: "mcp" },
  { label: "机器人", value: "bot" },
];

const TRIGGER_TYPE_OPTIONS = [
  { label: "定时", value: "cron" },
];

const INPUT_SOURCE_OPTIONS = [
  { label: "智能体问答", value: "智能体问答" },
  { label: "飞书机器人", value: "飞书机器人" },
  { label: "钉钉AI助手", value: "钉钉AI助手" },
  { label: "企业微信机器人", value: "企业微信机器人" },
  { label: "外部机器人", value: "外部机器人" },
  { label: "MCP", value: "mcp" },
];

interface SessionLogTabProps {
  usageId?: string | null;
  usageDetailClosePath?: string;
  refreshKey?: number;
}

const SessionLogTab: React.FC<SessionLogTabProps> = ({ usageId: usageIdProp, usageDetailClosePath, refreshKey = 0 }) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryUsageId = searchParams.get("usageId");
  const usageId = usageIdProp ?? queryUsageId;
  // ── 筛选状态 ──
  const [traceId, setTraceId] = useState("");
  const [agentNames, setAgentNames] = useState<string[]>([]);
  const [agentOptions, setAgentOptions] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [triggerType, setTriggerType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [inputSources, setInputSources] = useState<string[]>([]);
  const [userKeyword, setUserKeyword] = useState("");
  const [status, setStatus] = useState("");
  const [pipelineId, setPipelineId] = useState("");
  const [usageCreditsMin, setUsageCreditsMin] = useState("");
  const [usageCreditsMax, setUsageCreditsMax] = useState("");
  const [chargeSource, setChargeSource] = useState("");
  const [isFeishuProvider, setIsFeishuProvider] = useState(false);
  const showTriggerTypeFilter = types.includes("automation");

  // ── 分页 ──
  const [pageSize, setPageSize] = useState<number>(20);
  const [page, setPage] = useState(0);

  // ── 数据 ──
  const [logs, setLogs] = useState<TenantMessageLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── 详情抽屉 ──
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  function clearUsageIdParam() {
    if (!queryUsageId) return;
    const next = new URLSearchParams(searchParams);
    next.delete("usageId");
    setSearchParams(next, { replace: true });
  }

  function handleOpenJobDetail(jobId: string) {
    clearUsageIdParam();
    setSelectedJobId(jobId);
  }

  function handleCloseDetail() {
    if (usageId && usageDetailClosePath) {
      navigate(usageDetailClosePath, { replace: true });
      setSelectedJobId(null);
      return;
    }
    clearUsageIdParam();
    setSelectedJobId(null);
  }

  useEffect(() => {
    billingApi
      .getFeishuAuditAccess()
      .then((res) => setIsFeishuProvider(res.provider === "feishu"))
      .catch(() => setIsFeishuProvider(false));
  }, []);

  // ── 加载数据 ──
  const fetchLogs = useCallback(
    async (currentPage: number, currentSize: number) => {
      setLoading(true);
      setError(null);
      try {
        const params: Record<string, any> = {
          page: Math.max(currentPage, 0),
          size: currentSize,
        };
        if (traceId.trim()) params.traceId = traceId.trim();
        if (agentNames.length > 0) params.agentNames = agentNames;
        if (types.length > 0) params.type = types.join(",");
        if (showTriggerTypeFilter && triggerType) {
          params.triggerType = triggerType;
        }
        const startAt = toIsoDateTime(from);
        const endAt = toIsoDateTime(to);
        if (startAt) params.startAt = startAt;
        if (endAt) params.endAt = endAt;
        if (inputSources.length > 0) params.inputSource = inputSources.join(",");
        if (userKeyword.trim()) params.userKeyword = userKeyword.trim();
        if (status) params.status = status;
        if (pipelineId.trim()) params.pipelineId = pipelineId.trim();
        if (isFeishuProvider && chargeSource) params.chargeSource = chargeSource;
        if (usageCreditsMin !== "")
          params.usageCreditsMin = Number(usageCreditsMin);
        if (usageCreditsMax !== "")
          params.usageCreditsMax = Number(usageCreditsMax);
        params.includeFilterOptions = true;

        const res = await billingApi.listMessageLogs(params);
        const responseAgentOptions = res.filterOptions?.agentNames;
        const nextOptions = (responseAgentOptions ?? (res.items ?? []).map((item) => item.agentName))
          .filter((name): name is string => Boolean(name && name.trim()));
        if (responseAgentOptions) {
          setAgentOptions(Array.from(new Set(nextOptions)));
        } else if (nextOptions.length > 0) {
          setAgentOptions((prev) =>
            Array.from(new Set([...prev, ...nextOptions])),
          );
        }
        setLogs(res.items ?? []);
        setTotal(res.total ?? 0);
      } catch {
        setError("加载会话记录失败，请重试");
        setLogs([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [
      traceId,
      agentNames,
      types,
      triggerType,
      from,
      to,
      inputSources,
      userKeyword,
      status,
      pipelineId,
      chargeSource,
      isFeishuProvider,
      usageCreditsMin,
      usageCreditsMax,
      showTriggerTypeFilter,
    ],
  );

  useEffect(() => {
    if (!showTriggerTypeFilter && triggerType) {
      setTriggerType("");
    }
  }, [showTriggerTypeFilter, triggerType]);

  useEffect(() => {
    if (!isFeishuProvider && chargeSource) {
      setChargeSource("");
    }
  }, [isFeishuProvider, chargeSource]);

  // 筛选变化时重置到第 1 页
  useEffect(() => {
    setPage(0);
  }, [
    traceId,
    agentNames,
    types,
    triggerType,
    from,
    to,
    inputSources,
    userKeyword,
    status,
    pipelineId,
    chargeSource,
    usageCreditsMin,
    usageCreditsMax,
    pageSize,
  ]);

  useEffect(() => {
    void fetchLogs(page, pageSize);
  }, [fetchLogs, page, pageSize, refreshKey]);

  function handlePageSizeChange(size: number) {
    setPageSize(size);
    setPage(0);
  }

  function clearAllFilters() {
    setTraceId("");
    setAgentNames([]);
    setTypes([]);
    setTriggerType("");
    setFrom("");
    setTo("");
    setInputSources([]);
    setUserKeyword("");
    setStatus("");
    setPipelineId("");
    setChargeSource("");
    setUsageCreditsMin("");
    setUsageCreditsMax("");
    setPage(0);
  }

  const hasAnyFilter =
    traceId ||
    agentNames.length > 0 ||
    types.length > 0 ||
    (showTriggerTypeFilter && triggerType) ||
    from ||
    to ||
    inputSources.length > 0 ||
    userKeyword ||
    status ||
    pipelineId ||
    chargeSource ||
    usageCreditsMin ||
    usageCreditsMax;
  const mergedAgentOptions = Array.from(
    new Set([...agentOptions, ...agentNames]),
  ).map((name) => ({ label: name, value: name }));
  const conversationRecordColumns = CONVERSATION_RECORD_COLUMNS.filter(
    (column) => !column.feishuOnly || isFeishuProvider,
  );
  const conversationRecordTableMinWidth = conversationRecordColumns.reduce(
    (sum, column) => sum + column.width,
    0,
  );

  return (
    <div
      data-testid="agent-supervision-session-log-tab"
      className="usage-records-panel conversation-records"
    >
      <div
        data-testid="agent-supervision-session-log-filters"
        className="dashboard-records-filters"
      >
        <TextFilterField
          label="Trace ID"
          value={traceId}
          onChange={setTraceId}
          placeholder="搜索 Trace ID"
          width={120}
        />
        <MultiSelectFilterField
          label="智能体名称"
          values={agentNames}
          options={mergedAgentOptions}
          onChange={setAgentNames}
          width={120}
        />
        <TextFilterField
          label="用户名"
          value={userKeyword}
          onChange={setUserKeyword}
          placeholder="用户名 / 用户 ID"
          width={120}
        />
        <SelectFilterField
          label="输出状态"
          value={status}
          options={CONVERSATION_STATUS_OPTIONS}
          onChange={setStatus}
          width={120}
        />
        <MultiSelectFilterField
          label="来源入口"
          values={inputSources}
          options={INPUT_SOURCE_OPTIONS}
          onChange={setInputSources}
          width={120}
        />
        <MultiSelectFilterField
          label="记录类型"
          values={types}
          options={TYPE_OPTIONS}
          onChange={setTypes}
          width={120}
        />
        {showTriggerTypeFilter && (
          <SelectFilterField
            label="触发类型"
            value={triggerType}
            options={TRIGGER_TYPE_OPTIONS}
            onChange={setTriggerType}
            width={120}
          />
        )}
        <DateRangeField
          from={from}
          to={to}
          onFromChange={setFrom}
          onToChange={setTo}
        />
        <AmountRangeField
          min={usageCreditsMin}
          max={usageCreditsMax}
          onMinChange={setUsageCreditsMin}
          onMaxChange={setUsageCreditsMax}
        />
        {isFeishuProvider && (
          <SelectFilterField
            label="消耗来源"
            value={chargeSource}
            options={USAGE_RECORD_CHARGE_SOURCE_OPTIONS}
            onChange={setChargeSource}
            width={125}
          />
        )}
        <TextFilterField
          label="Pipeline ID"
          value={pipelineId}
          onChange={setPipelineId}
          placeholder="Pipeline ID"
          width={120}
        />
        {hasAnyFilter && <ResetFilterButton onClick={clearAllFilters} />}
      </div>

      {/* ── 表格 ── */}
      <div
        data-testid="agent-supervision-session-log-table"
        className="usage-records-table-wrap conversation-records-table-wrap"
      >
        <table
          className="usage-records-table conversation-records-table"
          style={{
            width: "100%",
            borderCollapse: "collapse",
            minWidth: conversationRecordTableMinWidth,
          }}
          aria-label="会话记录列表"
        >
          <colgroup>
            {conversationRecordColumns.map((column) => (
              <col key={column.key} style={{ width: column.width }} />
            ))}
          </colgroup>
          <thead>
            <tr className="usage-records-table-head-row">
              {conversationRecordColumns.map((column) => (
                <th
                  key={column.key}
                  role="columnheader"
                  style={thStyle}
                  title={column.label === "消耗量" ? "飞书AI包点数可用时会优先消耗，否则消耗MOSS账户积分。1元 = 飞书AI包20点数 = MOSS账户10积分。" : undefined}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={conversationRecordColumns.length}
                  className="usage-records-empty"
                >
                  加载中…
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td
                  colSpan={conversationRecordColumns.length}
                  className="usage-records-empty is-error"
                >
                  {error}
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td
                  colSpan={conversationRecordColumns.length}
                  className="usage-records-empty"
                >
                  暂无使用记录
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr
                  key={log.jobId}
                  className="usage-record-row"
                  tabIndex={0}
                  onClick={() => handleOpenJobDetail(log.jobId)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleOpenJobDetail(log.jobId);
                    }
                  }}
                >
                  {/* Trace ID — 整行可点击打开详情 */}
                  <td style={tdStyle} title={log.traceId}>
                    {log.traceId || log.jobId}
                  </td>

                  {/* 智能体名称 */}
                  <td style={tdStyle} title={log.agentName}>
                    {truncate(log.agentName, 16)}
                  </td>

                  {/* 时间 */}
                  <td style={tdStyle}>
                    {formatUsageRecordTime(log.taskAt)}
                  </td>

                  {/* 类型 */}
                  <td style={tdStyle}>{resolveTypeLabel(log.type)}</td>

                  {/* 输入来源 */}
                  <td style={tdStyle} title={log.inputSource}>
                    {truncate(log.inputSource, 12)}
                  </td>

                  {/* 用户名 */}
                  <td style={tdStyle} title={log.userName ?? undefined}>
                    {truncate(log.userName, 12)}
                  </td>

                  {/* 输入摘要 */}
                  <td
                    style={tdStyle}
                    title={log.inputSummary}
                  >
                    {truncate(log.inputSummary, 30)}
                  </td>

                  {/* 输出摘要 */}
                  <td
                    style={tdStyle}
                    title={log.outputSummary}
                  >
                    {truncate(log.outputSummary, 30)}
                  </td>

                  {/* 输出状态 */}
                  <td style={tdStyle}>
                    <UsageRecordStatusPill status={log.outputStatus} />
                  </td>

                  {isFeishuProvider && (
                    <td style={tdStyle}>{log.chargeSourceLabel || "-"}</td>
                  )}

                  {/* 消耗量 */}
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    {formatUsageRecordAmount(log.usageCredits, log.usageUnit)}
                  </td>

                  {/* 执行耗时 */}
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    {formatExecutionDuration(log.executionDurationMs, log.outputStatus === "running")}
                  </td>

                  {/* Pipeline ID */}
                  <td style={tdStyle} title={log.pipelineId ?? undefined}>
                    {log.pipelineId ? truncate(log.pipelineId, 12) : "-"}
                  </td>

                  {/* 自动化触发方式 */}
                  <td style={tdStyle}>
                    {resolveTriggerTypeLabel(log.type, log.triggerType)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="usage-records-cards conversation-records-cards">
        {loading ? (
          <div className="usage-records-mobile-state">加载中…</div>
        ) : error ? (
          <div className="usage-records-mobile-state is-error">{error}</div>
        ) : logs.length === 0 ? (
          <div className="usage-records-mobile-state">暂无使用记录</div>
        ) : logs.map(log => (
          <button
            type="button"
            className="usage-record-card"
            key={log.jobId}
            onClick={() => handleOpenJobDetail(log.jobId)}
          >
            <span className="record-card-head">
              <strong>{log.agentName}</strong>
              <UsageRecordStatusPill status={log.outputStatus} />
            </span>
            <span>{resolveTypeLabel(log.type)} · {log.userName || '-'}</span>
            <span className="usage-record-card-summary">{log.inputSummary || '无输入摘要'}</span>
            <span className="usage-record-card-summary">{log.outputSummary || '无输出摘要'}</span>
            <span className="record-card-foot">
              <span>{formatUsageRecordTime(log.taskAt)}</span>
              <b>{formatUsageRecordAmount(log.usageCredits, log.usageUnit)}</b>
            </span>
          </button>
        ))}
      </div>

      <div data-testid="agent-supervision-session-log-pagination">
        <UsageRecordsPagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
        />
      </div>
      {/* ── 侧栏详情抽屉 ── */}
      <DetailDrawer
        jobId={selectedJobId}
        usageId={usageId}
        isFeishuProvider={isFeishuProvider}
        onClose={handleCloseDetail}
      />
    </div>
  );
};

export default SessionLogTab;
