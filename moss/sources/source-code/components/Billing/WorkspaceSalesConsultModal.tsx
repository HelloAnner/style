import { useState } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid var(--border-default)',
  borderRadius: 8,
  fontSize: 14,
  color: 'var(--text-primary)',
  background: 'var(--bg-secondary)',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--text-secondary, #52525b)',
  marginBottom: 6,
};

export const CHINA_MAINLAND_PHONE_PATTERN = /^(?:\+?86)?1\d{10}$/;

export function normalizePhone(value: string): string {
  return value.replace(/\s+/g, '').replace(/-/g, '');
}

/**
 * 联系销售弹窗 — 与管理后台 > 用量管理 > 联系销售卡片保持一致。
 * 带背景模糊遮罩（backdrop-filter: blur）。
 */
export function WorkspaceSalesConsultModal({ open, onClose }: Props) {
  const [formData, setFormData] = useState({ name: '', company: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!open) return null;

  function handleChange(field: keyof typeof formData) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData(prev => ({ ...prev, [field]: e.target.value }));
      setError(null);
    };
  }

  async function handleSubmit() {
    if (!formData.name.trim()) {
      setError('请输入姓名');
      return;
    }
    if (!formData.company.trim()) {
      setError('请输入公司名称');
      return;
    }
    const normalizedPhone = normalizePhone(formData.phone.trim());
    if (!normalizedPhone) {
      setError('请输入手机号');
      return;
    }
    if (!CHINA_MAINLAND_PHONE_PATTERN.test(normalizedPhone)) {
      setError('请输入有效的手机号码');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/website/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json() as { msg?: string };
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          onClose();
          setFormData({ name: '', company: '', phone: '' });
        }, 1500);
      } else {
        setError(data.msg ?? '提交失败，请稍后重试');
      }
    } catch {
      setError('网络异常，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      data-testid="workspace-sales-consult-modal"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.3)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        data-testid="workspace-sales-consult-modal-panel"
        style={{
          background: 'var(--modal-bg, var(--bg-secondary))',
          borderRadius: 16,
          padding: '36px 32px 28px',
          width: 460,
          maxWidth: '95vw',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--modal-shadow, 0 8px 40px rgba(0,0,0,0.14))',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 关闭按钮 */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            width: 28,
            height: 28,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 6,
            color: 'var(--text-muted, #71717a)',
            fontSize: 18,
            lineHeight: 1,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-tertiary, #f4f4f5)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
        >
          ×
        </button>

        <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, textAlign: 'center', color: 'var(--text-primary, #18181b)' }}>
          联系销售
        </h3>
        <p style={{ margin: '0 0 24px', fontSize: 13, color: 'var(--text-muted, #71717a)', textAlign: 'center', lineHeight: 1.6 }}>
          请留下您的信息，我们的客户经理<br />会与您联系提供专属服务
        </p>

        <div data-testid="workspace-sales-consult-modal-form" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>姓名</label>
            <input
              type="text"
              placeholder="请输入您的姓名"
              value={formData.name}
              onChange={handleChange('name')}
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--text-muted)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; }}
            />
          </div>
          <div>
            <label style={labelStyle}>公司</label>
            <input
              type="text"
              placeholder="请输入公司名称"
              value={formData.company}
              onChange={handleChange('company')}
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--text-muted)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; }}
            />
          </div>
          <div>
            <label style={labelStyle}>手机</label>
            <input
              type="tel"
              placeholder="请输入手机号"
              value={formData.phone}
              onChange={handleChange('phone')}
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--text-muted)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; }}
            />
          </div>
        </div>

        {error && <div style={{ marginTop: 12, fontSize: 13, color: 'var(--danger)', textAlign: 'center' }}>{error}</div>}
        {success && <div style={{ marginTop: 12, fontSize: 13, color: 'var(--success)', textAlign: 'center' }}>提交成功，我们会尽快与您联系</div>}

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={submitting}
          style={{
            width: '100%',
            marginTop: 16,
            padding: '10px 0',
            borderRadius: 8,
            border: 'none',
            background: submitting ? 'var(--btn-mono-disabled-bg)' : 'var(--btn-mono-bg)',
            color: submitting ? 'var(--btn-mono-disabled-text)' : 'var(--btn-mono-text)',
            fontSize: 14,
            fontWeight: 500,
            cursor: submitting ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { if (!submitting) (e.currentTarget as HTMLButtonElement).style.background = 'var(--btn-mono-hover-bg)'; }}
          onMouseLeave={e => { if (!submitting) (e.currentTarget as HTMLButtonElement).style.background = 'var(--btn-mono-bg)'; }}
        >
          {submitting ? '提交中...' : '提交'}
        </button>
      </div>
    </div>
  );
}
