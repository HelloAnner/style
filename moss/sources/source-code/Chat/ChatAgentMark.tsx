import { memo } from 'react';
import SidebarAgentIcon from '../Sidebar/SidebarAgentIcon';

interface ChatAgentMarkAgent {
  name?: string | null;
  avatar_url?: string | null;
  businessId?: string | null;
}

interface ChatAgentMarkProps {
  size?: number;
  agent?: ChatAgentMarkAgent | null;
}

export const ChatAgentMark = memo(function ChatAgentMark({
  size = 24,
  agent,
}: ChatAgentMarkProps) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
      data-testid="chat-agent-mark"
    >
      <SidebarAgentIcon
        agent={{
          name: agent?.name || '客户洞察',
          avatar_url: agent?.avatar_url ?? null,
          businessId: agent?.businessId ?? null,
        }}
        size={size}
      />
    </span>
  );
});
