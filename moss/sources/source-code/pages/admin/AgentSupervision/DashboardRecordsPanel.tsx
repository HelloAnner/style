import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  billingApi,
  type DashboardUsageRecordDetailResponse,
  type DashboardUsageRecordItem,
  type ListDashboardUsageRecordsResponse,
} from '../../../api/billing';
import { formatExecutionDuration } from '../../../utils/formatExecutionDuration';
import {
  DASHBOARD_STATUS_OPTIONS,
  formatUsageRecordAmount,
  formatUsageRecordTime,
  UsageRecordsPagination,
  USAGE_RECORD_CHARGE_SOURCE_OPTIONS,
  UsageRecordStatusPill,
  usageRecordStatusLabel,
} from './UsageRecordsControls';
import {
  AmountRangeField,
  DateRangeField,
  MultiSelectFilterField,
  ResetFilterButton,
  SelectFilterField,
  TextFilterField,
} from './RecordFilterFields';
import './usage-records.css';

function formatQueryInputValue(value: unknown): string {
  if (value == null || value === '') return '—';
  if (Array.isArray(value)) {
    return value.map(formatQueryInputValue).filter(item => item !== '—').join('、') || '—';
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function toIsoDateTime(value: string): string | undefined {
  if (!value) return undefined;
  const normalizedValue = value.includes('T') ? value : value.replace(' ', 'T');
  const date = new Date(normalizedValue);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

type DashboardRecordColumn = {
  key: string;
  label: string;
  width: number;
  feishuOnly?: boolean;
};

const DASHBOARD_RECORD_COLUMNS = [
  { key: 'traceId', label: 'Trace ID', width: 160 },
  { key: 'agentName', label: '智能体名称', width: 130 },
  { key: 'dashboardName', label: '看板', width: 150 },
  { key: 'occurredAt', label: '时间', width: 156 },
  { key: 'userName', label: '用户名', width: 110 },
  { key: 'querySummary', label: '查询摘要', width: 240 },
  { key: 'outputStatus', label: '输出状态', width: 92 },
  { key: 'chargeSource', label: '消耗来源', width: 104, feishuOnly: true },
  { key: 'usageAmount', label: '消耗量', width: 84 },
  { key: 'executionDuration', label: '执行耗时', width: 90 },
] satisfies DashboardRecordColumn[];

interface DashboardRecordsPanelProps {
  usageRecordId?: string | null;
  usageDetailClosePath?: string;
  refreshKey?: number;
}

const DashboardRecordsPanel: React.FC<DashboardRecordsPanelProps> = ({
  usageRecordId: usageRecordIdProp,
  usageDetailClosePath,
  refreshKey = 0,
}) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [traceId, setTraceId] = useState('');
  const [agentNames, setAgentNames] = useState<string[]>([]);
  const [dashboardKeys, setDashboardKeys] = useState<string[]>([]);
  const [userKeyword, setUserKeyword] = useState('');
  const [statuses, setStatuses] = useState<string[]>([]);
  const [chargeSource, setChargeSource] = useState('');
  const [usageAmountMin, setUsageAmountMin] = useState('');
  const [usageAmountMax, setUsageAmountMax] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [data, setData] = useState<ListDashboardUsageRecordsResponse>({ items: [], total: 0, page: 0, size: 20 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<DashboardUsageRecordDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [isFeishuProvider, setIsFeishuProvider] = useState(false);
  const detailRequestVersion = useRef(0);
  const selectedRecordId = usageRecordIdProp ?? searchParams.get('recordId');

  useEffect(() => {
    billingApi.getFeishuAuditAccess()
      .then(result => setIsFeishuProvider(result.provider === 'feishu'))
      .catch(() => setIsFeishuProvider(false));
  }, []);

  useEffect(() => {
    if (!isFeishuProvider && chargeSource) setChargeSource('');
  }, [chargeSource, isFeishuProvider]);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await billingApi.listDashboardUsageRecords({
        traceId: traceId.trim() || undefined,
        agentNames: agentNames.length ? agentNames : undefined,
        dashboardKeys: dashboardKeys.length ? dashboardKeys : undefined,
        userKeyword: userKeyword.trim() || undefined,
        statuses: statuses.length ? statuses : undefined,
        chargeSource: isFeishuProvider && chargeSource
          ? chargeSource as 'FEISHU_AI_PACKAGE' | 'MOSS_CREDIT'
          : undefined,
        usageAmountMin: usageAmountMin === '' ? undefined : Number(usageAmountMin),
        usageAmountMax: usageAmountMax === '' ? undefined : Number(usageAmountMax),
        startAt: toIsoDateTime(startAt),
        endAt: toIsoDateTime(endAt),
        includeFilterOptions: true,
        page,
        size: pageSize,
      });
      setData(result);
    } catch {
      setError('加载看板使用记录失败，请重试');
    } finally {
      setLoading(false);
    }
  }, [agentNames, chargeSource, dashboardKeys, endAt, isFeishuProvider, page, pageSize, refreshKey, startAt, statuses, traceId, usageAmountMax, usageAmountMin, userKeyword]);

  useEffect(() => { void loadRecords(); }, [loadRecords]);

  const openDetail = useCallback((record: DashboardUsageRecordItem) => {
    setSearchParams(current => {
      const next = new URLSearchParams(current);
      next.set('recordId', record.usageRecordId);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const closeDetail = useCallback(() => {
    detailRequestVersion.current += 1;
    setDetail(null);
    setDetailLoading(false);
    setDetailError('');
    if (usageRecordIdProp && usageDetailClosePath) {
      navigate(usageDetailClosePath, { replace: true });
      return;
    }
    setSearchParams(current => {
      const next = new URLSearchParams(current);
      next.delete('recordId');
      return next;
    }, { replace: true });
  }, [navigate, setSearchParams, usageDetailClosePath, usageRecordIdProp]);

  useEffect(() => {
    if (!selectedRecordId) {
      setDetail(null);
      setDetailLoading(false);
      setDetailError('');
      return;
    }
    const requestVersion = detailRequestVersion.current + 1;
    detailRequestVersion.current = requestVersion;
    let cancelled = false;
    setDetail(null);
    setDetailLoading(true);
    setDetailError('');
    billingApi.getDashboardUsageRecordDetail(selectedRecordId)
      .then(value => {
        if (!cancelled && detailRequestVersion.current === requestVersion) setDetail(value);
      })
      .catch(() => {
        if (!cancelled && detailRequestVersion.current === requestVersion) {
          setDetailError('加载使用详情失败，请重试');
        }
      })
      .finally(() => {
        if (!cancelled && detailRequestVersion.current === requestVersion) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedRecordId]);

  const dashboardRecordColumns = DASHBOARD_RECORD_COLUMNS.filter(
    column => !column.feishuOnly || isFeishuProvider,
  );
  const dashboardRecordTableMinWidth = dashboardRecordColumns.reduce(
    (sum, column) => sum + column.width,
    0,
  );
  const tableColumnCount = dashboardRecordColumns.length;
  const filters = data.filterOptions;
  const inputEntries = useMemo(() => Object.entries(detail?.queryInputs ?? {}).filter(([key]) => !key.startsWith('_')), [detail]);
  const mergedAgentOptions = Array.from(new Set([...(filters?.agentNames ?? []), ...agentNames]))
    .map(name => ({ label: name, value: name }));
  const dashboardOptions = (filters?.dashboards ?? [])
    .map(item => ({ label: item.name, value: item.key }));
  const hasAnyFilter = Boolean(
    traceId || agentNames.length || dashboardKeys.length || userKeyword || statuses.length || chargeSource
    || usageAmountMin || usageAmountMax || startAt || endAt,
  );

  const clearAllFilters = () => {
    setTraceId('');
    setAgentNames([]);
    setDashboardKeys([]);
    setUserKeyword('');
    setStatuses([]);
    setChargeSource('');
    setUsageAmountMin('');
    setUsageAmountMax('');
    setStartAt('');
    setEndAt('');
    setPage(0);
  };

  return (
    <div className="usage-records-panel dashboard-records">
      <div className="dashboard-records-filters">
        <TextFilterField
          label="Trace ID"
          value={traceId}
          onChange={value => { setTraceId(value); setPage(0); }}
          placeholder="搜索 Trace ID"
          width={120}
        />
        <MultiSelectFilterField
          label="智能体名称"
          values={agentNames}
          options={mergedAgentOptions}
          onChange={value => { setAgentNames(value); setPage(0); }}
          width={120}
        />
        <MultiSelectFilterField
          label="看板类型"
          values={dashboardKeys}
          options={dashboardOptions}
          onChange={value => { setDashboardKeys(value); setPage(0); }}
          width={120}
        />
        <TextFilterField
          label="用户名"
          value={userKeyword}
          onChange={value => { setUserKeyword(value); setPage(0); }}
          placeholder="用户名 / 用户 ID"
          width={120}
        />
        <MultiSelectFilterField
          label="输出状态"
          values={statuses}
          options={DASHBOARD_STATUS_OPTIONS}
          onChange={value => { setStatuses(value); setPage(0); }}
          width={120}
        />
        {isFeishuProvider && (
          <SelectFilterField
            label="消耗来源"
            value={chargeSource}
            options={USAGE_RECORD_CHARGE_SOURCE_OPTIONS}
            onChange={value => { setChargeSource(value); setPage(0); }}
            width={125}
          />
        )}
        <AmountRangeField
          min={usageAmountMin}
          max={usageAmountMax}
          onMinChange={value => { setUsageAmountMin(value); setPage(0); }}
          onMaxChange={value => { setUsageAmountMax(value); setPage(0); }}
        />
        <DateRangeField
          from={startAt}
          to={endAt}
          onFromChange={value => { setStartAt(value); setPage(0); }}
          onToChange={value => { setEndAt(value); setPage(0); }}
        />
        {hasAnyFilter && <ResetFilterButton onClick={clearAllFilters} />}
      </div>
      <div className="usage-records-table-wrap dashboard-records-table-wrap">
        <table
          className="usage-records-table dashboard-records-table"
          style={{ minWidth: dashboardRecordTableMinWidth }}
        >
          <colgroup>
            {dashboardRecordColumns.map(column => (
              <col key={column.key} style={{ width: column.width }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {dashboardRecordColumns.map(column => (
                <th
                  key={column.key}
                  title={column.label === '消耗量' ? '飞书AI包点数可用时会优先消耗，否则消耗MOSS账户积分。1元 = 飞书AI包20点数 = MOSS账户10积分。' : undefined}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={tableColumnCount} className="usage-records-empty">加载中…</td></tr>
              : error ? <tr><td colSpan={tableColumnCount} className="usage-records-empty is-error">{error}</td></tr>
                : data.items.length === 0 ? <tr><td colSpan={tableColumnCount} className="usage-records-empty">暂无使用记录</td></tr>
                  : data.items.map(item => (
                    <tr className="usage-record-row" key={item.usageRecordId} onClick={() => void openDetail(item)} tabIndex={0} onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        void openDetail(item);
                      }
                    }}>
                      <td title={item.traceId}>{item.traceId}</td><td>{item.agentName}</td><td>{item.dashboardName}</td><td>{formatUsageRecordTime(item.occurredAt)}</td><td>{item.userName}</td>
                      <td title={item.querySummary}>{item.querySummary || '—'}</td>
                      <td><UsageRecordStatusPill status={item.outputStatus} /></td>
                      {isFeishuProvider && <td>{item.chargeSourceLabel}</td>}<td className="is-number">{formatUsageRecordAmount(item.usageAmount, item.usageUnit)}</td><td className="is-number">{formatExecutionDuration(item.executionDurationMs, item.outputStatus === 'running')}</td>
                    </tr>
                  ))}
          </tbody>
        </table>
        <div className="usage-records-cards dashboard-records-cards">
          {loading ? <div className="usage-records-mobile-state">加载中…</div>
            : error ? <div className="usage-records-mobile-state is-error">{error}</div>
              : data.items.length === 0 ? <div className="usage-records-mobile-state">暂无使用记录</div>
                : data.items.map(item => (
            <button type="button" className="usage-record-card dashboard-record-card" key={item.usageRecordId} onClick={() => void openDetail(item)}>
              <span className="record-card-head"><strong>{item.dashboardName}</strong><UsageRecordStatusPill status={item.outputStatus} /></span>
              <span>{item.agentName} · {item.userName}</span><span>{item.querySummary || '无查询摘要'}</span>
              <span className="record-card-foot"><span>{formatUsageRecordTime(item.occurredAt)}</span><b>{formatUsageRecordAmount(item.usageAmount, item.usageUnit)}</b></span>
            </button>
          ))}
        </div>
      </div>

      <UsageRecordsPagination
        page={page}
        pageSize={pageSize}
        total={data.total}
        onPageChange={setPage}
        onPageSizeChange={value => { setPageSize(value); setPage(0); }}
      />

      {selectedRecordId && <div className="usage-detail-backdrop" onMouseDown={closeDetail}>
        <aside className="usage-detail-drawer" aria-label="看板使用详情" onMouseDown={event => event.stopPropagation()}>
          <header><div><span className="usage-detail-kicker">看板使用详情</span><h3>{detail?.record.dashboardName ?? (detailLoading ? '加载中…' : '看板使用详情')}</h3></div><button type="button" onClick={closeDetail} aria-label="关闭详情"><X size={18} aria-hidden="true" /></button></header>
          <div className="usage-detail-body">
            {detailLoading && <div className="usage-detail-state">加载中…</div>}
            {detailError && <div className="usage-detail-state is-error">{detailError}</div>}
          {detail && <>
            <section className="usage-detail-overview"><div><span>消耗量</span><strong>{formatUsageRecordAmount(detail.record.usageAmount, detail.record.usageUnit)}</strong></div><div><span>执行耗时</span><strong>{formatExecutionDuration(detail.record.executionDurationMs, detail.record.outputStatus === 'running')}</strong></div><div><span>状态</span><strong>{usageRecordStatusLabel(detail.record.outputStatus)}</strong></div></section>
            <section><h4>执行信息</h4><dl><dt>Trace ID</dt><dd className="is-code">{detail.record.traceId}</dd><dt>智能体</dt><dd>{detail.record.agentName}</dd><dt>用户</dt><dd>{detail.record.userName}</dd><dt>发生时间</dt><dd>{formatUsageRecordTime(detail.record.occurredAt)}</dd>{isFeishuProvider && <><dt>消耗来源</dt><dd>{detail.record.chargeSourceLabel}</dd></>}</dl></section>
            <section><h4>查询输入</h4>{inputEntries.length ? <dl>{inputEntries.map(([key, value]) => <React.Fragment key={key}><dt>{key}</dt><dd>{formatQueryInputValue(value)}</dd></React.Fragment>)}</dl> : <p>无公开查询参数</p>}</section>
            <section><h4>计费拆分</h4><dl><dt>大模型 Token</dt><dd>{detail.totalTokens}</dd><dt>Token 折算</dt><dd>{detail.tokenPart} {detail.record.usageUnit}</dd><dt>诉讼明细接口</dt><dd>{detail.bApiCount} 次</dd><dt>接口折算</dt><dd>{detail.apiPart} {detail.record.usageUnit}</dd>{detail.externalRecordId && <><dt>飞书记录 ID</dt><dd className="is-code">{detail.externalRecordId}</dd></>}</dl></section>
            {detail.errorSummary && <section className="usage-detail-error"><h4>错误信息</h4><p>{detail.errorSummary}</p></section>}
          </>}
          </div>
        </aside>
      </div>}
    </div>
  );
};

export default DashboardRecordsPanel;
