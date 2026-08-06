/**
 * 管理后台「用量管理」子页面。
 *
 * 业务含义：
 * - 面向工作区 owner/admin 展示套餐状态、积分使用情况及联系销售入口。
 * - 数据来源：useBillingStore（内部对接 /v1/billing/status + /v1/billing/credits）。
 * - UI 结构对齐 V1 TeamBilling.tsx 的三卡片布局，进度条改为黑色填充（V2 主题规范）。
 * - 消息日志支持筛选、分页与详情查看（完整输入输出、执行链、token 与耗时）。
 *
 * BILLING_NOT_PROVISIONED 空态：
 * - 当 credits 加载失败且错误码为 BILLING_NOT_PROVISIONED（未开通计费）时，
 *   显示专属空态提示，对应 V1 TeamBilling 的 notProvisioned 处理。
 *
 * @see V1 src/pages/settings/tabs/TeamBilling.tsx — 逻辑来源
 * @see docs/frontend-state-management/changes/20260411-unified-store-and-pages/plans/008-billing-and-usage.md
 */

import React, { useEffect, useCallback, useState } from 'react';
import { useBillingStore, type BillingCreditsResponse } from '../../stores/billingStore';
import { BillingErrorCodes } from '../../api/errorCodes';
import {
  billingApi,
  type TenantMessageLogDetailResponse,
  type TenantMessageLogItem,
  type TenantMessageLogQueryParams,
} from '../../api/billing';
import { formatExecutionDuration } from '../../utils/formatExecutionDuration';

// ── 工具函数（对齐 V1 TeamBilling）──

function formatCredits(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function formatDateTime(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.replace('T', ' ').replace(/(\.\d+)?Z$/, '');
  }
  const parts = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const partMap = parts.reduce<Record<string, string>>((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  return `${partMap.year}-${partMap.month}-${partMap.day} ${partMap.hour}:${partMap.minute}:${partMap.second}`;
}

function resolveUsedPercent(usedCredits: number, totalCredits: number): number {
  if (totalCredits <= 0) return 0;
  const percent = (usedCredits / totalCredits) * 100;
  return Math.max(0, Math.min(100, Number(percent.toFixed(2))));
}

function resolvePlanTypeLabel(planType: string): string {
  return planType === 'official' ? '正式版' : '试用版';
}

function resolvePlanStatusLabel(planStatus: string): string {
  if (planStatus === 'expired') return '已过期';
  if (planStatus === 'exhausted') return '已耗尽';
  return '生效中';
}

// ── 卡片公共样式 ──

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--border-subtle)',
  borderRadius: 12,
  padding: 24,
  background: 'var(--bg-secondary)',
};

// ── 联系销售弹窗（V1 风格：全局遮罩 + 表单）──

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid var(--border-default)',
  borderRadius: 8,
  fontSize: 14,
  color: 'var(--text-primary)',
  background: 'var(--bg-secondary)',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--text-secondary)',
  marginBottom: 6,
};

function ContactSalesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [formData, setFormData] = useState({ name: '', company: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!open) return null;

  function handleChange(field: keyof typeof formData) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData(prev => ({ ...prev, [field]: e.target.value }));
      setError(null);
    };
  }

  async function handleSubmit() {
    if (!formData.phone.trim()) {
      setError('请输入手机号');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/website/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json() as { msg?: string };
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => { setSuccess(false); onClose(); setFormData({ name: '', company: '', phone: '' }); }, 1500);
      } else {
        setError(data.msg ?? '提交失败，请稍后重试');
      }
    } catch {
      setError('网络异常，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--modal-backdrop)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--modal-bg, var(--bg-secondary))',
          borderRadius: 16,
          padding: '36px 32px 28px',
          width: 460,
          maxWidth: '95vw',
          boxShadow: 'var(--modal-shadow)',
          position: 'relative',
          border: '1px solid var(--border-subtle)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 关闭按钮 */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            width: 28,
            height: 28,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 6,
            color: 'var(--text-muted)',
            fontSize: 18,
            lineHeight: 1,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-tertiary)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
        >
          ×
        </button>

        {/* 标题 */}
        <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, textAlign: 'center', color: 'var(--text-primary)' }}>
          联系销售
        </h3>
        <p style={{ margin: '0 0 24px', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
          请留下您的信息，我们的客户经理<br />会与您联系提供专属服务
        </p>

        {/* 表单 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>姓名</label>
            <input
              type="text"
              placeholder="请输入您的姓名"
              value={formData.name}
              onChange={handleChange('name')}
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--text-muted)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; }}
            />
          </div>
          <div>
            <label style={labelStyle}>公司</label>
            <input
              type="text"
              placeholder="请输入公司名称"
              value={formData.company}
              onChange={handleChange('company')}
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--text-muted)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; }}
            />
          </div>
          <div>
            <label style={labelStyle}>手机</label>
            <input
              type="tel"
              placeholder="请输入手机号"
              value={formData.phone}
              onChange={handleChange('phone')}
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--text-muted)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; }}
            />
          </div>
        </div>

        {/* 错误/成功提示 */}
        {error && <div style={{ marginTop: 12, fontSize: 13, color: 'var(--danger)', textAlign: 'center' }}>{error}</div>}
        {success && <div style={{ marginTop: 12, fontSize: 13, color: 'var(--success)', textAlign: 'center' }}>提交成功，我们会尽快与您联系</div>}

        {/* 提交按钮 */}
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={submitting}
          style={{
            width: '100%',
            marginTop: 16,
            padding: '10px 0',
            borderRadius: 8,
            border: 'none',
            background: submitting ? 'var(--btn-mono-disabled-bg)' : 'var(--btn-mono-bg)',
            color: submitting ? 'var(--btn-mono-disabled-text)' : 'var(--btn-mono-text)',
            fontSize: 14,
            fontWeight: 500,
            cursor: submitting ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { if (!submitting) (e.currentTarget as HTMLButtonElement).style.background = 'var(--btn-mono-hover-bg)'; }}
          onMouseLeave={e => { if (!submitting) (e.currentTarget as HTMLButtonElement).style.background = 'var(--btn-mono-bg)'; }}
        >
          {submitting ? '提交中...' : '提交'}
        </button>
      </div>
    </div>
  );
}

// ── 套餐状态卡片 ──

function PlanStatusCard({ credits }: { credits: BillingCreditsResponse }) {
  const daysToExpire = credits.daysToExpire;
  const isTrialPlan = credits.planType === 'trial';

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
          套餐状态
        </span>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <span
          style={{
            fontSize: 12,
            padding: '2px 8px',
            borderRadius: 20,
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary)',
            background: 'var(--bg-tertiary)',
          }}
        >
          {resolvePlanTypeLabel(credits.planType)}
        </span>
        <span
          style={{
            fontSize: 12,
            padding: '2px 8px',
            borderRadius: 20,
            background: credits.planStatus === 'active' ? 'var(--success-bg-soft)' : 'var(--danger-bg-soft)',
            color: credits.planStatus === 'active' ? 'var(--success)' : 'var(--danger)',
            border: `1px solid ${credits.planStatus === 'active' ? 'var(--success-border-soft)' : 'var(--danger-border-soft)'}`,
          }}
        >
          {resolvePlanStatusLabel(credits.planStatus)}
        </span>
      </div>

      {isTrialPlan ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>试用期永久有效</div>
      ) : (
        <>
          {daysToExpire != null ? (
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 32, fontWeight: 700, color: 'var(--text-primary)' }}>
                {daysToExpire}
              </span>
              <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 4 }}>
                天
              </span>
            </div>
          ) : null}
          {credits.planExpiresAt ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              到期时间：{formatDateTime(credits.planExpiresAt)}
            </div>
          ) : null}
        </>
      )}

      {credits.lowBalanceWarning && (
        <div
          style={{
            marginTop: 12,
            padding: '8px 10px',
            borderRadius: 8,
            background: 'var(--warning-bg-soft)',
            border: '1px solid var(--warning-border-soft)',
            fontSize: 12,
            color: 'var(--warning)',
          }}
        >
          积分余额偏低，建议尽快联系销售续费
        </div>
      )}
    </div>
  );
}

// ── 资源使用卡片 ──

