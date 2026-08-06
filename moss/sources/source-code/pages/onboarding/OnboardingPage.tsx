import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { platformAuthApi } from '../../api/platformAuth';
import { platformTenantApi } from '../../api/platformTenant';
import { useCursorSpotlight } from '../../components/Chat/Home/useCursorSpotlight';
import { Logo } from '../../components/common/Logo';
import { randomId } from '../../lib/id';
import { useAgentContextStore } from '../../stores/agentContextStore';
import { useAgentStore } from '../../stores/agentStore';
import { useAuthStore } from '../../stores/authStore';
import { useTenantStore } from '../../stores/tenantStore';
import { appendRedirect, resolveContinueTarget } from '../../utils/authNavigation';
import { WORKSPACE_HOME_PATH } from '../../utils/routes';
import {
  clearOnboardingDraft,
  findOnboardingAgent,
  readOnboardingDraft,
  requiresOnboardingForTenant,
  saveOnboardingDraft,
  savePendingOnboardingHandoff,
  type OnboardingAgentKind,
} from './onboardingHandoff';
import './onboarding.css';

type Locale = 'zh' | 'en';
type FlowPath = 'admin' | 'member';
type Step = 'intent' | 'intro' | 'department' | 'scenario';

type Option<K extends string> = { key: K; zh: string; en: string };
type ScenarioOption = Option<string> & { agentKind: OnboardingAgentKind };
type LogoRect = { left: number; top: number; width: number; height: number };
type LogoTransition = { from: LogoRect; to?: LogoRect };

const INTENTS: Option<string>[] = [
  { key: 'company_purchase', zh: '公司采购选型，需要 AI 洞察类 Agent', en: 'Evaluate an AI insight agent for my company' },
  { key: 'software_delivery', zh: '软件公司选型，需要交付 AI Agent 服务', en: 'Deliver AI agent services for customers' },
  { key: 'personal_research', zh: '个人试用研究，构建个人洞察 Agent', en: 'Explore and build a personal insight agent' },
  { key: 'personal_use', zh: '自己随便看看，解决个人问题', en: 'Look around and solve a personal problem' },
  { key: 'course_teaching', zh: '课程教学使用，比赛或课程设计', en: 'Use for teaching, competitions, or course design' },
  { key: 'other', zh: '其他', en: 'Other' },
];

const DEPARTMENTS: Option<string>[] = [
  { key: 'supply_chain', zh: '供应链管理', en: 'Supply chain' },
  { key: 'marketing', zh: '营销部门', en: 'Marketing' },
  { key: 'it', zh: 'IT 部门', en: 'IT' },
  { key: 'executive', zh: '企业高管', en: 'Executive team' },
  { key: 'legal', zh: '法务部', en: 'Legal' },
  { key: 'pr', zh: '公关部', en: 'Public relations' },
  { key: 'strategy', zh: '战略部', en: 'Strategy' },
  { key: 'other', zh: '其他', en: 'Other' },
];

const SCENARIOS: ScenarioOption[] = [
  { key: 'customer', zh: '客户洞察', en: 'Customer insight', agentKind: 'customer' },
  { key: 'opportunity', zh: '商机挖掘', en: 'Opportunity discovery', agentKind: 'customer' },
  { key: 'risk', zh: '风险管理', en: 'Risk management', agentKind: 'risk' },
  { key: 'opinion', zh: '舆情分析', en: 'Sentiment analysis', agentKind: 'opinion' },
  { key: 'market', zh: '市场行业研究', en: 'Market and industry research', agentKind: 'customer' },
  { key: 'competitor', zh: '竞对分析', en: 'Competitor analysis', agentKind: 'customer' },
  { key: 'other', zh: '其他', en: 'Other', agentKind: 'customer' },
];

const AGENT_READY_POLL_INTERVAL_MS = 2_000;
const AGENT_READY_POLL_ATTEMPTS = 30;

