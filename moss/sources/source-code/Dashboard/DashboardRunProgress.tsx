import React from 'react';
import { AlertCircle, CheckCircle2, Loader2, MinusCircle } from 'lucide-react';
import type { DashboardSnapshot } from '../../api/dashboards';

type BindingKind = 'data' | 'ai';

interface BindingProgressItem {
  key: string;
  label: string;
  kind?: BindingKind;
}

interface DashboardRunProgressProps {
  dashboardKey: string | null;
  snapshot: DashboardSnapshot | null;
  loading: boolean;
}

type BindingStatus = 'pending' | 'done' | 'error' | 'skipped';

const DASHBOARD_BINDING_PROGRESS: Record<string, BindingProgressItem[]> = {
  'batch-query': [
    { key: 'report', label: '批量报表' },
  ],
  'bidding-query': [
    { key: 'biddings', label: '招投标记录' },
  ],
  'company-filter': [
    { key: 'companies', label: '企业名单' },
  ],
  'customer-profile': [
    { key: 'basic_info', label: '工商信息' },
    { key: 'group_info', label: '集团关系' },
    { key: 'relation_chain', label: '关系链' },
    { key: 'financing', label: '融资' },
    { key: 'outward_investment', label: '对外投资' },
    { key: 'company_news', label: '舆情' },
    { key: 'biddings', label: '招投标' },
    { key: 'hire_list', label: '招聘' },
    { key: 'leader_positions', label: '高管' },
    { key: 'certificates', label: '资质' },
    { key: 'competitive_intel', label: '竞对洞察', kind: 'ai' },
    { key: 'financial_intel', label: '财务洞察', kind: 'ai' },
  ],
  'enterprise-360': [
    { key: 'basic_info', label: '基本信息' },
    { key: 'stockholders', label: '股东结构' },
    { key: 'financing', label: '融资历史' },
    { key: 'biddings', label: '招投标' },
    { key: 'hire_list', label: '招聘' },
    { key: 'leader_positions', label: '主要人员' },
    { key: 'contacts', label: '联系方式' },
    { key: 'patents', label: '专利' },
    { key: 'certificates', label: '资质证书' },
    { key: 'policy_subsidies', label: '政策补贴' },
    { key: 'news_intel', label: '新闻动态', kind: 'ai' },
  ],
  'enterprise-risk': [
    { key: 'biz', label: '企业信息' },
    { key: 'litigation', label: '诉讼风险' },
    { key: 'or_oper_abnorm', label: '经营异常' },
    { key: 'or_punishment', label: '行政处罚' },
    { key: 'or_illegal', label: '严重违法' },
    { key: 'or_tax_illegal', label: '税收违法' },
    { key: 'or_tax_arrears', label: '欠税' },
    { key: 'or_equity_pledge', label: '股权出质' },
    { key: 'or_mortgage', label: '动产抵押' },
    { key: 'or_tax_abnormal', label: '税务异常' },
    { key: 'or_simple_cancel', label: '简易注销' },
    { key: 'or_clear', label: '经营风险清白' },
  ],
  'industry-chain': [
    { key: 'chain', label: '产业链图谱' },
    { key: 'companies', label: '节点企业' },
  ],
  'key-account-operations': [
    { key: 'company_base', label: '客户基础' },
    { key: 'crm_cooperation', label: 'CRM合作' },
    { key: 'contracts_ytd', label: '年度合同' },
    { key: 'ka_archive', label: '客户档案' },
    { key: 'power_map', label: '权力地图' },
    { key: 'opportunities', label: '商机' },
    { key: 'related_companies', label: '关联企业' },
    { key: 'kh_search', label: '案例检索', kind: 'ai' },
    { key: 'ai_case_recommendation', label: '方案推荐', kind: 'ai' },
    { key: 'ai_warmap', label: '作战地图', kind: 'ai' },
    { key: 'ai_questions', label: '问题清单', kind: 'ai' },
    { key: 'external_insight', label: '外部洞察', kind: 'ai' },
  ],
  'relation-mining': [
    { key: 'host_info', label: '主体信息' },
    { key: 'relation_chain', label: '关系链' },
  ],
  'visit-preparation': [
    { key: 'basic_info', label: '工商信息' },
    { key: 'crm_customer', label: 'CRM客户' },
    { key: 'stockholders', label: '股东' },
    { key: 'policy_subsidies', label: '政策补贴' },
    { key: 'biddings', label: '招投标' },
    { key: 'financial_data', label: '财务数据' },
    { key: 'contacts', label: '联系方式' },
    { key: 'intel_insight', label: '情报洞察', kind: 'ai' },
  ],
};

function bindingStatus(snapshot: DashboardSnapshot, key: string): BindingStatus {
  if (!Object.prototype.hasOwnProperty.call(snapshot.bindings_data || {}, key)) {
    return 'pending';
  }
  const value = snapshot.bindings_data?.[key];
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const data = value as Record<string, unknown>;
    if (data._error || data.error) return 'error';
    if (data._pending === 'ai_async') return 'pending';
    if (data._skipped) return 'skipped';
  }
  return 'done';
}

function statusLabel(status: BindingStatus, kind: BindingKind | undefined): string {
  if (status === 'done') return '已返回';
  if (status === 'error') return '失败';
  if (status === 'skipped') return '跳过';
  return kind === 'ai' ? '分析中' : '查询中';
}

function StatusIcon({ status }: { status: BindingStatus }) {
  if (status === 'done') return <CheckCircle2 size={13} aria-hidden="true" />;
  if (status === 'error') return <AlertCircle size={13} aria-hidden="true" />;
  if (status === 'skipped') return <MinusCircle size={13} aria-hidden="true" />;
  return <Loader2 size={13} className="dashboard-run-progress-spin" aria-hidden="true" />;
}

export const DashboardRunProgress: React.FC<DashboardRunProgressProps> = ({
  dashboardKey,
  snapshot,
  loading,
}) => {
  if (!loading || !snapshot?.html) return null;

  const items = dashboardKey ? DASHBOARD_BINDING_PROGRESS[dashboardKey] : undefined;
  if (!items || items.length === 0) {
    return (
      <div className="dashboard-run-progress" role="status" aria-live="polite">
        <div className="dashboard-run-progress-head">
          <Loader2 size={14} className="dashboard-run-progress-spin" aria-hidden="true" />
          <span>已展示部分结果，剩余数据继续查询中</span>
        </div>
      </div>
    );
  }

  const states = items.map((item) => ({
    item,
    status: bindingStatus(snapshot, item.key),
  }));
  const settledCount = states.filter(({ status }) => status !== 'pending').length;
  const waitingCount = states.length - settledCount;

  if (waitingCount === 0) return null;

  return (
    <div className="dashboard-run-progress" role="status" aria-live="polite">
      <div className="dashboard-run-progress-head">
        <Loader2 size={14} className="dashboard-run-progress-spin" aria-hidden="true" />
        <span>已返回 {settledCount}/{states.length} 个模块，剩余数据继续查询中</span>
      </div>
      <div className="dashboard-run-progress-items" aria-label="看板模块查询进度">
        {states.map(({ item, status }) => (
          <div
            key={item.key}
            className={`dashboard-run-progress-item is-${status}`}
            title={`${item.label}：${statusLabel(status, item.kind)}`}
          >
            <StatusIcon status={status} />
            <span className="dashboard-run-progress-name">{item.label}</span>
            <span className="dashboard-run-progress-state">{statusLabel(status, item.kind)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
