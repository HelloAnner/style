import type { ReactNode } from 'react';

export type WufanTheme = 'light' | 'dark';

export type WufanSessionGroup = {
  label: string;
  sessions: Array<{
    id: string;
    title: string;
    active?: boolean;
  }>;
};

export type WufanMessage = {
  id: string;
  role: 'user' | 'agent';
  author: string;
  time: string;
  content: ReactNode;
};

export type WufanChatPageProps = {
  theme: WufanTheme;
  agentName?: string;
  sessionTitle?: string;
  sessionGroups?: WufanSessionGroup[];
  initialMessages?: WufanMessage[];
  modelLabel?: string;
  onSend?: (value: string) => void;
  onThemeChange?: (theme: WufanTheme) => void;
  className?: string;
};
