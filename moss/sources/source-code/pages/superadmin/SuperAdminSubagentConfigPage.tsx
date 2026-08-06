import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Database, History, ShieldCheck, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  superAdminApi,
  type SubagentRuntimeConfigResponse,
} from '../../api/superadmin';
import { MossSwitch } from '../../components/common/MossSwitch';
import { SuperAdminConfigShell } from './SuperAdminConfigShell';
import './SuperAdminSubagentConfigPage.css';

const PARAMETER_AUTO_SAVE_DELAY_MS = 600;

type Draft = {
  enabled: boolean;
  maxChildrenPerCreate: string;
  defaultTimeoutSeconds: string;
};

function toDraft(config: SubagentRuntimeConfigResponse): Draft {
  return {
    enabled: config.enabled,
    maxChildrenPerCreate: String(config.maxChildrenPerCreate),
    defaultTimeoutSeconds: String(config.defaultTimeoutSeconds),
  };
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function sameDraft(left: Draft | null, right: Draft | null): boolean {
  return Boolean(
    left
      && right
      && left.enabled === right.enabled
      && left.maxChildrenPerCreate === right.maxChildrenPerCreate
      && left.defaultTimeoutSeconds === right.defaultTimeoutSeconds,
  );
}

export const SuperAdminSubagentConfigPage: React.FC = () => {
  const navigate = useNavigate();
  const [current, setCurrent] = useState<SubagentRuntimeConfigResponse | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const config = await superAdminApi.subagentRuntimeConfig();
      setCurrent(config);
      setDraft(toDraft(config));
      setSaved(false);
    } catch (loadError) {
      setError(errorMessage(loadError, '加载 Subagent 配置失败，请稍后重试'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const parsedMaxChildren = Number(draft?.maxChildrenPerCreate ?? '');
  const parsedTimeout = Number(draft?.defaultTimeoutSeconds ?? '');
  const validationError = useMemo(() => {
    if (!draft || !current) return null;
    if (!Number.isInteger(parsedMaxChildren) || parsedMaxChildren < 1 || parsedMaxChildren > 10) {
      return '单次最多创建数须为 1 到 10 的整数';
    }
    if (!Number.isInteger(parsedTimeout) || parsedTimeout < 60 || parsedTimeout > current.maxTimeoutSeconds) {
      return `默认运行超时须为 60 到 ${current.maxTimeoutSeconds} 秒的整数`;
    }
    return null;
  }, [current, draft, parsedMaxChildren, parsedTimeout]);

  const dirty = Boolean(
    current
      && draft
      && (
        draft.enabled !== current.enabled
        || parsedMaxChildren !== current.maxChildrenPerCreate
        || parsedTimeout !== current.defaultTimeoutSeconds
    ),
  );

  const handleEnabledChange = (enabled: boolean) => {
    setDraft((previous) => previous ? { ...previous, enabled } : previous);
    setError(null);
    setSaved(false);
  };

  useEffect(() => {
    if (!current || !draft || !dirty || validationError || saving) return undefined;

    const snapshot = { ...draft };
    const baseConfig = current;
    const delay = snapshot.enabled !== baseConfig.enabled ? 0 : PARAMETER_AUTO_SAVE_DELAY_MS;
    const timer = window.setTimeout(() => {
      setSaving(true);
      setError(null);
      setSaved(false);
      void superAdminApi.updateSubagentRuntimeConfig({
        enabled: snapshot.enabled,
        maxChildrenPerCreate: Number(snapshot.maxChildrenPerCreate),
        defaultTimeoutSeconds: Number(snapshot.defaultTimeoutSeconds),
        expectedRevision: baseConfig.revision,
      }).then((updated) => {
        setCurrent(updated);
        setDraft((latest) => sameDraft(latest, snapshot) ? toDraft(updated) : latest);
        setSaved(true);
      }).catch((saveError) => {
        setError(errorMessage(saveError, '自动保存 Subagent 配置失败，请重试'));
        setDraft((latest) => sameDraft(latest, snapshot) ? toDraft(baseConfig) : latest);
      }).finally(() => {
        setSaving(false);
      });
    }, delay);

    return () => window.clearTimeout(timer);
  }, [current, dirty, draft, saving, validationError]);

  return (
    <SuperAdminConfigShell activeKey="subagent-runtime" testId="superadmin-subagent-config-page">
      {loading && (
        <div className="fi-subagent-config-message" role="status">正在读取当前生效配置...</div>
      )}
      {!loading && error && !draft && (
        <div className="fi-subagent-config-message is-error" role="alert">
          <span>{error}</span>
          <button className="fi-config-button" type="button" onClick={() => void loadConfig()}>
            重新加载
          </button>
        </div>
      )}
      {draft && current && (
        <article className="fi-config-card fi-subagent-config-card">
          <section className="fi-subagent-master-section" aria-labelledby="subagent-master-title">
            <div className="fi-subagent-master-copy">
              <div className="fi-subagent-eyebrow">全局能力入口</div>
              <h2 id="subagent-master-title">启用 Subagent</h2>
              <p>
                这是唯一的全局开关。修改后自动生效；关闭只做软过滤，不删除或改写数据库定义。
              </p>
            </div>
            <div className="fi-subagent-master-control">
              <span className={`fi-config-status ${draft.enabled ? 'ready' : 'off'}`}>
                {draft.enabled ? '已开启' : '已关闭'}
              </span>
              <MossSwitch
                checked={draft.enabled}
                disabled={saving}
                ariaLabel="全局启用 Subagent"
                testId="subagent-global-switch"
                onChange={handleEnabledChange}
              />
            </div>
          </section>

          <section className="fi-subagent-impact-grid" aria-label="开关影响范围">
            <div className="fi-subagent-impact-item">
              <ShieldCheck aria-hidden="true" />
              <div><strong>工具不可见</strong><span>最终发给模型的 Tools 中不包含 Task</span></div>
            </div>
            <div className="fi-subagent-impact-item">
              <Sparkles aria-hidden="true" />
              <div><strong>认知同步</strong><span>System Prompt、伙伴与 Skill 同步裁剪</span></div>
            </div>
            <div className="fi-subagent-impact-item">
              <History aria-hidden="true" />
              <div><strong>历史隔离</strong><span>历史 Task 调用及结果不再进入模型上下文</span></div>
            </div>
            <div className="fi-subagent-impact-item">
              <Database aria-hidden="true" />
              <div><strong>数据保留</strong><span>Tool、Skill 和既有子任务记录保持原样</span></div>
            </div>
          </section>

          <div className="fi-config-divider" />

          <section className={`fi-config-section fi-subagent-parameters${draft.enabled ? '' : ' is-disabled'}`}>
            <div className="fi-config-section-header">
              <div>
                <div className="fi-config-section-title">核心运行参数</div>
                <div className="fi-config-section-desc">仅开放日常需要调整的参数；关闭期间保留原值</div>
              </div>
            </div>
            <div className="fi-config-grid two">
              <label className="fi-config-field">
                <span className="fi-config-label">单次最多创建子任务数</span>
                <input
                  className="fi-config-input"
                  type="number"
                  min={1}
                  max={10}
                  step={1}
                  value={draft.maxChildrenPerCreate}
                  disabled={!draft.enabled || saving}
                  onChange={(event) => {
                    setDraft((previous) => previous ? {
                      ...previous,
                      maxChildrenPerCreate: event.target.value,
                    } : previous);
                    setError(null);
                    setSaved(false);
                  }}
                />
                <span className="fi-subagent-field-hint">限制一次 Task create 可生成的并行子任务数量</span>
              </label>
              <label className="fi-config-field">
                <span className="fi-config-label">默认运行超时（秒）</span>
                <input
                  className="fi-config-input"
                  type="number"
                  min={60}
                  max={current.maxTimeoutSeconds}
                  step={60}
                  value={draft.defaultTimeoutSeconds}
                  disabled={!draft.enabled || saving}
                  onChange={(event) => {
                    setDraft((previous) => previous ? {
                      ...previous,
                      defaultTimeoutSeconds: event.target.value,
                    } : previous);
                    setError(null);
                    setSaved(false);
                  }}
                />
                <span className="fi-subagent-field-hint">允许范围 60–{current.maxTimeoutSeconds} 秒</span>
              </label>
            </div>
          </section>

          <button
            type="button"
            className="fi-subagent-management-link"
            onClick={() => navigate('/superadmin/subagents')}
          >
            <span><strong>子智能体管理</strong><small>查看定义、运行记录与测试结果</small></span>
            <ArrowRight aria-hidden="true" />
          </button>

          <footer className="fi-config-footer fi-subagent-config-footer">
            <div className="fi-subagent-save-state" aria-live="polite">
              <span>
                {saving
                  ? '正在发布新配置...'
                  : current.updatedAt
                    ? `上次更新：${new Date(current.updatedAt).toLocaleString()}`
                    : '当前为默认生效配置'}
              </span>
              <small>版本 {current.revision}</small>
              {saving && <strong className="is-saving">正在自动保存...</strong>}
              {!saving && dirty && !validationError && <strong className="is-saving">等待自动保存...</strong>}
              {saved && !dirty && !saving && <strong>已自动保存，新任务将读取此配置</strong>}
              {validationError && <strong className="is-error">{validationError}</strong>}
              {error && <strong className="is-error">{error}</strong>}
            </div>
          </footer>
        </article>
      )}
    </SuperAdminConfigShell>
  );
};

export default SuperAdminSubagentConfigPage;
