/**
 * useToolActionDisplay — 主 agent ActionItem 与子 agent ToolStepRow 共用的工具行展示逻辑。
 *
 * 输入：工具名、参数、可选的 displayName。
 * 输出：图标组件、图标颜色 class、可读的行动文本（中文名 + 关键参数）。
 *
 * 解析优先级与 ActionItem 历史行为对齐：
 *   1. 后端给了 displayName 且工具不是 TOOL_DISPLAY_CONFIG 内置 — 直接用 displayName
 *      （内置工具仍走 formatAction(args)，避免丢失「阅读 \"xxx\"」这种参数化文案）
 *   2. 自定义工具 — display.action_text > display_name > description_zh
 *   3. 兜底 — getToolDisplayConfig(toolName).formatAction(args)
 */

import { useMemo } from 'react';
import { getToolDisplayConfig, TOOL_DISPLAY_CONFIG } from './toolDisplayConfig';
import { useAgentStore } from '../../../stores/agentStore';
import { getToolIcon } from '../../Tools/ToolIconPicker';

const DYNAMIC_TOOL_LABEL_OVERRIDES: Record<string, string> = {
  'moss-opinion-aggregate': '舆情聚合',
  'moss-search-opinion': '舆情搜索',
  read_document: '解析结构化文档',
  bidding_get_bidding_list_sys: 'MOSS-招投标信息',
  company_get_company_list_sys: 'MOSS-企业列表搜索',
  company_get_copyright_software_list_sys: 'MOSS-软件著作权',
  company_get_leader_positions_sys: 'MOSS-企业主要人员查询',
  company_get_patent_list_sys: 'MOSS-专利信息',
  company_get_report_asset_sys: 'MOSS-年报资产数据',
  company_get_report_out_guarant_sys: 'MOSS-年报对外担保',
  company_get_report_share_tran_sys: 'MOSS-年报股权变更',
  company_get_report_social_info_sys: 'MOSS-年报社保信息',
  enterprise_portrait_get_hire_list_sys: 'MOSS-企业招聘信息',
};

export interface ToolActionDisplay {
  Icon: React.FC<{ size?: number }>;
  iconColorClass: string;
  actionText: string;
  /** 自定义工具的展示样式（card 模式等） */
  displayCfg?: import('../../../types').ToolDisplayConfig;
  /** 用于 ActionItem 的内置/自定义区分 */
  isCustomTool: boolean;
}

export function useToolActionDisplay(
  toolName: string,
  args: Record<string, unknown>,
  displayName?: string,
): ToolActionDisplay {
  const tools = useAgentStore((s) => s.tools);

  const dynamicTarget = useMemo(
    () => resolveDynamicToolTarget(toolName, args),
    [toolName, args],
  );
  const effectiveToolName = dynamicTarget?.toolName ?? toolName;
  const effectiveArgs = dynamicTarget?.args ?? args;
  const effectiveDisplayName = dynamicTarget ? undefined : displayName;

  const config = getToolDisplayConfig(effectiveToolName);
  const isCustomTool = !(effectiveToolName in TOOL_DISPLAY_CONFIG);

  const toolInfo = useMemo(() => {
    if (!isCustomTool) return null;
    return tools.find((t) => t.name === effectiveToolName) ?? null;
  }, [isCustomTool, tools, effectiveToolName]);

  const displayCfg = toolInfo?.display;

  const CustomIcon = useMemo(() => {
    if (!isCustomTool || !displayCfg?.icon) return null;
    return getToolIcon(displayCfg.icon);
  }, [isCustomTool, displayCfg?.icon]);

  const Icon = (CustomIcon || config.icon) as React.FC<{ size?: number }>;

  const customDisplayName = useMemo(() => {
    if (!isCustomTool) return null;
    if (displayCfg?.action_text) return displayCfg.action_text;
    return toolInfo?.display_name
      || toolInfo?.description_zh
      || DYNAMIC_TOOL_LABEL_OVERRIDES[effectiveToolName]
      || readableToolName(effectiveToolName);
  }, [isCustomTool, displayCfg, toolInfo, effectiveToolName]);

  const actionText = useMemo(() => {
    if (effectiveDisplayName) {
      const staticCfg = TOOL_DISPLAY_CONFIG[effectiveToolName];
      if (staticCfg) return staticCfg.formatAction(effectiveArgs);
      return effectiveDisplayName;
    }
    if (isCustomTool && customDisplayName) return customDisplayName;
    return config.formatAction(effectiveArgs);
  }, [effectiveDisplayName, isCustomTool, customDisplayName, effectiveToolName, effectiveArgs, config]);

  return { Icon, iconColorClass: config.iconColor, actionText, displayCfg, isCustomTool };
}

function resolveDynamicToolTarget(
  toolName: string,
  args: Record<string, unknown>,
): { toolName: string; args: Record<string, unknown> } | null {
  if (toolName !== 'invoke_dynamic_tool') return null;
  const targetToolName = stringValue(args.tool_name) || stringValue(args.target_tool_name) || stringValue(args.name);
  if (!targetToolName) return null;
  return {
    toolName: targetToolName,
    args: objectValue(args.arguments),
  };
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function readableToolName(toolName: string): string {
  return toolName
    .replace(/_sys$/u, '')
    .split('_')
    .filter(Boolean)
    .join(' ');
}
