import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cancelJob } from '../../api/jobApi';
import { findActiveAssistantMessage, hasActiveAssistantMessage } from '../../lib/conversationActivity';
import { useAgentContextStore } from '../../stores/agentContextStore';
import { useAgentStore } from '../../stores/agentStore';
import { usePreviewStore } from '../../stores/previewStore';
import { useSessionRuntimeStore } from '../../stores/sessionRuntimeStore';
import type { Agent } from '../../types/platform';
import { WORKSPACE_HOME_PATH } from '../../utils/routes';

export function useAgentSwitchController() {
  const navigate = useNavigate();
  const agents = useAgentContextStore((s) => s.agents);
  const currentAgentId = useAgentContextStore((s) => s.currentAgentId);
  const setCurrentAgent = useAgentContextStore((s) => s.setCurrentAgent);
  const startNewSession = useAgentStore((s) => s.startNewSession);
  const closeSessionTabs = usePreviewStore((s) => s.closeSessionTabs);
  const messages = useSessionRuntimeStore((s) => s.messages);
  const [pendingSwitchAgent, setPendingSwitchAgent] = useState<Agent | null>(null);
  const [switchingAgentId, setSwitchingAgentId] = useState<string | null>(null);

  const selectableAgents = useMemo(
    () => agents.filter((agent) => agent.visibility !== 'internal'),
    [agents],
  );
  const currentAgent = selectableAgents.find((agent) => agent.id === currentAgentId)
    ?? selectableAgents[0]
    ?? null;
  const hasActiveTask = hasActiveAssistantMessage(messages);

  const cancelCurrentPlatformJob = useCallback(async (): Promise<boolean> => {
    const runtime = useSessionRuntimeStore.getState();
    const runningAssistant = findActiveAssistantMessage(runtime.messages);
    if (!runningAssistant?.job_id) return true;
    const previousStatus = runningAssistant.status;
    const previousIsStreaming = runningAssistant.isStreaming;

    runtime.updateMessage(runningAssistant.id, message => ({
      ...message,
      status: 'cancelling',
      isStreaming: true,
    }));

    try {
      const response = await cancelJob(runningAssistant.job_id);
      if (response.status === 'CANCELLED') {
        runtime.updateMessage(runningAssistant.id, message => ({
          ...message,
          content: message.content || '任务已取消',
          status: 'cancelled',
          isStreaming: false,
        }));
        return true;
      }
    } catch (error) {
      console.warn('[AgentSwitch] cancel current job before switching failed:', error);
    }
    runtime.updateMessage(runningAssistant.id, message => ({
      ...message,
      status: previousStatus,
      isStreaming: previousIsStreaming,
    }));
    return false;
  }, []);

  const switchAgent = useCallback(
    async (agent: Agent, interruptTask: boolean) => {
      if (switchingAgentId) {
        setPendingSwitchAgent(null);
        return;
      }

      if (agent.id === currentAgentId) {
        if (interruptTask) {
          const cancelled = await cancelCurrentPlatformJob();
          if (!cancelled) return;
        }
        closeSessionTabs();
        startNewSession();
        navigate(WORKSPACE_HOME_PATH);
        setPendingSwitchAgent(null);
        return;
      }

      setSwitchingAgentId(agent.id);
      try {
        if (interruptTask) {
          const cancelled = await cancelCurrentPlatformJob();
          if (!cancelled) return;
        }
        setCurrentAgent(agent.id);
        navigate(WORKSPACE_HOME_PATH);
      } finally {
        setSwitchingAgentId(null);
        setPendingSwitchAgent(null);
      }
    },
    [
      cancelCurrentPlatformJob,
      closeSessionTabs,
      currentAgentId,
      navigate,
      setCurrentAgent,
      startNewSession,
      switchingAgentId,
    ],
  );

  const selectAgent = useCallback(
    (agent: Agent) => {
      if (agent.id === currentAgentId) {
        if (hasActiveTask) {
          setPendingSwitchAgent(agent);
          return;
        }
        void switchAgent(agent, false);
        return;
      }
      if (hasActiveTask) {
        setPendingSwitchAgent(agent);
        return;
      }
      void switchAgent(agent, false);
    },
    [currentAgentId, hasActiveTask, switchAgent],
  );

  const confirmPendingSwitch = useCallback(() => {
    if (!pendingSwitchAgent) return;
    void switchAgent(pendingSwitchAgent, true);
  }, [pendingSwitchAgent, switchAgent]);

  const cancelPendingSwitch = useCallback(() => {
    setPendingSwitchAgent(null);
  }, []);

  return {
    selectableAgents,
    currentAgent,
    currentAgentId,
    pendingSwitchAgent,
    switchingAgentId,
    selectAgent,
    confirmPendingSwitch,
    cancelPendingSwitch,
  };
}
