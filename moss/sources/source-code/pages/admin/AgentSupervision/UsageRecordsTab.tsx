import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshIconButton } from '../../../components/common/RefreshIconButton';
import DashboardRecordsPanel from './DashboardRecordsPanel';
import SessionLogTab from './SessionLogTab';
import './usage-records.css';

type RecordType = 'conversation' | 'dashboard';

const UsageRecordsTab: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [refreshKey, setRefreshKey] = React.useState(0);
  const recordType: RecordType = searchParams.get('recordType') === 'dashboard' ? 'dashboard' : 'conversation';

  const changeType = (nextType: RecordType) => {
    const next = new URLSearchParams(searchParams);
    if (nextType === 'conversation') next.delete('recordType');
    else next.set('recordType', nextType);
    next.delete('usageId');
    next.delete('recordId');
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="usage-records-shell">
      <div className="usage-records-type-tabs-wrap">
        <div className="usage-records-type-tabs role-segment" role="tablist" aria-label="使用记录类型">
          {([
            ['conversation', '对话记录'],
            ['dashboard', '看板查询记录'],
          ] as Array<[RecordType, string]>).map(([type, label]) => (
            <button
              key={type}
              type="button"
              role="tab"
              aria-selected={recordType === type}
              className={`usage-records-type-tab er-chip ${recordType === type ? 'active' : ''}`}
              onClick={() => changeType(type)}
            >
              {label}
            </button>
          ))}
        </div>
        <RefreshIconButton
          className="usage-records-top-refresh"
          onClick={() => setRefreshKey(key => key + 1)}
          data-testid="usage-records-refresh"
        />
      </div>
      <div className="usage-records-content">
        {recordType === 'conversation' ? <SessionLogTab refreshKey={refreshKey} /> : <DashboardRecordsPanel refreshKey={refreshKey} />}
      </div>
    </div>
  );
};

export default UsageRecordsTab;
