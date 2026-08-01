/**
 * 交互式问卷卡片组件
 * 
 * 支持三种题型：
 * - single_choice: 单选题（可添加自定义选项）
 * - multiple_choice: 多选题（可添加自定义选项）
 * - text: 问答题
 * 
 * 提交后收起为简洁的占位卡片
 */

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { QuestionData, QuestionItem, QuestionType } from '../../types';
import { useQuestionnaireDraftStore } from '../../stores/questionnaireDraftStore';
import { MarkdownContent } from './MarkdownContent';
import {
  normalizeQuestionOptions,
  questionOptionSearchText,
  type NormalizedQuestionOption,
} from '../../lib/questionOptions';

interface QuestionCardProps {
  data: QuestionData;
  header?: string;  // Agent 的 thought，作为问卷开头的说明
  /**
   * 用作内存草稿的 key。传入后，未提交答案会按 messageId 缓存到
   * questionnaireDraftStore，切换会话再切回时自动恢复（刷新页面不保留）。
   */
  messageId?: string;
  onSubmit: (answers: Record<string, string | string[]>) => boolean | void | Promise<boolean | void>;
  disabled?: boolean;
  testId?: string;
}

const AUTOMATION_TRIGGER_QUESTION_RE = /((自动化|automation|任务).*(触发|trigger)|(触发|trigger).*(自动化|automation|任务))/i;
const UNAVAILABLE_AUTOMATION_TRIGGER_OPTION_RE = /(webhook|外部触发|事件触发|\bevent\b)/i;

const isAutomationTriggerQuestion = (
  question: QuestionItem,
  context?: string | null,
  header?: string,
): boolean => {
  const scope = [
    context,
    header,
    question.id,
    question.question,
    ...(question.options || []).map(questionOptionSearchText),
  ].filter(Boolean).join(' ');
  return AUTOMATION_TRIGGER_QUESTION_RE.test(scope);
};

const isUnavailableAutomationTriggerOption = (option: NormalizedQuestionOption): boolean => {
  return UNAVAILABLE_AUTOMATION_TRIGGER_OPTION_RE.test([
    option.label,
    option.value,
    option.description,
  ].filter(Boolean).join(' '));
};

// ========== 已提交状态的占位卡片 ==========
const SubmittedPlaceholder: React.FC<{
  questionCount: number;
  context?: string | null;
}> = ({ questionCount }) => {
  return (
    <div 
      className="inline-flex items-center gap-2.5 rounded-lg"
      style={{
        padding: '8px 14px',
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <QuestionnaireIcon />
      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
        问卷已提交
      </span>
      <span 
        className="px-1.5 py-0.5 text-xs rounded"
        style={{ 
          background: 'var(--questionnaire-element-bg)',
          color: 'var(--questionnaire-element-text)',
        }}
      >
        {questionCount} 个问题
      </span>
      <div 
        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: 'var(--questionnaire-element-bg)' }}
      >
        <CheckmarkIcon />
      </div>
    </div>
  );
};

// ========== 已跳过状态的占位卡片 ==========
const SkippedPlaceholder: React.FC<{
  questionCount: number;
  context?: string | null;
}> = ({ questionCount }) => {
  return (
    <div 
      className="inline-flex items-center gap-2.5 rounded-lg"
      style={{
        padding: '8px 14px',
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border-subtle)',
        opacity: 0.7,
      }}
    >
      <QuestionnaireIcon />
      <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
        问卷已跳过
      </span>
      <span 
        className="px-1.5 py-0.5 text-xs rounded"
        style={{ 
          background: 'var(--questionnaire-element-bg)',
          color: 'var(--questionnaire-element-text)',
        }}
      >
        {questionCount} 个问题
      </span>
      <div 
        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: 'var(--questionnaire-element-bg)' }}
      >
        <SkipIcon />
      </div>
    </div>
  );
};

