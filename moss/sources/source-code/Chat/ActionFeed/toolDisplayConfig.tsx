/**
 * 工具展示配置 - 定义每种工具在 ActionFeed 中的展示方式
 * 
 * 【设计原则】
 * 1. 简洁易读 - 用户能一眼理解 Agent 正在做什么
 * 2. 信息增强 - 对重要工具展示返回结果，增强用户信心
 * 3. 可展开 - 写入类工具支持展开查看流式内容
 */

import React from 'react';
import { useFrontendConfigStore } from '../../../stores/frontendConfigStore';

// ========== 图标组件 ==========

// 阅读文件
export const ReadIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M14 2v6h6" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M16 13H8" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M16 17H8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// 写入/编辑文件
export const WriteIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 20h9" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// 搜索/查找
export const SearchIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8"/>
    <path d="M21 21l-4.35-4.35" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// 文件夹/目录
export const FolderIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// 终端/命令行
export const TerminalIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="4 17 10 11 4 5" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="12" y1="19" x2="20" y2="19" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// 网络/浏览器
export const GlobeIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/>
    <line x1="2" y1="12" x2="22" y2="12" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// 下载/获取
export const DownloadIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// 问号/提问
export const QuestionIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/>
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="12" y1="17" x2="12.01" y2="17" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// 思考/大脑
export const ThinkIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 2a4 4 0 0 0-4 4v2a4 4 0 0 0 8 0V6a4 4 0 0 0-4-4z" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M16 8a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0v-2a4 4 0 0 1 4-4z" strokeLinecap="round" strokeLinejoin="round" opacity="0.5"/>
    <path d="M8 8a4 4 0 0 0-4 4v2a4 4 0 0 0 8 0v-2a4 4 0 0 0-4-4z" strokeLinecap="round" strokeLinejoin="round" opacity="0.5"/>
    <path d="M12 14v8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// 链接
export const LinkIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// 子任务/并行
export const SubtaskIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round"/>
    <rect x="14" y="3" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round"/>
    <rect x="14" y="14" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round"/>
    <rect x="3" y="14" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// 记忆/保存
export const MemoryIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="17 21 17 13 7 13 7 21" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="7 3 7 8 15 8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// 图片生成
export const ImageIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// 图片编辑
export const ImageEditIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// 可视化/图表
export const ChartIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="12" width="4" height="9" rx="1" />
    <rect x="10" y="7" width="4" height="14" rx="1" />
    <rect x="17" y="3" width="4" height="18" rx="1" />
  </svg>
);

// 调色板/设计指南
export const PaletteIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="7" r="1.5" fill="currentColor" />
    <circle cx="8" cy="10.5" r="1.5" fill="currentColor" />
    <circle cx="16" cy="10.5" r="1.5" fill="currentColor" />
    <circle cx="9" cy="15" r="1.5" fill="currentColor" />
    <path d="M15.6 14.4a2 2 0 0 1 2.8 0l.8.8a1.4 1.4 0 0 1-.2 2.1A4.7 4.7 0 0 1 16 18a2 2 0 0 1-2-2 2 2 0 0 1 1.6-1.6z" />
  </svg>
);

// 默认图标
export const DefaultIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="12" y1="16" x2="12.01" y2="16" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// 自定义工具图标（精致扳手）
export const CustomToolIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
  </svg>
);

// 计划/方案图标 - 文档带勾选
export const PlanIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M14 2v6h6" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M9 15l2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// 待办清单图标 - 列表样式
export const TodoIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="8" y1="6" x2="21" y2="6" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="8" y1="12" x2="21" y2="12" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="8" y1="18" x2="21" y2="18" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M3 6h.01" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M3 12h.01" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M3 18h.01" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// ========== 工具展示配置 ==========

export interface ToolDisplayConfig {
  /** 图标组件 */
  icon: React.FC<{ size?: number }>;
  /** 图标颜色（CSS 类名） */
  iconColor: string;
  /** 动作文本格式化函数 */
  formatAction: (args: Record<string, unknown>) => string;
  /** 是否展示工具返回结果 */
  showResult?: boolean;
  /** 结果格式化函数 (可选接收 args 用于计算统计信息) */
  formatResult?: (result: unknown, args?: Record<string, unknown>) => string | null;
  /** 是否可展开查看内容 */
  expandable?: boolean;
  /** 展开时的内容字段名 */
  expandField?: string;
}

export type TaskOperation = 'create' | 'get' | 'wait';

/**
 * 历史 task ToolCall 没有 operation 字段，等价于默认的 create。
 * 只识别当前协议中的查询操作，未知值继续沿用旧的创建展示，避免改变历史记录。
 */
export function resolveTaskOperation(args: Record<string, unknown>): TaskOperation {
  if (args.operation === 'get' || args.operation === 'wait') {
    return args.operation;
  }
  return 'create';
}

