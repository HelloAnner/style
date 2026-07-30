import React, { memo, useEffect, useState } from 'react';
import type {
  WufanRightPanelType,
  WufanWorkspaceFilesProps,
} from './types';
import { WufanWorkspaceStudio } from './WufanWorkspaceFiles';

function PanelIcon({
  type,
  size = 18,
}: {
  type:
    | Exclude<WufanRightPanelType, 'none'>
    | 'close'
    | 'download'
    | 'copy'
    | 'maximize'
    | 'restore';
  size?: number;
}): React.ReactElement {
  const path = {
    workspace: (
      <>
        <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h4l2 2h7A2.5 2.5 0 0 1 21 8.5v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-11Z" />
        <path d="M3.5 10h17" />
      </>
    ),
    execution: (
      <>
        <circle cx="7" cy="5" r="2.5" />
        <circle cx="17" cy="19" r="2.5" />
        <path d="M7 7.5v4c0 3 3 5.5 10 7" />
      </>
    ),
    automation: (
      <>
        <path d="M4 7h16M7 4v6M4 17h16M17 14v6" />
        <circle cx="7" cy="7" r="2" />
        <circle cx="17" cy="17" r="2" />
      </>
    ),
    close: <path d="m6 6 12 12M18 6 6 18" />,
    download: (
      <>
        <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
        <path d="M5 19h14" />
      </>
    ),
    copy: (
      <>
        <rect x="8" y="8" width="12" height="12" rx="2" />
        <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
      </>
    ),
    maximize: (
      <>
        <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" />
        <path d="m3 8 5-5m13 5-5-5M3 16l5 5m13-5-5 5" />
      </>
    ),
    restore: (
      <>
        <path d="M9 3H3v6M15 3h6v6M9 21H3v-6M15 21h6v-6" />
        <path d="m3 9 6-6m12 6-6-6M3 15l6 6m12-6-6 6" />
      </>
    ),
  }[type];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {path}
    </svg>
  );
}

function ExecutionPanel(): React.ReactElement {
  return (
    <div className="wufan-side-panel__body">
      <div className="wufan-execution-summary">
        <span>当前对话</span>
        <strong>3 轮迭代 · 4 次工具调用</strong>
      </div>
      <div className="wufan-execution-task">
        <small>用户任务</small>
        <p>分析三家汽车企业并给出合作优先级建议</p>
        <div>
          <span>↓ 18,640</span>
          <span>↑ 4,236</span>
          <span className="is-complete">已完成</span>
        </div>
      </div>
      <ol className="wufan-execution-timeline">
        <li className="is-complete">
          <span />
          <div>
            <strong>读取客户洞察技能</strong>
            <small>1 次工具调用 · 126ms</small>
          </div>
        </li>
        <li className="is-complete">
          <span />
          <div>
            <strong>核验企业主体</strong>
            <small>3 次并行搜索 · 2m 16s</small>
          </div>
        </li>
        <li className="is-complete">
          <span />
          <div>
            <strong>汇总结论并生成回答</strong>
            <small>完成 · 6m 24s</small>
          </div>
        </li>
      </ol>
    </div>
  );
}

function AutomationPanel(): React.ReactElement {
  return (
    <div className="wufan-side-panel__body">
      <button type="button" className="wufan-panel-primary-action">
        新建自动化任务
      </button>
      <div className="wufan-side-panel__section-title">任务列表</div>
      <div className="wufan-panel-list">
        <button type="button" className="wufan-panel-row">
          <span className="wufan-panel-row__glyph is-violet">
            <PanelIcon type="automation" size={15} />
          </span>
          <span className="wufan-panel-row__copy">
            <strong>每周客户洞察摘要</strong>
            <small>每周一 09:00 · 正常</small>
          </span>
        </button>
        <button type="button" className="wufan-panel-row">
          <span className="wufan-panel-row__glyph is-violet">
            <PanelIcon type="automation" size={15} />
          </span>
          <span className="wufan-panel-row__copy">
            <strong>竞品变更提醒</strong>
            <small>事件触发 · 最近执行成功</small>
          </span>
        </button>
      </div>
    </div>
  );
}

const TITLES: Record<Exclude<WufanRightPanelType, 'none'>, string> = {
  workspace: '工作室',
  execution: '执行链',
  automation: '自动化',
};

export const WufanRightPanel = memo(function WufanRightPanel({
  type,
  open,
  onClose,
  workspaceFiles,
}: {
  type: Exclude<WufanRightPanelType, 'none'>;
  open: boolean;
  onClose: () => void;
  workspaceFiles?: WufanWorkspaceFilesProps;
}): React.ReactElement {
  const [maximized, setMaximized] = useState(false);
  useEffect(() => {
    if (type !== 'workspace') setMaximized(false);
  }, [type]);
  return (
    <aside
      className="wufan-right-panel-region"
      data-open={open ? 'true' : 'false'}
      data-panel={type}
      data-maximized={type === 'workspace' && maximized ? 'true' : 'false'}
      aria-hidden={!open}
    >
      {type === 'workspace' ? (
        <WufanWorkspaceStudio
          {...workspaceFiles}
          expanded={maximized}
          onToggleExpanded={() => setMaximized((current) => !current)}
          onClose={() => {
            setMaximized(false);
            onClose();
          }}
        />
      ) : (
        <div className="wufan-side-panel">
          <header className="wufan-side-panel__header">
            <div>
              <PanelIcon type={type} />
              <strong>{TITLES[type]}</strong>
              {type === 'execution' ? <span className="wufan-panel-status-dot" /> : null}
            </div>
            <div>
              {type === 'execution' ? (
                <>
                  <button type="button" aria-label="复制诊断 ID" title="复制诊断 ID">
                    <PanelIcon type="copy" size={16} />
                  </button>
                  <button type="button" aria-label="导出执行链" title="导出执行链">
                    <PanelIcon type="download" size={16} />
                  </button>
                </>
              ) : null}
              <button
                type="button"
                aria-label={`关闭${TITLES[type]}`}
                title={`关闭${TITLES[type]}`}
                onClick={onClose}
              >
                <PanelIcon type="close" size={16} />
              </button>
            </div>
          </header>
          {type === 'execution' ? <ExecutionPanel /> : null}
          {type === 'automation' ? <AutomationPanel /> : null}
        </div>
      )}
    </aside>
  );
});
