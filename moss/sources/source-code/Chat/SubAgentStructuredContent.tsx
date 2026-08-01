import { Fragment } from 'react';
import { MarkdownContent } from './MarkdownContent';

const MAX_VISIBLE_ITEMS = 24;
const MAX_DEPTH = 5;

const FIELD_LABELS: Record<string, string> = {
  time_window: '时间范围',
  start: '开始时间',
  end: '结束时间',
  events: '关键事件',
  response_options: '可选动作',
  rating: '评级',
  level: '等级',
  confidence: '置信度',
  confidence_score: '置信分数',
  signals: '关键信号',
  controls: '控制措施',
  documents: '文档',
  findings_by_clause: '分条发现',
  deliverables: '交付内容',
  details: '说明',
  conclusion: '结论',
  facts: '事实',
  recommendations: '建议',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function fieldLabel(key: string): string {
  const known = FIELD_LABELS[key];
  if (known) return known;
  const spaced = key
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  return spaced || key;
}

function rawJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/** 内部交互字段：归档指针不对用户展示，归档本体也已从「我的文件」隐藏。 */
const HIDDEN_DATA_KEYS = new Set(['result_archive_file', 'result_archive_file_id', 'result_archive_format']);
const ARCHIVE_PLACEHOLDER_DETAILS = '完整结构化结果见归档文件。';

function isHiddenEntry(key: string, value: unknown): boolean {
  if (HIDDEN_DATA_KEYS.has(key)) return true;
  return key === 'details' && value === ARCHIVE_PLACEHOLDER_DETAILS;
}

function PrimitiveValue({ value }: { value: unknown }) {
  if (value == null) return <span className="subagent-structured-empty">暂无</span>;
  if (typeof value === 'boolean') return <span>{value ? '是' : '否'}</span>;
  if (typeof value === 'number') return <span className="subagent-structured-number">{value}</span>;
  return (
    <div className="subagent-structured-markdown">
      <MarkdownContent content={String(value)} />
    </div>
  );
}

function StructuredNode({
  value,
  depth,
}: {
  value: unknown;
  depth: number;
}) {
  if (!isRecord(value) && !Array.isArray(value)) {
    return <PrimitiveValue value={value} />;
  }
  if (depth >= MAX_DEPTH) {
    return <pre className="subagent-report-json">{rawJson(value)}</pre>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="subagent-structured-empty">暂无</span>;
    const visible = value.slice(0, MAX_VISIBLE_ITEMS);
    const allPrimitive = visible.every((item) => !isRecord(item) && !Array.isArray(item));
    return (
      <div className={allPrimitive ? 'subagent-structured-list' : 'subagent-structured-records'}>
        {visible.map((item, index) => (
          allPrimitive ? (
            <div className="subagent-structured-list-item" key={`${index}:${String(item)}`}>
              <span className="subagent-structured-bullet" aria-hidden="true" />
              <PrimitiveValue value={item} />
            </div>
          ) : (
            <section className="subagent-structured-record" key={index}>
              <div className="subagent-structured-record-index">第 {index + 1} 项</div>
              <StructuredNode value={item} depth={depth + 1} />
            </section>
          )
        ))}
        {value.length > visible.length && (
          <div className="subagent-structured-more">
            另有 {value.length - visible.length} 项，可在原始 JSON 中查看
          </div>
        )}
      </div>
    );
  }

  const entries = Object.entries(value).filter(([key, item]) => !isHiddenEntry(key, item));
  if (entries.length === 0) return <span className="subagent-structured-empty">暂无</span>;
  return (
    <div className="subagent-structured-object">
      {entries.slice(0, MAX_VISIBLE_ITEMS).map(([key, item]) => {
        const complex = isRecord(item) || Array.isArray(item);
        return (
          <Fragment key={key}>
            {complex ? (
              <section className="subagent-structured-group">
                <h4>{fieldLabel(key)}</h4>
                <StructuredNode value={item} depth={depth + 1} />
              </section>
            ) : (
              <div className="subagent-structured-field">
                <div className="subagent-structured-key">{fieldLabel(key)}</div>
                <div className="subagent-structured-value">
                  <PrimitiveValue value={item} />
                </div>
              </div>
            )}
          </Fragment>
        );
      })}
      {entries.length > MAX_VISIBLE_ITEMS && (
        <div className="subagent-structured-more">
          另有 {entries.length - MAX_VISIBLE_ITEMS} 个字段，可在原始 JSON 中查看
        </div>
      )}
    </div>
  );
}

export function RawJsonDetails({ value }: { value: unknown }) {
  return (
    <details className="subagent-raw-json">
      <summary>查看原始 JSON</summary>
      <pre className="subagent-report-json">{rawJson(value)}</pre>
    </details>
  );
}

export function SubAgentStructuredContent({ value }: { value: Record<string, unknown> }) {
  return (
    <div className="subagent-structured-content">
      <StructuredNode value={value} depth={0} />
      <RawJsonDetails value={value} />
    </div>
  );
}

function confidenceLabel(value: unknown): string | undefined {
  if (value === 'high') return '高置信';
  if (value === 'medium') return '中置信';
  if (value === 'low') return '低置信';
  return typeof value === 'string' && value ? value : undefined;
}

export function SubAgentEvidenceList({ items }: { items: Array<Record<string, unknown>> }) {
  return (
    <div className="subagent-evidence-list">
      {items.map((item, index) => {
        const claim = typeof item.claim === 'string' ? item.claim : '';
        const source = typeof item.source === 'string' ? item.source : '';
        const sourceRef = typeof item.source_ref === 'string' ? item.source_ref : '';
        const confidence = confidenceLabel(item.confidence);
        const extra = Object.fromEntries(
          Object.entries(item).filter(([key]) => ![
            'claim', 'source', 'source_ref', 'confidence',
          ].includes(key)),
        );
        return (
          <article className="subagent-evidence-item" key={`${index}:${claim}:${sourceRef}`}>
            <div className="subagent-evidence-heading">
              <span>证据 {index + 1}</span>
              {confidence && <span className="subagent-confidence">{confidence}</span>}
            </div>
            {claim && <div className="subagent-evidence-claim"><MarkdownContent content={claim} /></div>}
            {(source || sourceRef) && (
              <div className="subagent-evidence-source">
                {source && <span>{source}</span>}
                {sourceRef && /^https?:\/\//i.test(sourceRef) ? (
                  <a href={sourceRef} target="_blank" rel="noreferrer">查看来源</a>
                ) : sourceRef ? <span>{sourceRef}</span> : null}
              </div>
            )}
            {Object.keys(extra).length > 0 && <StructuredNode value={extra} depth={1} />}
          </article>
        );
      })}
    </div>
  );
}

export function SubAgentLimitationList({
  items,
}: {
  items: Array<Record<string, unknown> | string>;
}) {
  return (
    <div className="subagent-limitation-list">
      {items.map((item, index) => {
        if (typeof item === 'string') {
          return <div className="subagent-limitation-item" key={`${index}:${item}`}>{item}</div>;
        }
        const code = typeof item.code === 'string' ? item.code : '';
        const message = typeof item.message === 'string' ? item.message : '';
        const extra = Object.fromEntries(
          Object.entries(item).filter(([key]) => !['code', 'message'].includes(key)),
        );
        return (
          <div className="subagent-limitation-item" key={`${index}:${code}:${message}`}>
            {code && <div className="subagent-limitation-code">{code}</div>}
            {message && <div>{message}</div>}
            {Object.keys(extra).length > 0 && <StructuredNode value={extra} depth={1} />}
          </div>
        );
      })}
    </div>
  );
}
