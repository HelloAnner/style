import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  superAdminApi,
  type SaAliyunIntegrationConfig,
  type SaAliyunSkuConfig,
  type SaFeishuIntegrationConfig,
} from '../../api/superadmin';
import { SuperAdminConfigShell } from './SuperAdminConfigShell';
import './SuperAdminThirdPartyIntegrationPage.css';

type AliyunDraft = SaAliyunIntegrationConfig & { securityKey: string };
type FeishuDraft = SaFeishuIntegrationConfig & { clientSecret: string; appSecret: string };

const KNOWN_ALIYUN_SKUS: SaAliyunSkuConfig[] = [
  { skuId: 'yuncode6779600001', planTier: 'aliyun-professional', initialCredits: 0, renewCredits: 0 },
  { skuId: 'yuncode6779600002', planTier: 'aliyun-professional', initialCredits: 15000, renewCredits: 0 },
];

function toAliyunDraft(config: SaAliyunIntegrationConfig): AliyunDraft {
  return {
    ...config,
    frontendUrl: config.frontendUrl === '/' ? 'https://www.mossdo.com' : config.frontendUrl,
    productCode: config.productCode || 'cmgj00073796',
    securityKey: '',
    skuEntitlements: config.skuEntitlements.length > 0 ? config.skuEntitlements : KNOWN_ALIYUN_SKUS,
  };
}

function toFeishuDraft(config: SaFeishuIntegrationConfig): FeishuDraft {
  return { ...config, clientSecret: '', appSecret: '' };
}

export const SuperAdminThirdPartyIntegrationPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<'aliyun' | 'feishu' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aliyun, setAliyun] = useState<AliyunDraft | null>(null);
  const [feishu, setFeishu] = useState<FeishuDraft | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await superAdminApi.thirdPartyIntegrations();
      setAliyun(toAliyunDraft(data.aliyun));
      setFeishu(toFeishuDraft(data.feishu));
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载第三方接入配置失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveAliyun = async () => {
    if (!aliyun) return;
    setSaving('aliyun');
    try {
      const saved = await superAdminApi.updateAliyunIntegration({
        frontendUrl: aliyun.frontendUrl,
        productCode: aliyun.productCode,
        securityKey: aliyun.securityKey || undefined,
        skuEntitlements: aliyun.skuEntitlements,
      });
      setAliyun(toAliyunDraft(saved));
      toast.success('阿里云云市场配置已保存');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存阿里云配置失败');
    } finally {
      setSaving(null);
    }
  };

  const saveFeishu = async () => {
    if (!feishu) return;
    setSaving('feishu');
    try {
      const saved = await superAdminApi.updateFeishuIntegration({
        oauthEnabled: feishu.oauthEnabled,
        clientId: feishu.clientId,
        clientSecret: feishu.clientSecret || undefined,
        redirectUri: feishu.redirectUri,
        partnerAiEnabled: feishu.partnerAiEnabled,
        aiItemId: feishu.aiItemId,
        appId: feishu.appId,
        appSecret: feishu.appSecret || undefined,
      });
      setFeishu(toFeishuDraft(saved));
      toast.success('飞书配置已保存');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存飞书配置失败');
    } finally {
      setSaving(null);
    }
  };

  const updateSku = (index: number, patch: Partial<SaAliyunSkuConfig>) => {
    if (!aliyun) return;
    setAliyun({
      ...aliyun,
      skuEntitlements: aliyun.skuEntitlements.map((item, current) => (
        current === index ? { ...item, ...patch } : item
      )),
    });
  };

  const aliyunReady = Boolean(
    aliyun
    && aliyun.securityKeyConfigured
    && aliyun.productCode.trim()
    && aliyun.skuEntitlements.length > 0
    && aliyun.skuEntitlements.every((sku) => sku.skuId.trim() && sku.planTier.trim() && sku.initialCredits > 0),
  );

  return (
    <SuperAdminConfigShell activeKey="third-party" testId="superadmin-third-party-integration-page">
      <div className="fi-third-party-page">
        {loading && <div className="fi-third-party-message">加载中...</div>}
        {error && <div className="fi-third-party-message is-error">{error}</div>}

        {aliyun && (
          <section className="fi-third-party-card" aria-labelledby="aliyun-integration-title">
            <header className="fi-third-party-card-header">
              <div>
                <h2 id="aliyun-integration-title">阿里云云市场</h2>
                <p>配置 SPI 验签、免登地址与商品 SKU 权益映射。</p>
              </div>
              <span className={`fi-third-party-status${aliyunReady ? ' is-ready' : ''}`}>
                {aliyunReady ? '配置完整' : '配置不完整'}
              </span>
            </header>

            <div className="fi-third-party-grid">
              <label className="fi-third-party-field">
                <span>公网地址</span>
                <input
                  value={aliyun.frontendUrl}
                  onChange={(event) => setAliyun({ ...aliyun, frontendUrl: event.target.value })}
                  placeholder="https://www.mossdo.com"
                />
              </label>
              <label className="fi-third-party-field">
                <span>商品编码 ProductCode</span>
                <input
                  value={aliyun.productCode}
                  onChange={(event) => setAliyun({ ...aliyun, productCode: event.target.value })}
                  placeholder="cmgj00073796"
                />
              </label>
              <label className="fi-third-party-field fi-third-party-field-wide">
                <span>服务商安全密钥</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={aliyun.securityKey}
                  onChange={(event) => setAliyun({ ...aliyun, securityKey: event.target.value })}
                  placeholder={aliyun.securityKeyConfigured ? '已配置，留空不修改' : '从阿里云云市场商家后台概览页获取'}
                />
              </label>
            </div>

            <div className="fi-third-party-subsection">
              <div className="fi-third-party-subsection-header">
                <div>
                  <h3>SKU 权益</h3>
                  <p>积分包暂按 1 元 = 10 积分；1500 元对应 15000 积分。专业版首购积分需按实际权益录入且必须大于 0。</p>
                </div>
                <button
                  type="button"
                  className="fi-third-party-button"
                  onClick={() => setAliyun({
                    ...aliyun,
                    skuEntitlements: [...aliyun.skuEntitlements, {
                      skuId: '', planTier: 'aliyun-professional', initialCredits: 0, renewCredits: 0,
                    }],
                  })}
                >
                  增加 SKU
                </button>
              </div>
              {aliyun.skuEntitlements.map((sku, index) => (
                <div className="fi-third-party-sku-row" key={`${sku.skuId}-${index}`}>
                  <label className="fi-third-party-field">
                    <span>SKU ID</span>
                    <input value={sku.skuId} onChange={(event) => updateSku(index, { skuId: event.target.value })} />
                  </label>
                  <label className="fi-third-party-field">
                    <span>套餐标识</span>
                    <input value={sku.planTier} onChange={(event) => updateSku(index, { planTier: event.target.value })} />
                  </label>
                  <label className="fi-third-party-field">
                    <span>购买发放积分</span>
                    <input
                      type="number"
                      min={0}
                      value={sku.initialCredits}
                      onChange={(event) => updateSku(index, { initialCredits: Number(event.target.value) })}
                    />
                  </label>
                  <label className="fi-third-party-field">
                    <span>续费发放积分</span>
                    <input
                      type="number"
                      min={0}
                      value={sku.renewCredits}
                      onChange={(event) => updateSku(index, { renewCredits: Number(event.target.value) })}
                    />
                  </label>
                  <button
                    type="button"
                    className="fi-third-party-button is-danger"
                    aria-label={`删除 SKU ${sku.skuId || index + 1}`}
                    onClick={() => setAliyun({
                      ...aliyun,
                      skuEntitlements: aliyun.skuEntitlements.filter((_, current) => current !== index),
                    })}
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>

            <div className="fi-third-party-actions">
              <button
                type="button"
                className="fi-third-party-button is-primary"
                disabled={saving !== null}
                onClick={() => void saveAliyun()}
              >
                {saving === 'aliyun' ? '保存中...' : '保存阿里云配置'}
              </button>
            </div>
          </section>
        )}

        {feishu && (
          <section className="fi-third-party-card" aria-labelledby="feishu-integration-title">
            <header className="fi-third-party-card-header">
              <div>
                <h2 id="feishu-integration-title">飞书</h2>
                <p>配置登录 OAuth 与 Partner AI 核心凭据；高级重试参数仍由部署配置管理。</p>
              </div>
            </header>

            <div className="fi-third-party-subsection">
              <label className="fi-third-party-check">
                <input
                  type="checkbox"
                  checked={feishu.oauthEnabled}
                  onChange={(event) => setFeishu({ ...feishu, oauthEnabled: event.target.checked })}
                />
                启用飞书 OAuth
              </label>
              <div className="fi-third-party-grid">
                <label className="fi-third-party-field">
                  <span>Client ID</span>
                  <input value={feishu.clientId} onChange={(event) => setFeishu({ ...feishu, clientId: event.target.value })} />
                </label>
                <label className="fi-third-party-field">
                  <span>Client Secret</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={feishu.clientSecret}
                    onChange={(event) => setFeishu({ ...feishu, clientSecret: event.target.value })}
                    placeholder={feishu.clientSecretConfigured ? '已配置，留空不修改' : '请输入 Client Secret'}
                  />
                </label>
                <label className="fi-third-party-field fi-third-party-field-wide">
                  <span>OAuth 回调地址</span>
                  <input value={feishu.redirectUri} onChange={(event) => setFeishu({ ...feishu, redirectUri: event.target.value })} />
                </label>
              </div>
            </div>

            <div className="fi-third-party-divider" />

            <div className="fi-third-party-subsection">
              <label className="fi-third-party-check">
                <input
                  type="checkbox"
                  checked={feishu.partnerAiEnabled}
                  onChange={(event) => setFeishu({ ...feishu, partnerAiEnabled: event.target.checked })}
                />
                启用飞书 Partner AI
              </label>
              <div className="fi-third-party-grid">
                <label className="fi-third-party-field">
                  <span>AI Item ID</span>
                  <input value={feishu.aiItemId} onChange={(event) => setFeishu({ ...feishu, aiItemId: event.target.value })} />
                </label>
                <label className="fi-third-party-field">
                  <span>App ID</span>
                  <input value={feishu.appId} onChange={(event) => setFeishu({ ...feishu, appId: event.target.value })} />
                </label>
                <label className="fi-third-party-field fi-third-party-field-wide">
                  <span>App Secret</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={feishu.appSecret}
                    onChange={(event) => setFeishu({ ...feishu, appSecret: event.target.value })}
                    placeholder={feishu.appSecretConfigured ? '已配置，留空不修改' : '请输入 App Secret'}
                  />
                </label>
              </div>
            </div>

            <div className="fi-third-party-actions">
              <button
                type="button"
                className="fi-third-party-button is-primary"
                disabled={saving !== null}
                onClick={() => void saveFeishu()}
              >
                {saving === 'feishu' ? '保存中...' : '保存飞书配置'}
              </button>
            </div>
          </section>
        )}
      </div>
    </SuperAdminConfigShell>
  );
};

export default SuperAdminThirdPartyIntegrationPage;
