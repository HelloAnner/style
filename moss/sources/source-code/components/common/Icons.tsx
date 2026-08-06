/**
 * 图标组件库 - 基于 Lucide React
 * 
 * 所有图标使用 Lucide React 实现，支持自定义大小和颜色
 * 保持与原有 API 的兼容性
 */

import React from 'react';
import {
  Send,
  Square,
  Lightbulb,
  Wrench,
  Zap,
  Clock,
  MessageSquare,
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  Check,
  XCircle,
  Loader2,
  Code,
  FileText,
  PanelRight,
  Bot,
  User,
  Plus,
  Trash2,
  Copy,
  Eye,
  Download,
  Edit3,
  FileOutput,
  Timer,
  Braces,
  Coins,
  Settings,
  Save,
  Sparkles,
  RefreshCw,
  Upload,
  Image,
  Paperclip,
  FileUp,
  FileSpreadsheet,
  ArrowUp,
  History,
  Folder,
  FolderOpen,
  File,
  MoreHorizontal,
  Search,
  ExternalLink,
  Play,
  Pause,
  AlertCircle,
  Info,
  CheckCircle,
  type LucideProps,
} from 'lucide-react';

// 通用图标属性接口
interface IconProps {
  size?: number;
  className?: string;
}

// 包装 Lucide 图标的高阶组件
const wrapIcon = (LucideIcon: React.FC<LucideProps>) => {
  return ({ size = 20, className = '' }: IconProps) => (
    <LucideIcon size={size} className={className} />
  );
};

// ===== 基础图标 =====

// 发送消息图标 - 使用 ArrowUp (设计稿规范)
export const SendIcon: React.FC<IconProps> = wrapIcon(ArrowUp);

// 停止图标
export const StopIcon: React.FC<IconProps> = ({ size = 20, className = '' }) => (
  <Square size={size} className={className} fill="currentColor" />
);

// 思考/大脑图标
export const ThinkingIcon: React.FC<IconProps> = wrapIcon(Lightbulb);

// 工具/扳手图标
export const ToolIcon: React.FC<IconProps> = wrapIcon(Wrench);

// 技能/闪电图标
export const SkillIcon: React.FC<IconProps> = wrapIcon(Zap);

// 历史/时钟图标
export const HistoryIcon: React.FC<IconProps> = wrapIcon(History);

// 消息/聊天图标
export const ChatIcon: React.FC<IconProps> = wrapIcon(MessageSquare);

// 菜单图标
export const MenuIcon: React.FC<IconProps> = wrapIcon(Menu);

// 关闭图标
export const CloseIcon: React.FC<IconProps> = wrapIcon(X);

// 展开/折叠图标
export const ChevronIcon: React.FC<IconProps & { direction?: 'up' | 'down' | 'left' | 'right' }> = ({
  size = 20,
  className = '',
  direction = 'right',
}) => {
  const icons = {
    up: ChevronUp,
    down: ChevronDown,
    left: ChevronLeft,
    right: ChevronRight,
  };
  const Icon = icons[direction];
  return <Icon size={size} className={className} />;
};

// 成功/勾选图标
export const CheckIcon: React.FC<IconProps> = wrapIcon(Check);

// 错误/叉号图标
export const ErrorIcon: React.FC<IconProps> = wrapIcon(XCircle);

// 加载中图标（带动画）
export const LoadingIcon: React.FC<IconProps> = ({ size = 20, className = '' }) => (
  <Loader2 size={size} className={`animate-spin ${className}`} />
);

// 代码/终端图标
export const CodeIcon: React.FC<IconProps> = wrapIcon(Code);

// 文件图标
export const FileIcon: React.FC<IconProps> = wrapIcon(FileText);

// 面板切换图标
export const PanelIcon: React.FC<IconProps> = wrapIcon(PanelRight);

// Agent/机器人图标
export const AgentIcon: React.FC<IconProps> = wrapIcon(Bot);

// 用户图标
export const UserIcon: React.FC<IconProps> = wrapIcon(User);

// 新建图标
export const PlusIcon: React.FC<IconProps> = wrapIcon(Plus);

// 删除图标
export const TrashIcon: React.FC<IconProps> = wrapIcon(Trash2);

// 复制图标
export const CopyIcon: React.FC<IconProps> = wrapIcon(Copy);

// 眼睛/查看图标
export const EyeIcon: React.FC<IconProps> = wrapIcon(Eye);

