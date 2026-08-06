import type { Agent } from '../../types/platform';
import { getAgentDisplayName } from '../../types/platform';
import type { PlatformOnboardingStatus } from '../../api/platformAuth';

export type OnboardingAgentKind = 'customer' | 'risk' | 'opinion';

export interface PendingOnboardingHandoff {
  userId: string;
  tenantId: string;
  agentId: string;
  sessionId: string;
  idempotencyKey: string;
  displayMessage: string;
  source: 'onboarding_default_insight';
  createdAt: number;
}

export interface OnboardingDraft {
  flowPath: 'admin' | 'member';
  step: 'company' | 'intent' | 'intro' | 'department' | 'scenario';
  companyQuery: string;
  selectedCompany: {
    companyName: string;
    creditCode: string;
  } | null;
  spaceName: string;
  spaceTouched: boolean;
  intent: string;
  department: string;
  scenario: string;
}

const STORAGE_KEY_PREFIX = 'moss:onboarding-handoff:v1';
const DEFAULT_SESSION_STORAGE_KEY = 'moss:onboarding-default-session:v1';
const DRAFT_STORAGE_KEY_PREFIX = 'moss:onboarding-draft:v1';
const MAX_HANDOFF_AGE_MS = 24 * 60 * 60 * 1000;

export const ONBOARDING_HANDOFF_COMPLETED_EVENT = 'moss:onboarding-handoff-completed';

export type OnboardingHandoffCompletedDetail = {
  userId: string;
  tenantId: string;
};

const BUSINESS_ID_BY_KIND: Record<OnboardingAgentKind, string> = {
  customer: 'business_insight',
  risk: 'risk_insight',
  opinion: 'opinion_insight',
};

const DISPLAY_NAME_BY_KIND: Record<OnboardingAgentKind, string[]> = {
  customer: ['客户洞察', 'MOSS', 'Moss', '商业洞察智能体'],
  risk: ['风险管理'],
  opinion: ['舆情监控', '舆情分析'],
};

export function requiresOnboardingForTenant(
  status: PlatformOnboardingStatus | undefined,
  tenantId: string,
): boolean {
  return status?.required === true
    && (!status.tenantId || status.tenantId === tenantId);
}

export function findOnboardingAgent(
  agents: Agent[],
  kind: OnboardingAgentKind,
): Agent | null {
  const businessId = BUSINESS_ID_BY_KIND[kind];
  const byBusinessId = agents.find((agent) => agent.businessId === businessId);
  if (byBusinessId) return byBusinessId;

  const acceptedNames = DISPLAY_NAME_BY_KIND[kind];
  return agents.find((agent) => (
    acceptedNames.includes(agent.name) || acceptedNames.includes(getAgentDisplayName(agent))
  )) ?? null;
}

export function savePendingOnboardingHandoff(payload: PendingOnboardingHandoff): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    handoffStorageKey(payload.userId, payload.tenantId),
    JSON.stringify(payload),
  );
}

export function readPendingOnboardingHandoff(
  userId: string,
  tenantId: string,
): PendingOnboardingHandoff | null {
  if (typeof window === 'undefined') return null;
  const key = handoffStorageKey(userId, tenantId);
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    const payload = JSON.parse(raw) as PendingOnboardingHandoff;
    const valid = payload.userId === userId
      && payload.tenantId === tenantId
      && typeof payload.agentId === 'string'
      && typeof payload.sessionId === 'string'
      && typeof payload.idempotencyKey === 'string'
      && typeof payload.displayMessage === 'string'
      && payload.source === 'onboarding_default_insight'
      && typeof payload.createdAt === 'number'
      && Date.now() - payload.createdAt <= MAX_HANDOFF_AGE_MS;
    if (valid) return payload;
  } catch {
    // Invalid payloads are discarded below.
  }
  window.localStorage.removeItem(key);
  return null;
}

export function clearPendingOnboardingHandoff(userId: string, tenantId: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(handoffStorageKey(userId, tenantId));
}

export function notifyOnboardingHandoffCompleted(userId: string, tenantId: string): void {
  if (typeof window === 'undefined' || !userId || !tenantId) return;
  window.dispatchEvent(new CustomEvent<OnboardingHandoffCompletedDetail>(
    ONBOARDING_HANDOFF_COMPLETED_EVENT,
    { detail: { userId, tenantId } },
  ));
}

function handoffStorageKey(userId: string, tenantId: string): string {
  return `${STORAGE_KEY_PREFIX}:${userId}:${tenantId}`;
}

function draftStorageKey(userId: string, tenantId?: string): string {
  return `${DRAFT_STORAGE_KEY_PREFIX}:${userId}:${tenantId || 'pending'}`;
}

export function saveOnboardingDraft(
  userId: string,
  draft: OnboardingDraft,
  tenantId?: string,
): void {
  if (typeof window === 'undefined' || !userId) return;
  window.sessionStorage.setItem(draftStorageKey(userId, tenantId), JSON.stringify(draft));
}

export function readOnboardingDraft(
  userId: string,
  tenantId?: string,
): OnboardingDraft | null {
  if (typeof window === 'undefined' || !userId) return null;
  const key = draftStorageKey(userId, tenantId);
  const raw = window.sessionStorage.getItem(key)
    ?? (tenantId ? window.sessionStorage.getItem(draftStorageKey(userId)) : null);
  if (!raw) return null;
  try {
    const draft = JSON.parse(raw) as OnboardingDraft;
    const companyValid = draft.selectedCompany === null || (
      typeof draft.selectedCompany?.companyName === 'string'
      && typeof draft.selectedCompany.creditCode === 'string'
    );
    const valid = (draft.flowPath === 'admin' || draft.flowPath === 'member')
      && ['company', 'intent', 'intro', 'department', 'scenario'].includes(draft.step)
      && typeof draft.companyQuery === 'string'
      && companyValid
      && typeof draft.spaceName === 'string'
      && typeof draft.spaceTouched === 'boolean'
      && typeof draft.intent === 'string'
      && typeof draft.department === 'string'
      && typeof draft.scenario === 'string';
    if (valid) return draft;
  } catch {
    // Invalid payloads are discarded below.
  }
  window.sessionStorage.removeItem(key);
  return null;
}

export function clearOnboardingDraft(userId: string, tenantId?: string): void {
  if (typeof window === 'undefined' || !userId) return;
  window.sessionStorage.removeItem(draftStorageKey(userId, tenantId));
  if (tenantId) window.sessionStorage.removeItem(draftStorageKey(userId));
}

export function markOnboardingDefaultSession(sessionId: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DEFAULT_SESSION_STORAGE_KEY, sessionId);
}

export function isOnboardingDefaultSession(sessionId: string | null): boolean {
  if (typeof window === 'undefined' || !sessionId) return false;
  return window.localStorage.getItem(DEFAULT_SESSION_STORAGE_KEY) === sessionId;
}

export function clearOnboardingDefaultSession(sessionId: string): void {
  if (typeof window === 'undefined' || !isOnboardingDefaultSession(sessionId)) return;
  window.localStorage.removeItem(DEFAULT_SESSION_STORAGE_KEY);
}
