/**
 * DashboardQueryForm — 看板的查询条件区
 *
 * 职责：
 *   - 根据当前看板的 inputs schema **动态渲染**查询条件
 *   - 评估 show_when 决定字段是否显示
 *   - 提供"查询 / 重置"两个动作按钮，并允许调用方插入额外动作
 *   - 严格手动触发：任何字段改动都不自动查，只有点"查询"才发请求
 *
 * 布局：
 *   - 网格按 field.width 划分（full=12 / threeQuarter=9 / half=6 / third=4 / quarter=3 列）
 *   - 每个字段一行 label + 控件
 *   - 底部一行 action（查询 / 重置）
 */
import React, { useMemo } from 'react';
import { track } from '../../utils/track';
import { useDashboardStore, evalShowWhen, validateRequired } from '../../stores/dashboardStore';
import { useUiStore } from '../../stores/uiStore';
import { useBillingStore } from '../../stores/billingStore';
import { useTenantStore } from '../../stores/tenantStore';
import { resolveWorkspaceBillingUiState } from '../../utils/billingUiState';
import { DynamicInput } from './inputs';

interface DashboardQueryFormProps {
  onSubmitStart?: () => void;
  sessionId?: string | null;
  restoreWorkspaceOnSubmit?: boolean;
  actionsStart?: React.ReactNode;
  actionsBeforeReset?: React.ReactNode;
}

const WIDTH_COLSPAN: Record<string, number> = {
  full: 12,
  threeQuarter: 9,
  half: 6,
  third: 4,
  quarter: 3,
};

// 维护提示：重置按钮文案已由 UX 确认为“重置查询条件”，保留中英文结构，避免直接写死在 JSX。
const QUERY_FORM_COPY = {
  zh: {
    reset: '重置查询条件',
  },
  en: {
    reset: 'Reset query filters',
  },
} as const;

type QueryFormLocale = keyof typeof QUERY_FORM_COPY;

function resolveQueryFormLocale(): QueryFormLocale {
  if (typeof navigator === 'undefined') return 'zh';
  const language = navigator.language || navigator.languages?.[0] || '';
  return language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

function useQueryFormCopy() {
  const [locale, setLocale] = React.useState<QueryFormLocale>(() => resolveQueryFormLocale());

  React.useEffect(() => {
    const next = resolveQueryFormLocale();
    if (next !== locale) setLocale(next);
  }, [locale]);

  return QUERY_FORM_COPY[locale];
}

export const DashboardQueryForm: React.FC<DashboardQueryFormProps> = ({
  onSubmitStart,
  sessionId,
  restoreWorkspaceOnSubmit = true,
  actionsStart,
  actionsBeforeReset,
}) => {
  const copy = useQueryFormCopy();
  const inputs = useDashboardStore((s) => s.inputs);
  const setInput = useDashboardStore((s) => s.setInput);
  const submitQuery = useDashboardStore((s) => s.submitQuery);
  const resetInputs = useDashboardStore((s) => s.resetInputs);
  const loading = useDashboardStore((s) => s.loading);
  const error = useDashboardStore((s) => s.error);
  const currentKey = useDashboardStore((s) => s.currentKey);
  const schema = useDashboardStore((s) => s.getCurrentSchema());
  const restoreWorkspaceSize = useUiStore((s) => s.restoreWorkspaceSize);
  const billingStatus = useBillingStore((s) => s.billingStatus);
  const currentWorkspace = useTenantStore((s) => s.currentWorkspace);
  const billingUiState = resolveWorkspaceBillingUiState({
    billingStatus,
    role: currentWorkspace?.role ?? 'member',
  });
  const billingBlocked = !!billingUiState.billingBlockReason;

  const visibleFields = useMemo(
    () => schema.filter((f) => evalShowWhen(f.show_when, inputs)),
    [schema, inputs],
  );

  const missing = useMemo(
    () => validateRequired(schema, inputs),
    [schema, inputs],
  );

  const canSubmit = missing.length === 0 && !loading && !billingBlocked;
  const btnLabel = loading ? '查询中…' : '查询';
  const billingBlockedTitle = billingBlocked ? '当前空间额度不足，暂不可发起新的看板查询或修改查询条件' : undefined;
  const handleSubmit = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (billingBlocked) return;
    track('board_query', { board_id: currentKey ?? undefined });
    onSubmitStart?.();
    if (restoreWorkspaceOnSubmit) {
      restoreWorkspaceSize();
    }
    void submitQuery({ force: event.shiftKey, sessionId });
  };

  return (
    <div className="dashboard-queryform">
      {visibleFields.length > 0 && (
        <div className="dashboard-queryform-grid">
          {visibleFields.map((f) => {
            const colspan = WIDTH_COLSPAN[f.width || 'half'] || 6;
            return (
              <div
                key={f.name}
                className="dashboard-queryform-field"
                style={{ gridColumn: `span ${colspan}` }}
              >
                {/* help 文字以 title 形式挂在 label 上，鼠标悬停看见，不再单独画 "?" 图标 */}
                <label className="dashboard-queryform-label" title={f.help || undefined}>
                  {f.label || f.name}
                  {f.required && <span className="dashboard-queryform-required">*</span>}
                </label>
                <div className="dashboard-queryform-control">
                  <DynamicInput
                    field={f}
                    value={inputs[f.name]}
                    onChange={(v) => setInput(f.name, v)}
                    disabled={loading || billingBlocked}
                    sessionId={sessionId}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="dashboard-queryform-actions">
        {/* Keep leading action children as direct flex items so their visual gap matches the trailing buttons. */}
        <div className="dashboard-queryform-leading-actions">
          {actionsStart}
          {error && <span className="dashboard-queryform-err">{error}</span>}
        </div>
        {actionsBeforeReset}
        {schema.length > 0 && (
          <button
            type="button"
            className="dashboard-queryform-reset"
            onClick={resetInputs}
            disabled={loading || billingBlocked}
            title={billingBlockedTitle}
          >
            {copy.reset}
          </button>
        )}
        <button
          type="button"
          className="dashboard-query-btn"
          disabled={!canSubmit}
          title={billingBlockedTitle || (missing.length ? `请填写：${missing.join('、')}` : undefined)}
          onClick={handleSubmit}
        >
          {btnLabel}
        </button>
      </div>
    </div>
  );
};
