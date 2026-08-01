import styles from './AgentHome.module.css';
import { AgentHomeRecommendations } from './AgentHomeRecommendations';
import { AgentHomeTitle } from './AgentHomeTitle';
import type {
  AgentHomeAgent,
  AgentHomeQuestionGroup,
  AgentHomeQuestionSelectHandler,
} from './homeTypes';

export type AgentHomeProps = {
  currentAgent?: AgentHomeAgent | null;
  recommendedQuestions?: readonly AgentHomeQuestionGroup[] | null;
  homeTitle?: string | null;
  highlightWords?: readonly string[] | null;
  onQuestionSelect?: AgentHomeQuestionSelectHandler;
  animationKey?: string | null;
  className?: string;
};

export function AgentHome({
  currentAgent,
  recommendedQuestions,
  homeTitle,
  highlightWords,
  onQuestionSelect,
  animationKey,
  className,
}: AgentHomeProps) {
  return (
    <main
      className={[styles.homeLayout, className].filter(Boolean).join(' ')}
      aria-label="默认首页"
      data-testid="agent-home"
    >
      <AgentHomeTitle
        currentAgent={currentAgent}
        homeTitle={homeTitle}
        highlightWords={highlightWords}
      />
      <AgentHomeRecommendations
        recommendedQuestions={recommendedQuestions}
        highlightWords={highlightWords}
        onQuestionSelect={onQuestionSelect}
        animationKey={animationKey}
      />
    </main>
  );
}
