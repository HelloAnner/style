import { useAgentStore } from '../../stores/agentStore';

export function resolveDashboardWorkingSessionId(
  agentId: string | null | undefined,
  dashboardKey: string | null | undefined,
  currentSessionId: string | null | undefined,
): string | null {
  if (currentSessionId) return currentSessionId;
  if (!agentId || !dashboardKey) return null;
  return useAgentStore.getState().reserveNewSessionId();
}
