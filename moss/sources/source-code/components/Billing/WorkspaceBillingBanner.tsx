import type { WorkspaceBillingUiState } from '../../utils/billingUiState';
import { isFeishuEnv } from '../../utils/feishu';
import { isFeishuWorkspace, useTenantStore } from '../../stores/tenantStore';

type Props = {
  billingUiState: WorkspaceBillingUiState;
  onOpenSalesConsult: () => void;
};

const linkStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: 0,
  color: 'var(--btn-primary-bg)',
  fontWeight: 500,
  textDecoration: 'none',
  fontSize: 'inherit',
  whiteSpace: 'nowrap',
  display: 'inline',
};

export function resolveAiPackageTopupUrl(upgradeUrl: string, inFeishu = isFeishuEnv()): string {
  if (!inFeishu) return upgradeUrl;

  const params = new URLSearchParams({
    mode: 'window',
    url: upgradeUrl,
  });
  return `https://applink.feishu.cn/client/web_url/open?${params.toString()}`;
}

/**
 * 工作台顶部计费提示横幅。
 * 文案完全对标 V1 zh_CN.json conversationPanel.* 字段。
 */
export function WorkspaceBillingBanner({ billingUiState, onOpenSalesConsult }: Props) {
  const currentWorkspace = useTenantStore((s) => s.currentWorkspace);
  if (!billingUiState.bannerTone || !billingUiState.bannerMessage) return null;

  const isDanger = billingUiState.bannerTone === 'danger';
  const { billingBlockReason, showSalesLink, showTopupLink, completedJobCount, bannerMessage } = billingUiState;
  const showFeishuTopup = isFeishuWorkspace(currentWorkspace);

  const handleAiPackageTopup = () => {
    if (billingUiState.aiPackageUpgradeUrl) {
      window.open(resolveAiPackageTopupUrl(billingUiState.aiPackageUpgradeUrl), '_blank', 'noopener,noreferrer');
      return;
    }
    onOpenSalesConsult();
  };

  const renderContent = () => {
    // 试用耗尽：前缀 + 【N】 + 中间 + 【联系帆软销售】 + 后缀
    if (billingBlockReason === 'exhausted' && bannerMessage === 'exhaustedTrial') {
      return (
        <>
          抱歉，MOSS 试用积分耗尽，MOSS已为您累计完成【<strong>{completedJobCount}</strong>】次洞察分析。希望我的业务能力能得到您的认可！请
          <button type="button" style={linkStyle} onClick={onOpenSalesConsult}>【联系帆软销售】</button>
          为全公司正式开通服务。
        </>
      );
    }

    if (
      billingBlockReason === 'exhausted'
      && (bannerMessage === 'insufficientForNextJobOfficialAdmin' || bannerMessage === 'exhaustedOfficialAdmin')
    ) {
      if (!showFeishuTopup) {
        return (
          <>
            贵司MOSS的可用余额已耗尽，请立即
            <button type="button" style={linkStyle} onClick={onOpenSalesConsult}>【联系帆软销售】</button>
            补充MOSS账户积分。
          </>
        );
      }
      return (
        <>
          贵司MOSS的可用余额已耗尽，请立即
          <button type="button" style={linkStyle} onClick={handleAiPackageTopup}>【补充飞书AI通用额度】</button>
          。
        </>
      );
    }

    if (billingBlockReason === 'exhausted' && bannerMessage === 'insufficientForNextJobTrial') {
      return (
        <>
          当前空间 MOSS 试用积分不足以发起新的分析，请
          <button type="button" style={linkStyle} onClick={onOpenSalesConsult}>【联系帆软销售】</button>
          为全公司正式开通服务。
        </>
      );
    }

    if (
      billingBlockReason === 'exhausted'
      && (bannerMessage === 'insufficientForNextJobOfficialMember' || bannerMessage === 'exhaustedOfficialMember')
    ) {
      if (!showFeishuTopup) {
        return <>抱歉，由于商业分析过于火热，贵司MOSS的可用余额已耗尽，请联系管理员补充MOSS账户积分。</>;
      }
      return <>抱歉，由于商业分析过于火热，贵司MOSS的可用余额已耗尽，请联系管理员补充飞书AI通用额度。</>;
    }

    if (billingBlockReason === 'exhausted' && showTopupLink) {
      return (
        <>
          贵司本年度洞察积分额度已耗尽。企业的打单效率不能停！是否立即
          <button type="button" style={linkStyle} onClick={onOpenSalesConsult}>【购买紧急算力补充包】</button>
          或
          <button type="button" style={linkStyle} onClick={onOpenSalesConsult}>【联系帆软销售】</button>
          规划额度升级方案？
        </>
      );
    }

    // 过期 + 管理员：前缀 + 【联系帆软销售】 + 后缀
    if (billingBlockReason === 'expired' && showSalesLink) {
      return (
        <>
          贵司 MOSS 正式版服务已到期，当前工作台已暂停使用。企业的打单效率不能停！请立即
          <button type="button" style={linkStyle} onClick={onOpenSalesConsult}>【联系帆软销售】</button>
          续费开通服务。
        </>
      );
    }

    // 过期 + 成员
    if (billingBlockReason === 'expired') {
      return <>抱歉，贵司 MOSS 正式版服务已到期，当前工作台已暂停使用。请提醒贵司系统管理员联系帆软续费开通后再来找我哦～</>;
    }

    // notProvisioned
    if (billingBlockReason === 'notProvisioned') {
      return <>当前工作区尚未开通，请联系销售获取试用或开通服务。</>;
    }

    // dailyLimitBreached
    if (billingBlockReason === 'dailyLimitBreached') {
      return <>您今日的 MOSS 查询量已达到极高阈值，系统已启用临时保护机制。请等待明日零点自动恢复。</>;
    }

    // lowBalance — 纯文案无超链
    return bannerMessage;
  };

  return (
    <div
      data-testid="workspace-billing-banner"
      style={{
        padding: '10px 16px',
        fontSize: '13px',
        lineHeight: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        margin: '4px 4px 0',
        borderRadius: '8px',
        flexShrink: 0,
        background: isDanger ? 'var(--danger-bg-soft)' : 'var(--warning-bg-soft)',
        border: `1px solid ${isDanger ? 'var(--danger-border-soft)' : 'var(--warning-border-soft)'}`,
        color: isDanger ? 'var(--danger)' : 'var(--warning)',
      }}
    >
      <span className="workspace-billing-banner-content" style={{ flex: 1 }}>
        {renderContent()}
      </span>
    </div>
  );
}
