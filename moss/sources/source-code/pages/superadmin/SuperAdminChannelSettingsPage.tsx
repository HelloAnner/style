import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { superAdminApi } from '../../api/superadmin';
import { SuperAdminConfigShell } from './SuperAdminConfigShell';

type SavingTarget = 'sms' | 'email' | 'verification' | 'sms-test' | 'email-test' | null;
type StatusTone = 'ready' | 'draft' | 'off';


const SECRET_MASK = '*******';

const emptySms = {
  enabled: false,
  endpoint: '',
  signName: '',
  accessKeyId: '',
  accessKeySecret: '',
  accessKeyIdConfigured: false,
  accessKeySecretConfigured: false,
};

const emptyVerification = {
  verificationTemplateCode: '',
  verificationEmailSubject: '',
  verificationEmailBody: '',
};

const emptyEmail = {
  enabled: false,
  host: '',
  port: '465',
  sslEnabled: true,
  starttlsEnabled: false,
  username: '',
  password: '',
  usernameConfigured: false,
  passwordConfigured: false,
};

function hasSmsConfig(sms: typeof emptySms): boolean {
  return Boolean(
    sms.endpoint
    && sms.signName
    && sms.accessKeyIdConfigured
    && sms.accessKeySecretConfigured,
  );
}

function hasVerificationConfig(verification: typeof emptyVerification): boolean {
  return Boolean(
    verification.verificationTemplateCode
    && verification.verificationEmailSubject
    && verification.verificationEmailBody,
  );
}

function hasEmailConfig(email: typeof emptyEmail): boolean {
  return Boolean(
    email.host
    && email.port
    && email.usernameConfigured
    && email.passwordConfigured,
  );
}

function sectionStatus(enabled: boolean, configured: boolean): { tone: StatusTone; text: string } {
  if (!enabled) {
    return { tone: 'off', text: '已关闭' };
  }
  if (configured) {
    return { tone: 'ready', text: '配置完整' };
  }
  return { tone: 'draft', text: '配置不完整' };
}

/**
 * 超管通道设置页（主前端承接第十批）。
 *
 * 业务职责：
 * - 管理短信/邮件通道配置；
 * - 管理验证码业务模板配置；
 * - 支持短信/邮件测试发送。
 */
export const SuperAdminChannelSettingsPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<SavingTarget>(null);
  const [error, setError] = useState<string | null>(null);

  const [sms, setSms] = useState(emptySms);
  const [verification, setVerification] = useState(emptyVerification);
  const [email, setEmail] = useState(emptyEmail);
  const [secretEditing, setSecretEditing] = useState({ sms: false, email: false });
  const [smsTestPhone, setSmsTestPhone] = useState('');
  const [emailTestAddress, setEmailTestAddress] = useState('');

  const loadConfigs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await superAdminApi.channelConfigs();
      setSms({
        ...emptySms,
        enabled: data.smsAccess.enabled,
        endpoint: data.smsAccess.endpoint ?? '',
        signName: data.smsAccess.signName ?? '',
        accessKeyId: data.smsAccess.accessKeyId ?? '',
        accessKeyIdConfigured: data.smsAccess.accessKeyIdConfigured,
        accessKeySecretConfigured: data.smsAccess.accessKeySecretConfigured,
      });
      setVerification({
        ...emptyVerification,
        verificationTemplateCode: data.verification.verificationTemplateCode ?? '',
        verificationEmailSubject: data.verification.verificationEmailSubject ?? '',
        verificationEmailBody: data.verification.verificationEmailBody ?? '',
      });
      setEmail({
        ...emptyEmail,
        enabled: data.emailAccess.enabled,
        host: data.emailAccess.host ?? '',
        port: data.emailAccess.port ? String(data.emailAccess.port) : '465',
        sslEnabled: data.emailAccess.sslEnabled,
        starttlsEnabled: data.emailAccess.starttlsEnabled,
        username: data.emailAccess.username ?? '',
        usernameConfigured: data.emailAccess.usernameConfigured,
        passwordConfigured: data.emailAccess.passwordConfigured,
      });
      setSecretEditing({ sms: false, email: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfigs();
  }, [loadConfigs]);

  const smsStatus = useMemo(() => sectionStatus(sms.enabled, hasSmsConfig(sms)), [sms]);
  const emailStatus = useMemo(() => sectionStatus(email.enabled, hasEmailConfig(email)), [email]);
  const verificationStatus = useMemo(
    () => sectionStatus(true, hasVerificationConfig(verification)),
    [verification],
  );

  const saveSms = async () => {
    setSaving('sms');
    try {
      const res = await superAdminApi.updateSmsChannelConfig({
        enabled: sms.enabled,
        endpoint: sms.endpoint,
        signName: sms.signName,
        accessKeyId: sms.accessKeyId || undefined,
        accessKeySecret: sms.accessKeySecret || undefined,
      });
      setSms((prev) => ({
        ...prev,
        accessKeyId: res.accessKeyId ?? prev.accessKeyId,
        accessKeySecret: '',
        accessKeyIdConfigured: res.accessKeyIdConfigured,
        accessKeySecretConfigured: res.accessKeySecretConfigured,
      }));
      setSecretEditing((prev) => ({ ...prev, sms: false }));
      toast.success('短信通道配置已保存');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败，请稍后重试');
    } finally {
      setSaving(null);
    }
  };

  const saveEmail = async () => {
    setSaving('email');
    try {
      const res = await superAdminApi.updateEmailChannelConfig({
        enabled: email.enabled,
        host: email.host,
        port: Number(email.port),
        sslEnabled: email.sslEnabled,
        starttlsEnabled: email.starttlsEnabled,
        username: email.username || undefined,
        password: email.password || undefined,
      });
      setEmail((prev) => ({
        ...prev,
        username: res.username ?? '',
        password: '',
        usernameConfigured: res.usernameConfigured,
        passwordConfigured: res.passwordConfigured,
      }));
      setSecretEditing((prev) => ({ ...prev, email: false }));
      toast.success('邮件通道配置已保存');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败，请稍后重试');
    } finally {
      setSaving(null);
    }
  };

  const saveVerification = async () => {
    setSaving('verification');
    try {
      const res = await superAdminApi.updateVerificationBizConfig({
        verificationTemplateCode: verification.verificationTemplateCode,
        verificationEmailSubject: verification.verificationEmailSubject,
        verificationEmailBody: verification.verificationEmailBody,
      });
      setVerification({
        verificationTemplateCode: res.verificationTemplateCode ?? '',
        verificationEmailSubject: res.verificationEmailSubject ?? '',
        verificationEmailBody: res.verificationEmailBody ?? '',
      });
      toast.success('验证码业务配置已保存');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败，请稍后重试');
    } finally {
      setSaving(null);
    }
  };

  const testSms = async () => {
    setSaving('sms-test');
    try {
      await superAdminApi.testSmsChannelConfig({ phone: smsTestPhone });
      toast.success('短信测试发送成功');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '测试发送失败，请稍后重试');
    } finally {
      setSaving(null);
    }
  };

  const testEmail = async () => {
    setSaving('email-test');
    try {
      await superAdminApi.testEmailChannelConfig({ email: emailTestAddress });
      toast.success('邮件测试发送成功');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '测试发送失败，请稍后重试');
    } finally {
      setSaving(null);
    }
  };

  const smsSecretValue = secretEditing.sms || !sms.accessKeySecretConfigured ? sms.accessKeySecret : SECRET_MASK;
  const emailPasswordValue = secretEditing.email || !email.passwordConfigured ? email.password : SECRET_MASK;

  const saveAll = async () => {
    await saveSms();
    await saveEmail();
    await saveVerification();
  };

  return (
    <SuperAdminConfigShell activeKey="channel" testId="superadmin-channel-settings-page">
      <>
        {loading && <div className="fi-config-loading">加载中...</div>}
        {error && <div className="fi-config-alert error">{error}</div>}

        <article className="fi-config-card" data-testid="superadmin-channel-settings-channels">
          <section className="fi-config-section" data-testid="superadmin-channel-settings-sms">
            <div className="fi-config-section-header">
              <div>
                <div className="fi-config-section-title">短信通道</div>
                <div className="fi-config-section-desc">阿里云短信通道配置</div>
              </div>
              <span className={`fi-config-status ${smsStatus.tone}`}>
                {smsStatus.text}
              </span>
            </div>

            <div className="fi-config-grid">
              <label className="fi-config-field">
                <span className="fi-config-label">Endpoint</span>
                <input
                  className="fi-config-input"
                  value={sms.endpoint}
                  onChange={(event) => setSms((prev) => ({ ...prev, endpoint: event.target.value }))}
                />
              </label>
              <label className="fi-config-field">
                <span className="fi-config-label">签名名称</span>
                <input
                  className="fi-config-input"
                  value={sms.signName}
                  onChange={(event) => setSms((prev) => ({ ...prev, signName: event.target.value }))}
                />
              </label>
              <label className="fi-config-field">
                <span className="fi-config-label">AccessKey ID</span>
                <input
                  className="fi-config-input"
                  value={sms.accessKeyId}
                  onChange={(event) => setSms((prev) => ({ ...prev, accessKeyId: event.target.value }))}
                />
              </label>
              <label className="fi-config-field">
                <span className="fi-config-label">AccessKey Secret</span>
                <input
                  className="fi-config-input"
                  type="password"
                  value={smsSecretValue}
                  onFocus={() => setSecretEditing((prev) => ({ ...prev, sms: true }))}
                  onBlur={() => {
                    setSecretEditing((prev) => ({
                      ...prev,
                      sms: sms.accessKeySecret.trim().length > 0,
                    }));
                  }}
                  onChange={(event) => setSms((prev) => ({ ...prev, accessKeySecret: event.target.value }))}
                />
              </label>
            </div>

            <div className="fi-config-inline-row">
              <input
                className="fi-config-input"
                value={smsTestPhone}
                onChange={(event) => setSmsTestPhone(event.target.value)}
                placeholder="测试手机号"
                style={{ width: 240 }}
              />
              <button
                className="fi-config-button"
                type="button"
                disabled={saving === 'sms-test' || !smsTestPhone.trim()}
                onClick={() => void testSms()}
              >
                {saving === 'sms-test' ? '测试中...' : '发送测试短信'}
              </button>
            </div>


          </section>

          <div className="fi-config-divider" />

          <section className="fi-config-section" data-testid="superadmin-channel-settings-email">
            <div className="fi-config-section-header">
              <div>
                <div className="fi-config-section-title">邮件通道</div>
                <div className="fi-config-section-desc">SMTP 通道配置</div>
              </div>
              <span className={`fi-config-status ${emailStatus.tone}`}>
                {emailStatus.text}
              </span>
            </div>

            <div className="fi-config-grid">
              <label className="fi-config-field">
                <span className="fi-config-label">SMTP 主机</span>
                <input
                  className="fi-config-input"
                  value={email.host}
                  onChange={(event) => setEmail((prev) => ({ ...prev, host: event.target.value }))}
                />
              </label>
              <label className="fi-config-field">
                <span className="fi-config-label">端口</span>
                <input
                  className="fi-config-input"
                  value={email.port}
                  onChange={(event) => setEmail((prev) => ({ ...prev, port: event.target.value }))}
                />
              </label>
              <label className="fi-config-field">
                <span className="fi-config-label">用户名</span>
                <input
                  className="fi-config-input"
                  value={email.username}
                  onChange={(event) => setEmail((prev) => ({ ...prev, username: event.target.value }))}
                />
              </label>
              <label className="fi-config-field">
                <span className="fi-config-label">密码</span>
                <input
                  className="fi-config-input"
                  type="password"
                  value={emailPasswordValue}
                  onFocus={() => setSecretEditing((prev) => ({ ...prev, email: true }))}
                  onBlur={() => {
                    setSecretEditing((prev) => ({
                      ...prev,
                      email: email.password.trim().length > 0,
                    }));
                  }}
                  onChange={(event) => setEmail((prev) => ({ ...prev, password: event.target.value }))}
                />
              </label>
            </div>

            <div className="fi-config-inline-row">
              <label className="fi-config-inline-row">
                <input
                  type="checkbox"
                  checked={email.sslEnabled}
                  onChange={(event) => setEmail((prev) => ({ ...prev, sslEnabled: event.target.checked }))}
                />
                <span className="fi-config-label">SSL 加密</span>
              </label>
              <label className="fi-config-inline-row">
                <input
                  type="checkbox"
                  checked={email.starttlsEnabled}
                  onChange={(event) => setEmail((prev) => ({ ...prev, starttlsEnabled: event.target.checked }))}
                />
                <span className="fi-config-label">STARTTLS</span>
              </label>
            </div>

            <div className="fi-config-inline-row">
              <input
                className="fi-config-input"
                value={emailTestAddress}
                onChange={(event) => setEmailTestAddress(event.target.value)}
                placeholder="测试邮箱地址"
                style={{ width: 240 }}
              />
              <button
                className="fi-config-button"
                type="button"
                disabled={saving === 'email-test' || !emailTestAddress.trim()}
                onClick={() => void testEmail()}
              >
                {saving === 'email-test' ? '测试中...' : '发送测试邮件'}
              </button>
            </div>


          </section>

          <div className="fi-config-divider" />

          <section className="fi-config-section" data-testid="superadmin-channel-settings-verification">
            <div className="fi-config-section-header">
              <div>
                <div className="fi-config-section-title">验证码业务模板</div>
              </div>
              <span className={`fi-config-status ${verificationStatus.tone}`}>
                {verificationStatus.text}
              </span>
            </div>

            <div className="fi-config-grid three">
              <label className="fi-config-field">
                <span className="fi-config-label">短信模板 Code</span>
                <input
                  className="fi-config-input"
                  value={verification.verificationTemplateCode}
                  onChange={(event) => setVerification((prev) => ({ ...prev, verificationTemplateCode: event.target.value }))}
                />
              </label>
              <label className="fi-config-field">
                <span className="fi-config-label">邮件主题</span>
                <input
                  className="fi-config-input"
                  value={verification.verificationEmailSubject}
                  onChange={(event) => setVerification((prev) => ({ ...prev, verificationEmailSubject: event.target.value }))}
                />
              </label>
              <label className="fi-config-field">
                <span className="fi-config-label">邮件正文</span>
                <textarea
                  className="fi-config-textarea"
                  value={verification.verificationEmailBody}
                  onChange={(event) => setVerification((prev) => ({ ...prev, verificationEmailBody: event.target.value }))}
                />
              </label>
            </div>


          </section>

          <footer className="fi-config-footer">
            <span className="fi-config-updated-at">通道配置会在保存后立即生效</span>
            <div className="fi-config-inline-row">
              <button
                className="fi-config-button"
                type="button"
                disabled={saving !== null}
                onClick={() => void loadConfigs()}
              >
                放弃更改
              </button>
              <button
                className="fi-config-button primary"
                type="button"
                disabled={saving !== null}
                onClick={() => void saveAll()}
              >
                {saving ? '保存中...' : '保存生效'}
              </button>
            </div>
          </footer>
        </article>
      </>
    </SuperAdminConfigShell>
  );
};

export default SuperAdminChannelSettingsPage;
