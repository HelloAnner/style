import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAgentContextStore } from '../../stores/agentContextStore';
import { agentApi } from '../../api/platform';
import { AgentForm } from './AgentForm';
import { ConfirmDialog } from '../common/ConfirmDialog';
import type { Agent, AgentCreate, AgentUpdate } from '../../types/platform';
import { getAgentDisplayName } from '../../types/platform';
import { useAgentSwitchController } from './useAgentSwitchController';
import styles from './AgentSelector.module.css';

const toTestIdSegment = (value: string) => value.replace(/[^a-zA-Z0-9_-]+/g, '-');

export function AgentSelector() {
  const updateAgent = useAgentContextStore((s) => s.updateAgent);
  const {
    selectableAgents,
    currentAgentId,
    currentAgent: current,
    pendingSwitchAgent,
    selectAgent,
    confirmPendingSwitch,
    cancelPendingSwitch,
  } = useAgentSwitchController();

  const [open, setOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [targetAgent, setTargetAgent] = useState<Agent | null>(null);
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // 管理后台通过 /?openAgentSettings=<id> 跳回工作台，这里捕获 query 自动打开设置弹窗。
  useEffect(() => {
    const targetId = searchParams.get('openAgentSettings');
    if (!targetId) return;
    if (selectableAgents.length === 0) return;
    const target = selectableAgents.find((a) => a.id === targetId);
    if (target) {
      setTargetAgent(target);
      setShowForm(true);
      if (searchParams.get('from') === 'admin') {
        setReturnTo('/admin?tab=agents');
      }
    }
    const next = new URLSearchParams(searchParams);
    next.delete('openAgentSettings');
    next.delete('from');
    setSearchParams(next, { replace: true });
  }, [searchParams, selectableAgents, setSearchParams]);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const handleSave = async (data: AgentCreate | AgentUpdate) => {
    if (!targetAgent) return;
    const saved = await agentApi.update(targetAgent.id, data as AgentUpdate);
    updateAgent(saved);
  };

  const handleSelectAgent = (agent: Agent) => {
    selectAgent(agent);
    setOpen(false);
  };

  if (!current) return null;

  return (
    <>
      <div ref={rootRef} className={styles.root} data-testid="agent-picker">
        <button
          data-testid="agent-picker-trigger"
          className={styles.trigger}
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span data-testid="agent-picker-orb" className={styles.orb} aria-hidden="true" />
          <span className={styles.name} data-testid="agent-picker-current-name">{getAgentDisplayName(current)}</span>
          <ChevronDown
            data-testid="agent-picker-chevron"
            size={14}
            className={styles.chevron}
          />
        </button>

        {open && (
          <ul className={styles.menu} role="listbox" data-testid="agent-picker-menu">
            {selectableAgents.map((a) => (
              <li
                key={a.id}
                data-testid={`agent-menu-item-${toTestIdSegment(a.id)}`}
                role="option"
                aria-selected={a.id === currentAgentId}
                className={styles.menuItem}
                onClick={() => handleSelectAgent(a)}
              >
                <span className={styles.orb} aria-hidden="true" />
                <span>{getAgentDisplayName(a)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showForm && targetAgent && (
        <AgentForm
          agent={targetAgent}
          onSave={handleSave}
          onClose={() => {
            setShowForm(false);
            setTargetAgent(null);
            if (returnTo) {
              const to = returnTo;
              setReturnTo(null);
              navigate(to);
            }
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(pendingSwitchAgent)}
        title="切换智能体会中断当前任务"
        description="当前任务将停止，切换后会使用新的智能体继续。"
        confirmText="切换"
        cancelText="取消"
        variant="danger"
        backdropTestId="agent-switch-confirm-backdrop"
        panelTestId="agent-switch-confirm-dialog"
        titleTestId="agent-switch-confirm-title"
        descriptionTestId="agent-switch-confirm-description"
        cancelButtonTestId="agent-switch-confirm-cancel"
        confirmButtonTestId="agent-switch-confirm-confirm"
        onConfirm={confirmPendingSwitch}
        onCancel={cancelPendingSwitch}
      />
    </>
  );
}

export default AgentSelector;
