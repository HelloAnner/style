import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchShowcaseList,
  recordShowcaseClick,
  showcaseCoverUrl,
  type ShowcaseAgentTab,
  type ShowcasePublicItem,
} from '../../api/showcase';

// ─── 渐变色兜底（无封面图时按 agent 分配）────────────────────────────────

const GRADIENT_PRESETS = [
  'linear-gradient(135deg, #3f3f46 0%, #52525b 100%)',
  'linear-gradient(135deg, #18181b 0%, #3f3f46 100%)',
  'linear-gradient(135deg, #2557d6 0%, #1f4bb8 100%)',
  'linear-gradient(135deg, #0f766e 0%, #115e59 100%)',
  'linear-gradient(135deg, #52525b 0%, #71717a 100%)',
  'linear-gradient(135deg, #1f4bb8 0%, #3b6eea 100%)',
];

function agentGradient(agentId: string): string {
  let hash = 0;
  for (let i = 0; i < agentId.length; i++) hash = (hash * 31 + agentId.charCodeAt(i)) | 0;
  return GRADIENT_PRESETS[Math.abs(hash) % GRADIENT_PRESETS.length];
}

// ─── 全局 CSS ──────────────────────────────────────────────────────────────
// 导航栏直接复用 index.html 的 class 名和样式（含 V2 warm refresh override）

