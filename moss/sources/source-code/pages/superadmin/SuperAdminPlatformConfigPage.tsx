import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation } from "react-router-dom";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import {
  superAdminApi,
  type AuthSecurityResponse,
  type ExternalDataCacheConfigResponse,
  type KernelRuntimeConfigResponse,
  type ModelPricingResponse,
  type QuotaRulesResponse,
  type RegistrationInitializationConfigResponse,
  type RuntimeAssetsSourceConfigResponse,
  type SandboxRuntimeConfigResponse,
  type SaMcpAvailableToolItem,
  type ToolSearchConfigResponse,
  type ToolSearchCoreToolItem,
  type UiDisplayConfigResponse,
} from "../../api/superadmin";
import { SuperAdminConfigShell, type ConfigKey } from "./SuperAdminConfigShell";
import { SuperAdminLlmConfigPanel } from "./SuperAdminLlmConfigPanel";
import { SuperAdminPaidApiConfigPanel } from "./SuperAdminPaidApiConfigPanel";
import { SuperAdminSelect } from "./SuperAdminSelect";
import { useFrontendConfigStore } from "../../stores/frontendConfigStore";

type L1Key =
  | "billing"
  | "system"
  | "llm-config"
  | "tool-search"
  | "paid-api"
  | "registration"
  | "sandbox-runtime"
  | "kernel-runtime"
  | "external-data-cache"
  | "runtime-assets-source";
type L2BillingKey = "quota-rules" | "model-pricing";

type QuotaDraft = {
  preChargePerJob: string;
  dailyMaxCreditsPerUser: string;
  lowBalanceThreshold: string;
};

type ModelOverrideDraft = {
  modelId: string;
  inputPrice: string;
  outputPrice: string;
};

type ModelDraft = {
  defaultInput: string;
  defaultOutput: string;
  overrides: ModelOverrideDraft[];
};

type AuthDraft = {
  frontendEnabled: boolean;
  backendRequired: boolean;
};

type UiDisplayDraft = {
  showToolDurations: boolean;
};

type RegistrationDraft = {
  asyncEnhancementEnabled: boolean;
  registerConcurrency: string;
  ipRegisterConcurrency: string;
  enhancementWorkerCount: string;
  registerQueueSize: string;
  aiGenerationConcurrency: string;
  xilaCallConcurrency: string;
};

type SandboxRuntimeDraft = {
  quotaPersonalLimit: string;
  quotaTenantLimit: string;
  quotaQueueTimeoutSeconds: string;
  quotaRecycleThreshold: string;
  quotaTenantRecycleThreshold: string;
  resourceCpuMin: string;
  resourceCpuMax: string;
  resourceMemory: string;
  resourceTmpSize: string;
  totalMemLimitMb: string;
  codeMemLimitMb: string;
  replMemLimitMb: string;
  egressBandwidthMbps: string;
  ingressBandwidthMbps: string;
};

type KernelRuntimeDraft = {
  persistIterationContext: boolean;
};

type RuntimeAssetsSourceDraft = {
  source: RuntimeAssetsSourceConfigResponse["source"];
};

type ExternalDataCacheDraft = {
  enabled: boolean;
  litigationDetailTtlHours: string;
  litigationSummaryTtlHours: string;
  emptyTtlHours: string;
  maxSnapshotCount: string;
};

type ToolSearchDraft = {
  enabled: boolean;
  mode: "legacy" | "shadow" | "active";
  invokeDynamicToolEnabled: boolean;
  topKDefault: string;
  topKMin: string;
  topKMax: string;
  topKSimple: string;
  topKComplex: string;
  adaptiveTopKEnabled: boolean;
  maxLoadedDynamicTools: string;
  maxSearchesPerJob: string;
  maxSearchesPerIteration: string;
  loadedToolTtlTurns: string;
  loadedToolTtlSeconds: string;
  minScore: string;
  lowConfidenceThreshold: string;
  retrievalMode: "bm25" | "hybrid" | "vector";
  tokenizer: string;
  fieldWeights: string;
  exactNameBoost: string;
  aliasBoost: string;
  rerankEnabled: boolean;
  enabledSkillBoost: string;
  agentBusinessBoost: string;
  recentErrorRecoveryBoost: string;
  sideEffectPenalty: string;
  costPenalty: string;
  preferResolverTools: boolean;
  sessionCacheEnabled: boolean;
  clearOnTaskShift: boolean;
  retainSuccessfullyCalledTools: boolean;
  retainFailedToolsForRecovery: boolean;
  fallback: "core-only" | "ask-user" | "full";
  providerPolicy: string;
  observe: "off" | "summary" | "debug";
  sampleRate: string;
  coreTools: ToolSearchCoreToolItem[];
  alwaysIncludeEnabledFilterTools: boolean;
  includeBashInCore: boolean;
  includeTaskInCore: boolean;
  allowFullFallback: boolean;
};

function toQuotaDraft(data: QuotaRulesResponse): QuotaDraft {
  return {
    preChargePerJob: String(data.preChargePerJob),
    dailyMaxCreditsPerUser: String(data.dailyMaxCreditsPerUser),
    lowBalanceThreshold: String(data.lowBalanceThreshold),
  };
}

function toModelDraft(data: ModelPricingResponse): ModelDraft {
  return {
    defaultInput: String(data.defaultInput),
    defaultOutput: String(data.defaultOutput),
    overrides: data.overrides.map((item) => ({
      modelId: item.modelId,
      inputPrice: item.inputPrice === null ? "" : String(item.inputPrice),
      outputPrice: item.outputPrice === null ? "" : String(item.outputPrice),
    })),
  };
}

function toAuthDraft(data: AuthSecurityResponse): AuthDraft {
  return {
    frontendEnabled: data.frontendEnabled,
    backendRequired: data.backendRequired,
  };
}

function toUiDisplayDraft(data: UiDisplayConfigResponse): UiDisplayDraft {
  return {
    showToolDurations: data.showToolDurations,
  };
}

function toRegistrationDraft(
  data: RegistrationInitializationConfigResponse,
): RegistrationDraft {
  return {
    asyncEnhancementEnabled: data.asyncEnhancementEnabled,
    registerConcurrency: String(data.registerConcurrency),
    ipRegisterConcurrency: String(data.ipRegisterConcurrency),
    enhancementWorkerCount: String(data.enhancementWorkerCount),
    registerQueueSize: String(data.registerQueueSize),
    aiGenerationConcurrency: String(data.aiGenerationConcurrency),
    xilaCallConcurrency: String(data.xilaCallConcurrency),
  };
}

function toSandboxRuntimeDraft(
  data: SandboxRuntimeConfigResponse,
): SandboxRuntimeDraft {
  return {
    quotaPersonalLimit: String(data.quotaPersonalLimit),
    quotaTenantLimit: String(data.quotaTenantLimit),
    quotaQueueTimeoutSeconds: String(data.quotaQueueTimeoutSeconds),
    quotaRecycleThreshold: String(data.quotaRecycleThreshold),
    quotaTenantRecycleThreshold: String(data.quotaTenantRecycleThreshold),
    resourceCpuMin: data.resourceCpuMin,
    resourceCpuMax: data.resourceCpuMax,
    resourceMemory: data.resourceMemory,
    resourceTmpSize: data.resourceTmpSize,
    totalMemLimitMb: String(data.totalMemLimitMb),
    codeMemLimitMb: String(data.codeMemLimitMb),
    replMemLimitMb: String(data.replMemLimitMb),
    egressBandwidthMbps: String(data.egressBandwidthMbps),
    ingressBandwidthMbps: String(data.ingressBandwidthMbps),
  };
}

function toKernelRuntimeDraft(
  data: KernelRuntimeConfigResponse,
): KernelRuntimeDraft {
  return {
    persistIterationContext: data.persistIterationContext,
  };
}

function toRuntimeAssetsSourceDraft(
  data: RuntimeAssetsSourceConfigResponse,
): RuntimeAssetsSourceDraft {
  return {
    source: data.source,
  };
}

function toExternalDataCacheDraft(
  data: ExternalDataCacheConfigResponse,
): ExternalDataCacheDraft {
  return {
    enabled: data.enabled,
    litigationDetailTtlHours: String(data.litigationDetailTtlHours),
    litigationSummaryTtlHours: String(data.litigationSummaryTtlHours),
    emptyTtlHours: String(data.emptyTtlHours),
    maxSnapshotCount: String(data.maxSnapshotCount),
  };
}

function toToolSearchDraft(data: ToolSearchConfigResponse): ToolSearchDraft {
  return {
    enabled: data.enabled,
    mode: data.mode,
    invokeDynamicToolEnabled: data.invokeDynamicToolEnabled ?? false,
    topKDefault: String(data.topKDefault),
    topKMin: String(data.topKMin),
    topKMax: String(data.topKMax),
    topKSimple: String(data.topKSimple),
    topKComplex: String(data.topKComplex),
    adaptiveTopKEnabled: data.adaptiveTopKEnabled,
    maxLoadedDynamicTools: String(data.maxLoadedDynamicTools),
    maxSearchesPerJob: String(data.maxSearchesPerJob),
    maxSearchesPerIteration: String(data.maxSearchesPerIteration),
    loadedToolTtlTurns: String(data.loadedToolTtlTurns),
    loadedToolTtlSeconds: String(data.loadedToolTtlSeconds),
    minScore: String(data.minScore),
    lowConfidenceThreshold: String(data.lowConfidenceThreshold),
    retrievalMode: data.retrievalMode,
    tokenizer: data.tokenizer,
    fieldWeights: JSON.stringify(data.fieldWeights, null, 2),
    exactNameBoost: String(data.exactNameBoost),
    aliasBoost: String(data.aliasBoost),
    rerankEnabled: data.rerankEnabled,
    enabledSkillBoost: String(data.enabledSkillBoost),
    agentBusinessBoost: String(data.agentBusinessBoost),
    recentErrorRecoveryBoost: String(data.recentErrorRecoveryBoost),
    sideEffectPenalty: JSON.stringify(data.sideEffectPenalty, null, 2),
    costPenalty: JSON.stringify(data.costPenalty, null, 2),
    preferResolverTools: data.preferResolverTools,
    sessionCacheEnabled: data.sessionCacheEnabled,
    clearOnTaskShift: data.clearOnTaskShift,
    retainSuccessfullyCalledTools: data.retainSuccessfullyCalledTools,
    retainFailedToolsForRecovery: data.retainFailedToolsForRecovery,
    fallback: data.fallback,
    providerPolicy: JSON.stringify(data.providerPolicy, null, 2),
    observe: data.observe,
    sampleRate: String(data.sampleRate),
    coreTools: normalizeCoreTools(data.coreTools),
    alwaysIncludeEnabledFilterTools: data.alwaysIncludeEnabledFilterTools,
    includeBashInCore: data.includeBashInCore,
    includeTaskInCore: data.includeTaskInCore,
    allowFullFallback: data.allowFullFallback,
  };
}

