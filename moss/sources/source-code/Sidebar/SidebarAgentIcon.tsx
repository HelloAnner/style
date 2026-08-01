import React, { useState } from 'react';
import agentBusinessIcon from '../../assets/icons/sidebar/agent-business.svg';
import agentCustomerIcon from '../../assets/icons/sidebar/agent-customer.svg';
import agentOpinionIcon from '../../assets/icons/sidebar/agent-opinion.svg';
import agentRiskIcon from '../../assets/icons/sidebar/agent-risk.svg';
import { getAgentDisplayName, getAvatarById, type Agent } from '../../types/platform';

const FIGMA_ICON_BY_BUSINESS_ID: Record<string, string> = {
  business_insight: agentCustomerIcon,
  customer_insight: agentCustomerIcon,
  risk_insight: agentRiskIcon,
  opinion_insight: agentOpinionIcon,
  business_mining: agentBusinessIcon,
  opportunity_mining: agentBusinessIcon,
  business_opportunity: agentBusinessIcon,
};

const FIGMA_ICON_BY_DISPLAY_NAME: Record<string, string> = {
  客户洞察: agentCustomerIcon,
  风险管理: agentRiskIcon,
  舆情监控: agentOpinionIcon,
  商机挖掘: agentBusinessIcon,
};

function isImageUrl(value: string): boolean {
  return /^(https?:|data:image\/|blob:|\/)/.test(value.trim());
}

function resolveFigmaAgentIcon(agent: Pick<Agent, 'businessId' | 'name'>): string {
  const businessId = agent.businessId?.trim();
  if (businessId && FIGMA_ICON_BY_BUSINESS_ID[businessId]) {
    return FIGMA_ICON_BY_BUSINESS_ID[businessId];
  }

  const displayName = getAgentDisplayName(agent);
  return FIGMA_ICON_BY_DISPLAY_NAME[displayName] ?? agentCustomerIcon;
}

export interface SidebarAgentIconProps {
  agent: Pick<Agent, 'avatar_url' | 'businessId' | 'name'>;
  size?: number;
  testId?: string;
}

/**
 * Agent icon rendering policy:
 * - Business/user-provided avatar_url remains user content.
 * - Built-in Agent fallback icons use the Figma-exported sidebar assets.
 */
export const SidebarAgentIcon: React.FC<SidebarAgentIconProps> = ({
  agent,
  size = 16,
  testId,
}) => {
  const [imageFailed, setImageFailed] = useState(false);
  const avatarUrl = agent.avatar_url?.trim();

  if (avatarUrl && isImageUrl(avatarUrl) && !imageFailed) {
    return (
      <img
        data-testid={testId}
        src={avatarUrl}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        onError={() => setImageFailed(true)}
        style={{
          width: size,
          height: size,
          borderRadius: 4,
          objectFit: 'cover',
          flexShrink: 0,
          display: 'block',
        }}
      />
    );
  }

  if (avatarUrl && !isImageUrl(avatarUrl)) {
    const avatar = getAvatarById(avatarUrl);
    return (
      <span
        data-testid={testId}
        aria-hidden="true"
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: avatar.gradient,
          flexShrink: 0,
          display: 'inline-flex',
        }}
      />
    );
  }

  return (
    <img
      data-testid={testId}
      src={resolveFigmaAgentIcon(agent)}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        display: 'block',
      }}
    />
  );
};

export default SidebarAgentIcon;