const COPY = {
  zh: {
    next: '下一步', continue: '继续', sending: '正在进入智能体…', single: '单选',
    confirm: '确认',
    intentTitle: '选择诉求', intentBody: '这会帮助 MOSS 了解你此次体验的目标',
    introTitle: '你好，我是 MOSS',
    introLead: '我不是查询工具，也不是通用 AI 聊天机器人',
    introBodyBeforeCompany: '我是基于真实商业数据工作的商业洞察数字员工，能够结合工商、招投标、专利、舆情与行业数据，站在你们公司',
    introBodyAfterCompany: '的视角分析问题。',
    introNext: '接下来，我会先了解你的工作，再带你完成第一个真实任务。', meetMoss: '开始认识 MOSS',
    departmentLead: '为了让之后的建议更贴合实际，我想先了解一下你的工作。', departmentQuestion: '你希望我加入你们公司的哪个部门？', answerHint: '请选择一个最贴近你工作的部门',
    scenarioReply: '明白了。之后我会结合你的岗位，更准确地理解业务目标和决策语境。', scenarioQuestion: '你目前最关注哪个业务场景？', scenarioHint: '请选择一个最关注的场景',
    you: '你',
    noAgent: '没有找到对应的智能体，请刷新智能体列表后重试。', loginRequired: '请先登录并进入一个企业空间，再继续发送首个任务。',
    onboardingSaveFailed: '保存引导信息失败，请重试',
    capabilities: ['企业洞察', '机会挖掘', '风险识别', '舆情监控', '行业研究'],
  },
  en: {
    next: 'Next', continue: 'Continue', sending: 'Opening agent…', single: 'Single choice',
    confirm: 'Confirm',
    intentTitle: 'What brings you to MOSS?', intentBody: 'This helps MOSS understand what you want to accomplish',
    introTitle: 'Hello, I am MOSS',
    introLead: 'I am not a search tool or a general-purpose AI chatbot.',
    introBodyBeforeCompany: 'I am a commercial insight digital employee grounded in real business data, combining company records, bids, patents, public sentiment and industry data to analyze problems from the perspective of ',
    introBodyAfterCompany: '.',
    introNext: 'Next, I will learn about your work, then guide you through your first real task.', meetMoss: 'Meet MOSS',
    departmentLead: 'To make future recommendations practical, I would like to understand your work first.', departmentQuestion: 'Which department should I join?', answerHint: 'Choose the department closest to your work',
    scenarioReply: 'Got it. I will use your role to better understand the business goals and decision context.', scenarioQuestion: 'Which business scenario matters most to you?', scenarioHint: 'Choose the one scenario that matters most',
    you: 'You',
    noAgent: 'The matching agent could not be found. Refresh the agent list and try again.', loginRequired: 'Sign in and enter a workspace before sending the first task.',
    onboardingSaveFailed: 'Failed to save onboarding information. Please try again.',
    capabilities: ['Company insight', 'Opportunity discovery', 'Risk detection', 'Sentiment monitoring', 'Industry research'],
  },
} as const;