const GLOBAL_CSS = `
@keyframes spin { to { transform: rotate(360deg) } }
@keyframes heroFadeUp {
  from { opacity: 0; transform: translateY(18px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes cardFadeIn {
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ── index.html 根变量（V2 warm palette）── */
.showcase-page {
  --parchment: #18181b;
  --parchment2: #3f3f46;
  --gold: #2557d6;
  --gold-light: #3b6eea;
  --gold-dim: #1f4bb8;
  --text-main: #18181b;
  --text-sub: #52525b;
  --text-dim: #71717a;
  --border: #e4e4e7;
  --border-soft: #efeff1;
  --glass-bg: rgba(255, 255, 255, 0.86);
  --glass-border: rgba(228, 228, 231, 0.95);
  --radius-card: 12px;
  --radius-sm: 6px;
  --radius-btn: 8px;
  --hover-lift: translateY(-3px);

  min-height: 100vh;
  font-family: "Noto Sans SC","Inter","PingFang SC","Microsoft YaHei",-apple-system,BlinkMacSystemFont,sans-serif;
  background:
    linear-gradient(90deg, rgba(228,228,231,0.46) 1px, transparent 1px) 0 0 / 96px 96px,
    linear-gradient(180deg, rgba(228,228,231,0.36) 1px, transparent 1px) 0 0 / 96px 96px,
    #faf9f7;
  color: var(--text-main);
  line-height: 1.7;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}

/* ── NAV（精确复制 index.html 渲染值，用 !important 覆盖全局 reset）── */
.showcase-page .nav,
.showcase-page .nav *,
.showcase-page .nav *::before,
.showcase-page .nav *::after {
  box-sizing: content-box !important;
}
.showcase-page .nav {
  position: fixed; top: 0; left: 0; right: 0; z-index: 1000;
  padding: 0 3rem; height: 68px;
  display: flex; align-items: center; justify-content: space-between;
  background: rgba(250, 249, 247, 0.9);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
  box-shadow: 0 1px 0 rgba(24, 24, 27, 0.04);
  transition: background 0.4s, box-shadow 0.4s, border-color 0.4s;
}
.showcase-page .nav.scrolled {
  background: rgba(255, 255, 255, 0.94);
  border-bottom-color: var(--border);
  box-shadow: 0 8px 24px rgba(24, 24, 27, 0.06);
}
.showcase-page .nav-logo {
  font-family: "Noto Sans SC",sans-serif;
  font-size: 1.25rem; font-weight: 700;
  color: var(--parchment); letter-spacing: 0.08em;
  text-decoration: none;
}
.showcase-page .nav-logo em {
  font-style: normal; color: var(--parchment);
}
.showcase-page .nav-links {
  display: flex; gap: 2.5rem; list-style: none;
  margin: 16px 0 !important; padding: 0 0 0 40px !important;
}
.showcase-page .nav-links a {
  font-size: 0.875rem; font-weight: 400; color: var(--text-sub);
  text-decoration: none; letter-spacing: 0.04em; transition: color 0.25s;
  border: none !important;
}
.showcase-page .nav-links a:hover { color: var(--parchment); }
.showcase-page .nav-links a.active { color: var(--parchment); }
.showcase-page .nav-auth {
  display: flex; align-items: center; gap: 0.75rem;
}
.showcase-page .nav-login {
  font-size: 0.84rem; font-weight: 400; color: var(--text-sub);
  text-decoration: none; letter-spacing: 0.04em;
  padding: 0.45rem 0; width: 72px; text-align: center;
  border: 1px solid var(--border); border-radius: var(--radius-btn);
  background: #ffffff;
  transition: color 0.3s, border-color 0.3s, background 0.3s;
}
.showcase-page .nav-login:hover {
  color: var(--parchment); border-color: #d4d4d8; background: #f4f4f5;
}
.showcase-page .nav-register {
  font-size: 0.84rem; font-weight: 600; color: #fff;
  background: #18181b;
  padding: 0.45rem 0; width: 90px; text-align: center;
  border-radius: var(--radius-btn); text-decoration: none;
  letter-spacing: 0.06em; border: 1px solid #18181b;
  box-shadow: 0 10px 24px rgba(24, 24, 27, 0.16);
  transition: background 0.2s, box-shadow 0.2s;
}
.showcase-page .nav-register:hover {
  background: #000000;
  box-shadow: 0 14px 30px rgba(24, 24, 27, 0.2);
}

/* ── HERO ── */
.showcase-hero {
  position: relative; padding-top: 120px; padding-bottom: 36px;
  text-align: center; overflow: hidden;
  background:
    radial-gradient(ellipse 58% 42% at 50% 44%, rgba(37, 87, 214, 0.08), transparent 72%),
    linear-gradient(180deg, #ffffff 0%, #faf9f7 100%);
}
.showcase-hero-content { position: relative; z-index: 10; }
.showcase-hero-eyebrow {
  display: inline-flex; align-items: center; gap: 0.55rem;
  font-family: "Inter","Noto Sans SC",sans-serif;
  font-size: 0.72rem; font-weight: 600;
  letter-spacing: 0.28em; text-transform: uppercase;
  color: var(--gold);
  border: 1px solid #dbe4ff;
  background: #f3f6ff;
  padding: 0.35rem 1rem; border-radius: 100px;
  margin-bottom: 2.2rem;
  opacity: 0; animation: heroFadeUp 0.8s cubic-bezier(0.22,1,0.36,1) 0.2s forwards;
}
.showcase-hero-eyebrow-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: #0f766e;
  box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.12);
}
.showcase-hero-title {
  font-family: "Noto Sans SC",sans-serif;
  font-weight: 900; font-size: clamp(2.4rem,5vw,3.6rem);
  line-height: 1.15; letter-spacing: -0.01em;
  color: var(--parchment); margin-bottom: 1.2rem;
  opacity: 0; animation: heroFadeUp 0.9s cubic-bezier(0.16,1,0.3,1) 0.5s forwards;
}
.showcase-hero-sub {
  font-size: 1.1rem; color: var(--text-sub);
  letter-spacing: 0.06em; font-weight: 300; line-height: 1.6;
  opacity: 0; animation: heroFadeUp 0.8s cubic-bezier(0.22,1,0.36,1) 0.8s forwards;
}
.showcase-hero-divider {
  width: 32px; height: 1px; background: rgba(24, 24, 27, 0.18);
  margin: 26px auto 0;
}

/* ── TAB BAR ── */
.showcase-tab-bar {
  position: sticky; top: 68px; z-index: 99;
  background: rgba(250, 249, 247, 0.88);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
  box-shadow: 0 1px 0 rgba(24, 24, 27, 0.04);
}
.showcase-tab-bar-inner {
  max-width: 1200px; margin: 0 auto;
  display: flex; justify-content: center; gap: 10px;
  padding: 16px 2rem; overflow-x: auto; flex-wrap: wrap;
}
.showcase-tab-btn {
  padding: 8px 22px; font-size: 0.84rem; cursor: pointer;
  border: 1px solid var(--border);
  border-radius: 100px; white-space: nowrap;
  background: rgba(255,255,255,0.92);
  color: var(--text-sub); font-weight: 400;
  font-family: inherit; letter-spacing: 0.02em;
  transition: all 0.22s;
}
.showcase-tab-btn:hover {
  border-color: #d4d4d8;
  background: #ffffff;
  color: var(--parchment);
}
.showcase-tab-btn.active {
  border-color: #18181b;
  background: #18181b;
  color: #fff; font-weight: 500;
  box-shadow: 0 4px 14px rgba(24, 24, 27, 0.14);
}

/* ── CARD GRID ── */
.showcase-grid-section {
  padding: 48px 2rem 80px;
}
.showcase-grid {
  max-width: 1200px; margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 26px;
}

/* ── CARD ── */
.showcase-card {
  background: rgba(255,255,255,0.92);
  border-radius: var(--radius-card);
  overflow: hidden; cursor: pointer;
  border: 1px solid var(--border);
  display: flex; flex-direction: column;
  box-shadow: 0 1px 2px rgba(24, 24, 27, 0.04), 0 10px 28px rgba(24, 24, 27, 0.06);
  transition: transform 0.3s cubic-bezier(0.4,0,0.2,1), box-shadow 0.3s, border-color 0.3s;
}
.showcase-card:hover {
  transform: var(--hover-lift);
  border-color: #d4d4d8;
  box-shadow: 0 1px 2px rgba(24, 24, 27, 0.04), 0 16px 34px rgba(24, 24, 27, 0.08);
}
.showcase-card-cover {
  height: 180px; flex-shrink: 0; position: relative; overflow: hidden;
}
.showcase-card-cover img {
  position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;
  transition: transform 0.4s;
}
.showcase-card:hover .showcase-card-cover img {
  transform: scale(1.04);
}
.showcase-card-cover-placeholder {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
}
.showcase-card-cover-placeholder::after {
  content: "";
  position: absolute; inset: 0;
  background: radial-gradient(circle at 78% 28%, rgba(255,255,255,0.2) 0%, transparent 55%);
}
.showcase-card-cover-watermark {
  position: absolute; bottom: 14px; right: 16px;
  font-size: 10px; letter-spacing: 0.14em; font-weight: 500;
  color: rgba(255, 255, 255, 0.28); z-index: 1;
}
.showcase-card-body {
  padding: 20px 22px 22px; flex: 1;
  display: flex; flex-direction: column;
}
.showcase-card-title {
  font-size: 0.95rem; font-weight: 600; color: var(--parchment);
  line-height: 1.5; margin-bottom: 8px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.showcase-card-desc {
  font-size: 0.8rem; color: var(--text-sub); line-height: 1.7;
  flex: 1; margin-bottom: 16px;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden;
}
.showcase-card-footer {
  display: flex; align-items: center; justify-content: space-between; margin-top: auto;
}
.showcase-card-agent-tag {
  font-size: 0.68rem; padding: 3px 10px; border-radius: 20px;
  border: 1px solid var(--border); color: var(--text-sub);
  letter-spacing: 0.02em;
}
.showcase-card-action {
  font-size: 0.8rem; font-weight: 500; color: var(--gold);
  display: flex; align-items: center; gap: 4px;
  transition: gap 0.2s;
}
.showcase-card:hover .showcase-card-action { gap: 8px; }

/* ── LOAD MORE ── */
.showcase-load-more {
  text-align: center; margin-top: 40px;
}
.showcase-load-more-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 10px 32px; border-radius: 20px;
  border: 1px solid var(--border);
  background: rgba(255,255,255,0.8); color: var(--text-secondary);
  font-size: 0.88rem; cursor: pointer;
  transition: all 0.2s ease;
}
.showcase-load-more-btn:hover {
  background: #fff; border-color: #d4d4d8;
  box-shadow: 0 2px 8px rgba(24,24,27,0.06);
}

/* ── CTA FOOTER ── */
.showcase-cta {
  background: #1A1A1A;
  padding: 60px 3rem; text-align: center;
}
.showcase-cta-title {
  font-size: clamp(1.4rem,3vw,1.6rem); font-weight: 700;
  color: #fff; margin-bottom: 1.6rem; letter-spacing: -0.02em; line-height: 1.5;
}
.showcase-cta-btn {
  display: inline-block; padding: 13px 32px;
  background: var(--gold);
  color: #fff; border: none; border-radius: 9px;
  font-size: 0.88rem; font-weight: 500; cursor: pointer;
  text-decoration: none; letter-spacing: 0.02em;
  font-family: inherit;
  transition: opacity 0.15s;
}
.showcase-cta-btn:hover {
  background: var(--gold-light);
  box-shadow: 0 6px 20px rgba(37, 87, 214, 0.35);
  transform: translateY(-1px);
}

/* ── EMPTY STATE ── */
.showcase-empty {
  text-align: center; padding: 100px 2rem;
  color: var(--text-dim);
}
.showcase-empty-icon {
  width: 64px; height: 64px; margin: 0 auto 20px;
  border-radius: 50%;
  background: rgba(37, 87, 214, 0.04);
  display: flex; align-items: center; justify-content: center;
  color: var(--text-dim);
}
.showcase-loading {
  text-align: center; padding: 100px 2rem;
  color: var(--text-dim); font-size: 0.88rem;
}

/* ── DRAWER ── */
.showcase-drawer-mask {
  position: fixed; inset: 0; z-index: 1500;
  background: rgba(24, 24, 27, 0.35);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  animation: heroFadeUp 0.2s ease-out;
}
.showcase-drawer {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 1600;
  height: 88vh; background: #fff;
  border-radius: 20px 20px 0 0;
  display: flex; flex-direction: column;
  box-shadow: 0 -12px 48px rgba(24, 24, 27, 0.12);
  animation: drawerSlideUp 0.35s cubic-bezier(0.16,1,0.3,1);
}
@keyframes drawerSlideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
.showcase-drawer-handle {
  width: 40px; height: 4px; border-radius: 2px;
  background: rgba(24, 24, 27, 0.1); margin: 10px auto 0; flex-shrink: 0;
}
.showcase-drawer-header {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 28px; border-bottom: 1px solid var(--border-soft); flex-shrink: 0;
}
.showcase-drawer-title {
  font-size: 0.95rem; font-weight: 600; color: var(--parchment);
  flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.showcase-drawer-badge {
  font-size: 0.68rem; padding: 3px 10px; border-radius: 20px;
  border: 1px solid var(--border); color: var(--text-sub);
  white-space: nowrap; flex-shrink: 0;
}
.showcase-drawer-open-btn {
  padding: 6px 14px; border-radius: 7px; font-size: 0.75rem; font-weight: 500;
  background: transparent; border: 1px solid var(--border);
  color: var(--text-sub); cursor: pointer; text-decoration: none;
  display: flex; align-items: center; gap: 5px; flex-shrink: 0;
  transition: border-color 0.2s, color 0.2s;
}
.showcase-drawer-open-btn:hover {
  border-color: #d4d4d8; color: var(--parchment);
}
.showcase-drawer-close-btn {
  width: 32px; height: 32px; border-radius: 50%;
  border: 1px solid var(--border); background: transparent;
  cursor: pointer; color: var(--text-sub); font-size: 18px;
  display: flex; align-items: center; justify-content: center;
  line-height: 1; flex-shrink: 0;
  transition: border-color 0.2s, color 0.2s, background 0.2s;
}
.showcase-drawer-close-btn:hover {
  border-color: #d4d4d8; color: var(--parchment);
  background: #f4f4f5;
}
.showcase-drawer-loading {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 12px;
  background: #faf9f7; color: var(--text-dim); font-size: 0.88rem;
}
.showcase-drawer-spinner {
  width: 28px; height: 28px;
  border: 2px solid rgba(24, 24, 27, 0.1);
  border-top-color: var(--parchment);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
`;

