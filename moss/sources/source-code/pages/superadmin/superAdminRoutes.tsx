import React, { lazy, Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import { SUPER_ADMIN_DEFAULT_PATH } from './superAdminNav';

const SuperAdminDashboardPage = lazy(() => import('./SuperAdminDashboardPage'));
const SuperAdminUsersPage = lazy(() => import('./SuperAdminUsersPage'));
const SuperAdminAgentsPage = lazy(() => import('./SuperAdminAgentsPage'));
const SuperAdminSubAgentsPage = lazy(() => import('./SuperAdminSubAgentsPage'));
const SuperAdminDashboardConfigPage = lazy(() => import('./SuperAdminDashboardConfigPage'));
const SuperAdminMcpClientsPage = lazy(() => import('./SuperAdminMcpClientsPage'));
const SuperAdminOpenApiPage = lazy(() => import('./SuperAdminOpenApiPage'));
const SuperAdminExternalChannelsPage = lazy(() => import('./SuperAdminExternalChannelsPage'));
const SuperAdminAuditPage = lazy(() => import('./SuperAdminAuditPage'));
const SuperAdminTenantsPage = lazy(() => import('./SuperAdminTenantsPage'));
const SuperAdminOpsPage = lazy(() => import('./SuperAdminOpsPage'));
const SuperAdminConversationLogsPage = lazy(() => import('./SuperAdminConversationLogsPage'));
const SuperAdminFeedbackPage = lazy(() => import('./SuperAdminFeedbackPage'));
const SuperAdminAnalyticsRecommendedQuestionsPage = lazy(() => import('./SuperAdminAnalyticsRecommendedQuestionsPage'));
const SuperAdminAnalyticsPage = lazy(() => import('./SuperAdminAnalyticsPage'));
const SuperAdminChannelSettingsPage = lazy(() => import('./SuperAdminChannelSettingsPage'));
const SuperAdminThirdPartyIntegrationPage = lazy(() => import('./SuperAdminThirdPartyIntegrationPage'));
const SuperAdminXilaSettingsPage = lazy(() => import('./SuperAdminXilaSettingsPage'));
const SuperAdminPlatformConfigPage = lazy(() => import('./SuperAdminPlatformConfigPage'));
const SuperAdminPromptConfigPage = lazy(() => import('./SuperAdminPromptConfigPage'));
const SuperAdminSubagentConfigPage = lazy(() => import('./SuperAdminSubagentConfigPage'));
const SuperAdminShowcasePage = lazy(() => import('./SuperAdminShowcasePage'));

const SUPER_ADMIN_ROUTES: Record<string, React.LazyExoticComponent<React.ComponentType>> = {
  dashboard: SuperAdminDashboardPage,
  users: SuperAdminUsersPage,
  agents: SuperAdminAgentsPage,
  subagents: SuperAdminSubAgentsPage,
  'config/dashboard': SuperAdminDashboardConfigPage,
  'mcp-clients': SuperAdminMcpClientsPage,
  'open-api': SuperAdminOpenApiPage,
  'external-channels': SuperAdminExternalChannelsPage,
  tenants: SuperAdminTenantsPage,
  audit: SuperAdminAuditPage,
  'conversation-logs': SuperAdminConversationLogsPage,
  feedback: SuperAdminFeedbackPage,
  analytics: SuperAdminAnalyticsPage,
  'analytics/recommended-questions': SuperAdminAnalyticsRecommendedQuestionsPage,
  ops: SuperAdminOpsPage,
  'channel-settings': SuperAdminChannelSettingsPage,
  'third-party-integrations': SuperAdminThirdPartyIntegrationPage,
  'xila-settings': SuperAdminXilaSettingsPage,
  'platform-config': SuperAdminPlatformConfigPage,
  'prompt-configs': SuperAdminPromptConfigPage,
  'subagent-config': SuperAdminSubagentConfigPage,
  showcase: SuperAdminShowcasePage,
};

export function renderSuperAdminRoute(splat: string | undefined): React.ReactElement {
  if (!splat) {
    return <Navigate to={SUPER_ADMIN_DEFAULT_PATH} replace />;
  }
  const Page = SUPER_ADMIN_ROUTES[splat];
  if (!Page) {
    return <Navigate to={SUPER_ADMIN_DEFAULT_PATH} replace />;
  }
  return (
    <Suspense fallback={null}>
      <Page />
    </Suspense>
  );
}