// 辅助函数：截断路径只显示文件名和部分目录
function shortenPath(path: string, maxLen = 40): string {
  if (!path) return '';
  if (path.length <= maxLen) return path;
  const parts = path.split('/');
  const fileName = parts.pop() || '';
  if (fileName.length >= maxLen - 3) {
    return '...' + fileName.slice(-(maxLen - 3));
  }
  let result = fileName;
  for (let i = parts.length - 1; i >= 0 && result.length < maxLen - 6; i--) {
    result = parts[i] + '/' + result;
  }
  return '.../' + result;
}

// 辅助函数：截断文本
function truncate(text: string, maxLen = 50): string {
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}

// Keep smart board tab copy aligned with the product-approved dashboard definitions.
// A regression test locks the two renamed labels so future merges do not restore legacy copy.
const DASHBOARD_DISPLAY_NAMES: Record<string, string> = {
  'enterprise-360': '企业多维透视',
  'bidding-query': '招投标查询',
  'company-filter': '企业画像筛选',
  'industry-chain': '产业链图谱',
  'batch-query': '批量查询',
  'customer-profile': '客户画像',
  'key-account-operations': '战略客户经营v2',
  'relation-mining': '关系链挖掘',
  'visit-preparation': '访前准备',
  'enterprise-risk': '企业风险',
};

function dashboardDisplayNameFromArgs(args: Record<string, unknown>): string {
  const injectedName = typeof args.__dashboardDisplayName === 'string' ? args.__dashboardDisplayName.trim() : '';
  if (injectedName) return injectedName;
  const key = typeof args.sub_dashboard === 'string' ? args.sub_dashboard.trim() : '';
  if (!key || key === 'current') return '当前看板';
  return DASHBOARD_DISPLAY_NAMES[key] || key;
}

// 辅助函数：提取域名
function extractDomain(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname;
  } catch {
    return url.slice(0, 30);
  }
}