// ─── Drawer 组件 ──────────────────────────────────────────────────────────

function ShowcaseDrawer({
  item,
  agentName,
  onClose,
}: {
  item: ShowcasePublicItem;
  agentName: string;
  onClose: () => void;
}) {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [linkInvalid, setLinkInvalid] = useState(false);
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const shareUrl = item.shareToken ? `/share/${item.shareToken}` : item.shareUrl;

  const handleIframeLoad = useCallback(() => {
    setIframeLoaded(true);
    try {
      const loc = iframeRef.current?.contentWindow?.location;
      if (loc && loc.pathname && !loc.pathname.startsWith('/share/')) {
        setLinkInvalid(true);
      }
    } catch {
      // cross-origin — can't check, leave as-is
    }
  }, []);

  return (
    <>
      <div className="showcase-drawer-mask" onClick={onClose} />
      <div className="showcase-drawer">
        <div className="showcase-drawer-handle" />
        <div className="showcase-drawer-header">
          <div className="showcase-drawer-title">{item.title}</div>
          <span className="showcase-drawer-badge">{agentName}</span>
          <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="showcase-drawer-open-btn">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            新标签页打开
          </a>
          <button type="button" onClick={onClose} className="showcase-drawer-close-btn">×</button>
        </div>
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {!iframeLoaded && !linkInvalid && (
            <div className="showcase-drawer-loading">
              <div className="showcase-drawer-spinner" />
              <span>加载中...</span>
            </div>
          )}
          {linkInvalid ? (
            <div className="showcase-drawer-loading">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <span>该案例链接已失效</span>
            </div>
          ) : (
            <iframe
              ref={iframeRef}
              src={shareUrl}
              title={item.title}
              onLoad={handleIframeLoad}
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
            />
          )}
        </div>
      </div>
    </>
  );
}

