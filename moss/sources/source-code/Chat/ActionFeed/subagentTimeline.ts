import type { SubAgentExecution } from '../../../types';
import type { ActionItemData } from './ActionItem';

export interface SubAgentTimelinePlacement {
  byActionId: Map<string, SubAgentExecution[]>;
  unanchored: SubAgentExecution[];
}

function toolCallIdFromParentStep(parentStepId: string | undefined): string | undefined {
  if (!parentStepId?.startsWith('tool:')) return undefined;
  const toolCallId = parentStepId.slice('tool:'.length).trim();
  return toolCallId || undefined;
}

function toolCallIdFromDelegation(parentTaskId: string | undefined): string | undefined {
  if (!parentTaskId?.startsWith('delegation_')) return undefined;
  const toolCallId = parentTaskId.slice('delegation_'.length).trim();
  return toolCallId || undefined;
}

function nearestPrecedingTaskAction(
  actions: ActionItemData[],
  eventSeq: number | undefined,
): ActionItemData | undefined {
  if (eventSeq == null) return undefined;
  let nearest: ActionItemData | undefined;
  for (const action of actions) {
    if (action.toolName !== 'task' || action.traceEventSeq == null || action.traceEventSeq > eventSeq) {
      continue;
    }
    if (!nearest || (nearest.traceEventSeq ?? -1) < action.traceEventSeq) {
      nearest = action;
    }
  }
  return nearest;
}

export function resolveSubAgentTimelinePlacement(
  actions: ActionItemData[],
  subAgents: SubAgentExecution[],
): SubAgentTimelinePlacement {
  const byActionId = new Map<string, SubAgentExecution[]>();
  const unanchored: SubAgentExecution[] = [];
  const actionsById = new Map(actions.map(action => [action.id, action]));
  const taskActions = actions.filter(action => action.toolName === 'task');

  for (const subAgent of subAgents) {
    const explicitActionId = subAgent.anchorToolCallId
      || toolCallIdFromParentStep(subAgent.parentStepId)
      || toolCallIdFromDelegation(subAgent.parentTaskId);
    const fallbackAction = explicitActionId
      ? actionsById.get(explicitActionId)
      : nearestPrecedingTaskAction(actions, subAgent.startedEventSeq)
        || (taskActions.length === 1 ? taskActions[0] : undefined);
    const actionId = actionsById.has(explicitActionId || '')
      ? explicitActionId
      : fallbackAction?.id;

    if (!actionId) {
      unanchored.push(subAgent);
      continue;
    }
    const bucket = byActionId.get(actionId) ?? [];
    bucket.push(subAgent);
    byActionId.set(actionId, bucket);
  }

  return { byActionId, unanchored };
}