function resolveLocale(): Locale {
  if (typeof navigator === 'undefined') return 'zh';
  const language = navigator.languages?.[0] || navigator.language || '';
  return language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

function optionLabel(option: Option<string>, locale: Locale): string {
  return option[locale];
}

function buildFirstTaskDisplayMessage(
  locale: Locale,
  companyName: string,
  department: string,
  scenarioNames: string[],
): string {
  const scenarioText = scenarioNames.join(locale === 'zh' ? '、' : ', ');
  if (locale === 'en') {
    return `MOSS will join ${companyName} and work with the ${department} department. Think through and execute the following work: complete the full journey from ${scenarioText} to building an intelligent dashboard.\nNext, run the “MOSS Presales Demo” skill to demonstrate what MOSS can do.`;
  }
  return `MOSS将会入职到${companyName}，在${department}岗位/部门进行工作。希望让MOSS思考并执行以下工作：完成从${scenarioText}到智能看板搭建的全链路。\n接下来执行“MOSS售前演示”技能，展示MOSS能做什么`;
}

function isStep(value: string): value is Step {
  return value === 'intent' || value === 'intro' || value === 'department' || value === 'scenario';
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reduceMotion = useReducedMotion();
  const productSpotlight = useCursorSpotlight<HTMLElement>();
  const locale = resolveLocale();
  const copy = COPY[locale];
  const currentUserId = useAuthStore((state) => state.user?.id ?? '');
  const currentWorkspace = useTenantStore((state) => state.currentWorkspace);
  const rawDraft = useMemo(
    () => currentUserId ? readOnboardingDraft(currentUserId, currentWorkspace?.tenantId) : null,
    [currentUserId, currentWorkspace?.tenantId],
  );
  const flowPath: FlowPath = currentWorkspace
    ? currentWorkspace.role === 'owner' ? 'admin' : 'member'
    : rawDraft?.flowPath ?? 'admin';
  const initialDraft = rawDraft?.flowPath === flowPath ? rawDraft : null;
  const memberPath = flowPath === 'member';
  const tenantInitialized = useTenantStore((state) => state.initialized);
  const tenantInitializing = useTenantStore((state) => state.initializing);
  const initializeTenant = useTenantStore((state) => state.initialize);
  const authenticated = useAuthStore((state) => state.isAuthenticated);
  const agents = useAgentContextStore((state) => state.agents);
  const fetchAgents = useAgentContextStore((state) => state.fetchAgents);
  const setCurrentAgent = useAgentContextStore((state) => state.setCurrentAgent);
  const startNewSession = useAgentStore((state) => state.startNewSession);

  const steps = useMemo<Step[]>(
    () => memberPath ? ['intro', 'department', 'scenario'] : ['intent', 'intro', 'department', 'scenario'],
    [memberPath],
  );
  const [step, setStep] = useState<Step>(
    initialDraft && isStep(initialDraft.step) && steps.includes(initialDraft.step)
      ? initialDraft.step
      : steps[0],
  );
  const [intent, setIntent] = useState(initialDraft?.intent ?? '');
  const [department, setDepartment] = useState(initialDraft?.department ?? '');
  const [scenario, setScenario] = useState(initialDraft?.scenario ?? '');
  const [previousStep, setPreviousStep] = useState<Step | null>(null);
  const [handoffError, setHandoffError] = useState('');
  const [submittingHandoff, setSubmittingHandoff] = useState(false);
  const [logoTransition, setLogoTransition] = useState<LogoTransition | null>(null);
  const handoffStarted = useRef(false);
  const conversationScrollRef = useRef<HTMLDivElement>(null);
  const introLogoRef = useRef<HTMLDivElement>(null);
  const conversationLogoRef = useRef<HTMLDivElement>(null);
  const hydratedDraftScope = useRef(
    initialDraft && currentWorkspace?.tenantId
      ? `${currentUserId}:${currentWorkspace.tenantId}`
      : '',
  );

  useLayoutEffect(() => {
    const tenantId = currentWorkspace?.tenantId;
    if (!currentUserId || !tenantId) return;
    const scope = `${currentUserId}:${tenantId}`;
    if (hydratedDraftScope.current === scope) return;
    hydratedDraftScope.current = scope;
    const draft = readOnboardingDraft(currentUserId, tenantId);
    if (!draft || draft.flowPath !== flowPath) return;
    setStep(isStep(draft.step) && steps.includes(draft.step) ? draft.step : steps[0]);
    setIntent(draft.intent);
    setDepartment(draft.department);
    setScenario(draft.scenario);
  }, [
    currentUserId,
    currentWorkspace?.tenantId,
    flowPath,
    steps,
  ]);

  useEffect(() => {
    if (!authenticated || tenantInitialized || tenantInitializing) return;
    void initializeTenant();
  }, [authenticated, initializeTenant, tenantInitialized, tenantInitializing]);

  useEffect(() => {
    if (
      !tenantInitialized
      || tenantInitializing
      || currentWorkspace
    ) return;
    navigate(
      appendRedirect('/workspace/create', searchParams.get('redirect')),
      { replace: true },
    );
  }, [
    currentWorkspace,
    navigate,
    searchParams,
    tenantInitialized,
    tenantInitializing,
  ]);

  useEffect(() => {
    if (!authenticated || !tenantInitialized || tenantInitializing || !currentWorkspace) return;
    let active = true;
    void platformAuthApi.me().then((me) => {
      if (!active) return;
      if (!requiresOnboardingForTenant(me.onboarding, currentWorkspace.tenantId)) {
        clearOnboardingDraft(currentUserId, currentWorkspace.tenantId);
        navigate(resolveContinueTarget(searchParams.get('redirect'), WORKSPACE_HOME_PATH), { replace: true });
        return;
      }
      if (
        me.onboarding?.phase === 'DEFAULT_JOB_PENDING'
        && me.onboarding.tenantId === currentWorkspace?.tenantId
      ) {
        setIntent(me.onboarding.profile?.intent ?? '');
        setDepartment(me.onboarding.profile?.department ?? '');
        setScenario(me.onboarding.profile?.scenario ?? '');
        setStep('scenario');
      }
    }).catch(() => undefined);
    return () => {
      active = false;
    };
  }, [
    authenticated,
    currentUserId,
    currentWorkspace,
    navigate,
    searchParams,
    tenantInitialized,
    tenantInitializing,
  ]);

  useEffect(() => {
    if (!currentUserId || !currentWorkspace) return;
    saveOnboardingDraft(currentUserId, {
      flowPath,
      step,
      companyQuery: initialDraft?.companyQuery ?? currentWorkspace.enterpriseName ?? '',
      selectedCompany: initialDraft?.selectedCompany ?? null,
      spaceName: initialDraft?.spaceName ?? currentWorkspace.name,
      spaceTouched: initialDraft?.spaceTouched ?? false,
      intent,
      department,
      scenario,
    }, currentWorkspace?.tenantId);
  }, [
    currentUserId,
    currentWorkspace,
    department,
    flowPath,
    initialDraft,
    intent,
    scenario,
    step,
  ]);

  useEffect(() => {
    if (steps.includes(step)) return;
    setPreviousStep(null);
    setStep(steps[0]);
  }, [step, steps]);

  useLayoutEffect(() => {
    if (
      reduceMotion
      || step !== 'department'
      || !logoTransition
      || logoTransition.to
      || !conversationLogoRef.current
    ) return;

    const target = conversationLogoRef.current.getBoundingClientRect();
    setLogoTransition((current) => current ? {
      ...current,
      to: { left: target.left, top: target.top, width: target.width, height: target.height },
    } : null);
  }, [logoTransition, reduceMotion, step]);

  const stepIndex = steps.indexOf(step);
  const selectedDepartment = DEPARTMENTS.find((item) => item.key === department);
  const targetScenario = SCENARIOS.find((item) => item.key === scenario);
  const targetKind = targetScenario?.agentKind ?? 'customer';
  const resolvedCompanyName = currentWorkspace?.enterpriseName
    || currentWorkspace?.name
    || (locale === 'zh' ? '当前企业' : 'your company');
  const introCompanyName = resolvedCompanyName;
  const resolvedDepartmentName = selectedDepartment ? optionLabel(selectedDepartment, locale) : '';
  const taskMessage = buildFirstTaskDisplayMessage(
    locale,
    resolvedCompanyName,
    resolvedDepartmentName,
    targetScenario ? [optionLabel(targetScenario, locale)] : [],
  );

  useEffect(() => {
    if (!conversationScrollRef.current || (step !== 'department' && step !== 'scenario')) return;
    if (previousStep === 'intro' && step === 'department') return;
    const scrollToLatest = () => {
      conversationScrollRef.current?.scrollTo({
        top: conversationScrollRef.current.scrollHeight,
        behavior: reduceMotion ? 'auto' : 'smooth',
      });
    };
    const frame = requestAnimationFrame(scrollToLatest);
    const timer = window.setTimeout(scrollToLatest, reduceMotion ? 0 : 360);
    const laterTimer = window.setTimeout(scrollToLatest, reduceMotion ? 0 : 720);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      window.clearTimeout(laterTimer);
    };
  }, [department, previousStep, reduceMotion, step]);

  const performHandoff = async () => {
    if (handoffStarted.current || !scenario) return;
    if (!authenticated || !currentWorkspace) {
      setHandoffError(copy.loginRequired);
      return;
    }
    handoffStarted.current = true;
    setSubmittingHandoff(true);
    setHandoffError('');
    try {
      let targetAgent = findOnboardingAgent(agents, targetKind);
      for (let attempt = 0; !targetAgent && attempt < AGENT_READY_POLL_ATTEMPTS; attempt += 1) {
        await fetchAgents();
        targetAgent = findOnboardingAgent(useAgentContextStore.getState().agents, targetKind);
        if (targetAgent) break;
        const initialization = await platformTenantApi.getCurrentInitializationStatus();
        if (initialization.status === 'failed') break;
        await new Promise((resolve) => window.setTimeout(resolve, AGENT_READY_POLL_INTERVAL_MS));
      }
      if (!targetAgent) {
        setHandoffError(copy.noAgent);
        handoffStarted.current = false;
        setSubmittingHandoff(false);
        return;
      }
      await platformAuthApi.completeOnboarding({
        ...(memberPath ? {} : { intent }),
        department,
        scenario,
      });
      setCurrentAgent(targetAgent.id);
      startNewSession();
      const sessionId = useAgentStore.getState().reserveNewSessionId();
      savePendingOnboardingHandoff({
        userId: currentUserId,
        tenantId: currentWorkspace.tenantId,
        agentId: targetAgent.id,
        sessionId,
        idempotencyKey: randomId(),
        displayMessage: taskMessage,
        source: 'onboarding_default_insight',
        createdAt: Date.now(),
      });
      navigate(resolveContinueTarget(searchParams.get('redirect'), WORKSPACE_HOME_PATH), { replace: true });
    } catch {
      setHandoffError(copy.onboardingSaveFailed);
      handoffStarted.current = false;
      setSubmittingHandoff(false);
    }
  };

  const goTo = (next: Step) => {
    setHandoffError('');
    setStep((current) => {
      if (current === next) return current;
      setPreviousStep(current);
      return next;
    });
  };

  const selectScenario = (key: string) => {
    setScenario(key);
  };

  const selectDepartment = (key: string) => {
    setDepartment(key);
  };

  const startIntroConversation = () => {
    if (!reduceMotion && introLogoRef.current) {
      const source = introLogoRef.current.getBoundingClientRect();
      setLogoTransition({
        from: { left: source.left, top: source.top, width: source.width, height: source.height },
      });
    }
    goTo('department');
  };

  const progress = steps.length <= 1
    ? 0
    : (Math.max(stepIndex, 0) / (steps.length - 1)) * 100;
  const transition = reduceMotion ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const };
  const messageTransition = reduceMotion ? { duration: 0 } : { duration: 0.34, ease: [0.22, 1, 0.36, 1] as const };
  const productTransition = reduceMotion ? { duration: 0 } : { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const };
  const introExitTransition = reduceMotion ? { duration: 0 } : { duration: 0.26, ease: [0.4, 0, 1, 1] as const };
  const sceneKey = step === 'department' || step === 'scenario' ? 'conversation' : step;
  const usesProductBackground = step === 'intro' || step === 'department' || step === 'scenario';
  const usesIntroConversationTransition = previousStep === 'intro' && step === 'department';
  const sceneTransition = usesIntroConversationTransition ? productTransition : transition;
  const sceneInitial = reduceMotion ? false : usesIntroConversationTransition ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 };
  const sceneExit = reduceMotion ? undefined : usesIntroConversationTransition ? { opacity: 0, y: -28, transition: introExitTransition } : { opacity: 0, y: -4 };
  const stageClassName = [
    'moss-onboarding__stage',
    usesProductBackground ? 'moss-onboarding__stage--product' : '',
    step === 'intro' ? 'moss-onboarding__stage--intro' : '',
  ].filter(Boolean).join(' ');

  return (
    <main className="moss-onboarding" lang={locale === 'zh' ? 'zh-CN' : 'en'} data-testid="onboarding-page">
      <div className="moss-onboarding__progress" aria-hidden="true">
        <motion.div className="moss-onboarding__progress-value" animate={{ width: `${progress}%` }} transition={transition} />
      </div>

      <section
        ref={usesProductBackground ? productSpotlight.ref : undefined}
        className={stageClassName}
        onPointerMove={usesProductBackground ? productSpotlight.onPointerMove : undefined}
        onPointerEnter={usesProductBackground ? productSpotlight.onPointerEnter : undefined}
        onPointerLeave={usesProductBackground ? productSpotlight.onPointerLeave : undefined}
      >
        {usesProductBackground && (
          <div className="moss-onboarding__product-background" aria-hidden="true">
            <div className="moss-onboarding__product-dot-layer" />
            <div className="moss-onboarding__product-highlight-layer" />
            <div className="moss-onboarding__product-spotlight-layer" />
          </div>
        )}
        <AnimatePresence mode={usesIntroConversationTransition ? 'sync' : 'wait'} initial={false}>
          <motion.div
            key={sceneKey}
            className="moss-onboarding__scene"
            initial={sceneInitial}
            animate={{ opacity: 1, y: 0 }}
            exit={sceneExit}
            transition={sceneTransition}
          >
            {step === 'intent' && (
              <div className="moss-onboarding__form-panel">
                <div className="moss-onboarding__brand"><Logo size="sm" /></div>
                <h1>{copy.intentTitle}</h1>
                <p className="moss-onboarding__supporting">{copy.intentBody}</p>
                <div className="moss-onboarding__option-list">
                  {INTENTS.map((item) => (
                    <button key={item.key} type="button" className={intent === item.key ? 'is-selected' : ''} onClick={() => setIntent(item.key)}>
                      <span className="moss-onboarding__radio">{intent === item.key && <span />}</span>
                      {optionLabel(item, locale)}
                    </button>
                  ))}
                </div>
                <button className="moss-onboarding__primary" type="button" disabled={!intent} onClick={() => goTo('intro')}>
                  {copy.next}
                </button>
              </div>
            )}

            {step === 'intro' && (
              <div className="moss-onboarding__intro">
                <div ref={introLogoRef} className="moss-onboarding__intro-logo">
                  <Logo size="lg" showText={false} />
                </div>
                <h1>{copy.introTitle}</h1>
                <h2>{copy.introLead}</h2>
                <p className="moss-onboarding__intro-body">
                  {copy.introBodyBeforeCompany}
                  <span className="moss-onboarding__intro-company">「{introCompanyName}」</span>
                  {copy.introBodyAfterCompany}
                </p>
                <div className="moss-onboarding__capabilities">
                  {copy.capabilities.map((item) => <span key={item}>{item}</span>)}
                </div>
                <small>{copy.introNext}</small>
                <button className="moss-onboarding__primary moss-onboarding__primary--intro" type="button" onClick={startIntroConversation}>
                  {copy.meetMoss}
                </button>
              </div>
            )}

            {(step === 'department' || step === 'scenario') && (
              <div ref={conversationScrollRef} className="moss-onboarding__conversation">
                <motion.div
                  className={`moss-onboarding__message-row ${step === 'scenario' ? 'is-history' : ''}`}
                  initial={step === 'department' && !reduceMotion ? { opacity: 0 } : false}
                  animate={{ opacity: 1 }}
                  transition={step === 'department' ? { ...messageTransition, delay: reduceMotion ? 0 : 0.22 } : messageTransition}
                >
                  <div
                    ref={step === 'department' ? conversationLogoRef : undefined}
                    className={`moss-onboarding__conversation-logo ${logoTransition ? 'is-transition-target' : ''}`}
                  >
                    <Logo size="lg" showText={false} />
                  </div>
                  <div className="moss-onboarding__message-column">
                    <span className="moss-onboarding__speaker">MOSS</span>
                    <motion.div
                      className="moss-onboarding__bubble"
                      initial={step === 'department' && usesIntroConversationTransition && !reduceMotion ? { opacity: 0, y: 8, scale: 0.99 } : false}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={step === 'department' && usesIntroConversationTransition ? { ...messageTransition, delay: reduceMotion ? 0 : 0.32 } : messageTransition}
                      style={{ transformOrigin: 'left top' }}
                    >
                      <motion.p
                        initial={step === 'department' && usesIntroConversationTransition && !reduceMotion ? { opacity: 0, y: 4 } : false}
                        animate={{ opacity: 1, y: 0 }}
                        transition={step === 'department' && usesIntroConversationTransition ? { ...messageTransition, delay: reduceMotion ? 0 : 0.42 } : messageTransition}
                      >
                        {copy.departmentLead}
                      </motion.p>
                      <motion.h1
                        initial={step === 'department' && usesIntroConversationTransition && !reduceMotion ? { opacity: 0, y: 4 } : false}
                        animate={{ opacity: 1, y: 0 }}
                        transition={step === 'department' && usesIntroConversationTransition ? { ...messageTransition, delay: reduceMotion ? 0 : 0.54 } : messageTransition}
                      >
                        {copy.departmentQuestion}
                      </motion.h1>
                    </motion.div>
                  </div>
                </motion.div>
                {step === 'department' && (
                  <motion.div
                    className="moss-onboarding__answers"
                    initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...messageTransition, delay: reduceMotion ? 0 : 0.66 }}
                  >
                    <span>{copy.answerHint}</span>
                    <div>
                      {DEPARTMENTS.map((item, index) => (
                        <motion.button
                          key={item.key}
                          type="button"
                          className={department === item.key ? 'is-selected' : ''}
                          initial={usesIntroConversationTransition && !reduceMotion ? { opacity: 0, y: 8 } : false}
                          animate={{ opacity: 1, y: 0 }}
                          transition={usesIntroConversationTransition ? { ...messageTransition, delay: reduceMotion ? 0 : 0.74 + index * 0.045 } : messageTransition}
                          onClick={() => selectDepartment(item.key)}
                        >
                          {department === item.key && <Check size={14} />}{optionLabel(item, locale)}
                        </motion.button>
                      ))}
                    </div>
                    <div className="moss-onboarding__choice-footer">
                      <button className="moss-onboarding__primary moss-onboarding__primary--compact" type="button" disabled={!department} onClick={() => goTo('scenario')}>
                        {copy.confirm}
                      </button>
                    </div>
                  </motion.div>
                )}
                {step === 'scenario' && selectedDepartment && (
                  <div className="moss-onboarding__conversation-followup">
                    <motion.div
                      className="moss-onboarding__user-row is-history"
                      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={messageTransition}
                    >
                      <div><span className="moss-onboarding__speaker">{copy.you}</span><div className="moss-onboarding__user-bubble">{optionLabel(selectedDepartment, locale)}</div></div>
                    </motion.div>
                    <motion.div
                      className="moss-onboarding__message-row"
                      initial={reduceMotion ? false : { opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ ...messageTransition, delay: reduceMotion ? 0 : 0.34 }}
                    >
                      <div className="moss-onboarding__conversation-logo">
                        <Logo size="lg" showText={false} />
                      </div>
                      <div className="moss-onboarding__message-column">
                        <span className="moss-onboarding__speaker">MOSS</span>
                        <motion.div
                          className="moss-onboarding__bubble"
                          initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.99 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ ...messageTransition, delay: reduceMotion ? 0 : 0.42 }}
                          style={{ transformOrigin: 'left top' }}
                        >
                          <motion.p
                            initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ ...messageTransition, delay: reduceMotion ? 0 : 0.54 }}
                          >
                            {copy.scenarioReply}
                          </motion.p>
                          <motion.h1
                            initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ ...messageTransition, delay: reduceMotion ? 0 : 0.66 }}
                          >
                            {copy.scenarioQuestion}
                          </motion.h1>
                        </motion.div>
                      </div>
                    </motion.div>
                    <motion.div
                      className="moss-onboarding__answers"
                      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ ...messageTransition, delay: reduceMotion ? 0 : 0.78 }}
                    >
                      <span>{copy.scenarioHint}</span>
                      <div>
                        {SCENARIOS.map((item, index) => (
                          <Fragment key={item.key}>
                            {item.key === 'other' && <span className="moss-onboarding__answer-break" aria-hidden="true" />}
                            <motion.button
                              type="button"
                              className={scenario === item.key ? 'is-selected' : ''}
                              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ ...messageTransition, delay: reduceMotion ? 0 : 0.86 + index * 0.045 }}
                              onClick={() => selectScenario(item.key)}
                            >
                              {scenario === item.key && <Check size={14} />}{optionLabel(item, locale)}
                            </motion.button>
                          </Fragment>
                        ))}
                      </div>
                      <div className="moss-onboarding__choice-footer">
                        <button className="moss-onboarding__primary moss-onboarding__primary--compact" type="button" disabled={!scenario || submittingHandoff} onClick={() => void performHandoff()}>
                          {submittingHandoff ? copy.sending : copy.continue}
                        </button>
                      </div>
                      {handoffError && <div className="moss-onboarding__error">{handoffError}</div>}
                    </motion.div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </section>
      {logoTransition && (
        <motion.div
          className="moss-onboarding__logo-transition"
          initial={false}
          animate={logoTransition.to ? {
            x: logoTransition.to.left - logoTransition.from.left,
            y: logoTransition.to.top - logoTransition.from.top,
            scale: logoTransition.to.width / logoTransition.from.width,
          } : { x: 0, y: 0, scale: 1 }}
          transition={{ duration: 0.46, ease: [0.22, 1, 0.36, 1] }}
          style={{
            left: logoTransition.from.left,
            top: logoTransition.from.top,
            width: logoTransition.from.width,
            height: logoTransition.from.height,
            transformOrigin: 'left top',
          }}
          onAnimationComplete={() => {
            if (logoTransition.to) setLogoTransition(null);
          }}
          aria-hidden="true"
        >
          <Logo size="lg" showText={false} />
        </motion.div>
      )}
    </main>
  );
}