// ─── 卡片组件 ─────────────────────────────────────────────────────────────

function ShowcaseCard({
  item,
  agentName,
  onClick,
  animIndex,
}: {
  item: ShowcasePublicItem;
  agentName: string;
  onClick: () => void;
  animIndex?: number;
}) {
  const hasCover = !!item.coverImageKey;
  const animStyle = animIndex != null
    ? { opacity: 0, animation: `cardFadeIn 0.5s cubic-bezier(0.22,1,0.36,1) ${animIndex * 60}ms forwards` } as React.CSSProperties
    : undefined;
  return (
    <div className="showcase-card" onClick={onClick} style={animStyle} data-testid={`showcase-card-${item.id}`}>
      <div
        className="showcase-card-cover"
        style={{ background: hasCover ? '#18181b' : agentGradient(item.agentId) }}
      >
        {hasCover ? (
          <img
            src={showcaseCoverUrl(item.coverImageKey!)}
            alt={item.title}
            loading="lazy"
          />
        ) : (
          <>
            <div className="showcase-card-cover-placeholder" />
            <span className="showcase-card-cover-watermark">MOSS · 谋士</span>
          </>
        )}
      </div>
      <div className="showcase-card-body">
        <div className="showcase-card-title">{item.title}</div>
        {item.description && (
          <div className="showcase-card-desc">{item.description}</div>
        )}
        <div className="showcase-card-footer">
          <span className="showcase-card-agent-tag">{agentName}</span>
          <span className="showcase-card-action">查看案例 →</span>
        </div>
      </div>
    </div>
  );
}