// 问卷图标
const QuestionnaireIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--questionnaire-element-text)' }}>
    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
    <rect x="9" y="3" width="6" height="4" rx="1" />
    <path d="M9 12h6" />
    <path d="M9 16h6" />
  </svg>
);

// 完成勾选图标
const CheckmarkIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--questionnaire-element-text)' }}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// 跳过图标（简洁的右箭头 + 短划线）
const SkipIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--questionnaire-element-text)' }}>
    <polyline points="13 17 18 12 13 7" /><line x1="6" y1="12" x2="18" y2="12" />
  </svg>
);

// 单个问题的回答状态
type AnswerValue = string | string[] | null;

const hasAnswerValue = (answer: AnswerValue | undefined): answer is string | string[] => {
  if (answer == null) return false;
  if (Array.isArray(answer)) return answer.length > 0;
  return answer.trim().length > 0;
};

export const QuestionCard: React.FC<QuestionCardProps> = ({
  data,
  header,
  messageId,
  onSubmit,
  disabled = false,
  testId,
}) => {
  // 是否已提交 / 已跳过
  const [localSubmitted, setLocalSubmitted] = useState(false);
  const isSubmitted = data.submitted || localSubmitted || disabled;
  const isSkipped = data.skipped && !data.submitted && !localSubmitted;

  // 从内存 store 恢复未提交草稿（切会话再切回不丢；刷新页面会丢，符合产品预期）
  const setStoredDraft = useQuestionnaireDraftStore((s) => s.setDraft);
  const clearStoredDraft = useQuestionnaireDraftStore((s) => s.clearDraft);
  const initialDraft = React.useMemo(() => {
    if (!messageId) return null;
    return useQuestionnaireDraftStore.getState().drafts[messageId] ?? null;
  }, [messageId]);

  // 每个问题的回答状态
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>(
    () => (initialDraft?.answers as Record<string, AnswerValue>) ?? {},
  );
  // 用户添加的自定义选项（每个问题可添加多个）
  const [customOptions, setCustomOptions] = useState<Record<string, string[]>>(
    () => initialDraft?.customOptions ?? {},
  );
  // 正在输入的新选项文本（瞬时态，不缓存到 store）
  const [newOptionInput, setNewOptionInput] = useState<Record<string, string>>({});
  // 显示添加选项输入框的问题 ID
  const [showAddInput, setShowAddInput] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 答案/自定义选项变化时回写 store；已终结态（提交/跳过/disabled）不写
  useEffect(() => {
    if (!messageId) return;
    if (isSubmitted || isSkipped) return;
    const hasContent =
      Object.keys(answers).length > 0 ||
      Object.values(customOptions).some((arr) => arr.length > 0);
    if (!hasContent) return;
    setStoredDraft(messageId, { answers, customOptions });
  }, [answers, customOptions, messageId, isSubmitted, isSkipped, setStoredDraft]);

  // 进入终结态时清掉草稿，避免内存堆积
  useEffect(() => {
    if (!messageId) return;
    if (isSubmitted || isSkipped) {
      clearStoredDraft(messageId);
    }
  }, [messageId, isSubmitted, isSkipped, clearStoredDraft]);

  // 规范化问题列表（兼容旧格式）
  const questions: QuestionItem[] = React.useMemo(() => {
    if (data.questions && Array.isArray(data.questions)) {
      return data.questions;
    }
    // 兼容旧格式
    if ((data as any).question) {
      return [{
        id: 'q_0',
        type: 'text' as QuestionType,
        question: (data as any).question,
        options: (data as any).options || [],
      }];
    }
    return [];
  }, [data]);

  // 获取问题的所有选项（原始 + 用户添加的）
  const getOptionsForQuestion = (question: QuestionItem): NormalizedQuestionOption[] => {
    const originalOptions = normalizeQuestionOptions(question.options);
    const userOptions = (customOptions[question.id] || []).map((option) => ({
      label: option,
      value: option,
    }));
    const options = [...originalOptions, ...userOptions];
    if (!isAutomationTriggerQuestion(question, data.context, header)) {
      return options;
    }
    return options.filter(option => !isUnavailableAutomationTriggerOption(option));
  };

  // 更新单选答案
  const handleSingleChoice = (questionId: string, value: string) => {
    if (disabled) return;
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  // 更新多选答案
  const handleMultipleChoice = (questionId: string, value: string, checked: boolean) => {
    if (disabled) return;
    setAnswers(prev => {
      // 确保 current 是数组
      const currentValue = prev[questionId];
      const current: string[] = Array.isArray(currentValue) ? currentValue : [];
      
      if (checked) {
        // 避免重复添加
        if (current.includes(value)) return prev;
        return { ...prev, [questionId]: [...current, value] };
      } else {
        const filtered = current.filter(v => v !== value);
        // 如果没变化，返回原对象避免不必要的渲染
        if (filtered.length === current.length) return prev;
        return { ...prev, [questionId]: filtered };
      }
    });
  };

  // 更新问答答案
  const handleTextInput = (questionId: string, value: string) => {
    if (disabled) return;
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  // 添加自定义选项
  const handleAddCustomOption = (questionId: string) => {
    const input = newOptionInput[questionId]?.trim();
    if (!input || disabled) return;
    
    setCustomOptions(prev => ({
      ...prev,
      [questionId]: [...(prev[questionId] || []), input],
    }));
    setNewOptionInput(prev => ({ ...prev, [questionId]: '' }));
    setShowAddInput(null);
  };

  // 检查是否可以提交
  const canSubmit = questions.every(q => {
    if (q.required === false) return true;
    const answer = answers[q.id];
    return hasAnswerValue(answer);
  });

  // 提交问卷
  const handleSubmit = async () => {
    if (disabled || !canSubmit || isSubmitting) return;
    
    const finalAnswers: Record<string, string | string[]> = {};
    for (const q of questions) {
      const answer = answers[q.id];
      if (hasAnswerValue(answer)) {
        finalAnswers[q.id] = answer;
      } else if (q.required === false) {
        finalAnswers[q.id] = q.type === 'multiple_choice' ? [] : '';
      }
    }
    
    setIsSubmitting(true);
    try {
      const result = await onSubmit(finalAnswers);
      if (result === false) return;
      setLocalSubmitted(true);
      if (messageId) clearStoredDraft(messageId);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // 已跳过状态
  if (isSkipped) {
    return (
      <SkippedPlaceholder
        questionCount={questions.length}
        context={data.context}
      />
    );
  }

  // 已提交状态
  if (isSubmitted) {
    return (
      <SubmittedPlaceholder 
        questionCount={questions.length}
        context={data.context}
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      data-testid={testId ?? 'question-card'}
      className="w-full"
    >
      <div 
        className="rounded-xl overflow-hidden shadow-lg"
        style={{
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        {/* Header: Agent 的 thought（Markdown 渲染） */}
        {header && (
          <div
            className="question-card-header px-5 py-4"
            style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}
          >
            <MarkdownContent content={header} />
          </div>
        )}

        {/* 问卷背景说明（context）*/}
        {data.context && (
          <div
            className="question-card-context px-5 py-3"
            style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-subtle)' }}
          >
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{data.context}</p>
          </div>
        )}

        {/* 问题列表 */}
        <div className="question-card-questions px-5 py-4 space-y-6">
          {questions.map((question, index) => (
            <div
              key={question.id}
              className="question-card-question space-y-3"
              data-testid={`question-card-question-${question.id}`}
            >
              {/* 问题标题 */}
              <div className="flex items-start gap-2">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-zinc-700 text-zinc-300 text-xs font-medium flex items-center justify-center">
                  {index + 1}
                </span>
                <div className="flex-1">
                  <h4 className="text-sm font-medium leading-5" style={{ color: 'var(--text-secondary)' }}>
                    {question.question}
                    {question.required !== false ? (
                      <span className="text-red-400 ml-1">*</span>
                    ) : (
                      <span className="text-xs font-normal ml-2" style={{ color: 'var(--text-muted)' }}>可选</span>
                    )}
                  </h4>
                  {question.type === 'multiple_choice' && (
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>可多选</p>
                  )}
                </div>
              </div>

              {/* 单选题 */}
              {question.type === 'single_choice' && (
                <div className="question-card-single-choice space-y-2 pl-8">
                  {getOptionsForQuestion(question).map((option, i) => (
                    <div
                      key={`${option.value}-${i}`}
                      data-testid={`question-card-option-${question.id}-${i}`}
                      role="radio"
                      aria-checked={answers[question.id] === option.value}
                      onClick={() => !disabled && handleSingleChoice(question.id, option.value)}
                      className={`
                        question-card-option question-card-option-single flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all select-none text-sm leading-5
                        ${answers[question.id] === option.value
                          ? 'bg-zinc-700/50 border border-zinc-600'
                          : 'border hover:bg-zinc-800/30'
                        }
                        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                      `}
                      style={{ borderColor: answers[question.id] === option.value ? undefined : 'var(--border-subtle)' }}
                    >
                      <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center
                        ${answers[question.id] === option.value ? 'border-zinc-400 bg-zinc-400' : 'border-zinc-500'}
                      `}>
                        {answers[question.id] === option.value && <span className="w-2 h-2 rounded-full bg-zinc-900" />}
                      </span>
                      <span className="flex flex-col" style={{ color: 'var(--text-secondary)' }}>
                        <span>{option.label}</span>
                        {option.description && (
                          <span className="text-xs mt-1" style={{ color: 'var(--text-muted)', lineHeight: 1.4 }}>
                            {option.description}
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                  
                  {/* 添加自定义选项 */}
                  {!disabled && (
                    <AddOptionButton
                      questionId={question.id}
                      showInput={showAddInput === question.id}
                      inputValue={newOptionInput[question.id] || ''}
                      onToggle={() => setShowAddInput(showAddInput === question.id ? null : question.id)}
                      onInputChange={(value) => setNewOptionInput(prev => ({ ...prev, [question.id]: value }))}
                      onAdd={() => handleAddCustomOption(question.id)}
                    />
                  )}
                </div>
              )}

              {/* 多选题 */}
              {question.type === 'multiple_choice' && (
                <div className="question-card-multiple-choice space-y-2 pl-8">
                  {getOptionsForQuestion(question).map((option, i) => {
                    const answerValue = answers[question.id];
                    const selectedOptions = Array.isArray(answerValue) ? answerValue : [];
                    const isChecked = selectedOptions.includes(option.value);
                    return (
                      <div
                        key={`${option.value}-${i}`}
                        data-testid={`question-card-option-${question.id}-${i}`}
                        role="checkbox"
                        aria-checked={isChecked}
                        onClick={() => !disabled && handleMultipleChoice(question.id, option.value, !isChecked)}
                        className={`
                          question-card-option question-card-option-multiple flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all select-none text-sm leading-5
                          ${isChecked
                            ? 'bg-zinc-700/50 border border-zinc-600'
                            : 'border hover:bg-zinc-800/30'
                          }
                          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                        `}
                        style={{ borderColor: isChecked ? undefined : 'var(--border-subtle)' }}
                      >
                        <span className={`w-4 h-4 rounded border-2 flex items-center justify-center
                          ${isChecked ? 'border-zinc-400 bg-zinc-400' : 'border-zinc-500'}
                        `}>
                          {isChecked && <CheckIcon />}
                        </span>
                        <span className="flex flex-col" style={{ color: 'var(--text-secondary)' }}>
                          <span>{option.label}</span>
                          {option.description && (
                            <span className="text-xs mt-1" style={{ color: 'var(--text-muted)', lineHeight: 1.4 }}>
                              {option.description}
                            </span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                  
                  {/* 添加自定义选项 */}
                  {!disabled && (
                    <AddOptionButton
                      questionId={question.id}
                      showInput={showAddInput === question.id}
                      inputValue={newOptionInput[question.id] || ''}
                      onToggle={() => setShowAddInput(showAddInput === question.id ? null : question.id)}
                      onInputChange={(value) => setNewOptionInput(prev => ({ ...prev, [question.id]: value }))}
                      onAdd={() => handleAddCustomOption(question.id)}
                    />
                  )}
                </div>
              )}

              {/* 问答题 */}
              {question.type === 'text' && (
                <div className="question-card-text-wrap pl-8">
                  <textarea
                    data-testid={`question-card-text-${question.id}`}
                    value={(answers[question.id] as string) || ''}
                    onChange={(e) => handleTextInput(question.id, e.target.value)}
                    placeholder={question.placeholder || '请输入你的回答...'}
                    disabled={disabled}
                    rows={3}
                    className={`
                      question-card-text-input w-full px-4 py-3 rounded-lg resize-none text-sm leading-5
                      focus:outline-none focus:border-zinc-500
                      ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                    style={{
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-secondary)',
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 提交按钮 */}
        <div className="question-card-footer px-5 pb-5">
          <motion.button
            onClick={handleSubmit}
            disabled={!canSubmit || disabled || isSubmitting}
            whileHover={{ scale: canSubmit && !disabled && !isSubmitting ? 1.02 : 1 }}
            whileTap={{ scale: canSubmit && !disabled && !isSubmitting ? 0.98 : 1 }}
            className={`
              w-full py-3 rounded-lg font-medium transition-all duration-200
              flex items-center justify-center gap-2
              ${canSubmit && !disabled && !isSubmitting
                ? 'bg-zinc-700 hover:bg-zinc-600 text-white'
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              }
            `}
            data-testid="question-card-submit-button"
          >
            <SendIcon />
            <span>{isSubmitting ? '提交中...' : '提交'}</span>
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

// 添加选项按钮组件
interface AddOptionButtonProps {
  questionId: string;
  showInput: boolean;
  inputValue: string;
  onToggle: () => void;
  onInputChange: (value: string) => void;
  onAdd: () => void;
}

const AddOptionButton: React.FC<AddOptionButtonProps> = ({
  questionId,
  showInput,
  inputValue,
  onToggle,
  onInputChange,
  onAdd,
}) => {
  if (showInput) {
    return (
      <div
        className="question-card-add-option-form flex items-center gap-2"
        data-testid={`question-card-add-option-form-${questionId}`}
      >
        <input
          type="text"
          data-testid={`question-card-add-option-input-${questionId}`}
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onAdd()}
          placeholder="输入自定义选项..."
          autoFocus
          className="question-card-add-option-input flex-1 px-4 py-2 rounded-lg border text-sm
                     focus:outline-none focus:border-zinc-500"
          style={{
            background: 'var(--bg-secondary)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-secondary)',
          }}
        />
        <button
          onClick={onAdd}
          disabled={!inputValue.trim()}
          data-testid={`question-card-add-option-confirm-${questionId}`}
          className="question-card-add-option-confirm px-3 py-2 rounded-lg bg-zinc-700 text-white text-sm font-medium
                     disabled:opacity-50 disabled:cursor-not-allowed
                     hover:bg-zinc-600 transition-colors"
        >
          添加
        </button>
        <button
          onClick={onToggle}
          data-testid={`question-card-add-option-cancel-${questionId}`}
          className="question-card-add-option-cancel px-3 py-2 rounded-lg bg-zinc-800 text-zinc-400 text-sm
                     hover:bg-zinc-700 transition-colors"
        >
          取消
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={onToggle}
      data-testid={`question-card-add-option-toggle-${questionId}`}
      className="question-card-add-option-toggle flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed
                 text-sm hover:border-zinc-600 hover:text-zinc-400 transition-all"
      style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}
    >
      <PlusIcon />
      <span>添加选项</span>
    </button>
  );
};

// 图标组件
const CheckIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export default QuestionCard;