const ToggleSwitch: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
  hint?: string;
}> = ({ checked, onChange, disabled = false, label, hint }) => (
  <div className={`fi-config-toggle-row${disabled ? " is-disabled" : ""}`}>
    <span className="fi-config-toggle-text">
      <span className="fi-config-label">{label}</span>
      {hint && <span className="fi-config-tool-label">{hint}</span>}
    </span>
    <button
      type="button"
      className={`fi-config-toggle${checked ? " is-on" : ""}`}
      aria-label={label}
      aria-pressed={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  </div>
);

const CoreToolsSelector: React.FC<{
  value: ToolSearchCoreToolItem[];
  onChange: (value: ToolSearchCoreToolItem[]) => void;
  availableTools: SaMcpAvailableToolItem[];
  availableToolsLoading?: boolean;
  availableToolsError?: string | null;
  disabled?: boolean;
}> = ({
  value,
  onChange,
  availableTools,
  availableToolsLoading = false,
  availableToolsError = null,
  disabled = false,
}) => {
  const [queries, setQueries] = useState<Record<string, string>>({});
  const normalized = useMemo(() => respaceCoreTools(value), [value]);
  const availableToolOptions = useMemo(() => {
    const deduped = new Map<string, SaMcpAvailableToolItem>();
    availableTools.forEach((tool) => {
      if (tool.toolName) {
        deduped.set(tool.toolName, tool);
      }
    });
    return Array.from(deduped.values()).sort((a, b) =>
      (a.displayName || a.toolName).localeCompare(b.displayName || b.toolName),
    );
  }, [availableTools]);
  const availableToolByName = useMemo(
    () => new Map(availableToolOptions.map((tool) => [tool.toolName, tool])),
    [availableToolOptions],
  );

  const updateItem = (
    item: ToolSearchCoreToolItem,
    patch: Partial<ToolSearchCoreToolItem>,
  ) => {
    if (item.required && patch.enabled === false) return;
    onChange(
      respaceCoreTools(
        normalized.map((candidate) =>
          coreToolKey(candidate) === coreToolKey(item)
            ? { ...candidate, ...patch }
            : candidate,
        ),
      ),
    );
  };

  const removeItem = (item: ToolSearchCoreToolItem) => {
    if (item.required) return;
    onChange(
      respaceCoreTools(
        normalized.filter(
          (candidate) => coreToolKey(candidate) !== coreToolKey(item),
        ),
      ),
    );
  };

  const moveItem = (
    groupItems: ToolSearchCoreToolItem[],
    item: ToolSearchCoreToolItem,
    direction: -1 | 1,
  ) => {
    const groupKeys = groupItems.map(coreToolKey);
    const groupIndex = groupKeys.indexOf(coreToolKey(item));
    const nextGroupIndex = groupIndex + direction;
    if (
      groupIndex < 0 ||
      nextGroupIndex < 0 ||
      nextGroupIndex >= groupKeys.length
    )
      return;
    const next = [...normalized];
    const firstIndex = next.findIndex(
      (candidate) => coreToolKey(candidate) === groupKeys[groupIndex],
    );
    const secondIndex = next.findIndex(
      (candidate) => coreToolKey(candidate) === groupKeys[nextGroupIndex],
    );
    if (firstIndex < 0 || secondIndex < 0) return;
    [next[firstIndex], next[secondIndex]] = [
      next[secondIndex],
      next[firstIndex],
    ];
    onChange(respaceCoreTools(next));
  };

  const addToGroup = (group: CoreToolGroup, selectedName?: string) => {
    const query = (queries[group.key] || "").trim();
    const matchedTool = selectedName
      ? availableToolByName.get(selectedName)
      : availableToolOptions.find(
          (tool) => tool.toolName === query || tool.displayName === query,
        );
    const name = matchedTool?.toolName || selectedName || "";
    if (!name || disabled) return;
    const condition = group.defaultCondition;
    if (
      normalized.some(
        (item) => item.name === name && item.condition === condition,
      )
    )
      return;
    onChange(
      respaceCoreTools([
        ...normalized,
        {
          name,
          enabled: true,
          sortOrder: (normalized.length + 1) * 10,
          condition,
          required: false,
        },
      ]),
    );
    setQueries((current) => ({ ...current, [group.key]: "" }));
  };

  return (
    <div className="fi-config-tool-list">
      <div className="fi-config-section-header">
        <div>
          <div className="fi-config-tool-title">核心工具</div>
          <div className="fi-config-tool-label">
            添加候选来自全局工具目录，运行时覆盖保存在
            system_config，下一次新对话生效
          </div>
        </div>
        <span className="fi-config-muted">
          {normalized.filter((item) => item.enabled).length}/{normalized.length}{" "}
          启用
        </span>
      </div>

      {coreToolGroups.map((group) => {
        const groupItems = normalized.filter(group.match);
        const query = queries[group.key] || "";
        const keyword = query.trim().toLowerCase();
        const filteredItems = keyword
          ? groupItems.filter((item) => {
              const tool = availableToolByName.get(item.name);
              return [
                item.name,
                tool?.displayName,
                tool?.description,
                tool?.packageKey,
                tool?.bridgeName,
              ].some((value) => value?.toLowerCase().includes(keyword));
            })
          : groupItems;
        const existingNames = new Set(groupItems.map((item) => item.name));
        const suggestions = keyword
          ? availableToolOptions
              .filter(
                (tool) =>
                  !existingNames.has(tool.toolName) &&
                  [
                    tool.toolName,
                    tool.displayName,
                    tool.description,
                    tool.packageKey,
                    tool.bridgeName,
                  ].some((value) => value?.toLowerCase().includes(keyword)),
              )
              .slice(0, 8)
          : [];
        const exactTool = availableToolOptions.find(
          (tool) =>
            tool.toolName === query.trim() || tool.displayName === query.trim(),
        );
        const canAddExact = Boolean(
          exactTool && !existingNames.has(exactTool.toolName),
        );
        const canAddFromQuery = canAddExact || suggestions.length > 0;

        return (
          <div key={group.key} className="fi-config-tool-group">
            <div className="fi-config-section-header">
              <div>
                <div className="fi-config-tool-title">{group.label}</div>
                <div className="fi-config-tool-label">{group.description}</div>
              </div>
              <span className="fi-config-muted">
                {groupItems.filter((item) => item.enabled).length}/
                {groupItems.length}
              </span>
            </div>

            <div className="fi-config-tool-search-row">
              <Search size={15} color="var(--text-muted)" />
              <input
                value={query}
                list={`core-tool-options-${group.key}`}
                onChange={(event) =>
                  setQueries((current) => ({
                    ...current,
                    [group.key]: event.target.value,
                  }))
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addToGroup(
                      group,
                      exactTool?.toolName || suggestions[0]?.toolName,
                    );
                  }
                }}
                disabled={disabled}
                placeholder={`${group.label}：搜索全局工具后回车添加`}
              />
              <datalist id={`core-tool-options-${group.key}`}>
                {suggestions.map((tool) => (
                  <option key={tool.toolName} value={tool.toolName}>
                    {tool.displayName}
                  </option>
                ))}
              </datalist>
              {query.trim() && (
                <button
                  type="button"
                  onClick={() =>
                    addToGroup(
                      group,
                      exactTool?.toolName || suggestions[0]?.toolName,
                    )
                  }
                  disabled={disabled || !canAddFromQuery}
                >
                  添加
                </button>
              )}
            </div>
            {availableToolsLoading && (
              <div className="fi-config-tool-loading">
                正在加载全局工具目录...
              </div>
            )}
            {availableToolsError && (
              <div className="fi-config-alert error">
                全局工具目录加载失败：{availableToolsError}
              </div>
            )}
            {keyword && !availableToolsLoading && suggestions.length > 0 && (
              <div className="fi-config-tool-suggestions">
                {suggestions.map((tool) => (
                  <button
                    key={tool.toolName}
                    type="button"
                    onClick={() => addToGroup(group, tool.toolName)}
                    disabled={disabled}
                    className="fi-config-tool-suggestion"
                  >
                    <span className="fi-config-tool-suggestion-text">
                      <span className="fi-config-tool-suggestion-name">
                        {tool.displayName || tool.toolName}
                      </span>
                      <span className="fi-config-tool-suggestion-meta">
                        {tool.toolName}
                        {tool.description ? ` · ${tool.description}` : ""}
                      </span>
                    </span>
                    <span className="fi-config-tool-suggestion-type">
                      {tool.targetType}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className="fi-config-tool-items">
              {filteredItems.map((item, index) => (
                <div
                  key={coreToolKey(item)}
                  className={`fi-config-tool-item${group.system ? " fi-config-tool-item-grid-system" : " fi-config-tool-item-grid-default"}${item.required ? " required" : ""}${!item.enabled ? " disabled" : ""}`}
                >
                  <label className="fi-config-tool-item-name">
                    <input
                      type="checkbox"
                      checked={item.required || item.enabled}
                      disabled={disabled || item.required}
                      onChange={(event) =>
                        updateItem(item, { enabled: event.target.checked })
                      }
                    />
                    <span className="fi-config-tool-item-name-text">
                      {item.name}
                    </span>
                    {item.required && (
                      <span className="fi-config-tool-item-tag">必选</span>
                    )}
                  </label>
                  {group.system && (
                    <SuperAdminSelect
                      value={item.condition}
                      disabled={disabled || item.required}
                      onChange={(condition) => updateItem(item, { condition })}
                      ariaLabel={`${item.name} 启用条件`}
                      size="mini"
                      style={{ minWidth: 118 }}
                      options={systemConditionOptions}
                    />
                  )}
                  <div className="fi-config-tool-item-actions">
                    <button
                      type="button"
                      title="上移"
                      disabled={disabled || index === 0}
                      onClick={() => moveItem(groupItems, item, -1)}
                      className="fi-config-icon-button"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      title="下移"
                      disabled={disabled || index === groupItems.length - 1}
                      onClick={() => moveItem(groupItems, item, 1)}
                      className="fi-config-icon-button"
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>
                  <button
                    type="button"
                    title={item.required ? "默认必选工具不能移除" : "移除"}
                    disabled={disabled || item.required}
                    onClick={() => removeItem(item)}
                    className="fi-config-icon-button danger"
                  >
                    <X size={14} />
                    移除
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

/**
 * 超管平台配置页（主前端承接第十二批）。
 *
 * 业务职责：
 * - Billing：额度规则、模型定价；
 * - System：认证与安全开关。
 */
export const SuperAdminPlatformConfigPage: React.FC = () => {
  const location = useLocation();
  const setShowToolDurations = useFrontendConfigStore(
    (state) => state.setShowToolDurations,
  );
  const [activeL1, setActiveL1] = useState<L1Key>("billing");
  const [activeL2Billing, setActiveL2Billing] =
    useState<L2BillingKey>("quota-rules");
  const [registrationDraft, setRegistrationDraft] = useState<RegistrationDraft>(
    {
      asyncEnhancementEnabled: true,
      registerConcurrency: "200",
      ipRegisterConcurrency: "100",
      enhancementWorkerCount: "8",
      registerQueueSize: "256",
      aiGenerationConcurrency: "6",
      xilaCallConcurrency: "8",
    },
  );

  const [quotaLoading, setQuotaLoading] = useState(false);
  const [quotaSaving, setQuotaSaving] = useState(false);
  const [quotaLoadError, setQuotaLoadError] = useState<string | null>(null);
  const [quotaSaveError, setQuotaSaveError] = useState<string | null>(null);
  const [quotaSaveSuccess, setQuotaSaveSuccess] = useState(false);
  const [quotaSavedDraft, setQuotaSavedDraft] = useState<QuotaDraft | null>(
    null,
  );
  const [quotaDraft, setQuotaDraft] = useState<QuotaDraft | null>(null);
  const [quotaUpdatedAt, setQuotaUpdatedAt] = useState<string | null>(null);

  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingSaving, setPricingSaving] = useState(false);
  const [pricingLoadError, setPricingLoadError] = useState<string | null>(null);
  const [pricingSaveError, setPricingSaveError] = useState<string | null>(null);
  const [pricingSaveSuccess, setPricingSaveSuccess] = useState(false);
  const [pricingSavedDraft, setPricingSavedDraft] = useState<ModelDraft | null>(
    null,
  );
  const [pricingDraft, setPricingDraft] = useState<ModelDraft | null>(null);
  const [pricingUpdatedAt, setPricingUpdatedAt] = useState<string | null>(null);

  const [authLoading, setAuthLoading] = useState(false);
  const [authSaving, setAuthSaving] = useState(false);
  const [authLoadError, setAuthLoadError] = useState<string | null>(null);
  const [authSaveError, setAuthSaveError] = useState<string | null>(null);
  const [authSaveSuccess, setAuthSaveSuccess] = useState(false);
  const [authSavedDraft, setAuthSavedDraft] = useState<AuthDraft | null>(null);
  const [authDraft, setAuthDraft] = useState<AuthDraft | null>(null);
  const [authUpdatedAt, setAuthUpdatedAt] = useState<string | null>(null);

  const [uiDisplayLoading, setUiDisplayLoading] = useState(false);
  const [uiDisplaySaving, setUiDisplaySaving] = useState(false);
  const [uiDisplayLoadError, setUiDisplayLoadError] = useState<string | null>(
    null,
  );
  const [uiDisplaySaveError, setUiDisplaySaveError] = useState<string | null>(
    null,
  );
  const [uiDisplaySaveSuccess, setUiDisplaySaveSuccess] = useState(false);
  const [uiDisplaySavedDraft, setUiDisplaySavedDraft] =
    useState<UiDisplayDraft | null>(null);
  const [uiDisplayDraft, setUiDisplayDraft] = useState<UiDisplayDraft | null>(
    null,
  );
  const [uiDisplayUpdatedAt, setUiDisplayUpdatedAt] = useState<string | null>(
    null,
  );

  const [registrationLoading, setRegistrationLoading] = useState(false);
  const [registrationSaving, setRegistrationSaving] = useState(false);
  const [registrationLoadError, setRegistrationLoadError] = useState<
    string | null
  >(null);
  const [registrationSaveError, setRegistrationSaveError] = useState<
    string | null
  >(null);
  const [registrationSaveSuccess, setRegistrationSaveSuccess] = useState(false);
  const [registrationSavedDraft, setRegistrationSavedDraft] =
    useState<RegistrationDraft | null>(null);
  const [registrationUpdatedAt, setRegistrationUpdatedAt] = useState<
    string | null
  >(null);

  const [sandboxRuntimeLoading, setSandboxRuntimeLoading] = useState(false);
  const [sandboxRuntimeSaving, setSandboxRuntimeSaving] = useState(false);
  const [sandboxRuntimeLoadError, setSandboxRuntimeLoadError] = useState<
    string | null
  >(null);
  const [sandboxRuntimeSaveError, setSandboxRuntimeSaveError] = useState<
    string | null
  >(null);
  const [sandboxRuntimeSaveSuccess, setSandboxRuntimeSaveSuccess] =
    useState(false);
  const [sandboxRuntimeSavedDraft, setSandboxRuntimeSavedDraft] =
    useState<SandboxRuntimeDraft | null>(null);
  const [sandboxRuntimeDraft, setSandboxRuntimeDraft] =
    useState<SandboxRuntimeDraft | null>(null);
  const [sandboxRuntimeUpdatedAt, setSandboxRuntimeUpdatedAt] = useState<
    string | null
  >(null);

  const [kernelRuntimeLoading, setKernelRuntimeLoading] = useState(false);
  const [kernelRuntimeSaving, setKernelRuntimeSaving] = useState(false);
  const [kernelRuntimeLoadError, setKernelRuntimeLoadError] = useState<
    string | null
  >(null);
  const [kernelRuntimeSaveError, setKernelRuntimeSaveError] = useState<
    string | null
  >(null);
  const [kernelRuntimeSaveSuccess, setKernelRuntimeSaveSuccess] =
    useState(false);
  const [kernelRuntimeSavedDraft, setKernelRuntimeSavedDraft] =
    useState<KernelRuntimeDraft | null>(null);
  const [kernelRuntimeDraft, setKernelRuntimeDraft] =
    useState<KernelRuntimeDraft | null>(null);
  const [kernelRuntimeUpdatedAt, setKernelRuntimeUpdatedAt] = useState<
    string | null
  >(null);

  const [runtimeAssetsSourceLoading, setRuntimeAssetsSourceLoading] =
    useState(false);
  const [runtimeAssetsSourceSaving, setRuntimeAssetsSourceSaving] =
    useState(false);
  const [runtimeAssetsSourceLoadError, setRuntimeAssetsSourceLoadError] =
    useState<string | null>(null);
  const [runtimeAssetsSourceSaveError, setRuntimeAssetsSourceSaveError] =
    useState<string | null>(null);
  const [runtimeAssetsSourceSaveSuccess, setRuntimeAssetsSourceSaveSuccess] =
    useState(false);
  const [runtimeAssetsSourceSavedDraft, setRuntimeAssetsSourceSavedDraft] =
    useState<RuntimeAssetsSourceDraft | null>(null);
  const [runtimeAssetsSourceDraft, setRuntimeAssetsSourceDraft] =
    useState<RuntimeAssetsSourceDraft | null>(null);
  const [runtimeAssetsSourceUpdatedAt, setRuntimeAssetsSourceUpdatedAt] =
    useState<string | null>(null);

  const [externalDataCacheLoading, setExternalDataCacheLoading] = useState(false);
  const [externalDataCacheSaving, setExternalDataCacheSaving] = useState(false);
  const [externalDataCacheLoadError, setExternalDataCacheLoadError] =
    useState<string | null>(null);
  const [externalDataCacheSaveError, setExternalDataCacheSaveError] =
    useState<string | null>(null);
  const [externalDataCacheSaveSuccess, setExternalDataCacheSaveSuccess] =
    useState(false);
  const [externalDataCacheSavedDraft, setExternalDataCacheSavedDraft] =
    useState<ExternalDataCacheDraft | null>(null);
  const [externalDataCacheDraft, setExternalDataCacheDraft] =
    useState<ExternalDataCacheDraft | null>(null);
  const [externalDataCacheUpdatedAt, setExternalDataCacheUpdatedAt] =
    useState<string | null>(null);

  const [toolSearchLoading, setToolSearchLoading] = useState(false);
  const [toolSearchSaving, setToolSearchSaving] = useState(false);
  const [toolSearchLoadError, setToolSearchLoadError] = useState<string | null>(
    null,
  );
  const [toolSearchSaveError, setToolSearchSaveError] = useState<string | null>(
    null,
  );
  const [toolSearchSaveSuccess, setToolSearchSaveSuccess] = useState(false);
  const [toolSearchSavedDraft, setToolSearchSavedDraft] =
    useState<ToolSearchDraft | null>(null);
  const [toolSearchDraft, setToolSearchDraft] =
    useState<ToolSearchDraft | null>(null);
  const [toolSearchUpdatedAt, setToolSearchUpdatedAt] = useState<string | null>(
    null,
  );
  const [toolSearchAvailableTools, setToolSearchAvailableTools] = useState<
    SaMcpAvailableToolItem[]
  >([]);
  const [toolSearchAvailableToolsLoading, setToolSearchAvailableToolsLoading] =
    useState(false);
  const [toolSearchAvailableToolsError, setToolSearchAvailableToolsError] =
    useState<string | null>(null);

  const toolSearchSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const toolSearchInitialLoadRef = useRef(true);

  const quotaDirty = useMemo(
    () =>
      quotaDraft !== null &&
      quotaSavedDraft !== null &&
      JSON.stringify(quotaDraft) !== JSON.stringify(quotaSavedDraft),
    [quotaDraft, quotaSavedDraft],
  );
  const pricingDirty = useMemo(
    () =>
      pricingDraft !== null &&
      pricingSavedDraft !== null &&
      JSON.stringify(pricingDraft) !== JSON.stringify(pricingSavedDraft),
    [pricingDraft, pricingSavedDraft],
  );
  const authDirty = useMemo(
    () =>
      authDraft !== null &&
      authSavedDraft !== null &&
      JSON.stringify(authDraft) !== JSON.stringify(authSavedDraft),
    [authDraft, authSavedDraft],
  );
  const uiDisplayDirty = useMemo(
    () =>
      uiDisplayDraft !== null &&
      uiDisplaySavedDraft !== null &&
      JSON.stringify(uiDisplayDraft) !== JSON.stringify(uiDisplaySavedDraft),
    [uiDisplayDraft, uiDisplaySavedDraft],
  );
  const registrationDirty = useMemo(
    () =>
      registrationSavedDraft !== null &&
      JSON.stringify(registrationDraft) !==
        JSON.stringify(registrationSavedDraft),
    [registrationDraft, registrationSavedDraft],
  );
  const sandboxRuntimeDirty = useMemo(
    () =>
      sandboxRuntimeDraft !== null &&
      sandboxRuntimeSavedDraft !== null &&
      JSON.stringify(sandboxRuntimeDraft) !==
        JSON.stringify(sandboxRuntimeSavedDraft),
    [sandboxRuntimeDraft, sandboxRuntimeSavedDraft],
  );
  const kernelRuntimeDirty = useMemo(
    () =>
      kernelRuntimeDraft !== null &&
      kernelRuntimeSavedDraft !== null &&
      JSON.stringify(kernelRuntimeDraft) !==
        JSON.stringify(kernelRuntimeSavedDraft),
    [kernelRuntimeDraft, kernelRuntimeSavedDraft],
  );
  const runtimeAssetsSourceDirty = useMemo(
    () =>
      runtimeAssetsSourceDraft !== null &&
      runtimeAssetsSourceSavedDraft !== null &&
      JSON.stringify(runtimeAssetsSourceDraft) !==
        JSON.stringify(runtimeAssetsSourceSavedDraft),
    [runtimeAssetsSourceDraft, runtimeAssetsSourceSavedDraft],
  );
  const externalDataCacheDirty = useMemo(
    () =>
      externalDataCacheDraft !== null &&
      externalDataCacheSavedDraft !== null &&
      JSON.stringify(externalDataCacheDraft) !==
        JSON.stringify(externalDataCacheSavedDraft),
    [externalDataCacheDraft, externalDataCacheSavedDraft],
  );
  const toolSearchDirty = useMemo(
    () =>
      toolSearchDraft !== null &&
      toolSearchSavedDraft !== null &&
      JSON.stringify(toolSearchDraft) !== JSON.stringify(toolSearchSavedDraft),
    [toolSearchDraft, toolSearchSavedDraft],
  );

  const loadQuotaRules = useCallback(async () => {
    setQuotaLoading(true);
    setQuotaLoadError(null);
    try {
      const data = await superAdminApi.quotaRules();
      const draft = toQuotaDraft(data);
      setQuotaSavedDraft(draft);
      setQuotaDraft(draft);
      setQuotaUpdatedAt(data.updatedAt);
    } catch (err) {
      setQuotaLoadError(
        err instanceof Error ? err.message : "请求失败，请稍后重试",
      );
    } finally {
      setQuotaLoading(false);
    }
  }, []);

  const loadModelPricing = useCallback(async () => {
    setPricingLoading(true);
    setPricingLoadError(null);
    try {
      const data = await superAdminApi.modelPricing();
      const draft = toModelDraft(data);
      setPricingSavedDraft(draft);
      setPricingDraft(draft);
      setPricingUpdatedAt(data.updatedAt);
    } catch (err) {
      setPricingLoadError(
        err instanceof Error ? err.message : "请求失败，请稍后重试",
      );
    } finally {
      setPricingLoading(false);
    }
  }, []);

  const loadAuthSecurity = useCallback(async () => {
    setAuthLoading(true);
    setAuthLoadError(null);
    try {
      const data = await superAdminApi.authSecurity();
      const draft = toAuthDraft(data);
      setAuthSavedDraft(draft);
      setAuthDraft(draft);
      setAuthUpdatedAt(data.updatedAt);
    } catch (err) {
      setAuthLoadError(
        err instanceof Error ? err.message : "请求失败，请稍后重试",
      );
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const loadUiDisplayConfig = useCallback(async () => {
    setUiDisplayLoading(true);
    setUiDisplayLoadError(null);
    try {
      const data = await superAdminApi.uiDisplayConfig();
      const draft = toUiDisplayDraft(data);
      setUiDisplaySavedDraft(draft);
      setUiDisplayDraft(draft);
      setUiDisplayUpdatedAt(data.updatedAt ?? null);
    } catch (err) {
      setUiDisplayLoadError(
        err instanceof Error ? err.message : "请求失败，请稍后重试",
      );
    } finally {
      setUiDisplayLoading(false);
    }
  }, []);

  const loadRegistrationInitializationConfig = useCallback(async () => {
    setRegistrationLoading(true);
    setRegistrationLoadError(null);
    try {
      const data = await superAdminApi.registrationInitializationConfig();
      const draft = toRegistrationDraft(data);
      setRegistrationSavedDraft(draft);
      setRegistrationDraft(draft);
      setRegistrationUpdatedAt(data.updatedAt ?? null);
    } catch (err) {
      setRegistrationLoadError(
        err instanceof Error ? err.message : "请求失败，请稍后重试",
      );
    } finally {
      setRegistrationLoading(false);
    }
  }, []);

  const loadSandboxRuntimeConfig = useCallback(async () => {
    setSandboxRuntimeLoading(true);
    setSandboxRuntimeLoadError(null);
    try {
      const data = await superAdminApi.sandboxRuntimeConfig();
      const draft = toSandboxRuntimeDraft(data);
      setSandboxRuntimeSavedDraft(draft);
      setSandboxRuntimeDraft(draft);
      setSandboxRuntimeUpdatedAt(data.updatedAt ?? null);
    } catch (err) {
      setSandboxRuntimeLoadError(
        err instanceof Error ? err.message : "请求失败，请稍后重试",
      );
    } finally {
      setSandboxRuntimeLoading(false);
    }
  }, []);

  const loadKernelRuntimeConfig = useCallback(async () => {
    setKernelRuntimeLoading(true);
    setKernelRuntimeLoadError(null);
    try {
      const data = await superAdminApi.kernelRuntimeConfig();
      const draft = toKernelRuntimeDraft(data);
      setKernelRuntimeSavedDraft(draft);
      setKernelRuntimeDraft(draft);
      setKernelRuntimeUpdatedAt(data.updatedAt ?? null);
    } catch (err) {
      setKernelRuntimeLoadError(
        err instanceof Error ? err.message : "请求失败，请稍后重试",
      );
    } finally {
      setKernelRuntimeLoading(false);
    }
  }, []);

  const loadRuntimeAssetsSourceConfig = useCallback(async () => {
    setRuntimeAssetsSourceLoading(true);
    setRuntimeAssetsSourceLoadError(null);
    try {
      const data = await superAdminApi.runtimeAssetsSourceConfig();
      const draft = toRuntimeAssetsSourceDraft(data);
      setRuntimeAssetsSourceSavedDraft(draft);
      setRuntimeAssetsSourceDraft(draft);
      setRuntimeAssetsSourceUpdatedAt(data.updatedAt ?? null);
    } catch (err) {
      setRuntimeAssetsSourceLoadError(
        err instanceof Error ? err.message : "请求失败，请稍后重试",
      );
    } finally {
      setRuntimeAssetsSourceLoading(false);
    }
  }, []);

  const loadExternalDataCacheConfig = useCallback(async () => {
    setExternalDataCacheLoading(true);
    setExternalDataCacheLoadError(null);
    try {
      const data = await superAdminApi.externalDataCacheConfig();
      const draft = toExternalDataCacheDraft(data);
      setExternalDataCacheSavedDraft(draft);
      setExternalDataCacheDraft(draft);
      setExternalDataCacheUpdatedAt(data.updatedAt ?? null);
    } catch (err) {
      setExternalDataCacheLoadError(
        err instanceof Error ? err.message : "请求失败，请稍后重试",
      );
    } finally {
      setExternalDataCacheLoading(false);
    }
  }, []);

  const loadToolSearchConfig = useCallback(async () => {
    setToolSearchLoading(true);
    setToolSearchLoadError(null);
    try {
      const data = await superAdminApi.toolSearchConfig();
      const draft = toToolSearchDraft(data);
      setToolSearchSavedDraft(draft);
      setToolSearchDraft(draft);
      setToolSearchUpdatedAt(data.updatedAt);
    } catch (err) {
      setToolSearchLoadError(
        err instanceof Error ? err.message : "请求失败，请稍后重试",
      );
    } finally {
      setToolSearchLoading(false);
    }
  }, []);

  const loadToolSearchAvailableTools = useCallback(async () => {
    setToolSearchAvailableToolsLoading(true);
    setToolSearchAvailableToolsError(null);
    try {
      const data = await superAdminApi.mcpAvailableTools();
      setToolSearchAvailableTools(data);
    } catch (err) {
      setToolSearchAvailableToolsError(
        err instanceof Error ? err.message : "请求失败，请稍后重试",
      );
    } finally {
      setToolSearchAvailableToolsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadQuotaRules();
    void loadModelPricing();
    void loadAuthSecurity();
    void loadUiDisplayConfig();
    void loadRegistrationInitializationConfig();
    void loadSandboxRuntimeConfig();
    void loadKernelRuntimeConfig();
    void loadRuntimeAssetsSourceConfig();
    void loadExternalDataCacheConfig();
    void loadToolSearchConfig();
    void loadToolSearchAvailableTools();
  }, [
    loadAuthSecurity,
    loadExternalDataCacheConfig,
    loadKernelRuntimeConfig,
    loadModelPricing,
    loadQuotaRules,
    loadRegistrationInitializationConfig,
    loadRuntimeAssetsSourceConfig,
    loadSandboxRuntimeConfig,
    loadToolSearchAvailableTools,
    loadToolSearchConfig,
    loadUiDisplayConfig,
  ]);

  // 自动保存：tool-search 配置变更 1.5s 后自动落库
  useEffect(() => {
    if (toolSearchDraft === null || toolSearchSavedDraft === null) return;
    if (toolSearchInitialLoadRef.current) {
      toolSearchInitialLoadRef.current = false;
      return;
    }
    if (!toolSearchDirty || toolSearchSaving) return;

    if (toolSearchSaveTimerRef.current)
      clearTimeout(toolSearchSaveTimerRef.current);
    toolSearchSaveTimerRef.current = setTimeout(() => {
      void saveToolSearchConfig();
    }, 1500);

    return () => {
      if (toolSearchSaveTimerRef.current)
        clearTimeout(toolSearchSaveTimerRef.current);
    };
    // saveToolSearchConfig is intentionally omitted — it's stable-enough via the
    // toolSearchDraft/toolSearchSaving guards and the debounce reset on each change.
  }, [
    toolSearchDraft,
    toolSearchDirty,
    toolSearchSaving,
    toolSearchSavedDraft,
  ]);

  useEffect(() => {
    const tab = new URLSearchParams(location.search).get("tab");
    if (tab === "model-pricing") {
      setActiveL1("billing");
      setActiveL2Billing("model-pricing");
    } else if (tab === "system-config") {
      setActiveL1("system");
    } else if (tab === "llm-config") {
      setActiveL1("llm-config");
    } else if (tab === "tool-search") {
      setActiveL1("tool-search");
    } else if (tab === "paid-api") {
      setActiveL1("paid-api");
    } else if (tab === "registration") {
      setActiveL1("registration");
    } else if (tab === "sandbox-runtime") {
      setActiveL1("sandbox-runtime");
    } else if (tab === "kernel-runtime") {
      setActiveL1("kernel-runtime");
    } else if (tab === "external-data-cache") {
      setActiveL1("external-data-cache");
    } else if (tab === "runtime-assets-source") {
      setActiveL1("runtime-assets-source");
    } else {
      setActiveL1("billing");
      setActiveL2Billing("quota-rules");
    }
  }, [location.search]);

  const saveQuotaRules = async () => {
    if (!quotaDraft) {
      return;
    }
    if (
      Number.isNaN(Number(quotaDraft.preChargePerJob)) ||
      Number.isNaN(Number(quotaDraft.dailyMaxCreditsPerUser)) ||
      Number.isNaN(Number(quotaDraft.lowBalanceThreshold))
    ) {
      setQuotaSaveError("请输入有效数字");
      return;
    }
    setQuotaSaving(true);
    setQuotaSaveError(null);
    setQuotaSaveSuccess(false);
    try {
      const result = await superAdminApi.updateQuotaRules({
        preChargePerJob: Number(quotaDraft.preChargePerJob),
        dailyMaxCreditsPerUser: Number(quotaDraft.dailyMaxCreditsPerUser),
        lowBalanceThreshold: Number(quotaDraft.lowBalanceThreshold),
      });
      setQuotaSavedDraft(quotaDraft);
      setQuotaUpdatedAt(result.updatedAt);
      setQuotaSaveSuccess(true);
    } catch (err) {
      setQuotaSaveError(
        err instanceof Error ? err.message : "保存失败，请稍后重试",
      );
    } finally {
      setQuotaSaving(false);
    }
  };

  const discardQuotaRules = () => {
    setQuotaDraft(quotaSavedDraft);
    setQuotaSaveError(null);
    setQuotaSaveSuccess(false);
  };

  const saveModelPricing = async () => {
    if (!pricingDraft) {
      return;
    }
    if (
      Number.isNaN(Number(pricingDraft.defaultInput)) ||
      Number.isNaN(Number(pricingDraft.defaultOutput))
    ) {
      setPricingSaveError("请输入有效数字");
      return;
    }
    setPricingSaving(true);
    setPricingSaveError(null);
    setPricingSaveSuccess(false);
    try {
      const result = await superAdminApi.updateModelPricing({
        defaultInput: Number(pricingDraft.defaultInput),
        defaultOutput: Number(pricingDraft.defaultOutput),
        overrides: pricingDraft.overrides.map((item) => ({
          modelId: item.modelId,
          inputPrice:
            item.inputPrice.trim() === "" ? null : Number(item.inputPrice),
          outputPrice:
            item.outputPrice.trim() === "" ? null : Number(item.outputPrice),
        })),
      });
      setPricingSavedDraft(pricingDraft);
      setPricingUpdatedAt(result.updatedAt);
      setPricingSaveSuccess(true);
    } catch (err) {
      setPricingSaveError(
        err instanceof Error ? err.message : "保存失败，请稍后重试",
      );
    } finally {
      setPricingSaving(false);
    }
  };

  const discardModelPricing = () => {
    setPricingDraft(pricingSavedDraft);
    setPricingSaveError(null);
    setPricingSaveSuccess(false);
  };

  const updatePricingOverride = (
    index: number,
    field: "inputPrice" | "outputPrice",
    value: string,
  ) => {
    if (!pricingDraft || !pricingSavedDraft) {
      return;
    }
    const savedVal = pricingSavedDraft.overrides[index]?.[field] ?? "";
    if (value.trim() === "" && savedVal !== "") {
      return;
    }
    const next = pricingDraft.overrides.map((item, rowIndex) =>
      rowIndex === index ? { ...item, [field]: value } : item,
    );
    setPricingDraft({ ...pricingDraft, overrides: next });
  };

  const saveAuthSecurity = async () => {
    if (!authDraft) {
      return;
    }
    setAuthSaving(true);
    setAuthSaveError(null);
    setAuthSaveSuccess(false);
    try {
      const result = await superAdminApi.updateAuthSecurity({
        frontendEnabled: authDraft.frontendEnabled,
        backendRequired: authDraft.backendRequired,
      });
      setAuthSavedDraft(authDraft);
      setAuthUpdatedAt(result.updatedAt);
      setAuthSaveSuccess(true);
    } catch (err) {
      setAuthSaveError(
        err instanceof Error ? err.message : "保存失败，请稍后重试",
      );
    } finally {
      setAuthSaving(false);
    }
  };

  const discardAuthSecurity = () => {
    setAuthDraft(authSavedDraft);
    setAuthSaveError(null);
    setAuthSaveSuccess(false);
  };

  const saveUiDisplayConfig = async () => {
    if (!uiDisplayDraft) {
      return;
    }
    setUiDisplaySaving(true);
    setUiDisplaySaveError(null);
    setUiDisplaySaveSuccess(false);
    try {
      const result = await superAdminApi.updateUiDisplayConfig({
        showToolDurations: uiDisplayDraft.showToolDurations,
      });
      setUiDisplaySavedDraft(uiDisplayDraft);
      setUiDisplayUpdatedAt(result.updatedAt ?? null);
      setShowToolDurations(result.showToolDurations);
      setUiDisplaySaveSuccess(true);
    } catch (err) {
      setUiDisplaySaveError(
        err instanceof Error ? err.message : "保存失败，请稍后重试",
      );
    } finally {
      setUiDisplaySaving(false);
    }
  };

  const discardUiDisplayConfig = () => {
    setUiDisplayDraft(uiDisplaySavedDraft);
    setUiDisplaySaveError(null);
    setUiDisplaySaveSuccess(false);
  };

  const saveRegistrationInitializationConfig = async () => {
    const intFields = [
      registrationDraft.registerConcurrency,
      registrationDraft.ipRegisterConcurrency,
      registrationDraft.enhancementWorkerCount,
      registrationDraft.registerQueueSize,
      registrationDraft.aiGenerationConcurrency,
      registrationDraft.xilaCallConcurrency,
    ];
    if (
      intFields.some(
        (value) => !Number.isInteger(Number(value)) || Number(value) <= 0,
      )
    ) {
      setRegistrationSaveError("请输入大于 0 的整数");
      return;
    }
    setRegistrationSaving(true);
    setRegistrationSaveError(null);
    setRegistrationSaveSuccess(false);
    try {
      const result = await superAdminApi.updateRegistrationInitializationConfig(
        {
          asyncEnhancementEnabled: registrationDraft.asyncEnhancementEnabled,
          registerConcurrency: Number(registrationDraft.registerConcurrency),
          ipRegisterConcurrency: Number(
            registrationDraft.ipRegisterConcurrency,
          ),
          enhancementWorkerCount: Number(
            registrationDraft.enhancementWorkerCount,
          ),
          registerQueueSize: Number(registrationDraft.registerQueueSize),
          aiGenerationConcurrency: Number(
            registrationDraft.aiGenerationConcurrency,
          ),
          xilaCallConcurrency: Number(registrationDraft.xilaCallConcurrency),
        },
      );
      const saved = toRegistrationDraft(result);
      setRegistrationSavedDraft(saved);
      setRegistrationDraft(saved);
      setRegistrationUpdatedAt(result.updatedAt ?? null);
      setRegistrationSaveSuccess(true);
    } catch (err) {
      setRegistrationSaveError(
        err instanceof Error ? err.message : "保存失败，请稍后重试",
      );
    } finally {
      setRegistrationSaving(false);
    }
  };

  const discardRegistrationInitializationConfig = () => {
    if (registrationSavedDraft) {
      setRegistrationDraft(registrationSavedDraft);
    }
    setRegistrationSaveError(null);
    setRegistrationSaveSuccess(false);
  };

  const saveSandboxRuntimeConfig = async () => {
    if (!sandboxRuntimeDraft) {
      return;
    }
    const positiveIntFields = [
      sandboxRuntimeDraft.quotaPersonalLimit,
      sandboxRuntimeDraft.quotaTenantLimit,
      sandboxRuntimeDraft.quotaQueueTimeoutSeconds,
      sandboxRuntimeDraft.totalMemLimitMb,
      sandboxRuntimeDraft.codeMemLimitMb,
      sandboxRuntimeDraft.replMemLimitMb,
    ];
    const nonNegativeIntFields = [
      sandboxRuntimeDraft.quotaRecycleThreshold,
      sandboxRuntimeDraft.quotaTenantRecycleThreshold,
      sandboxRuntimeDraft.egressBandwidthMbps,
      sandboxRuntimeDraft.ingressBandwidthMbps,
    ];
    const textFields = [
      sandboxRuntimeDraft.resourceCpuMin,
      sandboxRuntimeDraft.resourceCpuMax,
      sandboxRuntimeDraft.resourceMemory,
      sandboxRuntimeDraft.resourceTmpSize,
    ];
    if (
      positiveIntFields.some(
        (value) => !Number.isInteger(Number(value)) || Number(value) <= 0,
      ) ||
      nonNegativeIntFields.some(
        (value) => !Number.isInteger(Number(value)) || Number(value) < 0,
      ) ||
      textFields.some((value) => value.trim() === "")
    ) {
      setSandboxRuntimeSaveError("请输入有效的 Sandbox 运行配置");
      return;
    }
    if (
      Number(sandboxRuntimeDraft.codeMemLimitMb) >=
        Number(sandboxRuntimeDraft.totalMemLimitMb) ||
      Number(sandboxRuntimeDraft.replMemLimitMb) >=
        Number(sandboxRuntimeDraft.totalMemLimitMb)
    ) {
      setSandboxRuntimeSaveError(
        "Shell 与 Python REPL 的进程内存上限必须小于总内存保护值",
      );
      return;
    }
    setSandboxRuntimeSaving(true);
    setSandboxRuntimeSaveError(null);
    setSandboxRuntimeSaveSuccess(false);
    try {
      const result = await superAdminApi.updateSandboxRuntimeConfig({
        quotaPersonalLimit: Number(sandboxRuntimeDraft.quotaPersonalLimit),
        quotaTenantLimit: Number(sandboxRuntimeDraft.quotaTenantLimit),
        quotaQueueTimeoutSeconds: Number(
          sandboxRuntimeDraft.quotaQueueTimeoutSeconds,
        ),
        quotaRecycleThreshold: Number(
          sandboxRuntimeDraft.quotaRecycleThreshold,
        ),
        quotaTenantRecycleThreshold: Number(
          sandboxRuntimeDraft.quotaTenantRecycleThreshold,
        ),
        resourceCpuMin: sandboxRuntimeDraft.resourceCpuMin.trim(),
        resourceCpuMax: sandboxRuntimeDraft.resourceCpuMax.trim(),
        resourceMemory: sandboxRuntimeDraft.resourceMemory.trim(),
        resourceTmpSize: sandboxRuntimeDraft.resourceTmpSize.trim(),
        totalMemLimitMb: Number(sandboxRuntimeDraft.totalMemLimitMb),
        codeMemLimitMb: Number(sandboxRuntimeDraft.codeMemLimitMb),
        replMemLimitMb: Number(sandboxRuntimeDraft.replMemLimitMb),
        egressBandwidthMbps: Number(sandboxRuntimeDraft.egressBandwidthMbps),
        ingressBandwidthMbps: Number(sandboxRuntimeDraft.ingressBandwidthMbps),
      });
      const saved = toSandboxRuntimeDraft(result);
      setSandboxRuntimeSavedDraft(saved);
      setSandboxRuntimeDraft(saved);
      setSandboxRuntimeUpdatedAt(result.updatedAt ?? null);
      setSandboxRuntimeSaveSuccess(true);
    } catch (err) {
      setSandboxRuntimeSaveError(
        err instanceof Error ? err.message : "保存失败，请稍后重试",
      );
    } finally {
      setSandboxRuntimeSaving(false);
    }
  };

  const discardSandboxRuntimeConfig = () => {
    setSandboxRuntimeDraft(sandboxRuntimeSavedDraft);
    setSandboxRuntimeSaveError(null);
    setSandboxRuntimeSaveSuccess(false);
  };

  const saveKernelRuntimeConfig = async () => {
    if (!kernelRuntimeDraft) {
      return;
    }
    setKernelRuntimeSaving(true);
    setKernelRuntimeSaveError(null);
    setKernelRuntimeSaveSuccess(false);
    try {
      const result = await superAdminApi.updateKernelRuntimeConfig({
        persistIterationContext: kernelRuntimeDraft.persistIterationContext,
      });
      const saved = toKernelRuntimeDraft(result);
      setKernelRuntimeSavedDraft(saved);
      setKernelRuntimeDraft(saved);
      setKernelRuntimeUpdatedAt(result.updatedAt ?? null);
      setKernelRuntimeSaveSuccess(true);
    } catch (err) {
      setKernelRuntimeSaveError(
        err instanceof Error ? err.message : "保存失败，请稍后重试",
      );
    } finally {
      setKernelRuntimeSaving(false);
    }
  };

  const discardKernelRuntimeConfig = () => {
    setKernelRuntimeDraft(kernelRuntimeSavedDraft);
    setKernelRuntimeSaveError(null);
    setKernelRuntimeSaveSuccess(false);
  };

  const saveRuntimeAssetsSourceConfig = async () => {
    if (!runtimeAssetsSourceDraft) {
      return;
    }
    setRuntimeAssetsSourceSaving(true);
    setRuntimeAssetsSourceSaveError(null);
    setRuntimeAssetsSourceSaveSuccess(false);
    try {
      const result = await superAdminApi.updateRuntimeAssetsSourceConfig({
        source: runtimeAssetsSourceDraft.source,
      });
      const saved = toRuntimeAssetsSourceDraft(result);
      setRuntimeAssetsSourceSavedDraft(saved);
      setRuntimeAssetsSourceDraft(saved);
      setRuntimeAssetsSourceUpdatedAt(result.updatedAt ?? null);
      setRuntimeAssetsSourceSaveSuccess(true);
    } catch (err) {
      setRuntimeAssetsSourceSaveError(
        err instanceof Error ? err.message : "保存失败，请稍后重试",
      );
    } finally {
      setRuntimeAssetsSourceSaving(false);
    }
  };

  const discardRuntimeAssetsSourceConfig = () => {
    setRuntimeAssetsSourceDraft(runtimeAssetsSourceSavedDraft);
    setRuntimeAssetsSourceSaveError(null);
    setRuntimeAssetsSourceSaveSuccess(false);
  };

  const saveExternalDataCacheConfig = async () => {
    if (!externalDataCacheDraft) return;
    const values = [
      externalDataCacheDraft.litigationDetailTtlHours,
      externalDataCacheDraft.litigationSummaryTtlHours,
      externalDataCacheDraft.emptyTtlHours,
    ].map(Number);
    if (values.some((value) => !Number.isInteger(value) || value < 1 || value > 720)) {
      setExternalDataCacheSaveError("有效期必须是 1～720 的整数小时");
      return;
    }
    const maxSnapshotCount = Number(externalDataCacheDraft.maxSnapshotCount);
    if (
      !Number.isInteger(maxSnapshotCount) ||
      maxSnapshotCount < 1 ||
      maxSnapshotCount > 100000
    ) {
      setExternalDataCacheSaveError("最大快照数量必须是 1～100000 的整数");
      return;
    }
    setExternalDataCacheSaving(true);
    setExternalDataCacheSaveError(null);
    setExternalDataCacheSaveSuccess(false);
    try {
      const result = await superAdminApi.updateExternalDataCacheConfig({
        enabled: externalDataCacheDraft.enabled,
        litigationDetailTtlHours: values[0],
        litigationSummaryTtlHours: values[1],
        emptyTtlHours: values[2],
        maxSnapshotCount,
      });
      const saved = toExternalDataCacheDraft(result);
      setExternalDataCacheSavedDraft(saved);
      setExternalDataCacheDraft(saved);
      setExternalDataCacheUpdatedAt(result.updatedAt ?? null);
      setExternalDataCacheSaveSuccess(true);
    } catch (err) {
      setExternalDataCacheSaveError(
        err instanceof Error ? err.message : "保存失败，请稍后重试",
      );
    } finally {
      setExternalDataCacheSaving(false);
    }
  };

  const discardExternalDataCacheConfig = () => {
    setExternalDataCacheDraft(externalDataCacheSavedDraft);
    setExternalDataCacheSaveError(null);
    setExternalDataCacheSaveSuccess(false);
  };

  const saveToolSearchConfig = async () => {
    if (!toolSearchDraft) {
      return;
    }
    const intFields = [
      toolSearchDraft.topKDefault,
      toolSearchDraft.topKMin,
      toolSearchDraft.topKMax,
      toolSearchDraft.topKSimple,
      toolSearchDraft.topKComplex,
      toolSearchDraft.maxLoadedDynamicTools,
      toolSearchDraft.maxSearchesPerJob,
      toolSearchDraft.maxSearchesPerIteration,
      toolSearchDraft.loadedToolTtlTurns,
      toolSearchDraft.loadedToolTtlSeconds,
    ];
    const numberFields = [
      toolSearchDraft.minScore,
      toolSearchDraft.lowConfidenceThreshold,
      toolSearchDraft.exactNameBoost,
      toolSearchDraft.aliasBoost,
      toolSearchDraft.enabledSkillBoost,
      toolSearchDraft.agentBusinessBoost,
      toolSearchDraft.recentErrorRecoveryBoost,
      toolSearchDraft.sampleRate,
    ];
    if (
      intFields.some((value) => !Number.isInteger(Number(value))) ||
      numberFields.some((value) => Number.isNaN(Number(value)))
    ) {
      setToolSearchSaveError("请输入有效数字");
      return;
    }
    let fieldWeights: Record<string, number>;
    let sideEffectPenalty: Record<string, number>;
    let costPenalty: Record<string, number>;
    let providerPolicy: Record<string, unknown>;
    try {
      fieldWeights = JSON.parse(toolSearchDraft.fieldWeights);
      sideEffectPenalty = JSON.parse(toolSearchDraft.sideEffectPenalty);
      costPenalty = JSON.parse(toolSearchDraft.costPenalty);
      providerPolicy = JSON.parse(toolSearchDraft.providerPolicy);
    } catch {
      setToolSearchSaveError("JSON 配置格式不正确");
      return;
    }
    const coreTools = respaceCoreTools(toolSearchDraft.coreTools);
    if (coreTools.length === 0) {
      setToolSearchSaveError("核心工具不能为空");
      return;
    }
    setToolSearchSaving(true);
    setToolSearchSaveError(null);
    setToolSearchSaveSuccess(false);
    try {
      const result = await superAdminApi.updateToolSearchConfig({
        enabled: toolSearchDraft.enabled,
        mode: toolSearchDraft.mode,
        invokeDynamicToolEnabled: toolSearchDraft.invokeDynamicToolEnabled,
        topKDefault: Number(toolSearchDraft.topKDefault),
        topKMin: Number(toolSearchDraft.topKMin),
        topKMax: Number(toolSearchDraft.topKMax),
        topKSimple: Number(toolSearchDraft.topKSimple),
        topKComplex: Number(toolSearchDraft.topKComplex),
        adaptiveTopKEnabled: toolSearchDraft.adaptiveTopKEnabled,
        maxLoadedDynamicTools: Number(toolSearchDraft.maxLoadedDynamicTools),
        maxSearchesPerJob: Number(toolSearchDraft.maxSearchesPerJob),
        maxSearchesPerIteration: Number(
          toolSearchDraft.maxSearchesPerIteration,
        ),
        loadedToolTtlTurns: Number(toolSearchDraft.loadedToolTtlTurns),
        loadedToolTtlSeconds: Number(toolSearchDraft.loadedToolTtlSeconds),
        minScore: Number(toolSearchDraft.minScore),
        lowConfidenceThreshold: Number(toolSearchDraft.lowConfidenceThreshold),
        retrievalMode: toolSearchDraft.retrievalMode,
        tokenizer: toolSearchDraft.tokenizer.trim(),
        fieldWeights,
        exactNameBoost: Number(toolSearchDraft.exactNameBoost),
        aliasBoost: Number(toolSearchDraft.aliasBoost),
        rerankEnabled: toolSearchDraft.rerankEnabled,
        enabledSkillBoost: Number(toolSearchDraft.enabledSkillBoost),
        agentBusinessBoost: Number(toolSearchDraft.agentBusinessBoost),
        recentErrorRecoveryBoost: Number(
          toolSearchDraft.recentErrorRecoveryBoost,
        ),
        sideEffectPenalty,
        costPenalty,
        preferResolverTools: toolSearchDraft.preferResolverTools,
        sessionCacheEnabled: toolSearchDraft.sessionCacheEnabled,
        clearOnTaskShift: toolSearchDraft.clearOnTaskShift,
        retainSuccessfullyCalledTools:
          toolSearchDraft.retainSuccessfullyCalledTools,
        retainFailedToolsForRecovery:
          toolSearchDraft.retainFailedToolsForRecovery,
        fallback: toolSearchDraft.fallback,
        providerPolicy,
        observe: toolSearchDraft.observe,
        sampleRate: Number(toolSearchDraft.sampleRate),
        coreTools,
        alwaysIncludeEnabledFilterTools: false,
        includeBashInCore: false,
        includeTaskInCore: false,
        allowFullFallback: toolSearchDraft.allowFullFallback,
      });
      const saved = toToolSearchDraft(result);
      setToolSearchSavedDraft(saved);
      setToolSearchDraft(saved);
      setToolSearchUpdatedAt(result.updatedAt);
      setToolSearchSaveSuccess(true);
    } catch (err) {
      setToolSearchSaveError(
        err instanceof Error ? err.message : "保存失败，请稍后重试",
      );
    } finally {
      setToolSearchSaving(false);
    }
  };

  const discardToolSearchConfig = () => {
    setToolSearchDraft(toolSearchSavedDraft);
    setToolSearchSaveError(null);
    setToolSearchSaveSuccess(false);
  };

  const activeConfigKey: ConfigKey = activeL1 === "system"
    ? "system-config"
    : activeL1 === "billing"
      ? activeL2Billing
      : activeL1;
  const toolSearchDynamicDisabled =
    !toolSearchDraft?.enabled || toolSearchDraft.mode !== "active";
  const toolSearchDynamicHint = !toolSearchDraft?.enabled
    ? "Tool Search 关闭时动态工具调用自动关闭。"
    : toolSearchDraft.mode !== "active"
      ? "非 active 模式下动态工具调用不生效。"
      : toolSearchDraft.invokeDynamicToolEnabled
        ? "开启后模型通过 tool_search 召回工具，并由 invoke_dynamic_tool 分发。"
        : "关闭后 tool_search 仍按核心工具配置暴露，召回工具后续直接可见，不暴露 invoke_dynamic_tool。";
  const toolSearchEffectiveMode = !toolSearchDraft?.enabled
    ? "legacy"
    : toolSearchDraft.mode === "active"
      ? toolSearchDraft.invokeDynamicToolEnabled
        ? "dynamic"
        : "direct"
      : toolSearchDraft.mode;

  return (
    <SuperAdminConfigShell
      activeKey={activeConfigKey as ConfigKey}
      testId="superadmin-platform-config-page"
    >
      <>
        {activeL1 === "paid-api" && <SuperAdminPaidApiConfigPanel />}
        {activeL1 === "llm-config" && <SuperAdminLlmConfigPanel />}

        {activeL1 === "billing" && (
          <>
            {activeL2Billing === "quota-rules" && (
              <section
                data-testid="superadmin-platform-config-quota-rules"
                className="fi-config-card"
              >
                {quotaLoading && (
                  <div className="fi-config-loading">加载中...</div>
                )}
                {quotaLoadError && (
                  <div className="fi-config-alert error">{quotaLoadError}</div>
                )}
                {quotaDraft && (
                  <>
                    <label className="fi-config-field">
                      <span className="fi-config-label">每次任务预扣额度</span>
                      <input
                        className="fi-config-input"
                        value={quotaDraft.preChargePerJob}
                        onChange={(event) =>
                          setQuotaDraft({
                            ...quotaDraft,
                            preChargePerJob: event.target.value,
                          })
                        }
                        disabled={quotaSaving}
                      />
                    </label>
                    <label className="fi-config-field">
                      <span className="fi-config-label">
                        单用户每日额度上限
                      </span>
                      <input
                        className="fi-config-input"
                        value={quotaDraft.dailyMaxCreditsPerUser}
                        onChange={(event) =>
                          setQuotaDraft({
                            ...quotaDraft,
                            dailyMaxCreditsPerUser: event.target.value,
                          })
                        }
                        disabled={quotaSaving}
                      />
                    </label>
                    <label className="fi-config-field">
                      <span className="fi-config-label">低余额阈值</span>
                      <input
                        className="fi-config-input"
                        value={quotaDraft.lowBalanceThreshold}
                        onChange={(event) =>
                          setQuotaDraft({
                            ...quotaDraft,
                            lowBalanceThreshold: event.target.value,
                          })
                        }
                        disabled={quotaSaving}
                      />
                    </label>
                    {quotaUpdatedAt && (
                      <div className="fi-config-updated-at">
                        更新时间：{new Date(quotaUpdatedAt).toLocaleString()}
                      </div>
                    )}
                    {quotaDirty && (
                      <div className="fi-config-inline-row">
                        <button
                          className="fi-config-button primary"
                          type="button"
                          disabled={quotaSaving}
                          onClick={() => void saveQuotaRules()}
                        >
                          {quotaSaving ? "保存中..." : "保存"}
                        </button>
                        <button
                          className="fi-config-button"
                          type="button"
                          disabled={quotaSaving}
                          onClick={discardQuotaRules}
                        >
                          放弃更改
                        </button>
                      </div>
                    )}
                    {quotaSaveError && (
                      <div className="fi-config-alert error">
                        {quotaSaveError}
                      </div>
                    )}
                    {quotaSaveSuccess && !quotaDirty && (
                      <div className="fi-config-alert success">保存成功</div>
                    )}
                  </>
                )}
              </section>
            )}

            {activeL2Billing === "model-pricing" && (
              <section
                data-testid="superadmin-platform-config-model-pricing"
                className="fi-config-card"
              >
                {pricingLoading && (
                  <div className="fi-config-loading">加载中...</div>
                )}
                {pricingLoadError && (
                  <div className="fi-config-alert error">
                    {pricingLoadError}
                  </div>
                )}
                {pricingDraft && (
                  <>
                    <div className="fi-config-grid two">
                      <label className="fi-config-field">
                        <span className="fi-config-tool-label">
                          默认输入单价
                        </span>
                        <input
                          value={pricingDraft.defaultInput}
                          onChange={(event) =>
                            setPricingDraft({
                              ...pricingDraft,
                              defaultInput: event.target.value,
                            })
                          }
                          disabled={pricingSaving}
                          className="fi-config-input"
                        />
                      </label>
                      <label className="fi-config-field">
                        <span className="fi-config-tool-label">
                          默认输出单价
                        </span>
                        <input
                          value={pricingDraft.defaultOutput}
                          onChange={(event) =>
                            setPricingDraft({
                              ...pricingDraft,
                              defaultOutput: event.target.value,
                            })
                          }
                          disabled={pricingSaving}
                          className="fi-config-input"
                        />
                      </label>
                    </div>

                    {pricingDraft.overrides.length > 0 && (
                      <div className="fi-config-table-wrap">
                        <table className="fi-config-table">
                          <thead>
                            <tr>
                              {["模型ID", "输入单价覆盖", "输出单价覆盖"].map(
                                (title) => (
                                  <th key={title}>{title}</th>
                                ),
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {pricingDraft.overrides.map((item, index) => (
                              <tr key={item.modelId}>
                                <td>{item.modelId}</td>
                                <td>
                                  <input
                                    value={item.inputPrice}
                                    placeholder="留空表示默认值"
                                    onChange={(event) =>
                                      updatePricingOverride(
                                        index,
                                        "inputPrice",
                                        event.target.value,
                                      )
                                    }
                                    disabled={pricingSaving}
                                    className="fi-config-input"
                                  />
                                </td>
                                <td>
                                  <input
                                    value={item.outputPrice}
                                    placeholder="留空表示默认值"
                                    onChange={(event) =>
                                      updatePricingOverride(
                                        index,
                                        "outputPrice",
                                        event.target.value,
                                      )
                                    }
                                    disabled={pricingSaving}
                                    className="fi-config-input"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {pricingUpdatedAt && (
                      <div className="fi-config-updated-at">
                        更新时间：{new Date(pricingUpdatedAt).toLocaleString()}
                      </div>
                    )}
                    {pricingDirty && (
                      <div className="fi-config-inline-row">
                        <button
                          className="fi-config-button primary"
                          type="button"
                          disabled={pricingSaving}
                          onClick={() => void saveModelPricing()}
                        >
                          {pricingSaving ? "保存中..." : "保存"}
                        </button>
                        <button
                          className="fi-config-button"
                          type="button"
                          disabled={pricingSaving}
                          onClick={discardModelPricing}
                        >
                          放弃更改
                        </button>
                      </div>
                    )}
                    {pricingSaveError && (
                      <div className="fi-config-alert error">
                        {pricingSaveError}
                      </div>
                    )}
                    {pricingSaveSuccess && !pricingDirty && (
                      <div className="fi-config-alert success">保存成功</div>
                    )}
                  </>
                )}
              </section>
            )}
          </>
        )}

        {activeL1 === "system" && (
          <section
            data-testid="superadmin-platform-config-system"
            className="fi-config-card"
          >
            {authLoading && <div className="fi-config-loading">加载中...</div>}
            {authLoadError && (
              <div className="fi-config-alert error">{authLoadError}</div>
            )}
            {authDraft && (
              <>
                <label className="fi-config-row-between">
                  <span className="fi-config-label">前端启用 RSA 加密</span>
                  <input
                    type="checkbox"
                    checked={authDraft.frontendEnabled}
                    onChange={(event) =>
                      setAuthDraft({
                        ...authDraft,
                        frontendEnabled: event.target.checked,
                      })
                    }
                    disabled={authSaving}
                  />
                </label>
                <label className="fi-config-row-between">
                  <span className="fi-config-label">后端强制 RSA 校验</span>
                  <input
                    type="checkbox"
                    checked={authDraft.backendRequired}
                    onChange={(event) =>
                      setAuthDraft({
                        ...authDraft,
                        backendRequired: event.target.checked,
                      })
                    }
                    disabled={authSaving}
                  />
                </label>
                {authUpdatedAt && (
                  <div className="fi-config-updated-at">
                    更新时间：{new Date(authUpdatedAt).toLocaleString()}
                  </div>
                )}
                {authDirty && (
                  <div className="fi-config-inline-row">
                    <button
                      className="fi-config-button primary"
                      type="button"
                      disabled={authSaving}
                      onClick={() => void saveAuthSecurity()}
                    >
                      {authSaving ? "保存中..." : "保存"}
                    </button>
                    <button
                      className="fi-config-button"
                      type="button"
                      disabled={authSaving}
                      onClick={discardAuthSecurity}
                    >
                      放弃更改
                    </button>
                  </div>
                )}
                {authSaveError && (
                  <div className="fi-config-alert error">{authSaveError}</div>
                )}
                {authSaveSuccess && !authDirty && (
                  <div className="fi-config-alert success">保存成功</div>
                )}
              </>
            )}
            {uiDisplayLoading && (
              <div className="fi-config-loading">加载界面配置中...</div>
            )}
            {uiDisplayLoadError && (
              <div className="fi-config-alert error">{uiDisplayLoadError}</div>
            )}
            {uiDisplayDraft && (
              <>
                <label className="fi-config-row-between">
                  <span className="fi-config-label">显示工具耗时</span>
                  <input
                    type="checkbox"
                    checked={uiDisplayDraft.showToolDurations}
                    onChange={(event) =>
                      setUiDisplayDraft({
                        ...uiDisplayDraft,
                        showToolDurations: event.target.checked,
                      })
                    }
                    disabled={uiDisplaySaving}
                  />
                </label>
                {uiDisplayUpdatedAt && (
                  <div className="fi-config-updated-at">
                    更新时间：{new Date(uiDisplayUpdatedAt).toLocaleString()}
                  </div>
                )}
                {uiDisplayDirty && (
                  <div className="fi-config-inline-row">
                    <button
                      className="fi-config-button primary"
                      type="button"
                      disabled={uiDisplaySaving}
                      onClick={() => void saveUiDisplayConfig()}
                    >
                      {uiDisplaySaving ? "保存中..." : "保存"}
                    </button>
                    <button
                      className="fi-config-button"
                      type="button"
                      disabled={uiDisplaySaving}
                      onClick={discardUiDisplayConfig}
                    >
                      放弃更改
                    </button>
                  </div>
                )}
                {uiDisplaySaveError && (
                  <div className="fi-config-alert error">
                    {uiDisplaySaveError}
                  </div>
                )}
                {uiDisplaySaveSuccess && !uiDisplayDirty && (
                  <div className="fi-config-alert success">保存成功</div>
                )}
              </>
            )}
          </section>
        )}

        {activeL1 === "tool-search" && (
          <section
            data-testid="superadmin-platform-config-tool-search"
            className="fi-config-card"
          >
            {toolSearchLoading && (
              <div className="fi-config-loading">加载中...</div>
            )}
            {toolSearchLoadError && (
              <div className="fi-config-alert error">{toolSearchLoadError}</div>
            )}
            {toolSearchDraft && (
              <>
                <div className="fi-config-status-row">
                  {[
                    {
                      label: "总开关",
                      value: toolSearchDraft.enabled ? "已开启" : "已关闭",
                      active: toolSearchDraft.enabled,
                    },
                    {
                      label: "配置模式",
                      value: toolSearchDraft.mode,
                      active: toolSearchDraft.mode === "active",
                    },
                    {
                      label: "实际暴露",
                      value: toolSearchEffectiveMode,
                      active:
                        toolSearchEffectiveMode === "dynamic" ||
                        toolSearchEffectiveMode === "direct",
                    },
                    {
                      label: "动态分发",
                      value:
                        toolSearchDraft.enabled &&
                        toolSearchDraft.mode === "active" &&
                        toolSearchDraft.invokeDynamicToolEnabled
                          ? "active"
                          : "inactive",
                      active:
                        toolSearchDraft.enabled &&
                        toolSearchDraft.mode === "active" &&
                        toolSearchDraft.invokeDynamicToolEnabled,
                    },
                  ].map(({ label, value, active }) => (
                    <span key={label} className="fi-config-status-pill">
                      <span
                        className={`fi-config-status-dot${active ? " is-on" : ""}`}
                      />
                      <span className="fi-config-status-label">{label}</span>
                      <span className="fi-config-status-value">{value}</span>
                    </span>
                  ))}
                </div>

                <div className="fi-config-card-compact">
                  <div className="fi-config-tool-title">运行策略</div>
                  <ToggleSwitch
                    label="启用 Tool Search"
                    hint="全局开关，关闭后实际暴露模式回退为 legacy"
                    checked={toolSearchDraft.enabled}
                    onChange={(v) =>
                      setToolSearchDraft({ ...toolSearchDraft, enabled: v })
                    }
                    disabled={toolSearchSaving}
                  />
                  <ToggleSwitch
                    label="启用动态分发"
                    hint={toolSearchDynamicHint}
                    checked={toolSearchDraft.invokeDynamicToolEnabled}
                    onChange={(v) =>
                      setToolSearchDraft({
                        ...toolSearchDraft,
                        invokeDynamicToolEnabled: v,
                      })
                    }
                    disabled={toolSearchSaving || toolSearchDynamicDisabled}
                  />
                </div>

                <div className="fi-config-card-compact">
                  <CoreToolsSelector
                    value={toolSearchDraft.coreTools}
                    onChange={(coreTools) =>
                      setToolSearchDraft({ ...toolSearchDraft, coreTools })
                    }
                    availableTools={toolSearchAvailableTools}
                    availableToolsLoading={toolSearchAvailableToolsLoading}
                    availableToolsError={toolSearchAvailableToolsError}
                    disabled={toolSearchSaving}
                  />
                </div>

                <details className="fi-config-card-compact">
                  <summary className="fi-config-tool-title">高级参数</summary>
                  <div className="fi-config-advanced-panel">
                    <div className="fi-config-card-compact">
                      <div className="fi-config-tool-title">召回预算</div>
                      <div className="fi-config-tool-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 132px), 1fr))" }}>
                        {[
                          ["默认召回数", "topKDefault"],
                          ["最小召回数", "topKMin"],
                          ["最大召回数", "topKMax"],
                          ["简单任务", "topKSimple"],
                          ["复杂任务", "topKComplex"],
                          ["动态工具上限", "maxLoadedDynamicTools"],
                          ["任务检索上限", "maxSearchesPerJob"],
                          ["单轮检索上限", "maxSearchesPerIteration"],
                        ].map(([label, key]) => (
                          <label key={key} className="fi-config-field">
                            <span className="fi-config-tool-label">
                              {label}
                            </span>
                            <input
                              value={
                                toolSearchDraft[
                                  key as keyof ToolSearchDraft
                                ] as string
                              }
                              onChange={(event) =>
                                setToolSearchDraft({
                                  ...toolSearchDraft,
                                  [key]: event.target.value,
                                })
                              }
                              disabled={toolSearchSaving}
                              className="fi-config-input"
                            />
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* ── 评分 & 调优参数 ── */}
                    <div className="fi-config-card-compact">
                      <div className="fi-config-tool-title">评分与调优</div>
                      <div className="fi-config-tool-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))" }}>
                        {[
                          ["最低分数", "minScore"],
                          ["低置信阈值", "lowConfidenceThreshold"],
                          ["精确名加分", "exactNameBoost"],
                          ["别名加分", "aliasBoost"],
                          ["技能加分", "enabledSkillBoost"],
                          ["业务加分", "agentBusinessBoost"],
                          ["错误恢复加分", "recentErrorRecoveryBoost"],
                          ["采样率", "sampleRate"],
                          ["轮次 TTL", "loadedToolTtlTurns"],
                          ["秒级 TTL", "loadedToolTtlSeconds"],
                        ].map(([label, key]) => (
                          <label key={key} className="fi-config-field">
                            <span className="fi-config-tool-label">
                              {label}
                            </span>
                            <input
                              value={
                                toolSearchDraft[
                                  key as keyof ToolSearchDraft
                                ] as string
                              }
                              onChange={(event) =>
                                setToolSearchDraft({
                                  ...toolSearchDraft,
                                  [key]: event.target.value,
                                })
                              }
                              disabled={toolSearchSaving}
                              className="fi-config-input"
                            />
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* ── 功能开关 ── */}
                    <div className="fi-config-card-compact">
                      <div className="fi-config-tool-title">功能开关</div>
                      <div className="fi-config-tool-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: 4 }}>
                        <ToggleSwitch
                          label="自适应召回数"
                          hint="根据查询复杂度自动调整 topK"
                          checked={toolSearchDraft.adaptiveTopKEnabled}
                          onChange={(v) =>
                            setToolSearchDraft({
                              ...toolSearchDraft,
                              adaptiveTopKEnabled: v,
                            })
                          }
                          disabled={toolSearchSaving}
                        />
                        <ToggleSwitch
                          label="启用重排"
                          hint="对召回结果进行二次排序"
                          checked={toolSearchDraft.rerankEnabled}
                          onChange={(v) =>
                            setToolSearchDraft({
                              ...toolSearchDraft,
                              rerankEnabled: v,
                            })
                          }
                          disabled={toolSearchSaving}
                        />
                        <ToggleSwitch
                          label="偏好 resolver 工具"
                          hint="优先返回能直接完成任务的高置信工具"
                          checked={toolSearchDraft.preferResolverTools}
                          onChange={(v) =>
                            setToolSearchDraft({
                              ...toolSearchDraft,
                              preferResolverTools: v,
                            })
                          }
                          disabled={toolSearchSaving}
                        />
                        <ToggleSwitch
                          label="任务切换清理缓存"
                          hint="用户切换话题时清空缓存重新检索"
                          checked={toolSearchDraft.clearOnTaskShift}
                          onChange={(v) =>
                            setToolSearchDraft({
                              ...toolSearchDraft,
                              clearOnTaskShift: v,
                            })
                          }
                          disabled={toolSearchSaving}
                        />
                        <ToggleSwitch
                          label="保留成功工具"
                          hint="调用成功的工具在后续轮次中保留"
                          checked={
                            toolSearchDraft.retainSuccessfullyCalledTools
                          }
                          onChange={(v) =>
                            setToolSearchDraft({
                              ...toolSearchDraft,
                              retainSuccessfullyCalledTools: v,
                            })
                          }
                          disabled={toolSearchSaving}
                        />
                        <ToggleSwitch
                          label="保留失败工具恢复"
                          hint="调用失败的工具保留以便自动重试"
                          checked={toolSearchDraft.retainFailedToolsForRecovery}
                          onChange={(v) =>
                            setToolSearchDraft({
                              ...toolSearchDraft,
                              retainFailedToolsForRecovery: v,
                            })
                          }
                          disabled={toolSearchSaving}
                        />
                        <ToggleSwitch
                          label="允许全量兜底"
                          hint="检索无结果时回退为暴露全部工具"
                          checked={toolSearchDraft.allowFullFallback}
                          onChange={(v) =>
                            setToolSearchDraft({
                              ...toolSearchDraft,
                              allowFullFallback: v,
                            })
                          }
                          disabled={toolSearchSaving}
                        />
                      </div>
                    </div>

                    {/* ── JSON 配置 ── */}
                    <div className="fi-config-card-compact">
                      <div className="fi-config-tool-title">JSON 配置</div>
                      <div className="fi-config-tool-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 12 }}>
                        {[
                          [
                            "字段权重",
                            "fieldWeights",
                            "工具名字段的 BM25 加权系数",
                          ],
                          [
                            "副作用惩罚",
                            "sideEffectPenalty",
                            "对具有副作用工具（如 delete）的降权配置",
                          ],
                          [
                            "成本惩罚",
                            "costPenalty",
                            "按工具 token/耗时 成本的惩罚系数",
                          ],
                        ].map(([label, key, desc]) => (
                          <label key={key} className="fi-config-field">
                            <div>
                              <span className="fi-config-label">{label}</span>
                              <span className="fi-config-field-hint">
                                {desc}
                              </span>
                            </div>
                            <textarea
                              value={
                                toolSearchDraft[
                                  key as keyof ToolSearchDraft
                                ] as string
                              }
                              onChange={(event) =>
                                setToolSearchDraft({
                                  ...toolSearchDraft,
                                  [key]: event.target.value,
                                })
                              }
                              disabled={toolSearchSaving}
                              rows={4}
                              placeholder="{}"
                              className="fi-config-textarea code"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </details>

                <div className="fi-config-footer" style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 12 }}>
                  <div className="fi-config-inline-row">
                    {toolSearchSaving ? (
                      <span className="fi-config-muted">自动保存中...</span>
                    ) : toolSearchSaveError ? (
                      <span className="fi-config-text-danger">
                        {toolSearchSaveError}
                      </span>
                    ) : !toolSearchDirty && toolSearchSaveSuccess ? (
                      <span className="fi-config-text-success">已自动保存</span>
                    ) : toolSearchDirty ? (
                      <span className="fi-config-muted">待自动保存...</span>
                    ) : null}
                    {toolSearchUpdatedAt && (
                      <span className="fi-config-muted">
                        {!toolSearchDirty && toolSearchSaveSuccess ? "·" : ""}{" "}
                        上次更新：
                        {new Date(toolSearchUpdatedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                  {toolSearchDirty && (
                    <button
                      className="fi-config-button"
                      type="button"
                      disabled={toolSearchSaving}
                      onClick={discardToolSearchConfig}
                    >
                      放弃更改
                    </button>
                  )}
                </div>
              </>
            )}
          </section>
        )}

        {activeL1 === "sandbox-runtime" && (
          <section
            className="fi-config-card"
            data-testid="superadmin-platform-config-sandbox-runtime"
          >
            {sandboxRuntimeLoading && (
              <div className="fi-config-loading">加载中...</div>
            )}
            {sandboxRuntimeLoadError && (
              <div className="fi-config-alert error">
                {sandboxRuntimeLoadError}
              </div>
            )}
            {sandboxRuntimeDraft && (
              <>
                <div className="fi-config-section">
                  <div className="fi-config-section-header">
                    <div>
                      <div className="fi-config-section-title">配额与回收</div>
                      <div className="fi-config-section-desc">
                        这些值会在 Kernel
                        运行配置缓存过期后，作用于后续配额检查与回收判断。
                      </div>
                    </div>
                  </div>
                  <div className="fi-config-grid two">
                    <SandboxRuntimeField
                      label="个人沙箱配额"
                      value={sandboxRuntimeDraft.quotaPersonalLimit}
                      unit="个 Pod"
                      disabled={sandboxRuntimeSaving || sandboxRuntimeLoading}
                      onChange={(value) =>
                        setSandboxRuntimeDraft((prev) =>
                          prev ? { ...prev, quotaPersonalLimit: value } : prev,
                        )
                      }
                    />
                    <SandboxRuntimeField
                      label="租户沙箱配额"
                      value={sandboxRuntimeDraft.quotaTenantLimit}
                      unit="个 Pod"
                      disabled={sandboxRuntimeSaving || sandboxRuntimeLoading}
                      onChange={(value) =>
                        setSandboxRuntimeDraft((prev) =>
                          prev ? { ...prev, quotaTenantLimit: value } : prev,
                        )
                      }
                    />
                    <SandboxRuntimeField
                      label="排队超时时间"
                      value={sandboxRuntimeDraft.quotaQueueTimeoutSeconds}
                      unit="秒"
                      disabled={sandboxRuntimeSaving || sandboxRuntimeLoading}
                      onChange={(value) =>
                        setSandboxRuntimeDraft((prev) =>
                          prev
                            ? { ...prev, quotaQueueTimeoutSeconds: value }
                            : prev,
                        )
                      }
                    />
                    <SandboxRuntimeField
                      label="个人回收阈值"
                      value={sandboxRuntimeDraft.quotaRecycleThreshold}
                      unit="个 Pod"
                      disabled={sandboxRuntimeSaving || sandboxRuntimeLoading}
                      onChange={(value) =>
                        setSandboxRuntimeDraft((prev) =>
                          prev
                            ? { ...prev, quotaRecycleThreshold: value }
                            : prev,
                        )
                      }
                    />
                    <SandboxRuntimeField
                      label="租户回收阈值"
                      value={sandboxRuntimeDraft.quotaTenantRecycleThreshold}
                      unit="个 Pod"
                      disabled={sandboxRuntimeSaving || sandboxRuntimeLoading}
                      onChange={(value) =>
                        setSandboxRuntimeDraft((prev) =>
                          prev
                            ? { ...prev, quotaTenantRecycleThreshold: value }
                            : prev,
                        )
                      }
                    />
                  </div>
                </div>

                <div className="fi-config-section">
                  <div className="fi-config-divider" />
                  <div className="fi-config-section-title">Pod 资源</div>
                  <div className="fi-config-grid two">
                    <SandboxRuntimeField
                      label="CPU 请求值"
                      value={sandboxRuntimeDraft.resourceCpuMin}
                      unit="例如 10m"
                      disabled={sandboxRuntimeSaving || sandboxRuntimeLoading}
                      onChange={(value) =>
                        setSandboxRuntimeDraft((prev) =>
                          prev ? { ...prev, resourceCpuMin: value } : prev,
                        )
                      }
                    />
                    <SandboxRuntimeField
                      label="CPU 上限"
                      value={sandboxRuntimeDraft.resourceCpuMax}
                      unit="例如 500m"
                      disabled={sandboxRuntimeSaving || sandboxRuntimeLoading}
                      onChange={(value) =>
                        setSandboxRuntimeDraft((prev) =>
                          prev ? { ...prev, resourceCpuMax: value } : prev,
                        )
                      }
                    />
                    <SandboxRuntimeField
                      label="内存上限"
                      value={sandboxRuntimeDraft.resourceMemory}
                      unit="例如 128Mi"
                      disabled={sandboxRuntimeSaving || sandboxRuntimeLoading}
                      onChange={(value) =>
                        setSandboxRuntimeDraft((prev) =>
                          prev ? { ...prev, resourceMemory: value } : prev,
                        )
                      }
                    />
                    <SandboxRuntimeField
                      label="临时目录大小"
                      value={sandboxRuntimeDraft.resourceTmpSize}
                      unit="例如 512Mi"
                      disabled={sandboxRuntimeSaving || sandboxRuntimeLoading}
                      onChange={(value) =>
                        setSandboxRuntimeDraft((prev) =>
                          prev ? { ...prev, resourceTmpSize: value } : prev,
                        )
                      }
                    />
                  </div>
                </div>

                <div className="fi-config-section">
                  <div className="fi-config-divider" />
                  <div className="fi-config-section-title">
                    运行时保护与带宽
                  </div>
                  <div className="fi-config-section-desc">
                    进程级内存限制在新建或重建 Sandbox 后生效；已有 Sandbox 保持创建时配置。
                  </div>
                  <div className="fi-config-grid two">
                    <SandboxRuntimeField
                      label="总内存保护"
                      value={sandboxRuntimeDraft.totalMemLimitMb}
                      unit="MB"
                      disabled={sandboxRuntimeSaving || sandboxRuntimeLoading}
                      onChange={(value) =>
                        setSandboxRuntimeDraft((prev) =>
                          prev ? { ...prev, totalMemLimitMb: value } : prev,
                        )
                      }
                    />
                    <SandboxRuntimeField
                      label="Shell 进程内存上限"
                      value={sandboxRuntimeDraft.codeMemLimitMb}
                      unit="MB"
                      disabled={sandboxRuntimeSaving || sandboxRuntimeLoading}
                      onChange={(value) =>
                        setSandboxRuntimeDraft((prev) =>
                          prev ? { ...prev, codeMemLimitMb: value } : prev,
                        )
                      }
                    />
                    <SandboxRuntimeField
                      label="Python REPL 进程内存上限"
                      value={sandboxRuntimeDraft.replMemLimitMb}
                      unit="MB"
                      disabled={sandboxRuntimeSaving || sandboxRuntimeLoading}
                      onChange={(value) =>
                        setSandboxRuntimeDraft((prev) =>
                          prev ? { ...prev, replMemLimitMb: value } : prev,
                        )
                      }
                    />
                    <SandboxRuntimeField
                      label="出站带宽"
                      value={sandboxRuntimeDraft.egressBandwidthMbps}
                      unit="Mbps"
                      disabled={sandboxRuntimeSaving || sandboxRuntimeLoading}
                      onChange={(value) =>
                        setSandboxRuntimeDraft((prev) =>
                          prev ? { ...prev, egressBandwidthMbps: value } : prev,
                        )
                      }
                    />
                    <SandboxRuntimeField
                      label="入站带宽"
                      value={sandboxRuntimeDraft.ingressBandwidthMbps}
                      unit="Mbps"
                      disabled={sandboxRuntimeSaving || sandboxRuntimeLoading}
                      onChange={(value) =>
                        setSandboxRuntimeDraft((prev) =>
                          prev
                            ? { ...prev, ingressBandwidthMbps: value }
                            : prev,
                        )
                      }
                    />
                  </div>
                </div>

                <footer className="fi-config-footer">
                  <span className="fi-config-updated-at">
                    {sandboxRuntimeSaving
                      ? "保存中..."
                      : sandboxRuntimeUpdatedAt
                        ? `上次更新：${new Date(sandboxRuntimeUpdatedAt).toLocaleString()}`
                        : "尚未更新"}
                    {sandboxRuntimeSaveSuccess && !sandboxRuntimeDirty
                      ? " / 保存成功"
                      : ""}
                  </span>
                  {sandboxRuntimeSaveError && (
                    <span className="fi-config-text-danger">
                      {sandboxRuntimeSaveError}
                    </span>
                  )}
                  <div className="fi-config-inline-row">
                    <button
                      className="fi-config-button"
                      type="button"
                      disabled={
                        !sandboxRuntimeDirty ||
                        sandboxRuntimeSaving ||
                        sandboxRuntimeLoading
                      }
                      onClick={discardSandboxRuntimeConfig}
                    >
                      放弃更改
                    </button>
                    <button
                      className="fi-config-button primary"
                      type="button"
                      disabled={
                        !sandboxRuntimeDirty ||
                        sandboxRuntimeSaving ||
                        sandboxRuntimeLoading
                      }
                      onClick={() => void saveSandboxRuntimeConfig()}
                    >
                      {sandboxRuntimeSaving ? "保存中..." : "保存"}
                    </button>
                  </div>
                </footer>
              </>
            )}
          </section>
        )}

        {activeL1 === "kernel-runtime" && (
          <section
            className="fi-config-card"
            data-testid="superadmin-platform-config-kernel-runtime"
          >
            {kernelRuntimeLoading && (
              <div className="fi-config-loading">加载中...</div>
            )}
            {kernelRuntimeLoadError && (
              <div className="fi-config-alert error">
                {kernelRuntimeLoadError}
              </div>
            )}
            {kernelRuntimeDraft && (
              <>
                <div className="fi-config-section">
                  <div className="fi-config-section-title">
                    Iteration Context
                  </div>
                  <div className="fi-config-card-compact">
                    <ToggleSwitch
                      label="持久化每轮 LLM 输入上下文"
                      hint="开启后写入 chat_iteration_context.input_messages/input_tools；关闭后不构造完整 messages 快照。"
                      checked={kernelRuntimeDraft.persistIterationContext}
                      disabled={kernelRuntimeSaving || kernelRuntimeLoading}
                      onChange={(checked) =>
                        setKernelRuntimeDraft((prev) =>
                          prev
                            ? { ...prev, persistIterationContext: checked }
                            : prev,
                        )
                      }
                    />
                  </div>
                </div>

                <footer className="fi-config-footer">
                  <span className="fi-config-updated-at">
                    {kernelRuntimeSaving
                      ? "保存中..."
                      : kernelRuntimeUpdatedAt
                        ? `上次更新：${new Date(kernelRuntimeUpdatedAt).toLocaleString()}`
                        : "尚未更新"}
                    {kernelRuntimeSaveSuccess && !kernelRuntimeDirty
                      ? " / 保存成功"
                      : ""}
                  </span>
                  {kernelRuntimeSaveError && (
                    <span className="fi-config-text-danger">
                      {kernelRuntimeSaveError}
                    </span>
                  )}
                  <div className="fi-config-inline-row">
                    <button
                      className="fi-config-button"
                      type="button"
                      disabled={
                        !kernelRuntimeDirty ||
                        kernelRuntimeSaving ||
                        kernelRuntimeLoading
                      }
                      onClick={discardKernelRuntimeConfig}
                    >
                      放弃更改
                    </button>
                    <button
                      className="fi-config-button primary"
                      type="button"
                      disabled={
                        !kernelRuntimeDirty ||
                        kernelRuntimeSaving ||
                        kernelRuntimeLoading
                      }
                      onClick={() => void saveKernelRuntimeConfig()}
                    >
                      {kernelRuntimeSaving ? "保存中..." : "保存"}
                    </button>
                  </div>
                </footer>
              </>
            )}
          </section>
        )}

        {activeL1 === "registration" && (
          <section
            className="fi-config-card"
            data-testid="superadmin-platform-config-registration"
          >
            {registrationLoading && (
              <div className="fi-config-loading">加载中...</div>
            )}
            {registrationLoadError && (
              <div className="fi-config-alert error">
                {registrationLoadError}
              </div>
            )}
            <div className="fi-config-section">
              <div className="fi-config-section-header">
                <div>
                  <div className="fi-config-section-title">推荐问后台生成</div>
                  <div className="fi-config-section-desc">
                    开启后，新用户注册时立即展示默认推荐问，AI
                    推荐问与企业画像在后台排队生成，不影响前端使用
                  </div>
                </div>
                <button
                  className={`fi-config-toggle${registrationDraft.asyncEnhancementEnabled ? " is-on" : ""}`}
                  type="button"
                  aria-pressed={registrationDraft.asyncEnhancementEnabled}
                  disabled={registrationSaving || registrationLoading}
                  onClick={() =>
                    setRegistrationDraft((prev) => ({
                      ...prev,
                      asyncEnhancementEnabled: !prev.asyncEnhancementEnabled,
                    }))
                  }
                >
                  <span />
                </button>
              </div>
              <div className="fi-config-divider" />
            </div>

            <div className="fi-config-section">
              <div className="fi-config-section-title">并发控制</div>
              <div className="fi-config-grid two">
                <RegistrationField
                  label="注册总并发"
                  unit="个"
                  value={registrationDraft.registerConcurrency}
                  desc="全局同时允许的最大注册请求数，超出后快速返回 429"
                  disabled={registrationSaving || registrationLoading}
                  onChange={(value) =>
                    setRegistrationDraft((prev) => ({
                      ...prev,
                      registerConcurrency: value,
                    }))
                  }
                />
                <RegistrationField
                  label="同 IP 注册并发"
                  unit="个"
                  value={registrationDraft.ipRegisterConcurrency}
                  desc="同一公网 IP 下同时允许的最大注册请求数"
                  disabled={registrationSaving || registrationLoading}
                  onChange={(value) =>
                    setRegistrationDraft((prev) => ({
                      ...prev,
                      ipRegisterConcurrency: value,
                    }))
                  }
                />
                <RegistrationField
                  label="后台增强 Worker 数"
                  unit="个"
                  value={registrationDraft.enhancementWorkerCount}
                  desc="同时处理多少个工作区的后台增强任务"
                  disabled={registrationSaving || registrationLoading}
                  onChange={(value) =>
                    setRegistrationDraft((prev) => ({
                      ...prev,
                      enhancementWorkerCount: value,
                    }))
                  }
                />
                <RegistrationField
                  label="注册队列大小"
                  unit="个"
                  value={registrationDraft.registerQueueSize}
                  desc="排队等待后台增强的最大注册任务数"
                  disabled={registrationSaving || registrationLoading}
                  onChange={(value) =>
                    setRegistrationDraft((prev) => ({
                      ...prev,
                      registerQueueSize: value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="fi-config-section">
              <div className="fi-config-divider" />
              <div className="fi-config-section-title">外部资源并发限制</div>
              <div className="fi-config-grid two">
                <RegistrationField
                  label="AI 生成并发"
                  unit="个"
                  value={registrationDraft.aiGenerationConcurrency}
                  desc="企业画像摘要与推荐问生成的全局并发"
                  disabled={registrationSaving || registrationLoading}
                  onChange={(value) =>
                    setRegistrationDraft((prev) => ({
                      ...prev,
                      aiGenerationConcurrency: value,
                    }))
                  }
                />
                <RegistrationField
                  label="Xila 调用并发"
                  unit="个"
                  value={registrationDraft.xilaCallConcurrency}
                  desc="Xila 账号初始化与企业资料查询的全局并发"
                  disabled={registrationSaving || registrationLoading}
                  onChange={(value) =>
                    setRegistrationDraft((prev) => ({
                      ...prev,
                      xilaCallConcurrency: value,
                    }))
                  }
                />
              </div>
            </div>

            <footer className="fi-config-footer">
              <span className="fi-config-updated-at">
                {registrationSaving
                  ? "保存中..."
                  : registrationUpdatedAt
                    ? `上次更新：${new Date(registrationUpdatedAt).toLocaleString()}`
                    : "上次更新：-"}
                {registrationSaveSuccess && !registrationDirty
                  ? " · 保存成功"
                  : ""}
              </span>
              {registrationSaveError && (
                <span className="fi-config-text-danger">
                  {registrationSaveError}
                </span>
              )}
              <div className="fi-config-inline-row">
                <button
                  className="fi-config-button"
                  type="button"
                  disabled={
                    !registrationDirty ||
                    registrationSaving ||
                    registrationLoading
                  }
                  onClick={discardRegistrationInitializationConfig}
                >
                  放弃更改
                </button>
                <button
                  className="fi-config-button primary"
                  type="button"
                  disabled={
                    !registrationDirty ||
                    registrationSaving ||
                    registrationLoading
                  }
                  onClick={() => void saveRegistrationInitializationConfig()}
                >
                  {registrationSaving ? "保存中..." : "保存生效"}
                </button>
              </div>
            </footer>
          </section>
        )}
      </>
      {activeL1 === "external-data-cache" && (
        <section
          data-testid="superadmin-platform-config-external-data-cache"
          className="fi-config-card"
        >
          {externalDataCacheLoading && (
            <div className="fi-config-loading">加载中...</div>
          )}
          {externalDataCacheLoadError && (
            <div className="fi-config-alert error">{externalDataCacheLoadError}</div>
          )}
          {externalDataCacheDraft && (
            <>
              <div className="fi-config-section">
                <div className="fi-config-section-title">缓存开关</div>
                <div className="fi-config-card-compact">
                  <ToggleSwitch
                    label="启用诉讼数据缓存"
                    hint="关闭后完全旁路缓存，查询将直接调用诉讼数据接口。"
                    checked={externalDataCacheDraft.enabled}
                    disabled={externalDataCacheSaving || externalDataCacheLoading}
                    onChange={(checked) =>
                      setExternalDataCacheDraft((prev) =>
                        prev ? { ...prev, enabled: checked } : prev,
                      )
                    }
                  />
                </div>
                {!externalDataCacheDraft.enabled && (
                  <div className="fi-config-alert warning">
                    缓存已关闭：不会读取或生成快照，外部调用成本可能明显增加。
                  </div>
                )}
              </div>

              <div className="fi-config-section">
                <div className="fi-config-divider" />
                <div>
                  <div className="fi-config-section-title">缓存有效期</div>
                  <div className="fi-config-section-desc">
                    按查询结果类型设置快照可复用时间，支持 1～720 的整数小时。
                  </div>
                </div>
                <div className="fi-config-grid three">
                  {[
                    {
                      label: "诉讼明细",
                      key: "litigationDetailTtlHours" as const,
                      desc: "有明细数据时的快照有效期，默认 24 小时。",
                    },
                    {
                      label: "诉讼统计",
                      key: "litigationSummaryTtlHours" as const,
                      desc: "有统计数据时的快照有效期，默认 24 小时。",
                    },
                    {
                      label: "空结果",
                      key: "emptyTtlHours" as const,
                      desc: "未查询到数据时的快照有效期，默认 12 小时。",
                    },
                  ].map(({ label, key, desc }) => (
                    <label
                      className="fi-config-field fi-config-field-box tertiary"
                      key={key}
                    >
                      <span className="fi-config-section-header">
                        <span className="fi-config-label">{label}</span>
                        <span className="fi-config-unit">小时</span>
                      </span>
                      <input
                        className="fi-config-input"
                        type="number"
                        min={1}
                        max={720}
                        step={1}
                        value={externalDataCacheDraft[key]}
                        disabled={externalDataCacheSaving || externalDataCacheLoading}
                        onChange={(event) =>
                          setExternalDataCacheDraft((prev) =>
                            prev ? { ...prev, [key]: event.target.value } : prev,
                          )
                        }
                      />
                      <span className="fi-config-field-desc">{desc}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="fi-config-section">
                <div className="fi-config-divider" />
                <div>
                  <div className="fi-config-section-title">存储数量上限</div>
                  <div className="fi-config-section-desc">
                    全局诉讼快照超过上限后才执行兜底淘汰，默认 1024 份。
                  </div>
                </div>
                <div className="fi-config-grid">
                  <label className="fi-config-field fi-config-field-box tertiary">
                    <span className="fi-config-section-header">
                      <span className="fi-config-label">最大快照数量</span>
                      <span className="fi-config-unit">份</span>
                    </span>
                    <input
                      className="fi-config-input"
                      type="number"
                      min={1}
                      max={100000}
                      step={1}
                      value={externalDataCacheDraft.maxSnapshotCount}
                      disabled={externalDataCacheSaving || externalDataCacheLoading}
                      onChange={(event) =>
                        setExternalDataCacheDraft((prev) =>
                          prev
                            ? { ...prev, maxSnapshotCount: event.target.value }
                            : prev,
                        )
                      }
                    />
                    <span className="fi-config-field-desc">
                      TTL 到期不会立即删除；成功写入后超过上限才按最旧优先清理。
                    </span>
                  </label>
                </div>
              </div>

              <footer className="fi-config-footer">
                <span className="fi-config-updated-at">
                  {externalDataCacheSaving
                    ? "保存中..."
                    : externalDataCacheUpdatedAt
                      ? `上次更新：${new Date(externalDataCacheUpdatedAt).toLocaleString()}`
                      : "尚未更新"}
                  {externalDataCacheSaveSuccess && !externalDataCacheDirty
                    ? " / 保存成功"
                    : ""}
                </span>
                {externalDataCacheSaveError && (
                  <span className="fi-config-text-danger">
                    {externalDataCacheSaveError}
                  </span>
                )}
                <div className="fi-config-inline-row">
                  <button
                    className="fi-config-button"
                    type="button"
                    disabled={
                      !externalDataCacheDirty ||
                      externalDataCacheSaving ||
                      externalDataCacheLoading
                    }
                    onClick={discardExternalDataCacheConfig}
                  >
                    放弃更改
                  </button>
                  <button
                    className="fi-config-button primary"
                    type="button"
                    disabled={
                      !externalDataCacheDirty ||
                      externalDataCacheSaving ||
                      externalDataCacheLoading
                    }
                    onClick={() => void saveExternalDataCacheConfig()}
                  >
                    {externalDataCacheSaving ? "保存中..." : "保存"}
                  </button>
                </div>
              </footer>
            </>
          )}
        </section>
      )}

      {activeL1 === "runtime-assets-source" && (
        <section
          className="fi-config-card"
          data-testid="superadmin-platform-config-runtime-assets-source"
        >
          {runtimeAssetsSourceLoading && (
            <div className="fi-config-loading">加载中...</div>
          )}
          {runtimeAssetsSourceLoadError && (
            <div className="fi-config-alert error">
              {runtimeAssetsSourceLoadError}
            </div>
          )}
          {runtimeAssetsSourceDraft && (
            <>
              <div className="fi-config-section">
                <div className="fi-config-section-title">
                  Kernel 运行时资产事实源
                </div>
                <div className="fi-config-section-desc">
                  控制新任务在 before_agent 阶段从哪里获取当前 Agent 的 skills
                  与 tools。子智能体注册及调用范围始终以数据库表为准。
                </div>
                <div className="fi-config-option-grid">
                  {[
                    {
                      source: "platform" as const,
                      title: "Platform runtime-assets 接口",
                      desc: "默认路径。Kernel 在任务启动前调用 Platform 接口，以数据库资产权限表为事实源。",
                    },
                    {
                      source: "agent_assets_json" as const,
                      title: "agent_assets.json 兼容路径",
                      desc: "短期灰度回退使用，Kernel 从旧 JSON 快照读取资产权限。",
                    },
                  ].map((option) => {
                    const selected =
                      runtimeAssetsSourceDraft.source === option.source;
                    return (
                      <button
                        key={option.source}
                        type="button"
                        disabled={
                          runtimeAssetsSourceSaving ||
                          runtimeAssetsSourceLoading
                        }
                        onClick={() =>
                          setRuntimeAssetsSourceDraft({ source: option.source })
                        }
                        className={`fi-config-option-card${selected ? " selected" : ""}`}
                      >
                        <span className="fi-config-option-title">
                          {option.title}
                        </span>
                        <span className="fi-config-option-desc">
                          {option.desc}
                        </span>
                        <span className="fi-config-option-hint">
                          {selected ? "当前启用" : "点击切换"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <footer className="fi-config-footer">
                <span className="fi-config-updated-at">
                  {runtimeAssetsSourceSaving
                    ? "保存中..."
                    : runtimeAssetsSourceUpdatedAt
                      ? `上次更新：${new Date(runtimeAssetsSourceUpdatedAt).toLocaleString()}`
                      : "尚未更新"}
                  {runtimeAssetsSourceSaveSuccess && !runtimeAssetsSourceDirty
                    ? " / 保存成功"
                    : ""}
                </span>
                {runtimeAssetsSourceSaveError && (
                  <span className="fi-config-text-danger">
                    {runtimeAssetsSourceSaveError}
                  </span>
                )}
                <div className="fi-config-inline-row">
                  <button
                    className="fi-config-button"
                    type="button"
                    disabled={
                      !runtimeAssetsSourceDirty ||
                      runtimeAssetsSourceSaving ||
                      runtimeAssetsSourceLoading
                    }
                    onClick={discardRuntimeAssetsSourceConfig}
                  >
                    放弃更改
                  </button>
                  <button
                    className="fi-config-button primary"
                    type="button"
                    disabled={
                      !runtimeAssetsSourceDirty ||
                      runtimeAssetsSourceSaving ||
                      runtimeAssetsSourceLoading
                    }
                    onClick={() => void saveRuntimeAssetsSourceConfig()}
                  >
                    {runtimeAssetsSourceSaving ? "保存中..." : "保存"}
                  </button>
                </div>
              </footer>
            </>
          )}
        </section>
      )}
    </SuperAdminConfigShell>
  );
};

function SandboxRuntimeField({
  label,
  unit,
  value,
  disabled = false,
  onChange,
}: {
  label: string;
  unit: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="fi-config-field fi-config-field-box">
      <span className="fi-config-section-header">
        <span className="fi-config-label">{label}</span>
        <span className="fi-config-unit">{unit}</span>
      </span>
      <input
        className="fi-config-input"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function RegistrationField({
  label,
  unit,
  value,
  desc,
  disabled = false,
  onChange,
}: {
  label: string;
  unit: string;
  value: string;
  desc: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="fi-config-field fi-config-field-box tertiary">
      <span className="fi-config-section-header">
        <span className="fi-config-label">{label}</span>
        <span className="fi-config-unit">{unit}</span>
      </span>
      <input
        className="fi-config-input"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
      <span className="fi-config-field-desc">{desc}</span>
    </label>
  );
}

function normalizeCoreTools(
  items: ToolSearchCoreToolItem[] | string[] | null | undefined,
): ToolSearchCoreToolItem[] {
  if (!Array.isArray(items)) {
    return [];
  }
  const deduped = new Map<string, ToolSearchCoreToolItem>();
  items.forEach((item, index) => {
    if (typeof item === "string") {
      const name = item.trim();
      if (!name) return;
      deduped.set(name, {
        name,
        enabled: true,
        sortOrder: (index + 1) * 10,
        condition:
          name === "tool_search"
            ? "tool_search_active"
            : name === "invoke_dynamic_tool"
              ? "dynamic_dispatch_active"
              : "always",
        required: false,
      });
      return;
    }
    const name = item.name?.trim();
    if (!name) return;
    const condition = item.condition?.trim() || "always";
    deduped.set(`${condition}::${name}`, {
      name,
      enabled: item.required ? true : (item.enabled ?? true),
      sortOrder: item.sortOrder > 0 ? item.sortOrder : (index + 1) * 10,
      condition,
      required: item.required ?? false,
    });
  });
  return Array.from(deduped.values()).sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
  );
}

function respaceCoreTools(
  items: ToolSearchCoreToolItem[],
): ToolSearchCoreToolItem[] {
  const deduped = new Map<string, ToolSearchCoreToolItem>();
  items.forEach((item) => {
    const name = item.name?.trim();
    if (!name) return;
    const condition = item.condition?.trim() || "always";
    deduped.set(`${condition}::${name}`, {
      ...item,
      name,
      condition,
      enabled: item.required ? true : item.enabled,
      required: item.required ?? false,
    });
  });
  return Array.from(deduped.values()).map((item, index) => ({
    ...item,
    sortOrder: (index + 1) * 10,
  }));
}

type CoreToolGroup = {
  key: string;
  label: string;
  description: string;
  defaultCondition: string;
  system?: boolean;
  match: (item: ToolSearchCoreToolItem) => boolean;
};

const systemConditionOptions = [
  { value: "always", label: "始终" },
  { value: "tool_search_active", label: "Active" },
  { value: "dynamic_dispatch_active", label: "动态" },
];

const coreToolGroups: CoreToolGroup[] = [
  {
    key: "system",
    label: "系统默认",
    description: "所有 agent 共享的基础核心工具",
    defaultCondition: "always",
    system: true,
    match: (item) => !item.condition.startsWith("agent_business:"),
  },
  {
    key: "business_insight",
    label: "商业洞察",
    description: "仅 business_insight agent 生效",
    defaultCondition: "agent_business:business_insight",
    match: (item) => item.condition === "agent_business:business_insight",
  },
  {
    key: "risk_insight",
    label: "风险洞察",
    description: "仅 risk_insight agent 生效",
    defaultCondition: "agent_business:risk_insight",
    match: (item) => item.condition === "agent_business:risk_insight",
  },
  {
    key: "opinion_insight",
    label: "舆情洞察",
    description: "仅 opinion_insight agent 生效",
    defaultCondition: "agent_business:opinion_insight",
    match: (item) => item.condition === "agent_business:opinion_insight",
  },
];

function coreToolKey(item: ToolSearchCoreToolItem): string {
  return `${item.condition || "always"}::${item.name}`;
}

export default SuperAdminPlatformConfigPage;
