import { useEffect, useState } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { billingApi, type UsageDetailTargetResponse } from '../../api/billing';
import DashboardRecordsPanel from '../admin/AgentSupervision/DashboardRecordsPanel';
import SessionLogTab from '../admin/AgentSupervision/SessionLogTab';

export default function FeishuUsageDetailPage() {
  const { usageId } = useParams<{ usageId: string }>();
  const location = useLocation();
  const [target, setTarget] = useState<UsageDetailTargetResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(usageId));
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!usageId) {
      setTarget(null);
      setLoading(false);
      setError(false);
      return;
    }
    let cancelled = false;
    setTarget(null);
    setLoading(true);
    setError(false);
    billingApi.getUsageDetailTarget(usageId)
      .then((value) => {
        if (!cancelled) setTarget(value);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [usageId]);

  if (!usageId) {
    return (
      <div style={{ height: '100vh', background: 'var(--bg-primary)', overflow: 'auto' }} data-testid="feishu-usage-detail-page">
        <SessionLogTab />
      </div>
    );
  }

  const searchParams = new URLSearchParams(location.search);
  if (searchParams.has('usageId')) {
    searchParams.delete('usageId');
    const query = searchParams.toString();
    return <Navigate to={`${location.pathname}${query ? `?${query}` : ''}`} replace />;
  }

  if (loading) {
    return (
      <div role="status" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
        正在加载使用详情…
      </div>
    );
  }

  if (error || !target || (target.recordType === 'dashboard' && !target.usageRecordId)) {
    return (
      <div role="alert" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
        该使用详情不存在或无权访问
      </div>
    );
  }

  if (target.recordType === 'dashboard') {
    return (
      <div style={{ height: '100vh', background: 'var(--bg-primary)', overflow: 'auto' }} data-testid="feishu-usage-detail-page">
        <DashboardRecordsPanel
          usageRecordId={target.usageRecordId}
          usageDetailClosePath="/feishu/usage"
        />
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', background: 'var(--bg-primary)', overflow: 'auto' }} data-testid="feishu-usage-detail-page">
      <SessionLogTab usageId={usageId} usageDetailClosePath="/feishu/usage" />
    </div>
  );
}
