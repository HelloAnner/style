import { memo, useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Check, ChevronDown, ChevronUp, ExternalLink, X } from 'lucide-react';
import { track } from '../../utils/track';
import type { AnswerSource } from '../../types';

interface AnswerSourcesDrawerProps {
  sources: AnswerSource[];
  onClose: () => void;
  traceId?: string;
}

const sectionStyle: CSSProperties = {
  background: 'var(--bg-secondary)',
  borderRadius: 6,
  padding: 8,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const DRAWER_WIDTH = 400;

const lineClamp = (lines: number): CSSProperties => ({
  display: '-webkit-box',
  WebkitLineClamp: lines,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
});

function hostFromUrl(url?: string): string {
  if (!url) return '';
  try {
    const host = new URL(url).host;
    return host.startsWith('www.') ? host.slice(4) : host;
  } catch {
    return url;
  }
}

function knowledgeTitle(sources: AnswerSource[]): string {
  return sources.some(source => source.provider === 'MOSS')
    ? 'Moss商业智能库'
    : '数据来源';
}

export const AnswerSourcesDrawer = memo(function AnswerSourcesDrawer({
  sources,
  onClose,
  traceId,
}: AnswerSourcesDrawerProps) {
  const grouped = useMemo(() => ({
    knowledge: sources.filter(source => source.type === 'knowledge'),
    web: sources.filter(source => source.type === 'web'),
  }), [sources]);

  useEffect(() => {
    track('info_source', { trace_id: traceId ?? undefined });
  }, [traceId]);

  return (
    <>
      <button
        type="button"
        aria-label="关闭信息来源"
        onClick={onClose}
        data-testid="answer-sources-backdrop"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: DRAWER_WIDTH,
          bottom: 0,
          zIndex: 29,
          padding: 0,
          border: 'none',
          cursor: 'default',
          background: 'linear-gradient(90deg, color-mix(in srgb, var(--bg-primary) 16%, transparent) 0%, color-mix(in srgb, var(--bg-primary) 68%, transparent) 72%, color-mix(in srgb, var(--bg-primary) 94%, transparent) 100%)',
        }}
      />
      <aside
        role="dialog"
        aria-modal="false"
        aria-label="信息来源"
        data-testid="answer-sources-drawer"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 30,
          width: DRAWER_WIDTH,
          maxWidth: '100%',
          background: 'var(--bg-primary)',
          boxShadow: '-18px 0 36px color-mix(in srgb, var(--text-primary) 7%, transparent)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <header style={{
          height: 58,
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ fontSize: 16, lineHeight: '24px', fontWeight: 600, color: 'var(--text-primary)' }}>
            信息来源
          </div>
          <button
            onClick={onClose}
            title="关闭"
            data-testid="answer-sources-close"
            style={{
              width: 28,
              height: 28,
              borderRadius: 4,
              border: 'none',
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>
        </header>
        <div data-testid="answer-sources-content" style={{ overflowY: 'auto', padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {grouped.knowledge.length > 0 && (
            <SourceSection title={knowledgeTitle(grouped.knowledge)} sectionTestId="answer-sources-knowledge">
              {grouped.knowledge.map(source => <KnowledgeItem key={source.source_id} source={source} />)}
            </SourceSection>
          )}
          {grouped.web.length > 0 && (
            <SourceSection title="外部来源" collapsible sectionTestId="answer-sources-web">
              {grouped.web.map((source, index) => (
                <WebItem key={source.source_id} source={source} index={index + 1} />
              ))}
            </SourceSection>
          )}
        </div>
      </aside>
    </>
  );
});

function SourceSection({
  title,
  collapsible = false,
  sectionTestId,
  children,
}: {
  title: string;
  collapsible?: boolean;
  sectionTestId?: string;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(true);
  const contentVisible = !collapsible || expanded;
  const headerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minHeight: 22,
    color: 'var(--text-primary)',
    fontSize: 14,
    lineHeight: '22px',
    fontWeight: 600,
  };
  const titleNode = (
    <>
      <span style={{
        width: 2,
        height: 14,
        borderRadius: 1,
        background: 'var(--text-tertiary)',
        flexShrink: 0,
      }} />
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {title}
      </span>
      {collapsible && (
        expanded
          ? <ChevronUp size={16} color="var(--text-muted)" />
          : <ChevronDown size={16} color="var(--text-muted)" />
      )}
    </>
  );

  return (
    <section className="answer-sources-section" style={sectionStyle} data-testid={sectionTestId}>
      {collapsible ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded(current => !current)}
          className="answer-sources-section-toggle"
          data-testid={sectionTestId ? `${sectionTestId}-toggle` : undefined}
          style={{
            ...headerStyle,
            width: '100%',
            padding: 0,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          {titleNode}
        </button>
      ) : (
        <div style={headerStyle}>{titleNode}</div>
      )}
      {contentVisible && (
        <div
          className="answer-sources-section-items"
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
          data-testid={sectionTestId ? `${sectionTestId}-items` : undefined}
        >
          {children}
        </div>
      )}
    </section>
  );
}

function KnowledgeItem({ source }: { source: AnswerSource }) {
  return (
    <div className="answer-source-knowledge" data-testid={`answer-source-knowledge-${source.source_id}`} style={{
      minHeight: 38,
      padding: 8,
      borderRadius: 6,
      background: 'var(--bg-primary)',
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      color: 'var(--text-primary)',
      fontSize: 14,
      lineHeight: '22px',
    }}>
      <span style={{
        width: 16,
        height: 16,
        borderRadius: '50%',
        background: 'var(--text-tertiary)',
        color: 'var(--bg-primary)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Check size={10} strokeWidth={3} />
      </span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{source.title}</span>
    </div>
  );
}

function WebItem({ source, index }: { source: AnswerSource; index: number }) {
  const host = source.site_name || hostFromUrl(source.url) || source.provider || '网页来源';
  const content = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 20, minWidth: 0 }}>
        <span style={{
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: 'var(--hover-bg)',
          color: 'var(--text-tertiary)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          lineHeight: '16px',
          flexShrink: 0,
        }}>{index}</span>
        <span style={{
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: 'var(--accent-bg)',
          color: 'var(--accent-color)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <ExternalLink size={10} />
        </span>
        <span style={{
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          color: 'var(--text-tertiary)',
          fontSize: 12,
          lineHeight: '20px',
        }}>{host}</span>
      </div>
      <div style={{
        marginTop: 4,
        color: 'var(--text-secondary)',
        fontSize: 14,
        lineHeight: '22px',
        fontWeight: 600,
        ...lineClamp(2),
      }}>{source.title}</div>
      {source.snippet && (
        <div style={{
          marginTop: 4,
          color: 'var(--text-tertiary)',
          fontSize: 12,
          lineHeight: '20px',
          ...lineClamp(2),
        }}>{source.snippet}</div>
      )}
    </>
  );
  const style: CSSProperties = {
    display: 'block',
    padding: 8,
    borderRadius: 6,
    background: 'var(--bg-primary)',
    textDecoration: 'none',
    color: 'inherit',
  };
  return source.url
    ? <a className="answer-source-web" href={source.url} target="_blank" rel="noreferrer" style={style} data-testid={`answer-source-web-${source.source_id}`}>{content}</a>
    : <div className="answer-source-web" style={style} data-testid={`answer-source-web-${source.source_id}`}>{content}</div>;
}
