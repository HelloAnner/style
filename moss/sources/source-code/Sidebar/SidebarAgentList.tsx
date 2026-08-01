import React from 'react';
import { useAgentSwitchController } from '../Agent/useAgentSwitchController';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { getAgentDisplayName } from '../../types/platform';
import activeDotIcon from '../../assets/icons/sidebar/active-dot.svg';
import { SidebarAgentIcon } from './SidebarAgentIcon';

const labelStyle: React.CSSProperties = {
  padding: '6px 4px 4px',
  color: 'var(--moss-sidebar-text-muted)',
  fontSize: 12,
  lineHeight: '20px',
  fontWeight: 400,
};

export const SidebarAgentList: React.FC = () => {
  const {
    selectableAgents,
    currentAgentId,
    pendingSwitchAgent,
    switchingAgentId,
    selectAgent,
    confirmPendingSwitch,
    cancelPendingSwitch,
  } = useAgentSwitchController();

  if (selectableAgents.length === 0) return null;

  return (
    <div data-sidebar-entry="agent-picker" style={{ padding: '0 12px 4px' }} data-testid="sidebar-agent-list">
      <div style={labelStyle}>我的 Agent</div>
      <div role="listbox" aria-label="我的 Agent" style={{ display: 'grid', gap: 2 }} data-testid="sidebar-agent-listbox">
        {selectableAgents.map((agent) => {
          const isSelected = agent.id === currentAgentId;
          const isSwitching = agent.id === switchingAgentId;

          return (
            <button
              key={agent.id}
              type="button"
              className="sidebar-agent-item"
              role="option"
              aria-selected={isSelected}
              disabled={isSwitching}
              onClick={() => selectAgent(agent)}
              style={{
                position: 'relative',
                width: '100%',
                minHeight: 36,
                padding: '7px 28px 7px 12px',
                border: 'none',
                borderRadius: 8,
                background: isSelected ? 'var(--moss-sidebar-item-active-bg)' : 'transparent',
                color: isSelected
                  ? 'var(--moss-sidebar-text-primary)'
                  : 'var(--moss-sidebar-text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: isSwitching ? 'wait' : 'pointer',
                font: 'inherit',
                fontSize: 14,
                lineHeight: '22px',
                textAlign: 'left',
                opacity: isSwitching ? 0.7 : 1,
              }}
              onMouseEnter={(event) => {
                if (!isSelected) {
                  event.currentTarget.style.background = 'var(--moss-sidebar-item-hover-bg)';
                }
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = isSelected
                  ? 'var(--moss-sidebar-item-active-bg)'
                  : 'transparent';
              }}
              data-testid={`sidebar-agent-item-${agent.id}`}
            >
              <SidebarAgentIcon agent={agent} />
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {getAgentDisplayName(agent)}
              </span>
              {isSelected && (
                <img
                  src={activeDotIcon}
                  alt=""
                  aria-hidden="true"
                  width={8}
                  height={8}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    width: 8,
                    height: 8,
                    transform: 'translateY(-50%)',
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      <ConfirmDialog
        open={Boolean(pendingSwitchAgent)}
        title="切换智能体会中断当前任务"
        description="当前任务将停止，切换后会使用新的智能体继续。"
        confirmText="切换"
        cancelText="取消"
        variant="danger"
        onConfirm={confirmPendingSwitch}
        onCancel={cancelPendingSwitch}
      />
    </div>
  );
};

export default SidebarAgentList;
