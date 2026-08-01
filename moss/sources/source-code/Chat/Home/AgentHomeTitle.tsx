import styles from './AgentHome.module.css';
import { HighlightText } from './HighlightText';
import type { AgentHomeAgent } from './homeTypes';

type AgentHomeTitleProps = {
  currentAgent?: AgentHomeAgent | null;
  homeTitle?: string | null;
  highlightWords?: readonly string[] | null;
};

function getFallbackTitle(currentAgent?: AgentHomeAgent | null): string {
  const agentName = currentAgent?.name?.trim();
  if (agentName) return `和 ${agentName} 开始新的对话`;
  return '开始新的对话';
}

export function AgentHomeTitle({
  currentAgent,
  homeTitle,
  highlightWords,
}: AgentHomeTitleProps) {
  const title = homeTitle?.trim() || getFallbackTitle(currentAgent);

  return (
    <header className={styles.titleBlock} data-testid="agent-home-title-block">
      <h1 className={styles.title} data-testid="agent-home-title">
        <HighlightText
          text={title}
          highlightWords={highlightWords}
          highlightClassName={styles.titleAccent}
        />
      </h1>
    </header>
  );
}