// ─── 主页面 ───────────────────────────────────────────────────────────────

export const ShowcasePage: React.FC = () => {
  const PAGE_SIZE = 12;
  const [data, setData] = useState<ShowcaseAgentTab[]>([]);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [drawerItem, setDrawerItem] = useState<{ item: ShowcasePublicItem; agentName: string } | null>(null);
  const [navScrolled, setNavScrolled] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    fetchShowcaseList()
      .then((res) => {
        setData(res.agents);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  type ItemWithAgent = ShowcasePublicItem & { agentName: string };

  const allItems = useMemo<ItemWithAgent[]>(() => {
    return data.flatMap((tab) => tab.items.map((item) => ({ ...item, agentName: tab.agentName })));
  }, [data]);

  const filteredItems = useMemo<ItemWithAgent[]>(() => {
    if (activeTab === 'all') return allItems;
    return allItems.filter((item) => item.agentId === activeTab);
  }, [allItems, activeTab]);

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [activeTab]);

  const visibleItems = useMemo(() => filteredItems.slice(0, visibleCount), [filteredItems, visibleCount]);
  const hasMore = visibleCount < filteredItems.length;

  const handleCardClick = useCallback((item: ShowcasePublicItem, agentName: string) => {
    void recordShowcaseClick(item.id);
    setDrawerItem({ item, agentName });
  }, []);

  return (
    <div className="showcase-page">
      <style>{GLOBAL_CSS}</style>

      {/* ── NAV（直接复用 index.html 的 class 名和结构）── */}
      <nav className={`nav${navScrolled ? ' scrolled' : ''}`} data-testid="showcase-page-nav">
        <a href="/website/index.html" className="nav-logo">
          <em>MOSS</em> · 谋士
        </a>
        <ul className="nav-links">
          <li><a href="/website/index.html#contrast">洞察矩阵</a></li>
          <li><a href="/website/index.html#four-dims">四维能力</a></li>
          <li><a href="/website/index.html#capabilities">核心功能</a></li>
          <li><a href="/website/index.html#roles">适用场景</a></li>
          <li><a href="/showcase" className="active">案例中心</a></li>
        </ul>
        <div className="nav-auth">
          <a href="/api/v1/auth/cas/login" className="nav-login">登录</a>
          <a href="/api/v1/auth/cas/login" className="nav-register">免费注册</a>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="showcase-hero">
        <div className="showcase-hero-content">
          <div className="showcase-hero-eyebrow">
            <span className="showcase-hero-eyebrow-dot" />
            CASE LIBRARY · 案例墙
          </div>
          <h1 className="showcase-hero-title">
            看看 MOSS 能帮你做什么
          </h1>
          <p className="showcase-hero-sub">
            一个好问题，胜过十条好答案
          </p>
          <div className="showcase-hero-divider" />
        </div>
      </section>

      {/* ── TAB BAR ── */}
      <div className="showcase-tab-bar">
        <div className="showcase-tab-bar-inner">
          <button
            type="button"
            className={`showcase-tab-btn${activeTab === 'all' ? ' active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            全部
          </button>
          {data.map((tab) => (
            <button
              type="button"
              key={tab.agentId}
              className={`showcase-tab-btn${activeTab === tab.agentId ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.agentId)}
            >
              {tab.agentName}
            </button>
          ))}
        </div>
      </div>

      {/* ── CARD GRID ── */}
      <section className="showcase-grid-section">
        {loading && (
          <div className="showcase-loading">加载中…</div>
        )}
        {!loading && filteredItems.length === 0 && (
          <div className="showcase-empty">
            <div className="showcase-empty-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </div>
            <p style={{ fontSize: '0.88rem' }}>暂无已发布案例</p>
          </div>
        )}
        {!loading && filteredItems.length > 0 && (
          <>
            <div className="showcase-grid">
              {visibleItems.map((item, idx) => (
                <ShowcaseCard
                  key={item.id}
                  item={item}
                  agentName={item.agentName}
                  onClick={() => handleCardClick(item, item.agentName)}
                  animIndex={idx < PAGE_SIZE ? idx : undefined}
                />
              ))}
            </div>
            {hasMore && (
              <div className="showcase-load-more">
                <button type="button" className="showcase-load-more-btn" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
                  加载更多（{filteredItems.length - visibleCount} 个）
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* ── CTA FOOTER ── */}
      <footer className="showcase-cta">
        <div className="showcase-cta-title">
          感兴趣？免费试用 MOSS，请你的商业谋士入职。
        </div>
        <a href="/api/v1/auth/cas/login" className="showcase-cta-btn">
          立即免费试用 →
        </a>
      </footer>

      {/* ── DRAWER ── */}
      {drawerItem && (
        <ShowcaseDrawer
          item={drawerItem.item}
          agentName={drawerItem.agentName}
          onClose={() => setDrawerItem(null)}
        />
      )}
    </div>
  );
};

export default ShowcasePage;