// 辅助函数：从代码中提取有意义的描述
function extractCodeDescription(code: string, language: string): string | null {
  if (!code) return null;
  
  const lines = code.trim().split('\n').filter(l => l.trim() && !l.trim().startsWith('#') && !l.trim().startsWith('//'));
  if (lines.length === 0) return null;
  
  // Python 特定解析
  if (language === 'python') {
    // 检查是否是数据读取操作
    const readMatch = code.match(/(?:pd\.)?read_(?:csv|excel|json|parquet|sql|pickle)\s*\(\s*['"]([^'"]+)['"]/);
    if (readMatch) {
      const filename = readMatch[1].split('/').pop() || readMatch[1];
      return `读取 ${truncate(filename, 25)}`;
    }
    
    // 检查是否是保存文件操作
    const saveMatch = code.match(/(?:\.to_(?:csv|excel|json|parquet|pickle)|savefig|\.save)\s*\(\s*['"]([^'"]+)['"]/);
    if (saveMatch) {
      const filename = saveMatch[1].split('/').pop() || saveMatch[1];
      return `保存 ${truncate(filename, 25)}`;
    }
    
    // 检查是否是 DataFrame 操作
    if (code.includes('.describe()') || code.includes('.info()')) {
      return '数据概览';
    }
    if (code.includes('.groupby(')) {
      return '分组统计';
    }
    if (code.includes('.merge(') || code.includes('.join(')) {
      return '数据合并';
    }
    if (code.includes('.plot') || code.includes('plt.')) {
      return '数据可视化';
    }
    if (code.includes('.head(') || code.includes('.tail(')) {
      return '查看数据';
    }
    if (code.includes('.dropna(') || code.includes('.fillna(')) {
      return '处理缺失值';
    }
    
    // 检查是否定义函数/类
    const defMatch = code.match(/(?:def|class)\s+(\w+)/);
    if (defMatch) {
      return `定义 ${defMatch[1]}`;
    }
    
    // 检查是否是导入
    const importMatch = code.match(/(?:import|from)\s+(\w+)/);
    if (importMatch && lines.length <= 3) {
      return `导入 ${importMatch[1]}`;
    }
    
    // 检查是否是变量赋值
    const assignMatch = lines[0].match(/^(\w+)\s*=\s*(.+)/);
    if (assignMatch) {
      const varName = assignMatch[1];
      const value = assignMatch[2].trim();
      
      // 检查是否是创建 DataFrame
      if (value.includes('pd.DataFrame') || value.includes('DataFrame(')) {
        return `创建 ${varName}`;
      }
      // 检查是否是筛选/过滤
      if (value.includes('[') && value.includes(']')) {
        return `筛选 ${varName}`;
      }
      // 一般赋值
      if (lines.length <= 2) {
        return `${varName} = ${truncate(value, 25)}`;
      }
    }
    
    // 检查 print 语句
    const printMatch = code.match(/print\s*\((.+?)\)/);
    if (printMatch) {
      let content = printMatch[1].trim();
      // 清理转义字符
      content = content.replace(/\\n/g, ' ').replace(/\\t/g, ' ').replace(/\s+/g, ' ').trim();
      if (content.startsWith('"') || content.startsWith("'") || content.startsWith('f"') || content.startsWith("f'")) {
        const cleaned = content.replace(/^f?['"]|['"]$/g, '').replace(/\\n/g, ' ').trim();
        return truncate(cleaned, 30);
      }
      return `输出 ${truncate(content, 25)}`;
    }
  }
  
  // 通用：返回第一行代码的摘要
  let firstLine = lines[0].trim();
  // 清理转义字符和多余空白
  firstLine = firstLine
    .replace(/\\n/g, ' ')  // 替换 \n 为空格
    .replace(/\\t/g, ' ')  // 替换 \t 为空格
    .replace(/\\r/g, '')   // 移除 \r
    .replace(/\s+/g, ' ')  // 合并多个空格
    .trim();
  
  if (firstLine.length <= 40) {
    return firstLine;
  }
  return truncate(firstLine, 35);
}

// 辅助函数：格式化代码执行结果
function formatCodeResult(result: unknown): string | null {
  if (typeof result !== 'string') return null;
  
  const text = result.trim();
  if (!text) return null;
  
  // 检查是否执行成功
  const isError = text.includes('错误') || text.includes('Error') || 
                  text.includes('Traceback') || text.includes('Exception');
  
  if (isError) {
    // 提取错误类型
    const errorMatch = text.match(/(\w+Error|\w+Exception):/);
    if (errorMatch) {
      return `✗ ${errorMatch[1]}`;
    }
    return '✗ 执行失败';
  }
  
  // 成功时显示输出摘要
  const lines = text.split('\n').filter(l => l.trim());
  
  // 检查是否有耗时信息（只有大于 0.01 秒才显示）
  const timeMatch = text.match(/耗时[：:]\s*([\d.]+)\s*(秒|ms|s)/i);
  let timeInfo = '';
  if (timeMatch && useFrontendConfigStore.getState().showToolDurations) {
    const timeVal = parseFloat(timeMatch[1]);
    // 只显示大于 0.01 秒的耗时
    if (timeVal >= 0.01) {
      timeInfo = ` (${timeMatch[1]}${timeMatch[2]})`;
    }
  }
  
  if (lines.length === 0) {
    return `✓ Done${timeInfo}`;
  }
  
  // 辅助函数：判断是否是分隔线（包括各种 Unicode 线条字符）
  const isSeparatorLine = (line: string): boolean => {
    // 匹配各种分隔线：-, =, _, ─, ━, ═, ┄, ┅, ┈, ┉, ―, —, 等
    // 包括细线、粗线、破折号等各种水平线字符
    if (/^[-=_─━═┄┅┈┉·•*―—─]+$/.test(line)) return true;
    // 如果行超过10个字符且主要由线条字符组成
    if (line.length > 10) {
      const lineChars = line.replace(/[\s\-=_─━═┄┅┈┉·•*―—]/g, '');
      if (lineChars.length < line.length * 0.3) return true;  // 70%以上是线条字符
    }
    return false;
  };
  
  // 辅助函数：判断是否是有意义的输出
  const isMeaningfulLine = (line: string): boolean => {
    if (!line) return false;
    if (line.includes('耗时') || line.includes('执行时间')) return false;
    if (isSeparatorLine(line)) return false;
    return true;
  };
  
  if (lines.length === 1) {
    const line = lines[0].trim();
    if (isMeaningfulLine(line)) {
      return `${truncate(line, 35)}${timeInfo}`;
    }
    return `✓ Done${timeInfo}`;
  }
  
  // 多行输出，显示最后一行有意义的内容
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (isMeaningfulLine(line)) {
      return `${truncate(line, 30)}${timeInfo}`;
    }
  }
  
  return `✓ ${lines.length}行输出${timeInfo}`;
}

/**
 * 工具展示配置映射
 * 
 * 设计思路：
 * - 简洁直观：用户一眼就能明白 Agent 在做什么
 * - 信息增强：重要工具（如搜索）展示返回结果
 * - 可展开：写入类工具支持展开查看内容
 */
// 统一的图标颜色（适配深色/浅色主题）
const ICON_COLOR = 'text-zinc-400';

export const TOOL_DISPLAY_CONFIG: Record<string, ToolDisplayConfig> = {
  // ========== 文件读取 ==========
  read: {
    icon: ReadIcon,
    iconColor: ICON_COLOR,
    formatAction: (args) => {
      const path = args.path as string;
      if (!path) return '阅读文件';
      const shortPath = shortenPath(path);
      const offset = args.offset as number | undefined;
      const limit = args.limit as number | undefined;
      if (offset !== undefined && limit !== undefined) {
        return `阅读 "${shortPath}" ${offset}-${offset + limit}行`;
      }
      return `阅读 "${shortPath}"`;
    },
  },
  
  // ========== 文件写入 ==========
  write: {
    icon: WriteIcon,
    iconColor: ICON_COLOR,
    formatAction: (args) => {
      const path = args.path as string;
      const fileName = path ? shortenPath(path) : '文件';
      return `写入 "${fileName}"`;
    },
    showResult: true,
    formatResult: (_result, args) => {
      // 统计行数作为结果显示
      const content = (args?.file_text as string) || (args?.content as string) || '';
      const lines = content ? content.split('\n').length : 0;
      if (lines > 0) {
        return `+${lines}`;
      }
      return null;
    },
  },
  
  // ========== 文件编辑 ==========
  edit: {
    icon: WriteIcon,
    iconColor: ICON_COLOR,
    formatAction: (args) => {
      const path = args.path as string;
      const fileName = path ? shortenPath(path) : '文件';
      return `编辑 "${fileName}"`;
    },
    showResult: true,
    formatResult: (_result, args) => {
      // 统计增删行数作为结果显示
      const oldStr = (args?.old_str as string) || '';
      const newStr = (args?.new_str as string) || '';
      const oldLines = oldStr ? oldStr.split('\n').length : 0;
      const newLines = newStr ? newStr.split('\n').length : 0;
      
      const stats = [];
      if (newLines > 0) stats.push(`+${newLines}`);
      if (oldLines > 0) stats.push(`-${oldLines}`);
      return stats.length > 0 ? stats.join(' ') : null;
    },
  },
  
  multi_edit: {
    icon: WriteIcon,
    iconColor: ICON_COLOR,
    formatAction: (args) => {
      // multi_edit 的 path 在顶层，edits 数组只有 old_str/new_str
      const filePath = args.path as string;
      const edits = args.edits as Array<{ 
        old_str?: string; 
        new_str?: string;
      }> | undefined;
      
      if (filePath && edits && edits.length > 0) {
        return `批量编辑 ${edits.length} 处`;
      }
      return '批量编辑';
    },
    showResult: true,
    formatResult: (_result, args) => {
      // 统计总增删行数作为结果显示
      const edits = (args?.edits as Array<{ old_str?: string; new_str?: string }>) || [];
      let totalAdded = 0;
      let totalRemoved = 0;
      
      for (const edit of edits) {
        const oldLines = edit.old_str ? edit.old_str.split('\n').length : 0;
        const newLines = edit.new_str ? edit.new_str.split('\n').length : 0;
        totalAdded += newLines;
        totalRemoved += oldLines;
      }
      
      const stats = [];
      if (totalAdded > 0) stats.push(`+${totalAdded}`);
      if (totalRemoved > 0) stats.push(`-${totalRemoved}`);
      return stats.length > 0 ? stats.join(' ') : null;
    },
  },
  
  // ========== 搜索类 ==========
  grep: {
    icon: SearchIcon,
    iconColor: ICON_COLOR,
    formatAction: (args) => {
      const pattern = args.pattern as string;
      if (!pattern) return '搜索代码';
      const path = args.path as string;
      if (path) {
        return `搜索 "${truncate(pattern, 30)}" in ${shortenPath(path, 20)}`;
      }
      return `搜索 "${truncate(pattern, 30)}"`;
    },
    showResult: true,
    formatResult: (result) => {
      if (typeof result === 'string') {
        const lines = result.split('\n').filter(l => l.trim());
        if (lines.length > 0) {
          return `找到 ${lines.length} 处匹配`;
        }
      }
      return null;
    },
  },
  
  glob: {
    icon: FolderIcon,
    iconColor: ICON_COLOR,
    formatAction: (args) => {
      const pattern = args.pattern as string;
      if (!pattern) return '查找文件';
      return `查找 "${pattern}"`;
    },
    showResult: true,
    formatResult: (result) => {
      if (typeof result === 'string') {
        const files = result.split('\n').filter(l => l.trim());
        if (files.length > 0) {
          const first = shortenPath(files[0], 25);
          if (files.length === 1) {
            return first;
          }
          return `${first} +${files.length - 1}`;
        }
      }
      return null;
    },
  },
  
  search: {
    icon: SearchIcon,
    iconColor: ICON_COLOR,
    formatAction: (args) => {
      const query = args.query as string;
      if (!query) return '搜索';
      return `搜索 "${truncate(query, 40)}"`;
    },
  },
  
  // ========== 终端 ==========
  bash: {
    icon: TerminalIcon,
    iconColor: ICON_COLOR,
    formatAction: (args) => {
      const cmd = args.command as string;
      if (!cmd) return '执行命令';
      return `执行 ${truncate(cmd, 50)}`;
    },
    showResult: true,
    formatResult: (result) => {
      if (typeof result === 'string') {
        const lines = result.trim().split('\n');
        if (lines.length > 0) {
          // 取最后一行作为预览
          const lastLine = truncate(lines[lines.length - 1], 40);
          if (lastLine) {
            return lastLine;
          }
        }
      }
      return null;
    },
  },
  
  // ========== 网络搜索 ==========
  web_search: {
    icon: GlobeIcon,
    iconColor: ICON_COLOR,
    formatAction: (args) => {
      const query = args.query as string;
      if (query && query.trim()) {
        return `搜索网络 "${truncate(query, 35)}"`;
      }
      return '搜索网络';
    },
    showResult: true,
    formatResult: (result) => {
      // 尝试解析搜索结果
      if (typeof result === 'string') {
        // 提取 URL
        const urlPattern = /https?:\/\/[^\s\]]+/g;
        const urls = result.match(urlPattern) || [];
        if (urls.length > 0 && urls[0]) {
          const first = extractDomain(urls[0]);
          if (urls.length === 1) {
            return first;
          }
          return `${first} +${urls.length - 1}`;
        }
      }
      return null;
    },
  },
  
  // Bocha 网络搜索（系统工具，平台侧 display_name 为 "Moss AI 搜索"）
  bocha_web_search_sys: {
    icon: SearchIcon,
    iconColor: ICON_COLOR,
    formatAction: (args) => {
      const query = args.query as string;
      if (query && query.trim()) {
        return `Moss AI 搜索：${truncate(query, 35)}`;
      }
      return 'Moss AI 搜索';
    },
  },

  get_current_dashboard_context: {
    icon: ChartIcon,
    iconColor: ICON_COLOR,
    formatAction: (args) => `查看看板内容 ${dashboardDisplayNameFromArgs(args)}`,
  },

  // ========== 网页获取 ==========
  fetch: {
    icon: DownloadIcon,
    iconColor: ICON_COLOR,
    formatAction: (args) => {
      const url = args.url as string;
      if (!url) return '精读网页';
      return `精读 ${extractDomain(url)}`;
    },
  },
  
  web_fetch: {
    icon: DownloadIcon,
    iconColor: ICON_COLOR,
    formatAction: (args) => {
      const url = args.url as string;
      if (!url) return '精读网页';
      return `精读 ${extractDomain(url)}`;
    },
  },
  
  // ========== 用户交互 ==========
  ask_user_question: {
    icon: QuestionIcon,
    iconColor: ICON_COLOR,
    formatAction: () => '制作用户问卷',
  },
  
  // ========== 模式切换 ==========
  enter_plan_mode: {
    icon: PlanIcon,
    iconColor: ICON_COLOR,
    formatAction: () => '进入规划模式',
  },
  
  // ========== 子任务 ==========
  task: {
    icon: SubtaskIcon,
    iconColor: ICON_COLOR,
    formatAction: (args) => {
      const operation = resolveTaskOperation(args);
      if (operation === 'wait') {
        return '等待伙伴返回结果';
      }
      if (operation === 'get') {
        return '查询伙伴任务进度';
      }
      const desc = (args.description || args.task || args.tasks) as string | undefined;
      if (typeof desc === 'string' && desc.trim()) {
        return `子任务：${truncate(desc, 35)}`;
      }
      return '委托伙伴执行任务';
    },
    showResult: true,
    formatResult: (result) => {
      if (!result) return null;
      const res = result as { success?: boolean; output?: string; error?: string };
      if (res.success === true) {
        return '已完成 ✓';
      } else if (res.success === false) {
        return res.error ? `失败: ${truncate(res.error, 20)}` : '已失败';
      }
      // 返回 output 的前几个字符
      if (res.output) {
        return truncate(res.output, 30);
      }
      return null;
    },
  },
  
  run_subagent: {
    icon: SubtaskIcon,
    iconColor: ICON_COLOR,
    formatAction: (args) => {
      const name = args.agent_name as string;
      const task = args.task as string;
      if (name && task) {
        return `[${name}] ${truncate(task, 30)}`;
      }
      return '委托伙伴';
    },
    showResult: true,
    formatResult: (result) => {
      if (!result) return null;
      const res = result as { success?: boolean; output?: string; error?: string };
      if (res.success === true) {
        return '已完成 ✓';
      } else if (res.success === false) {
        return res.error ? `失败: ${truncate(res.error, 20)}` : '已失败';
      }
      if (res.output) {
        return truncate(res.output, 30);
      }
      return null;
    },
  },
  
  // ========== 记忆 ==========
  remember: {
    icon: MemoryIcon,
    iconColor: ICON_COLOR,
    formatAction: (args) => {
      const key = args.key as string;
      if (key) {
        return `记住 "${truncate(key, 30)}"`;
      }
      return '保存记忆';
    },
  },
  
  recall: {
    icon: MemoryIcon,
    iconColor: ICON_COLOR,
    formatAction: (args) => {
      const key = args.key as string;
      if (key) {
        return `回忆 "${truncate(key, 30)}"`;
      }
      return '检索记忆';
    },
  },
  
  // ========== 目录列表 ==========
  ls: {
    icon: FolderIcon,
    iconColor: ICON_COLOR,
    formatAction: (args) => {
      const path = args.path as string;
      if (!path) return '列出目录';
      return `列出 ${shortenPath(path, 35)}`;
    },
  },
  
  // ========== Todo ==========
  todo: {
    icon: TodoIcon,
    iconColor: ICON_COLOR,
    formatAction: (args) => {
      const action = args.action as string;
      if (action === 'add') {
        return '添加待办事项';
      } else if (action === 'complete') {
        return '完成待办事项';
      }
      return '更新待办';
    },
  },
  
  // ========== Todo Write (新版待办管理) ==========
  todo_write: {
    icon: TodoIcon,
    iconColor: ICON_COLOR,
    formatAction: (args) => {
      const todos = args.todos as Array<{ id?: string; content?: string; status?: string }> | undefined;
      const merge = args.merge as boolean | undefined;
      
      if (!todos || todos.length === 0) {
        return '更新任务清单';
      }
      
      // 统计各状态数量
      const stats = { pending: 0, in_progress: 0, completed: 0, cancelled: 0 };
      for (const todo of todos) {
        const status = todo.status || 'pending';
        if (status in stats) {
          stats[status as keyof typeof stats]++;
        }
      }
      
      // 构建描述
      if (merge === false) {
        return `创建 ${todos.length} 项任务`;
      }
      
      // 合并模式下，显示主要操作
      if (stats.completed > 0 && stats.in_progress === 0 && stats.pending === 0) {
        return `完成 ${stats.completed} 项任务`;
      }
      if (stats.in_progress > 0) {
        return `更新任务进度`;
      }
      
      return `更新 ${todos.length} 项任务`;
    },
    showResult: true,
    formatResult: (_result, args) => {
      const todos = args?.todos as Array<{ status?: string }> | undefined;
      if (!todos || todos.length === 0) return null;
      
      // 统计状态
      let completed = 0;
      let total = 0;
      for (const todo of todos) {
        total++;
        if (todo.status === 'completed') completed++;
      }
      
      if (completed > 0) {
        return `${completed}/${total} ✓`;
      }
      return `${total} 项`;
    },
  },
  
  // ========== Todo Read ==========
  todo_read: {
    icon: TodoIcon,
    iconColor: ICON_COLOR,
    formatAction: () => '查看任务清单',
  },
  
  // ========== Plan Mode ==========
  exit_plan_mode: {
    icon: PlanIcon,
    iconColor: ICON_COLOR,
    formatAction: (args) => {
      const summary = args.summary as string;
      if (summary && summary.trim()) {
        return `提交方案审批`;
      }
      return '退出规划模式';
    },
    showResult: true,
    formatResult: () => '待审批',
  },
  
  // ========== 语义搜索 ==========
  semantic_search: {
    icon: SearchIcon,
    iconColor: ICON_COLOR,
    formatAction: (args) => {
      const query = args.query as string;
      if (query && query.trim()) {
        return `语义搜索 "${truncate(query, 30)}"`;
      }
      return '语义搜索';
    },
  },
  
  // ========== 代码执行 ==========
  execute_code: {
    icon: TerminalIcon,
    iconColor: ICON_COLOR,
    formatAction: (args) => {
      const language = args.language as string;
      const code = args.code as string;
      if (language && code) {
        const desc = extractCodeDescription(code, language);
        if (desc) {
          return `${language}: ${desc}`;
        }
        return `执行 ${language} 代码`;
      }
      return '执行代码';
    },
    showResult: true,
    formatResult: (result) => formatCodeResult(result),
  },
  
  execute_python: {
    icon: TerminalIcon,
    iconColor: ICON_COLOR,
    formatAction: (args) => {
      const code = args.code as string;
      if (code) {
        const desc = extractCodeDescription(code, 'python');
        if (desc) {
          return `Python: ${desc}`;
        }
      }
      return '执行 Python';
    },
    showResult: true,
    formatResult: (result) => formatCodeResult(result),
  },
  
  python_repl: {
    icon: TerminalIcon,
    iconColor: ICON_COLOR,
    formatAction: (args) => {
      const expr = args.expression as string;
      if (expr) {
        return `计算: ${truncate(expr, 40)}`;
      }
      return 'Python 计算';
    },
    showResult: true,
    formatResult: (result) => {
      if (typeof result === 'string') {
        // 提取计算结果
        const lines = result.trim().split('\n');
        for (const line of lines) {
          if (line && !line.startsWith('错误') && !line.startsWith('Error')) {
            return truncate(line, 30);
          }
        }
      }
      return null;
    },
  },
  
  bash_background: {
    icon: TerminalIcon,
    iconColor: ICON_COLOR,
    formatAction: (args) => {
      const command = args.command as string;
      if (command) {
        return `后台执行 "${truncate(command, 25)}"`;
      }
      return '后台命令';
    },
  },
  
  // ========== 浏览器 ==========
  browser: {
    icon: GlobeIcon,
    iconColor: ICON_COLOR,
    formatAction: (args) => {
      const command = (args.command || args.action) as string;
      const url = args.url as string;
      const selector = args.selector as string;
      const text = args.text as string;

      switch (command) {
        case 'goto':
        case 'navigate':
          if (url) return `访问 ${extractDomain(url)}`;
          return '导航页面';
        case 'click':
          if (selector) return `点击 "${truncate(selector, 30)}"`;
          return '点击元素';
        case 'type':
          if (text && selector) return `输入 "${truncate(text, 20)}" → ${truncate(selector, 15)}`;
          if (text) return `输入 "${truncate(text, 30)}"`;
          return '输入文本';
        case 'screenshot':
          return '截取页面快照';
        case 'get_content':
          if (selector) return `提取内容 "${truncate(selector, 25)}"`;
          return '提取页面内容';
        case 'scroll':
          return '滚动页面';
        case 'wait':
          if (selector) return `等待 "${truncate(selector, 25)}" 出现`;
          return '等待页面加载';
        case 'close':
          return '关闭浏览器';
        default:
          return '浏览器操作';
      }
    },
    showResult: true,
    formatResult: (result) => {
      if (typeof result !== 'string') return null;
      if (result.includes('错误') || result.includes('Error') || result.includes('Timeout')) {
        const msg = result.replace(/^错误:\s*/, '');
        return `✗ ${truncate(msg, 25)}`;
      }
      if (result.includes('成功') || result.includes('✓')) return '✓ Done';
      const urlMatch = result.match(/当前页面:\s*(.+)/);
      if (urlMatch) {
        try { return extractDomain(urlMatch[1]); } catch { /* */ }
      }
      const lines = result.trim().split('\n').filter(l => l.trim());
      if (lines.length > 0) return truncate(lines[0], 30);
      return null;
    },
  },
  
  browse_url: {
    icon: GlobeIcon,
    iconColor: ICON_COLOR,
    formatAction: (args) => {
      const url = args.url as string;
      if (url) return `访问 ${extractDomain(url)}`;
      return '访问网址';
    },
    showResult: true,
    formatResult: (result) => {
      if (typeof result === 'string') {
        const lines = result.trim().split('\n').filter(l => l.trim());
        if (lines.length > 0) return truncate(lines[0], 30);
      }
      return null;
    },
  },
  
  // ========== 文档解析 ==========
  read_document: {
    icon: ReadIcon,
    iconColor: ICON_COLOR,
    formatAction: (args) => {
      const path = args.path as string;
      if (path) {
        return `解析文档 "${shortenPath(path)}"`;
      }
      return '解析文档';
    },
  },
  
  // ========== 图片分析 ==========
  analyze_image: {
    icon: ImageIcon,
    iconColor: ICON_COLOR,
    formatAction: (args) => {
      const images = args.images as string | string[] | undefined;
      const path = args.path as string | undefined;
      const question = args.question as string | undefined;

      const count = Array.isArray(images) ? images.length : (images ? 1 : (path ? 1 : 0));
      const filename = (() => {
        const src = Array.isArray(images) ? images[0] : (images || path || '');
        if (!src) return '';
        const last = src.split('/').pop() || '';
        return last.length > 25 ? '...' + last.slice(-22) : last;
      })();

      let label = count > 1 ? `分析 ${count} 张图片` : (filename ? `分析 "${filename}"` : '分析图片');
      if (question && question !== '请详细描述图片的内容。') {
        label += ` "${truncate(question, 20)}"`;
      }
      return label;
    },
    showResult: true,
    formatResult: (result) => {
      if (typeof result !== 'string') return null;
      if (result.includes('错误') || result.includes('Error')) {
        return `✗ ${truncate(result.replace(/^错误:\s*/, ''), 25)}`;
      }
      const lines = result.trim().split('\n').filter(l => l.trim());
      if (lines.length > 0) {
        return truncate(lines[0], 35);
      }
      return '✓ 已分析';
    },
  },
  
  // ========== 图片生成 ==========
  generate_image: {
    icon: ImageIcon,
    iconColor: ICON_COLOR,
    formatAction: (args) => {
      const prompt = args.prompt as string;
      const ratio = args.aspect_ratio as string;
      const quality = args.quality as string;
      let label = '生成图片';
      if (prompt) {
        label = `生成图片 "${truncate(prompt, 30)}"`;
      }
      const tags: string[] = [];
      if (ratio && ratio !== '1:1') tags.push(ratio);
      if (quality === 'hd') tags.push('4K');
      if (tags.length > 0) {
        label += ` [${tags.join(' ')}]`;
      }
      return label;
    },
    showResult: true,
    formatResult: (result) => {
      if (typeof result !== 'string') return null;
      if (result.startsWith('错误') || result.includes('错误:')) {
        const msg = result.replace(/^错误:\s*/, '');
        return `✗ ${truncate(msg, 30)}`;
      }
      const seedMatch = result.match(/seed:\s*(\d+)/);
      if (seedMatch) {
        return `✓ seed:${seedMatch[1]}`;
      }
      if (result.includes('✓')) return '✓ 已生成';
      return null;
    },
  },

  // ========== 视频生成 ==========
  generate_video: {
    icon: ImageIcon,
    iconColor: ICON_COLOR,
    formatAction: (args) => {
      const prompt = args.prompt as string;
      const duration = args.duration as string;
      const image = args.image as string;
      const mode = image ? '图生视频' : '生成视频';
      let label = mode;
      if (prompt) {
        label = `${mode} "${truncate(prompt, 25)}"`;
      }
      const tags: string[] = ['1080P'];
      if (duration && duration !== '5') tags.push(`${duration}s`);
      label += ` [${tags.join(' ')}]`;
      return label;
    },
    showResult: true,
    formatResult: (result) => {
      if (typeof result !== 'string') return null;
      if (result.startsWith('错误') || result.includes('错误:')) {
        const msg = result.replace(/^错误:\s*/, '');
        return `✗ ${truncate(msg, 30)}`;
      }
      const durMatch = result.match(/时长:\s*(\d+s)/);
      const modeMatch = result.match(/模式:\s*(\S+)/);
      const parts: string[] = ['✓'];
      if (modeMatch) parts.push(modeMatch[1]);
      if (durMatch) parts.push(durMatch[1]);
      if (result.includes('✓')) {
        return parts.length > 1 ? parts.join(' ') : '✓ 已生成';
      }
      return null;
    },
  },

  // ========== 图片编辑/合成 ==========
  edit_image: {
    icon: ImageEditIcon,
    iconColor: ICON_COLOR,
    formatAction: (args) => {
      const prompt = args.prompt as string;
      const images = args.images;
      const count = Array.isArray(images) ? images.length : (images ? 1 : 0);
      if (count > 1) {
        if (prompt) return `合成 ${count} 张图 "${truncate(prompt, 25)}"`;
        return `合成 ${count} 张图片`;
      }
      if (prompt) return `编辑图片 "${truncate(prompt, 30)}"`;
      return '编辑图片';
    },
    showResult: true,
    formatResult: (result) => {
      if (typeof result !== 'string') return null;
      if (result.startsWith('错误') || result.includes('错误:')) {
        const msg = result.replace(/^错误:\s*/, '');
        return `✗ ${truncate(msg, 30)}`;
      }
      const seedMatch = result.match(/seed:\s*(\d+)/);
      if (result.includes('合成')) {
        return seedMatch ? `✓ 合成完成 seed:${seedMatch[1]}` : '✓ 合成完成';
      }
      if (result.includes('编辑')) {
        return seedMatch ? `✓ 编辑完成 seed:${seedMatch[1]}` : '✓ 编辑完成';
      }
      if (result.includes('✓')) return '✓ 已完成';
      return null;
    },
  },
  
  // ========== 记忆管理 ==========
  memory: {
    icon: MemoryIcon,
    iconColor: ICON_COLOR,
    formatAction: (args) => {
      const action = args.action as string;
      if (action === 'save') {
        return '保存记忆';
      } else if (action === 'recall') {
        return '检索记忆';
      }
      return '管理记忆';
    },
  },

  // ========== 内联可视化 ==========
  show_widget_guide: {
    icon: PaletteIcon,
    iconColor: ICON_COLOR,
    formatAction: (args) => {
      const modules = args.modules;
      if (Array.isArray(modules) && modules.length > 0) {
        return `加载设计规范 [${modules.join(', ')}]`;
      }
      return '加载设计规范';
    },
    showResult: false,
  },

  show_widget: {
    icon: ChartIcon,
    iconColor: ICON_COLOR,
    formatAction: (args) => {
      const title = args.title as string;
      if (title) {
        return `绘制 "${truncate(title, 30)}"`;
      }
      return '绘制可视化';
    },
    showResult: true,
    formatResult: (result) => {
      if (typeof result !== 'string') return null;
      if (result.includes('ERROR')) {
        return `✗ ${truncate(result.replace(/^ERROR:\s*/, ''), 30)}`;
      }
      const titleMatch = result.match(/"title"\s*:\s*"([^"]+)"/);
      if (titleMatch) {
        return titleMatch[1];
      }
      return '✓ 已渲染';
    },
  },

  // ========== 3D 关系图谱 ==========
  graph_3d: {
    icon: GlobeIcon,
    iconColor: ICON_COLOR,
    formatAction: (args) => {
      const title = args.title as string;
      const nodes = args.nodes as unknown[];
      const nodeCount = Array.isArray(nodes) ? nodes.length : 0;
      if (title) {
        return `构建 3D 图谱 "${truncate(title, 24)}"${nodeCount ? ` (${nodeCount} 节点)` : ''}`;
      }
      return '构建 3D 关系图谱';
    },
    showResult: true,
    formatResult: (result) => {
      if (typeof result !== 'string') return null;
      if (result.includes('ERROR')) {
        return `✗ ${truncate(result.replace(/^ERROR:\s*/, ''), 30)}`;
      }
      const titleMatch = result.match(/"title"\s*:\s*"([^"]+)"/);
      if (titleMatch) {
        return titleMatch[1];
      }
      return '✓ 已渲染';
    },
  },
};

/** 自定义工具通用结果格式化 */
function formatCustomToolResult(result: unknown): string | null {
  if (result == null) return null;
  const text = typeof result === 'string' ? result : JSON.stringify(result);
  if (!text) return null;
  if (text.includes('错误') || text.includes('Error')) {
    const cleaned = text.replace(/^错误:\s*/, '');
    return `✗ ${truncate(cleaned, 50)}`;
  }
  if (text.startsWith('✓') || text.startsWith('{') || text.startsWith('[')) {
    return truncate(text.replace(/\n/g, ' '), 65);
  }
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length > 0) return truncate(lines[0], 65);
  return null;
}

/**
 * 获取工具展示配置
 * 
 * 内置工具使用精确配置；自定义工具使用扳手图标 + 通用结果预览。
 */
export function getToolDisplayConfig(toolName: string): ToolDisplayConfig {
  if (TOOL_DISPLAY_CONFIG[toolName]) {
    return TOOL_DISPLAY_CONFIG[toolName];
  }

  return {
    icon: CustomToolIcon,
    iconColor: ICON_COLOR,
    formatAction: () => toolName,
    showResult: true,
    formatResult: (result) => formatCustomToolResult(result),
  };
}
