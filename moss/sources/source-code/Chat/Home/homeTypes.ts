export type AgentHomeAgent = {
  id?: string;
  name?: string | null;
  avatar_url?: string | null;
};

export type AgentHomeQuestionGroup = {
  group_name?: string | null;
  questions?: string[] | null;
};

export type AgentHomeGroupedPrompt = {
  key: string;
  groupName: string;
  questions: string[];
};

export type AgentHomeQuestionSelectMeta = {
  groupName?: string;
  questionIndex?: number;
};

export type AgentHomeQuestionSelectHandler = (
  question: string,
  meta?: AgentHomeQuestionSelectMeta,
) => void;
