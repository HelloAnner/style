export { AgentHome, type AgentHomeProps } from './AgentHome';
export { AgentHomeBackground } from './AgentHomeBackground';
export {
  AgentHomeRecommendations,
  filterAgentHomeQuestionGroups,
} from './AgentHomeRecommendations';
export { AgentHomeTitle } from './AgentHomeTitle';
export {
  HighlightText,
  buildHighlightSegments,
  normalizeHighlightWords,
  type HighlightSegment,
} from './HighlightText';
export { useCursorSpotlight, type CursorSpotlightBindings } from './useCursorSpotlight';
export type {
  AgentHomeAgent,
  AgentHomeGroupedPrompt,
  AgentHomeQuestionGroup,
  AgentHomeQuestionSelectMeta,
  AgentHomeQuestionSelectHandler,
} from './homeTypes';