// 下载图标
export const DownloadIcon: React.FC<IconProps> = wrapIcon(Download);

// 输入/编辑图标
export const InputIcon: React.FC<IconProps> = wrapIcon(Edit3);

// 输出图标
export const OutputIcon: React.FC<IconProps> = wrapIcon(FileOutput);

// 时间/时长图标
export const TimerIcon: React.FC<IconProps> = wrapIcon(Timer);

// JSON 图标
export const JsonIcon: React.FC<IconProps> = wrapIcon(Braces);

// Token 图标
export const TokenIcon: React.FC<IconProps> = wrapIcon(Coins);

// 设置/齿轮图标
export const SettingsIcon: React.FC<IconProps> = wrapIcon(Settings);

// 保存图标
export const SaveIcon: React.FC<IconProps> = wrapIcon(Save);

// 闪光/星星图标
export const SparklesIcon: React.FC<IconProps> = wrapIcon(Sparkles);

// 刷新图标
export const RefreshIcon: React.FC<IconProps> = wrapIcon(RefreshCw);

// 上传图标
export const UploadIcon: React.FC<IconProps> = wrapIcon(Upload);

// 图片上传图标
export const ImageUploadIcon: React.FC<IconProps> = wrapIcon(Image);

// 附件/回形针图标
export const AttachmentIcon: React.FC<IconProps> = wrapIcon(Paperclip);

// 文档上传图标
export const DocumentUploadIcon: React.FC<IconProps> = wrapIcon(FileUp);

// PDF 图标 (保持自定义，因为 Lucide 没有 PDF 特定图标)
export const PdfIcon: React.FC<IconProps> = ({ size = 20, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14,2 14,8 20,8" />
    <path d="M10 12H8v5h2v-2h.5a1.5 1.5 0 000-3H10z" />
    <path d="M16 17v-5h-1.5a1.5 1.5 0 00-1.5 1.5v2a1.5 1.5 0 001.5 1.5H16z" />
  </svg>
);

// Excel 图标
export const ExcelIcon: React.FC<IconProps> = wrapIcon(FileSpreadsheet);

// ===== 新增图标 (Lucide) =====

// 文件夹图标
export const FolderIcon: React.FC<IconProps> = wrapIcon(Folder);

// 打开的文件夹图标
export const FolderOpenIcon: React.FC<IconProps> = wrapIcon(FolderOpen);

// 更多操作图标
export const MoreIcon: React.FC<IconProps> = wrapIcon(MoreHorizontal);

// 搜索图标
export const SearchIcon: React.FC<IconProps> = wrapIcon(Search);

// 外部链接图标
export const ExternalLinkIcon: React.FC<IconProps> = wrapIcon(ExternalLink);

// 播放图标
export const PlayIcon: React.FC<IconProps> = wrapIcon(Play);

// 暂停图标
export const PauseIcon: React.FC<IconProps> = wrapIcon(Pause);

// 警告图标
export const AlertIcon: React.FC<IconProps> = wrapIcon(AlertCircle);

// 信息图标
export const InfoIcon: React.FC<IconProps> = wrapIcon(Info);

// 成功圆圈图标
export const SuccessIcon: React.FC<IconProps> = wrapIcon(CheckCircle);

// 时钟图标（与 History 区分）
export const ClockIcon: React.FC<IconProps> = wrapIcon(Clock);

// 向上箭头图标
export const ArrowUpIcon: React.FC<IconProps> = wrapIcon(ArrowUp);

// ===== 直接导出 Lucide 图标供需要时使用 =====
export {
  Send,
  Square,
  Lightbulb,
  Wrench,
  Zap,
  Clock,
  MessageSquare,
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  Check,
  XCircle,
  Loader2,
  Code,
  FileText,
  PanelRight,
  Bot,
  User,
  Plus,
  Trash2,
  Copy,
  Eye,
  Download,
  Edit3,
  FileOutput,
  Timer,
  Braces,
  Coins,
  Settings,
  Save,
  Sparkles,
  RefreshCw,
  Upload,
  Image,
  Paperclip,
  FileUp,
  FileSpreadsheet,
  ArrowUp,
  History,
  Folder,
  FolderOpen,
  File,
  MoreHorizontal,
  Search,
  ExternalLink,
  Play,
  Pause,
  AlertCircle,
  Info,
  CheckCircle,
};
