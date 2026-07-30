import type {
  WufanAccountUser,
  WufanAdminMockData,
  WufanAssetItem,
  WufanQuotaItem,
  WufanSpace,
} from './types';

export const accountUserFixture: WufanAccountUser = {
  id: 'user-demo-01',
  name: '午饭示例',
  email: 'demo@example.com',
  source: 'password',
};

export const accountSpacesFixture: WufanSpace[] = [
  {
    id: 'space-personal',
    name: '午饭示例的空间',
    plan: 'developer',
    role: 'owner',
    isPersonal: true,
    current: true,
    memberCount: 1,
    agentCount: 4,
    skillCount: 12,
  },
  {
    id: 'space-growth',
    name: '增长研究组',
    plan: 'pro',
    role: 'admin',
    memberCount: 8,
    agentCount: 6,
    skillCount: 21,
  },
];

export const accountQuotaFixture: WufanQuotaItem[] = [
  { id: 'glm', label: 'GLM-5 对话', used: 18, limit: 30, group: 'chat' },
  { id: 'haiku', label: 'Claude Haiku 对话', used: 8, limit: 30, group: 'chat' },
  { id: 'sonnet', label: 'Claude Sonnet 对话', used: 11, limit: null, byok: true, group: 'chat' },
  { id: 'image', label: '生成图片', used: 3, limit: 10, group: 'tools' },
  { id: 'video', label: '生成视频', used: 1, limit: 3, group: 'tools' },
  { id: 'search', label: '网络搜索', used: 24, limit: null, byok: true, group: 'tools' },
];

export const accountAssetFixture: WufanAssetItem[] = [
  { id: 'asset-1', name: '企业信息搜索', kind: 'tool', description: '检索并核验企业公开信息', status: '已启用' },
  { id: 'asset-2', name: '客户洞察', kind: 'skill', description: '生成客户画像与合作建议', status: '已安装' },
  { id: 'asset-3', name: '研究伙伴', kind: 'partner', description: '处理资料检索与交叉验证', status: '主 Agent' },
  { id: 'asset-4', name: '每周洞察摘要', kind: 'automation', description: '每周一自动生成客户摘要', status: '活跃' },
  { id: 'asset-5', name: '机会优先级卡片', kind: 'widget', description: '展示客户机会与跟进状态', status: '交互式' },
];

export const adminMockData: WufanAdminMockData = {
  tokenRows: [
    {
      id: 'usage-1',
      user: 'demo@example.com',
      agent: '客户洞察助手',
      model: 'claude-sonnet-4-5',
      source: '平台',
      promptTokens: 18_640,
      completionTokens: 4_236,
      totalTokens: 22_876,
      createdAt: '2026-07-30 10:32',
    },
    {
      id: 'usage-2',
      user: 'analyst@example.com',
      agent: '周报整理助手',
      model: 'glm-5',
      source: '团队',
      promptTokens: 9_842,
      completionTokens: 2_113,
      totalTokens: 11_955,
      createdAt: '2026-07-30 09:18',
    },
    {
      id: 'usage-3',
      user: 'owner@example.com',
      agent: '项目复盘助手',
      model: 'claude-haiku-4-5',
      source: '平台',
      promptTokens: 5_312,
      completionTokens: 1_406,
      totalTokens: 6_718,
      createdAt: '2026-07-29 18:46',
    },
  ],
  feedbackRows: [
    {
      id: 'feedback-1',
      sentiment: 'negative',
      user: 'demo@example.com',
      agent: '客户洞察助手',
      sessionTitle: '查询空间信息',
      messagePreview: '建议优先推进数据协同与渠道分析……',
      categories: ['数据不准', '分析不深'],
      content: '主体信息的更新时间不一致',
      createdAt: '2026-07-30 10:36',
    },
    {
      id: 'feedback-2',
      sentiment: 'positive',
      user: 'analyst@example.com',
      agent: '周报整理助手',
      sessionTitle: '整理本周项目进展',
      messagePreview: '本周三个项目节点均已汇总……',
      categories: [],
      content: '',
      createdAt: '2026-07-30 09:24',
    },
  ],
};
