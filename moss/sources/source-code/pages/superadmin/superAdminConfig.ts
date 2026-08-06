export type ConfigKey =
  | 'channel'
  | 'third-party'
  | 'xila'
  | 'quota-rules'
  | 'model-pricing'
  | 'system-config'
  | 'llm-config'
  | 'tool-search'
  | 'dashboard'
  | 'prompt-config'
  | 'paid-api'
  | 'registration'
  | 'sandbox-runtime'
  | 'kernel-runtime'
  | 'external-data-cache'
  | 'subagent-runtime'
  | 'runtime-assets-source';

export const CONFIG_TABS: Array<{ key: ConfigKey; label: string; path: string; activeKeys?: ConfigKey[] }> = [
  { key: 'channel', label: '通道配置', path: '/superadmin/channel-settings' },
  { key: 'third-party', label: '第三方接入', path: '/superadmin/third-party-integrations' },
  { key: 'xila', label: '析拉配置', path: '/superadmin/xila-settings' },
  { key: 'quota-rules', label: '额度规则', path: '/superadmin/platform-config?tab=quota-rules' },
  { key: 'model-pricing', label: '模型定价', path: '/superadmin/platform-config?tab=model-pricing' },
  { key: 'system-config', label: '系统配置', path: '/superadmin/platform-config?tab=system-config' },
  { key: 'llm-config', label: 'LLM 配置', path: '/superadmin/platform-config?tab=llm-config' },
  { key: 'tool-search', label: '工具检索', path: '/superadmin/platform-config?tab=tool-search' },
  { key: 'dashboard', label: '智能看板', path: '/superadmin/config/dashboard' },
  { key: 'prompt-config', label: 'Prompt 调试', path: '/superadmin/prompt-configs' },
  { key: 'paid-api', label: '付费 API', path: '/superadmin/platform-config?tab=paid-api' },
  { key: 'registration', label: '注册配置', path: '/superadmin/platform-config?tab=registration' },
  { key: 'sandbox-runtime', label: 'Sandbox 配置', path: '/superadmin/platform-config?tab=sandbox-runtime' },
  { key: 'kernel-runtime', label: 'Kernel 配置', path: '/superadmin/platform-config?tab=kernel-runtime' },
  { key: 'external-data-cache', label: '数据缓存', path: '/superadmin/platform-config?tab=external-data-cache' },
  { key: 'runtime-assets-source', label: '运行时资产', path: '/superadmin/platform-config?tab=runtime-assets-source' },
  { key: 'subagent-runtime', label: 'Subagent 配置', path: '/superadmin/subagent-config' },
];

export const configPageCopy: Record<ConfigKey, { title: string; subtitle: string }> = {
  channel: {
    title: '通道配置',
    subtitle: '管理短信、邮件通道与验证码业务模板',
  },
  'third-party': {
    title: '第三方接入',
    subtitle: '管理阿里云云市场、飞书及后续平台级第三方系统接入',
  },
  xila: {
    title: '析拉配置',
    subtitle: '管理析拉平台管理员账号、全局兜底号池与租户 token 绑定',
  },
  'quota-rules': {
    title: '额度规则',
    subtitle: '配置每次任务预扣额度、单用户每日上限与低余额告警阈值',
  },
  'model-pricing': {
    title: '模型定价',
    subtitle: '设置默认输入/输出单价，并按模型覆盖特殊价格',
  },
  'system-config': {
    title: '系统配置',
    subtitle: '管理认证安全与界面展示开关',
  },
  'llm-config': {
    title: 'LLM 配置',
    subtitle: '维护平台可用模型、默认模型与运行时诊断信息',
  },
  'tool-search': {
    title: '工具检索',
    subtitle: '配置 tool_search 召回、动态分发与核心工具策略',
  },
  dashboard: {
    title: '智能看板',
    subtitle: '控制用户前端入口、看板上下文工具、默认 Prompt 和参数查询缓存',
  },
  'prompt-config': {
    title: 'Prompt 调试',
    subtitle: '按 Agent 调试最终 System Prompt',
  },
  'paid-api': {
    title: '付费 API',
    subtitle: '配置外部付费服务 API Key 与扣费观测策略',
  },
  registration: {
    title: '注册配置',
    subtitle: '注册高峰时优先让用户进入工作区，推荐问与企业画像转后台排队生成',
  },
  'sandbox-runtime': {
    title: 'Sandbox 配置',
    subtitle: '管理 Sandbox 配额、Pod 资源、内存保护与带宽限制',
  },
  'kernel-runtime': {
    title: 'Kernel 配置',
    subtitle: '控制 Kernel 运行时调试开关，配置变更会在缓存刷新后动态生效',
  },
  'external-data-cache': {
    title: '数据缓存',
    subtitle: '管理诉讼数据缓存开关和小时级有效期',
  },
  'subagent-runtime': {
    title: 'Subagent 配置',
    subtitle: '统一控制子智能体能力是否对模型可见，并管理少量核心运行参数',
  },
  'runtime-assets-source': {
    title: '运行时资产源',
    subtitle: '控制 Kernel 在任务启动前从数据库接口或兼容 JSON 获取 Agent 资产权限',
  },
};
