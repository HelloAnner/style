import React from 'react';
import { Link } from 'react-router-dom';
import { CONFIG_TABS, type ConfigKey } from './superAdminConfig';

export const SuperAdminConfigHeader: React.FC<{ activeKey: ConfigKey }> = ({ activeKey }) => {
  return (
    <div className="fi-config-header" data-testid="superadmin-config-header">
      <div className="fi-config-header-titles">
        <div className="fi-config-header-title">配置中心</div>
        <div className="fi-config-header-subtitle">
          通道、第三方接入、智能看板、模型、系统开关与付费 API 统一在这里维护。
        </div>
      </div>
      <nav className="fi-config-tabs" data-testid="superadmin-config-tabs" aria-label="配置中心">
        {CONFIG_TABS.map((tab) => {
          const active = tab.key === activeKey;
          return (
            <Link
              key={tab.key}
              to={tab.path}
              aria-current={active ? 'page' : undefined}
              className={`fi-config-tab${active ? ' is-active' : ''}`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
};
