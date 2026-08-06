import type { Agent } from '../../types/platform';

export const BOARD_ENTRY_ENABLED = true;

const BOARD_AGENT_BUSINESS_IDS = new Set([
  'business_insight',
  'risk_insight',
]);

const BOARD_AGENT_NAMES = new Set([
  '客户洞察',
  '风险管理',
]);

export function supportsBoard(agent: Pick<Agent, 'businessId' | 'name'> | null | undefined): boolean {
  if (!BOARD_ENTRY_ENABLED) return false;
  if (!agent) return false;
  if (agent.businessId && BOARD_AGENT_BUSINESS_IDS.has(agent.businessId)) return true;
  return BOARD_AGENT_NAMES.has(agent.name?.trim() ?? '');
}