function ResourceUsageCard({ credits }: { credits: BillingCreditsResponse }) {
  const usedPercent = resolveUsedPercent(credits.usedCredits, credits.totalCredits);

  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
        MOSS账户积分
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 }}>
        <div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>已消耗 / 总配额</span>
          <div style={{ marginTop: 4, fontSize: 13, color: 'var(--text-secondary)' }}>
            {formatCredits(credits.usedCredits)} / {formatCredits(credits.totalCredits)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)' }}>
            {usedPercent}%
          </span>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>已使用</div>
        </div>
      </div>

      {/* 进度条：主文字色填充，三级背景色底 var(--bg-tertiary) */}
      <div
        style={{
          height: 8,
          borderRadius: 4,
          background: 'var(--bg-tertiary)',
          overflow: 'hidden',
          marginBottom: 14,
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${usedPercent}%`,
            background: 'var(--text-primary)',
            borderRadius: 4,
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>余额</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
            {formatCredits(credits.balance)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>总配额</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
            {formatCredits(credits.totalCredits)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 联系销售卡片 ──

function ContactSalesCard({ onOpenSales }: { onOpenSales: () => void }) {
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>
        增购与商务支持
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, margin: '0 0 20px' }}>
        补充积分包或开通正式版，请联系销售
      </p>
      <button
        type="button"
        onClick={onOpenSales}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 18px',
          borderRadius: 8,
          border: 'none',
          background: 'var(--btn-mono-bg)',
          color: 'var(--btn-mono-text)',
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--btn-mono-hover-bg)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--btn-mono-bg)';
        }}
      >
        {/* 电话图标 */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.44 2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.9a16 16 0 0 0 6.1 6.1l.95-.95a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
        联系销售
      </button>
    </div>
  );
}

// ── 未开通空态（BILLING_NOT_PROVISIONED）──

function NotProvisionedView({ onOpenSales }: { onOpenSales: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 32px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.4 }}>💳</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
        尚未开通计费服务
      </div>
      <p
        style={{
          fontSize: 13,
          color: 'var(--text-muted)',
          lineHeight: 1.7,
          maxWidth: 320,
          margin: '0 0 24px',
        }}
      >
        当前工作区尚未开通计费套餐，请联系销售团队了解开通方式和套餐方案。
      </p>
      <button
        type="button"
        onClick={onOpenSales}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--btn-mono-hover-bg)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--btn-mono-bg)';
        }}
        style={{
          padding: '9px 24px',
          borderRadius: 8,
          border: 'none',
          background: 'var(--btn-mono-bg)',
          color: 'var(--btn-mono-text)',
          fontSize: 14,
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'background 0.15s',
        }}
      >
        联系销售
      </button>
    </div>
  );
}

// ── 消息日志 ──

type MessageLogFilterForm = {
  traceId: string;
  agentName: string;
  startAt: string;
  endAt: string;
  type: '' | 'user' | 'automation';
  chargeSource: '' | 'FEISHU_AI_PACKAGE' | 'MOSS_CREDIT';
  usageCredits: string;
};

const MESSAGE_LOG_DEFAULT_FILTERS: MessageLogFilterForm = {
  traceId: '',
  agentName: '',
  startAt: '',
  endAt: '',
  type: '',
  chargeSource: '',
  usageCredits: '',
};

function resolveMessageTypeLabel(type: string): string {
  return type === 'automation' ? '自动化执行' : '用户提问';
}

function resolveOutputStatusLabel(status: string): string {
  if (status === 'success') return '成功';
  if (status === 'failed') return '失败';
  if (status === 'timeout') return '响应超时';
  return '执行中';
}

function formatUsageAmount(
  usageCredits: number | null | undefined,
  usageUnit: string | null | undefined,
): string {
  if (usageCredits == null) return '-';
  return `${formatCredits(usageCredits)}${usageUnit || ''}`;
}

function toIsoFromDateTimeLocal(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function buildMessageLogQuery(
  filters: MessageLogFilterForm,
  page: number,
  size: number,
): TenantMessageLogQueryParams {
  const usageCredits = filters.usageCredits.trim() ? Number(filters.usageCredits.trim()) : undefined;
  const agentName = filters.agentName.trim();
  return {
    traceId: filters.traceId.trim() || undefined,
    agentNames: agentName ? [agentName] : undefined,
    startAt: toIsoFromDateTimeLocal(filters.startAt),
    endAt: toIsoFromDateTimeLocal(filters.endAt),
    type: filters.type || undefined,
    chargeSource: filters.chargeSource || undefined,
    usageCreditsMin: Number.isFinite(usageCredits) ? usageCredits : undefined,
    usageCreditsMax: Number.isFinite(usageCredits) ? usageCredits : undefined,
    page,
    size,
  };
}

function MessageLogDetailModal({
  open,
  loading,
  error,
  detail,
  onClose,
}: {
  open: boolean;
  loading: boolean;
  error: string | null;
  detail: TenantMessageLogDetailResponse | null;
  onClose: () => void;
}) {
  if (!open) return null;
  const hasFeishuAuditFields = Boolean(
    detail?.recordId
    || detail?.openId
    || detail?.tenantKey
    || detail?.auditReportStatus
    || detail?.usageDetailUrl
  );
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--modal-backdrop)',
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(1040px, 95vw)',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--modal-bg, var(--bg-secondary))',
          borderRadius: 14,
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--modal-shadow)',
          padding: '22px 22px 18px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>消息日志详情</div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: 18,
              color: 'var(--text-muted)',
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {loading && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>详情加载中...</div>}
        {!loading && error && <div style={{ fontSize: 13, color: 'var(--danger)' }}>{error}</div>}
        {!loading && !error && detail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              <div><strong>任务时间：</strong>{formatDateTime(detail.taskAt)}</div>
              <div><strong>智能体：</strong>{detail.agentName || '-'}</div>
              <div><strong>类型：</strong>{resolveMessageTypeLabel(detail.type)}</div>
              <div><strong>输出状态：</strong>{resolveOutputStatusLabel(detail.outputStatus)}</div>
              <div><strong>消耗来源：</strong>{detail.chargeSourceLabel || '-'}</div>
              <div><strong>消耗量：</strong>{formatUsageAmount(detail.usageCredits, detail.usageUnit)}</div>
              <div>
                <strong>积分消耗明细：</strong>
                大模型token：{formatUsageAmount(detail.tokenPart, detail.usageUnit)}、
                付费接口调用：{formatUsageAmount(detail.apiPart, detail.usageUnit)}
              </div>
              <div><strong>执行耗时：</strong>{formatExecutionDuration(detail.executionDurationMs, detail.outputStatus === 'running')}</div>
              <div><strong>Pipeline ID：</strong>{detail.pipelineId || '-'}</div>
              {hasFeishuAuditFields && (
                <>
                  <div><strong>Trace ID：</strong>{detail.traceId || '-'}</div>
                  <div><strong>Job ID：</strong>{detail.jobId || '-'}</div>
                  <div><strong>Record ID：</strong>{detail.recordId || '-'}</div>
                  <div><strong>Open ID：</strong>{detail.openId || '-'}</div>
                  <div><strong>Tenant Key：</strong>{detail.tenantKey || '-'}</div>
                  <div><strong>上报状态：</strong>{detail.auditReportStatus || '-'}</div>
                  <div>
                    <strong>飞书详情：</strong>
                    {detail.usageDetailUrl ? (
                      <a href={detail.usageDetailUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
                        查看
                      </a>
                    ) : '-'}
                  </div>
                </>
              )}
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>输入内容（完整）</div>
              <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
                {detail.inputContent || '-'}
              </pre>
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>输出内容（完整）</div>
              <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
                {detail.outputContent || '-'}
              </pre>
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>执行链（仅工具）</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {detail.toolChain.length > 0 ? detail.toolChain.map((tool, index) => (
                  <span
                    key={`${tool.toolName}-${index}`}
                    style={{
                      fontSize: 12,
                      borderRadius: 999,
                      padding: '4px 10px',
                      border: '1px solid var(--border-default)',
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {tool.toolName}
                  </span>
                )) : (
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>无工具调用</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MessageLogPanel() {
  const [filters, setFilters] = useState<MessageLogFilterForm>(MESSAGE_LOG_DEFAULT_FILTERS);
  const [submittedFilters, setSubmittedFilters] = useState<MessageLogFilterForm>(MESSAGE_LOG_DEFAULT_FILTERS);
  const [page, setPage] = useState(0);
  const [size] = useState(20);
  const [items, setItems] = useState<TenantMessageLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detail, setDetail] = useState<TenantMessageLogDetailResponse | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / size));

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = buildMessageLogQuery(submittedFilters, page, size);
      const response = await billingApi.listMessageLogs(query);
      setItems(response.items ?? []);
      setTotal(response.total ?? 0);
    } catch {
      setError('加载消息日志失败，请稍后重试');
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [submittedFilters, page, size]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  function updateFilter<K extends keyof MessageLogFilterForm>(key: K, value: MessageLogFilterForm[K]) {
    setFilters(prev => ({ ...prev, [key]: value }));
  }

  function handleSearch() {
    setPage(0);
    setSubmittedFilters(filters);
  }

  function handleReset() {
    setFilters(MESSAGE_LOG_DEFAULT_FILTERS);
    setSubmittedFilters(MESSAGE_LOG_DEFAULT_FILTERS);
    setPage(0);
  }

  async function handleOpenDetail(item: TenantMessageLogItem) {
    setDetailOpen(true);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const response = await billingApi.getMessageLogDetail(item.jobId);
      setDetail(response);
    } catch {
      setDetailError('加载日志详情失败，请稍后重试');
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div style={{ marginTop: 24, ...cardStyle, background: 'var(--bg-secondary)' }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14 }}>
        消息日志
      </div>

      {/* 筛选栏 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 10, marginBottom: 12 }}>
        <input value={filters.traceId} onChange={e => updateFilter('traceId', e.target.value)} placeholder="Trace ID" style={inputStyle} />
        <input value={filters.agentName} onChange={e => updateFilter('agentName', e.target.value)} placeholder="智能体名称" style={inputStyle} />
        <input value={filters.usageCredits} onChange={e => updateFilter('usageCredits', e.target.value)} placeholder="消耗量" style={inputStyle} />
        <select value={filters.type} onChange={e => updateFilter('type', e.target.value as MessageLogFilterForm['type'])} style={inputStyle}>
          <option value="">全部类型</option>
          <option value="user">用户提问</option>
          <option value="automation">自动化执行</option>
        </select>
        <select value={filters.chargeSource} onChange={e => updateFilter('chargeSource', e.target.value as MessageLogFilterForm['chargeSource'])} style={inputStyle}>
          <option value="">全部来源</option>
          <option value="FEISHU_AI_PACKAGE">飞书AI包</option>
          <option value="MOSS_CREDIT">MOSS账户</option>
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginBottom: 14 }}>
        <input type="datetime-local" value={filters.startAt} onChange={e => updateFilter('startAt', e.target.value)} style={inputStyle} />
        <input type="datetime-local" value={filters.endAt} onChange={e => updateFilter('endAt', e.target.value)} style={inputStyle} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={handleSearch}
            style={{
              padding: '8px 14px',
              border: 'none',
              borderRadius: 8,
              background: 'var(--btn-mono-bg)',
              color: 'var(--btn-mono-text)',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            查询
          </button>
          <button
            type="button"
            onClick={handleReset}
            style={{
              padding: '8px 14px',
              border: '1px solid var(--border-default)',
              borderRadius: 8,
              background: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            重置
          </button>
        </div>
      </div>

      {/* 表格 */}
      <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 10 }}>
        <table style={{ width: '100%', minWidth: 1160, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-secondary)' }}>
              {['智能体', '任务时间', '类型', '输入内容', '输出内容', '输出状态', '消耗来源', '消耗量', '操作'].map(title => (
                <th
                  key={title}
                  title={title === '消耗量' ? '飞书AI包点数可用时会优先消耗，否则消耗MOSS账户积分。1元 = 飞书 AI 包20点数 = MOSS账户10积分。' : undefined}
                  style={{
                    padding: '10px 12px',
                    textAlign: 'left',
                    fontSize: 12,
                    color: 'var(--text-muted)',
                    borderBottom: '1px solid var(--border-subtle)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={9} style={{ padding: '18px 12px', fontSize: 13, color: 'var(--text-muted)' }}>
                  加载中...
                </td>
              </tr>
            )}
            {!loading && error && (
              <tr>
                <td colSpan={9} style={{ padding: '18px 12px', fontSize: 13, color: 'var(--danger)' }}>
                  {error}
                </td>
              </tr>
            )}
            {!loading && !error && items.length === 0 && (
              <tr>
                <td colSpan={9} style={{ padding: '18px 12px', fontSize: 13, color: 'var(--text-muted)' }}>
                  暂无消息日志
                </td>
              </tr>
            )}
            {!loading && !error && items.map(item => (
              <tr key={item.jobId} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '10px 12px', fontSize: 12 }}>{item.agentName || '-'}</td>
                <td style={{ padding: '10px 12px', fontSize: 12 }}>{formatDateTime(item.taskAt)}</td>
                <td style={{ padding: '10px 12px', fontSize: 12 }}>{resolveMessageTypeLabel(item.type)}</td>
                <td style={{ padding: '10px 12px', fontSize: 12, maxWidth: 260 }} title={item.inputContent || ''}>
                  <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.inputContent || '-'}</div>
                </td>
                <td style={{ padding: '10px 12px', fontSize: 12, maxWidth: 260 }} title={item.outputContent || ''}>
                  <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.outputContent || '-'}</div>
                </td>
                <td style={{ padding: '10px 12px', fontSize: 12 }}>{resolveOutputStatusLabel(item.outputStatus)}</td>
                <td style={{ padding: '10px 12px', fontSize: 12 }}>{item.chargeSourceLabel || '-'}</td>
                <td style={{ padding: '10px 12px', fontSize: 12 }}>{formatUsageAmount(item.usageCredits, item.usageUnit)}</td>
                <td style={{ padding: '10px 12px', fontSize: 12 }}>
                  <button
                    type="button"
                    onClick={() => void handleOpenDetail(item)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--accent)',
                      cursor: 'pointer',
                      fontSize: 12,
                      padding: 0,
                    }}
                  >
                    查看详情
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          共 {total} 条，当前第 {Math.min(page + 1, totalPages)} / {totalPages} 页
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            disabled={page <= 0}
            onClick={() => setPage(prev => Math.max(prev - 1, 0))}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: '1px solid var(--border-default)',
              background: page <= 0 ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
              color: page <= 0 ? 'var(--text-disabled)' : 'var(--text-secondary)',
              cursor: page <= 0 ? 'not-allowed' : 'pointer',
              fontSize: 12,
            }}
          >
            上一页
          </button>
          <button
            type="button"
            disabled={page + 1 >= totalPages}
            onClick={() => setPage(prev => Math.min(prev + 1, totalPages - 1))}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: '1px solid var(--border-default)',
              background: page + 1 >= totalPages ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
              color: page + 1 >= totalPages ? 'var(--text-disabled)' : 'var(--text-secondary)',
              cursor: page + 1 >= totalPages ? 'not-allowed' : 'pointer',
              fontSize: 12,
            }}
          >
            下一页
          </button>
        </div>
      </div>

      <MessageLogDetailModal
        open={detailOpen}
        loading={detailLoading}
        error={detailError}
        detail={detail}
        onClose={() => setDetailOpen(false)}
      />
    </div>
  );
}

// ── 主组件 ──

/**
 * 用量管理页（管理后台子页面，?tab=usage）。
 *
 * 三卡片并列布局：套餐状态 + 资源使用情况 + 联系销售。
 * BILLING_NOT_PROVISIONED 时降级为单一空态视图。
 * 消息日志支持筛选、分页与详情查看。
 */
const UsageManagement: React.FC = () => {
  const { fetchCredits, credits, lastStatusErrorCode } = useBillingStore();
  const [loading, setLoading] = useState(true);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [salesOpen, setSalesOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorCode(null);
    try {
      await fetchCredits();
    } catch {
      // fetchCredits 内部已记录 error，这里仅清理 loading
    } finally {
      setLoading(false);
    }
  }, [fetchCredits]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // 从 store 同步错误码（fetchCredits 失败时 lastStatusErrorCode 可能有值）
  useEffect(() => {
    setErrorCode(lastStatusErrorCode);
  }, [lastStatusErrorCode]);

  if (loading) {
    return (
      <div style={{ padding: '32px 28px' }} data-testid="usage-management-page">
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }} data-testid="usage-management-loading">加载中...</div>
      </div>
    );
  }

  // BILLING_NOT_PROVISIONED：未开通计费，整页替换为空态
  if (errorCode === BillingErrorCodes.BILLING_NOT_PROVISIONED || (credits === null && errorCode !== null)) {
    const isNotProvisioned = errorCode === BillingErrorCodes.BILLING_NOT_PROVISIONED;
    return (
      <div style={{ padding: '28px' }} data-testid="usage-management-page">
        {isNotProvisioned ? (
          <NotProvisionedView onOpenSales={() => setSalesOpen(true)} />
        ) : (
          <div style={{ padding: '48px 32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
            加载用量数据失败，请稍后重试
          </div>
        )}
        <ContactSalesModal open={salesOpen} onClose={() => setSalesOpen(false)} />
      </div>
    );
  }

  if (!credits) {
    return (
      <div style={{ padding: '48px 32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }} data-testid="usage-management-page">
        暂无用量数据
      </div>
    );
  }

  return (
    <div style={{ padding: '28px' }} data-testid="usage-management-page">
      {/* 三卡片并列布局 */}
      <div
        data-testid="usage-management-overview"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
          marginBottom: 0,
        }}
      >
        <PlanStatusCard credits={credits} />
        <ResourceUsageCard credits={credits} />
        <ContactSalesCard onOpenSales={() => setSalesOpen(true)} />
      </div>

      {/* 消息日志 */}
      <MessageLogPanel />

      <ContactSalesModal open={salesOpen} onClose={() => setSalesOpen(false)} />
    </div>
  );
};

export default UsageManagement;
