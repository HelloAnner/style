import { memo, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { RuntimeErrorDiagnostics } from '../../conversation/model/runtimeTypes';

interface AssistantErrorDetailsProps {
  code?: string;
  origin?: string;
  category?: string;
  stepId?: string;
  diagnostics?: RuntimeErrorDiagnostics;
}

function detailRows({
  code,
  origin,
  category,
  stepId,
  diagnostics,
}: AssistantErrorDetailsProps): Array<[string, string]> {
  const rows: Array<[string, string]> = [];
  const add = (label: string, value: unknown) => {
    if (typeof value !== 'string' && typeof value !== 'number') return;
    const text = String(value).trim();
    if (text) rows.push([label, text]);
  };
  add('错误码', code);
  add('来源', origin);
  add('分类', category);
  add('触发位置', stepId);
  add('模型服务', diagnostics?.provider);
  add('模型', diagnostics?.model);
  add('来源组件', diagnostics?.source_component);
  add('来源类型', diagnostics?.source_error_type);
  add('异常类型', diagnostics?.source_exception_class);
  add('迭代轮次', diagnostics?.iteration_num);
  add('原始错误摘要', diagnostics?.raw_message_preview);
  return rows;
}

export const AssistantErrorDetails = memo(function AssistantErrorDetails(props: AssistantErrorDetailsProps) {
  const [expanded, setExpanded] = useState(false);
  const rows = useMemo(() => detailRows(props), [props]);
  if (rows.length === 0) return null;

  return (
    <div
      data-testid="assistant-error-details"
      style={{
        marginTop: 8,
        border: '1px solid var(--border-subtle)',
        borderRadius: 8,
        background: 'var(--bg-secondary)',
        color: 'var(--text-secondary)',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded(value => !value)}
        aria-expanded={expanded}
        style={{
          width: '100%',
          minHeight: 36,
          padding: '8px 12px',
          border: 'none',
          background: 'transparent',
          color: 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          cursor: 'pointer',
          fontSize: 13,
          lineHeight: '20px',
          fontWeight: 500,
        }}
      >
        <span>错误详情</span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          style={{
            color: 'var(--text-muted)',
            transform: expanded ? 'rotate(180deg)' : undefined,
            transition: 'transform 0.15s ease',
            flex: '0 0 auto',
          }}
        />
      </button>
      {expanded && (
        <div
          style={{
            borderTop: '1px solid var(--border-subtle)',
            padding: '10px 12px 12px',
          }}
        >
          <dl
            style={{
              margin: 0,
              display: 'grid',
              gridTemplateColumns: 'max-content minmax(0, 1fr)',
              columnGap: 12,
              rowGap: 6,
              fontSize: 12,
              lineHeight: '18px',
            }}
          >
            {rows.map(([label, value]) => (
              <div key={label} style={{ display: 'contents' }}>
                <dt style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{label}</dt>
                <dd
                  style={{
                    margin: 0,
                    minWidth: 0,
                    color: 'var(--text-secondary)',
                    overflowWrap: 'anywhere',
                    fontFamily: label.includes('错误') || label.includes('类型') || label.includes('模型')
                      ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
                      : undefined,
                  }}
                >
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          <p
            style={{
              margin: '10px 0 0',
              color: 'var(--text-muted)',
              fontSize: 12,
              lineHeight: '18px',
            }}
          >
            请联系系统管理员以进一步排查。
          </p>
        </div>
      )}
    </div>
  );
});
