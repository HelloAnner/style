/**
 * DashboardRenderer - 渲染看板的 HTML
 *
 * 通过 buildWidgetHtml 包一层 shell：iframe 自动注入 Corevo 设计系统的
 * CSS 变量（--bg-surface / --text-primary / --blue-600 等 9 色板），
 * 让看板与智能体内联 widget 共享一套设计语言并跟随主题切换。
 *
 * 通过 forwardRef + useImperativeHandle 暴露 exportImage(filename) 方法：
 * 父页面动态加载本地打包的 html2canvas 后直接截 iframe DOM，再触发下载。
 * 所见即所得（含 tab/分页/滚动等当前状态）。
 */

import { useCallback, useEffect, useRef, useImperativeHandle, forwardRef, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { track } from '../../utils/track';
import { buildWidgetHtml } from '../../lib/widgetTheme';
import { useTheme } from '../common/ThemeProvider';
import { useAuthStore } from '../../stores/authStore';
import { isDashboardSnapshotReadyForDisplay, useDashboardStore } from '../../stores/dashboardStore';
import { refreshDashboardStream, type DashboardSnapshot } from '../../api/dashboards';
import {
  AI_BLOCK_ID_PREFIX,
  isStrictlyAiOnlyHtmlUpdate,
  patchAiBlocks,
} from './dashboardHtmlPatch';
import { resolveDashboardExportBackground } from './dashboardImageExport';

interface Props {
  html: string;
  /** Agent / 看板 / 入参上下文。注入到 iframe 内供模板 JS 调用 `window.dashboardPull(binding, inputs)` 等 API 时使用。 */
  agentId?: string | null;
  dashboardKey?: string | null;
  inputs?: Record<string, unknown> | null;
  sessionId?: string | null;
  snapshotId?: string | null;
  /** 当前已有 partial 可展示、但主查询流尚未结束。 */
  streaming?: boolean;
  /** final 已到达，等待 iframe 新文档完成脚本初始化。 */
  finalizing?: boolean;
  onReady?: (snapshotId: string | null | undefined) => void;
  onPendingAiVisible?: () => void;
  /** DB 恢复的 iframe 可见状态。只描述视图，不承载完整 binding 数据。 */
  interactionState?: Record<string, any> | null;
  onInteractionStateChange?: (state: DashboardDocumentState) => void;
}

interface PendingPaginationScroll {
  anchor: string;
  binding: string;
  targetViewportTop?: number;
}

interface DashboardCheckedState {
  id: string;
  name: string;
  value: string;
}

interface DashboardInteractionState {
  section?: string;
  litigationRole?: string;
  litigationType?: string;
  litigationStage?: string;
  litigationYear?: string;
  litigationTab?: string;
  litigationPage?: string;
  litigationPieExpanded?: boolean;
  operatingType?: string;
  operatingYear?: string;
  operatingTab?: string;
  operatingPage?: string;
}

interface DashboardPagerState {
  binding: string;
  page: string;
}

interface IndustryChainViewState {
  open?: boolean;
  nodeCode?: string;
  nodeName?: string;
  page?: string;
}

export interface DashboardDocumentState {
  checked?: DashboardCheckedState[];
  risk?: DashboardInteractionState;
  pagers?: DashboardPagerState[];
  batchPage?: string;
  industryChain?: IndustryChainViewState;
  drilldown?: {
    open?: boolean;
    companyName?: string;
    creditCode?: string;
    activeTab?: string;
  };
}

interface TemplateListModalState {
  open: boolean;
  title: string;
  subtitle?: string;
  tags?: string[];
  bodyHtml: string;
}

function getRiskDetailRoleClass(label: string): string {
  const text = label.replace(/\s+/g, '');
  if (!text) return 'is-neutral-role';
  if (/(被上诉人|被申请人|被执行人|被告|被申诉人|被异议人|被申请执行人)/.test(text)) {
    return 'is-passive-role';
  }
  if (/(上诉人|原告|申请人|申请执行人|执行申请人|再审申请人|申诉人|异议人)/.test(text)) {
    return 'is-active-role';
  }
  return 'is-neutral-role';
}

function getRiskDetailStageClass(label: string): string {
  const text = label.replace(/\s+/g, '');
  if (!text) return 'is-stage-neutral';
  if (/(已结案|已结束|已关闭|已移出|已注销|已履行|已移除|无效)/.test(text)) {
    return 'is-stage-closed';
  }
  if (/(在审|在执|进行中|未结案|有效|未履行)/.test(text)) {
    return 'is-stage-open';
  }
  return 'is-stage-neutral';
}

function getRiskDetailHeaderTagClass(label: string, index: number): string {
  if (index === 0) return 'is-kind';
  const stageClass = getRiskDetailStageClass(label);
  if (stageClass !== 'is-stage-neutral') return stageClass;
  return getRiskDetailRoleClass(label);
}

function decorateRiskDetailBodyHtml(html: string): string {
  if (!html || typeof document === 'undefined') return html;
  const template = document.createElement('template');
  template.innerHTML = html;
  template.content.querySelectorAll<HTMLElement>('.mp-role').forEach((role) => {
    role.classList.remove('is-active-role', 'is-passive-role', 'is-neutral-role');
    role.classList.add(getRiskDetailRoleClass(role.textContent || ''));
  });
  return template.innerHTML;
}

const PAGINATION_SCROLL_FALLBACK_TOP = 12;

function normalizePage(value: number, fallback = 1): number {
  if (!Number.isFinite(value)) return fallback;
  const n = Math.floor(value);
  return n > 0 ? n : fallback;
}

function buildPaginationPayload(
  base: Record<string, unknown>,
  bindingName: string,
  page: number,
  pageSize: number,
): Record<string, unknown> {
  const previous = (
    base._pagination &&
    typeof base._pagination === 'object' &&
    !Array.isArray(base._pagination)
  ) ? base._pagination as Record<string, Record<string, unknown>> : {};
  return {
    ...base,
    _dashboard_page_request: {
      binding: bindingName,
      index: normalizePage(page),
      limit: normalizePage(pageSize, 50),
    },
    _pagination: {
      ...previous,
      [bindingName]: {
        ...(previous[bindingName] || {}),
        index: normalizePage(page),
        limit: normalizePage(pageSize, 50),
      },
    },
  };
}

export interface DashboardRendererHandle {
  exportImage: (filename: string) => Promise<void>;
}

// 注入到 iframe 内的高度上报脚本：让外层容器一起滚动而非 iframe 自滚
//   - ResizeObserver 监听 body 尺寸变化（tab 切换、展开折叠、AI 内容增长都会触发）
//   - 把当前 content 高度 postMessage 给父，父调整 iframe.style.height 与之匹配
//   - 退化路径：不支持 ResizeObserver 时用 setInterval 兜底（古老浏览器）
const HEIGHT_SCRIPT = `
<script>
(function() {
  function compute() {
    var body = document.body;
    if (!body) return 0;
    var bodyRect = body.getBoundingClientRect();
    var style = window.getComputedStyle ? window.getComputedStyle(body) : null;
    var paddingBottom = style ? parseFloat(style.paddingBottom || '0') || 0 : 0;
    var maxBottom = 0;
    var root = document.getElementById('widget-root');
    var nodes = root ? [root] : Array.prototype.slice.call(body.children || []);
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (!node || !node.getBoundingClientRect || node.tagName === 'SCRIPT' || node.tagName === 'STYLE') continue;
      var rect = node.getBoundingClientRect();
      if (!rect.width && !rect.height) continue;
      maxBottom = Math.max(maxBottom, rect.bottom - bodyRect.top);
    }
    if (maxBottom > 0) return Math.ceil(maxBottom + paddingBottom);
    return Math.ceil(body.scrollHeight || body.offsetHeight || 0);
  }
  var lastH = 0;
  function report() {
    var h = compute();
    if (!h || h === lastH) return;
    lastH = h;
    try { parent.postMessage({ type: 'dashboard:height', height: h }, '*'); } catch (e) {}
  }
  // 初始 + load
  setTimeout(report, 0);
  window.addEventListener('load', report);
  // 长生命周期监听
  if (window.ResizeObserver && document.body) {
    try { new ResizeObserver(report).observe(document.body); } catch (e) {}
  } else {
    setInterval(report, 600);
  }
  // 图片资源加载完会撑大内容；监听 img.onload 一并上报
  document.addEventListener('load', function(e) {
    if (e.target && e.target.tagName === 'IMG') report();
  }, true);
})();
</script>
	`;

// 每次整页导航都注入唯一 token。模板脚本位于它之前；DOMContentLoaded 触发时，
// 父页面收到 ready 才能确认当前 final 已完成脚本初始化和事件绑定。
const DASHBOARD_READY_SCRIPT = (renderToken: number) => `
<script>
(function() {
  var renderToken = ${renderToken};
  var reportReady = function() {
    document.documentElement.setAttribute('data-dashboard-render-ready', String(renderToken));
    try { parent.postMessage({ type: 'dashboard:ready', render_token: renderToken }, '*'); } catch (e) {}
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      requestAnimationFrame(reportReady);
    }, { once: true });
  } else {
    requestAnimationFrame(reportReady);
  }
})();
</script>
`;

const CO360_BRIDGE_SCRIPT = `
<script>
(function(){
  var shouldOverrideExisting = !!document.getElementById('co360-overlay');
  if (typeof window.openCo360 === 'function' && !shouldOverrideExisting) return;
  window.openCo360 = function dashboardOpenCo360(companyName, creditCode) {
    try {
      parent.postMessage({
        type: 'dashboard:open-enterprise-360',
        company_name: companyName || '',
        credit_code: creditCode || ''
      }, '*');
    } catch (e) {}
  };
})();
</script>
`;

const EXTERNAL_LINK_BRIDGE_SCRIPT = `
<script>
(function(){
  document.addEventListener('click', function(e) {
    var target = e.target;
    if (!target || !target.closest) return;
    var link = target.closest('a[href]');
    if (!link) return;
    var rawHref = link.getAttribute('href') || '';
    if (!rawHref || rawHref.charAt(0) === '#') return;
    var url;
    try {
      url = new URL(rawHref, window.location.href);
    } catch (_) {
      return;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
    if (url.origin === window.location.origin) return;
    e.preventDefault();
    e.stopPropagation();
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
    try {
      window.open(url.href, '_blank', 'noopener,noreferrer');
    } catch (_) {}
  }, true);
})();
</script>
`;

const PENDING_AI_BRIDGE_SCRIPT = `
<script>
(function(){
  var pendingAiTimer = null;
  function isVisible(el) {
    if (!el) return false;
    var style = window.getComputedStyle ? window.getComputedStyle(el) : null;
    if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  }
  function hasVisiblePendingAi() {
    var blocks = document.querySelectorAll('[id^="${AI_BLOCK_ID_PREFIX}"]');
    for (var i = 0; i < blocks.length; i++) {
      var block = blocks[i];
      if (isVisible(block) && block.querySelector('.ai-loading-hint')) {
        return true;
      }
    }
    return false;
  }
  function notifyIfPendingAiVisible() {
    if (!hasVisiblePendingAi()) return false;
    try { parent.postMessage({ type: 'dashboard:pending-ai-visible' }, '*'); } catch (e) {}
    return true;
  }
  function syncPendingAiPolling() {
    if (hasVisiblePendingAi()) {
      if (!pendingAiTimer) {
        notifyIfPendingAiVisible();
        pendingAiTimer = window.setInterval(function() {
          if (!notifyIfPendingAiVisible()) {
            window.clearInterval(pendingAiTimer);
            pendingAiTimer = null;
          }
        }, 3000);
      }
    } else if (pendingAiTimer) {
      window.clearInterval(pendingAiTimer);
      pendingAiTimer = null;
    }
  }
  document.addEventListener('click', function(e) {
    var target = e.target;
    if (!target || !target.closest) return;
    if (target.closest('.dash-tab-header, label, [role="tab"], [data-dashboard-ai-tab]')) {
      setTimeout(syncPendingAiPolling, 0);
    }
  }, true);
  document.addEventListener('change', function(e) {
    var target = e.target;
    if (target && target.matches && target.matches('input[type="radio"]')) {
      setTimeout(syncPendingAiPolling, 0);
    }
  }, true);
  window.addEventListener('pagehide', function() {
    if (pendingAiTimer) window.clearInterval(pendingAiTimer);
    pendingAiTimer = null;
  });
  setTimeout(syncPendingAiPolling, 0);
})();
</script>
`;

const PAGER_BRIDGE_SCRIPT = `
<style id="dashboard-pager-bridge-style">
  .dashboard-pager {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
    width: 100%;
    min-width: 0;
    margin-top: 12px;
    padding-top: 8px;
    border-top: 0.5px dashed var(--border-color);
  }
  .dashboard-pager-status {
    flex: 1 1 auto;
    min-width: 160px;
    color: var(--text-muted);
    font-size: 12px;
    line-height: 26px;
    overflow-wrap: anywhere;
    order: 2;
  }
  .dashboard-pager-pages {
    display: flex;
    align-items: center;
    flex: 0 1 auto;
    flex-wrap: wrap;
    gap: 4px;
    max-width: 100%;
    min-width: 0;
    order: 1;
  }
  .dashboard-pager-btn {
    appearance: none;
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 26px;
    height: 26px;
    padding: 0 8px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--text-secondary);
    font: inherit;
    font-size: 12.5px;
    line-height: 1;
    white-space: nowrap;
    cursor: pointer;
  }
  .dashboard-pager-btn:hover:not(:disabled) {
    background: var(--bg-elevated);
    color: var(--text-primary);
  }
  .dashboard-pager-btn.is-active {
    background: var(--blue-50);
    color: var(--blue-800);
    font-weight: 600;
  }
  .dashboard-pager-btn:disabled {
    opacity: 0.52;
    cursor: not-allowed;
  }
  .dashboard-pager-ellipsis {
    flex: 0 0 auto;
    color: var(--text-muted);
    font-size: 12px;
    line-height: 26px;
    padding: 0 1px;
    white-space: nowrap;
  }
  .pagi-nav {
    display: flex;
    gap: 4px;
    justify-content: center;
    align-items: center;
    max-width: 100%;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: thin;
    padding-top: 12px;
    margin-top: 8px;
    border-top: 0.5px solid var(--border-color);
  }
  .pagi-nav label {
    flex: 0 0 auto;
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 28px;
    height: 28px;
    padding: 4px 10px;
    border-radius: 6px;
    color: var(--text-muted);
    font: inherit;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    user-select: none;
    transition: background 0.12s ease, color 0.12s ease;
    text-align: center;
  }
  .pagi-nav label:hover {
    background: var(--bg-tertiary);
    color: var(--text-secondary);
  }
  .pagi-nav label.is-active {
    background: var(--blue-50);
    color: var(--blue-700);
    font-weight: 600;
  }
  .pagi-nav .pagi-info {
    flex: 0 0 auto;
    color: var(--text-muted);
    font-size: 12px;
    margin-left: 10px;
    cursor: default;
    pointer-events: none;
    white-space: nowrap;
  }
  @media (max-width: 640px) {
    .dashboard-pager {
      align-items: flex-start;
    }
    .dashboard-pager-pages {
      flex-wrap: nowrap;
      overflow-x: auto;
      scrollbar-width: thin;
      width: 100%;
      padding-bottom: 2px;
    }
    .dashboard-pager-status {
      flex-basis: 100%;
      line-height: 1.5;
      order: 2;
    }
  }
  /* ===== 纯 CSS 本地分页器公共样式（corevo 风格） =====
     模板只需输出 .paginator / .pg-input / .paged-list / .pagi-nav 结构，
     不再需要为每个前缀写死 :checked 规则。 */
  .paginator { position: relative; }
  .paginator .pg-input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
    width: 0;
    height: 0;
  }
  .paginator .paged-list > li { display: none; }
  .paginator .paged-list > li[data-pg="1"] { display: list-item; }
  .paginator .paged-list > li.is-visible { display: list-item; }
  .paginator .contact-list.paged-list > li.is-visible { display: flex; }
</style>
<script>
(function(){
  function reportHeight() {
    try {
      parent.postMessage({ type: 'dashboard:height', height: document.documentElement.scrollHeight || document.body.scrollHeight || 0 }, '*');
    } catch (e) {}
  }
  function dashboardPagerContainer(pager) {
    if (!pager || !pager.closest) return null;
    return pager.closest('[data-dashboard-page-container], .card, .panel, .section, .block, .module, .list-card, .table-card, .result-card, .dash-tab-panel');
  }
  function pageContentForPager(pager) {
    var container = dashboardPagerContainer(pager);
    if (!container) return null;
    return container.querySelector('[data-dashboard-page-content]');
  }
  function directPageItems(content) {
    if (!content) return [];
    if (content.tBodies && content.tBodies[0]) {
      return Array.prototype.slice.call(content.tBodies[0].children || []);
    }
    return Array.prototype.slice.call(content.children || []).filter(function(el) {
      return el && el.tagName !== 'SCRIPT' && el.tagName !== 'STYLE';
    });
  }
  function pagerPageSize(pager) {
    var value = parseInt(pager.getAttribute('data-dashboard-page-size') || '50', 10);
    return isFinite(value) && value > 0 ? value : 50;
  }
  function pagerTotalCount(pager, itemCount) {
    var value = parseInt(pager.getAttribute('data-dashboard-total') || String(itemCount || 0), 10);
    return isFinite(value) && value >= 0 ? value : itemCount;
  }
  function ensurePageMarks(pager) {
    var content = pageContentForPager(pager);
    var items = directPageItems(content);
    if (!content || !items.length) return null;
    var pageSize = pagerPageSize(pager);
    var startPage = parseInt(pager.getAttribute('data-dashboard-current-page') || '1', 10);
    startPage = isFinite(startPage) && startPage > 0 ? startPage : 1;
    for (var i = 0; i < items.length; i++) {
      if (!items[i].getAttribute('data-pg')) {
        items[i].setAttribute('data-pg', String(startPage + Math.floor(i / pageSize)));
      }
    }
    return { content: content, items: items, pageSize: pageSize };
  }
  function buttonHtml(binding, page, pageSize, label, active, disabled) {
    var classes = 'dashboard-pager-btn' + (active ? ' is-active' : '');
    return '<button type="button" class="' + classes + '" data-dashboard-binding="' + binding + '" data-dashboard-page="' + page + '" data-dashboard-page-size="' + pageSize + '"' + (disabled ? ' disabled' : '') + '>' + label + '</button>';
  }
  function renderPagerButtons(pager, current, totalPages) {
    var holder = pager.querySelector('.dashboard-pager-pages');
    if (!holder) return;
    var binding = pager.getAttribute('data-dashboard-binding') || '';
    var pageSize = pagerPageSize(pager);
    var html = '';
    html += buttonHtml(binding, 1, pageSize, '首页', false, current <= 1);
    html += buttonHtml(binding, Math.max(1, current - 1), pageSize, '上一页', false, current <= 1);
    var start = Math.max(1, current - 2);
    var end = Math.min(totalPages, current + 2);
    if (start > 1) {
      html += buttonHtml(binding, 1, pageSize, '1', current === 1, false);
      if (start > 2) html += '<span class="dashboard-pager-ellipsis" aria-hidden="true">...</span>';
    }
    for (var p = start; p <= end; p++) {
      html += buttonHtml(binding, p, pageSize, String(p), current === p, false);
    }
    if (end < totalPages) {
      if (end < totalPages - 1) html += '<span class="dashboard-pager-ellipsis" aria-hidden="true">...</span>';
      html += buttonHtml(binding, totalPages, pageSize, String(totalPages), current === totalPages, false);
    }
    html += buttonHtml(binding, Math.min(totalPages, current + 1), pageSize, '下一页', false, current >= totalPages);
    html += buttonHtml(binding, totalPages, pageSize, '末页', false, current >= totalPages);
    holder.innerHTML = html;
  }
  function updatePagerStatus(pager, current, totalPages, totalCount) {
    var status = pager.querySelector('.dashboard-pager-status');
    if (!status) return;
    var text = status.textContent || '';
    var suffix = '';
    var comma = text.indexOf('，共 ');
    if (comma >= 0) suffix = text.slice(comma);
    else if (totalCount > 0) suffix = '，共 ' + totalCount + ' 条';
    status.textContent = '第 ' + current + ' / ' + totalPages + ' 页' + suffix;
  }
  function switchDashboardPageLocal(pager, page) {
    var state = ensurePageMarks(pager);
    if (!state || !state.items.length) return false;
    var totalCount = pagerTotalCount(pager, state.items.length);
    var totalPages = Math.max(1, Math.ceil(totalCount / state.pageSize));
    if (!isFinite(page) || page < 1 || page > totalPages) return false;
    var hasPage = false;
    for (var i = 0; i < state.items.length; i++) {
      if (state.items[i].getAttribute('data-pg') === String(page)) {
        hasPage = true;
        break;
      }
    }
    if (!hasPage) return false;
    for (var j = 0; j < state.items.length; j++) {
      var visible = state.items[j].getAttribute('data-pg') === String(page);
      state.items[j].hidden = !visible;
      state.items[j].classList.toggle('is-visible', visible);
    }
    pager.classList.remove('is-loading');
    pager.removeAttribute('aria-busy');
    pager.setAttribute('data-dashboard-current-page', String(page));
    renderPagerButtons(pager, page, totalPages);
    updatePagerStatus(pager, page, totalPages, totalCount);
    var container = dashboardPagerContainer(pager);
    if (container) {
      container.classList.remove('is-dashboard-page-loading');
      container.removeAttribute('aria-busy');
    }
    setTimeout(reportHeight, 0);
    return true;
  }
  function initLocalPages() {
    var pagers = document.querySelectorAll('.dashboard-pager[data-dashboard-binding]');
    for (var i = 0; i < pagers.length; i++) {
      var pager = pagers[i];
      var current = parseInt(pager.getAttribute('data-dashboard-current-page') || '1', 10);
      switchDashboardPageLocal(pager, isFinite(current) && current > 0 ? current : 1);
    }
  }
  document.addEventListener('click', function(e) {
    var target = e.target;
    if (!target || !target.closest) return;
    var btn = target.closest('.dashboard-pager-btn[data-dashboard-binding][data-dashboard-page]');
    if (!btn || btn.disabled || btn.classList.contains('is-active')) return;
    var binding = btn.getAttribute('data-dashboard-binding') || '';
    var page = parseInt(btn.getAttribute('data-dashboard-page') || '1', 10);
    var pageSize = parseInt(btn.getAttribute('data-dashboard-page-size') || '50', 10);
    if (!binding || !isFinite(page) || page < 1) return;
    var pager = btn.closest('.dashboard-pager');
    if (pager && pager.classList.contains('is-loading')) return;
    if (pager && switchDashboardPageLocal(pager, page)) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (pager) {
      pager.classList.add('is-loading');
      pager.setAttribute('aria-busy', 'true');
      var container = dashboardPagerContainer(pager);
      if (container) {
        container.classList.add('is-dashboard-page-loading');
        container.setAttribute('aria-busy', 'true');
      }
    }
    var anchor = pager ? (pager.getAttribute('data-dashboard-page-anchor') || '') : '';
    try {
      parent.postMessage({
        type: 'dashboard:paginate-binding',
        binding: binding,
        anchor: anchor,
        page: page,
        pageSize: isFinite(pageSize) && pageSize > 0 ? pageSize : 50
      }, '*');
    } catch (_) {
      if (pager) pager.classList.remove('is-loading');
    }
  }, true);
  setTimeout(initLocalPages, 0);
})();

/* 纯 CSS 本地分页器：用 JS 维护当前页高亮和内容显示，
   避免模板为每个前缀/每页写死 :checked ~ 规则。 */
(function(){
  function updatePaginator(paginator, input) {
    var page = input.id.split('-').pop();
    var labels = paginator.querySelectorAll('.pagi-nav label');
    for (var i = 0; i < labels.length; i++) {
      labels[i].classList.toggle('is-active', labels[i].getAttribute('for') === input.id);
    }
    var items = paginator.querySelectorAll('.paged-list > li');
    for (var j = 0; j < items.length; j++) {
      items[j].classList.toggle('is-visible', items[j].getAttribute('data-pg') === page);
    }
  }
  document.body.addEventListener('change', function(e) {
    var el = e.target;
    if (!el.matches || !el.matches('.paginator .pg-input')) return;
    var paginator = el.closest('.paginator');
    if (!paginator) return;
    updatePaginator(paginator, el);
  });
  var initialInputs = document.querySelectorAll('.paginator .pg-input:checked');
  for (var k = 0; k < initialInputs.length; k++) {
    var paginator = initialInputs[k].closest('.paginator');
    if (paginator) updatePaginator(paginator, initialInputs[k]);
  }
})();
</script>
`;

const DASHBOARD_TAB_SCROLLBAR_STYLE = `
<style id="dashboard-tab-scrollbar-style">
  .tab-card .dash-tab-headers,
  .tab-card .td-tab-headers {
    position: relative;
    align-items: stretch;
    flex-wrap: nowrap;
    overflow-x: auto;
    overflow-y: hidden;
    border-bottom: 0;
    padding-bottom: 8px;
    scrollbar-width: thin;
  }
  .tab-card .dash-tab-headers::after,
  .tab-card .td-tab-headers::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    bottom: 8px;
    height: 1px;
    background: var(--border-color);
    pointer-events: none;
    z-index: 0;
  }
  .tab-card .dash-tab-header,
  .tab-card .td-tab-header {
    position: relative;
    z-index: 1;
    flex: 0 0 auto;
    white-space: nowrap;
  }
</style>
`;

/**
 * iframe 内的流式分区骨架。
 * 只装饰模板已明确标记为“查询中/加载中”的局部空态，已返回模块保持原样和可交互。
 */
const DASHBOARD_STREAMING_STYLE = `
<style id="dashboard-streaming-style">
  [data-dashboard-stream-pending] {
    position: relative;
    overflow: hidden;
  }
  [data-dashboard-stream-pending] > .dashboard-stream-pending-visual {
    display: none;
  }
  html.dashboard-streaming-active [data-dashboard-stream-pending] {
    min-height: 34px;
  }
  html.dashboard-streaming-active [data-dashboard-stream-pending] > .dashboard-stream-pending-copy {
    display: none;
  }
  html.dashboard-streaming-active [data-dashboard-stream-pending] > .dashboard-stream-pending-visual {
    position: relative;
    display: flex;
    width: 100%;
    min-height: inherit;
    align-items: center;
    gap: 8px;
  }
  html.dashboard-streaming-active [data-dashboard-stream-kind="value"] > .dashboard-stream-pending-visual {
    width: min(108px, 72%);
    min-height: 22px;
    border-radius: 6px;
    background: var(--bg-elevated);
  }
  html.dashboard-streaming-active [data-dashboard-stream-kind="count"] {
    display: inline-flex;
    min-width: 12px;
    min-height: 12px;
  }
  html.dashboard-streaming-active [data-dashboard-stream-kind="count"] > .dashboard-stream-pending-visual {
    width: 12px;
    min-height: 12px;
    border-radius: 999px;
    background: var(--bg-elevated);
  }
  html.dashboard-streaming-active [data-dashboard-stream-kind="chart"] > .dashboard-stream-pending-visual {
    min-height: 126px;
    align-items: flex-end;
    justify-content: center;
    padding: 16px 12px 10px;
    border-radius: 8px;
    background: var(--bg-elevated);
  }
  html.dashboard-streaming-active [data-dashboard-stream-kind="chart"] .dashboard-stream-pending-bar {
    flex: 1;
    max-width: 48px;
    border-radius: 6px 6px 3px 3px;
    background: var(--bg-tertiary);
  }
  html.dashboard-streaming-active [data-dashboard-stream-kind="chart"] .dashboard-stream-pending-bar:nth-child(1) { height: 42%; }
  html.dashboard-streaming-active [data-dashboard-stream-kind="chart"] .dashboard-stream-pending-bar:nth-child(2) { height: 74%; }
  html.dashboard-streaming-active [data-dashboard-stream-kind="chart"] .dashboard-stream-pending-bar:nth-child(3) { height: 56%; }
  html.dashboard-streaming-active [data-dashboard-stream-kind="chart"] .dashboard-stream-pending-bar:nth-child(4) { height: 88%; }
  html.dashboard-streaming-active [data-dashboard-stream-kind="table"] > .dashboard-stream-pending-visual {
    min-height: 116px;
    flex-direction: column;
    align-items: stretch;
    justify-content: center;
    padding: 12px 4px;
  }
  html.dashboard-streaming-active [data-dashboard-stream-kind="table"] .dashboard-stream-pending-row {
    height: 12px;
    border-radius: 999px;
    background: var(--bg-elevated);
  }
  html.dashboard-streaming-active [data-dashboard-stream-kind="table"] .dashboard-stream-pending-row:nth-child(2) { width: 82%; }
  html.dashboard-streaming-active [data-dashboard-stream-kind="table"] .dashboard-stream-pending-row:nth-child(3) { width: 64%; }
  html.dashboard-streaming-active [data-dashboard-stream-pending] > .dashboard-stream-pending-visual::after,
  html.dashboard-streaming-active [data-dashboard-stream-kind="chart"] .dashboard-stream-pending-bar::after,
  html.dashboard-streaming-active [data-dashboard-stream-kind="table"] .dashboard-stream-pending-row::after {
    content: "";
    position: absolute;
    inset: 0;
    transform: translateX(-110%);
    background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--text-muted) 10%, transparent), transparent);
    animation: dashboard-iframe-stream-shimmer 1.55s ease-in-out infinite;
    pointer-events: none;
  }
  html.dashboard-streaming-active [data-dashboard-stream-kind="chart"] .dashboard-stream-pending-bar,
  html.dashboard-streaming-active [data-dashboard-stream-kind="table"] .dashboard-stream-pending-row {
    position: relative;
    overflow: hidden;
  }
  @keyframes dashboard-iframe-stream-shimmer {
    100% { transform: translateX(110%); }
  }
  @media (prefers-reduced-motion: reduce) {
    html.dashboard-streaming-active [data-dashboard-stream-pending] > .dashboard-stream-pending-visual::after,
    html.dashboard-streaming-active [data-dashboard-stream-kind="chart"] .dashboard-stream-pending-bar::after,
    html.dashboard-streaming-active [data-dashboard-stream-kind="table"] .dashboard-stream-pending-row::after {
      animation: none;
    }
  }
</style>
`;

async function waitForFonts(doc: Document): Promise<void> {
  if (!doc.fonts?.ready) return;
  await Promise.race([
    doc.fonts.ready.catch(() => undefined),
    new Promise((resolve) => window.setTimeout(resolve, 2000)),
  ]);
}

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/["\\]/g, '\\$&');
}

function isHtmlElement(el: Element | null | undefined): el is HTMLElement {
  if (!el) return false;
  const win = el.ownerDocument.defaultView;
  return Boolean(win && el instanceof win.HTMLElement);
}

function isVisibleElement(el: Element): boolean {
  if (!isHtmlElement(el)) return false;
  const style = el.ownerDocument.defaultView?.getComputedStyle(el);
  if (!style) return false;
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function hasVisibleTemplateOverlay(doc: Document): boolean {
  return ['chain-list-overlay', 'co360-overlay', 'er-modal'].some((id) => {
    const overlay = doc.getElementById(id);
    if (!overlay) return false;
    if (id === 'er-modal' && overlay.classList.contains('show')) return true;
    const style = doc.defaultView?.getComputedStyle(overlay);
    return Boolean(style && style.display !== 'none');
  });
}

function findParentScrollContainer(el: HTMLElement): HTMLElement | null {
  let parent = el.parentElement;
  while (parent) {
    const style = window.getComputedStyle(parent);
    const overflowY = style.overflowY;
    if ((overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') && parent.scrollHeight > parent.clientHeight) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return null;
}

function measureDashboardDocumentHeight(doc: Document): number {
  const body = doc.body;
  if (!body || !doc.defaultView) return 0;
  const bodyRect = body.getBoundingClientRect();
  const style = doc.defaultView.getComputedStyle(body);
  const paddingBottom = Number.parseFloat(style.paddingBottom || '0') || 0;
  let maxBottom = 0;
  const root = doc.getElementById('widget-root');
  const nodes = root ? [root] : Array.from(body.children);
  for (const node of nodes) {
    if (!isHtmlElement(node)) continue;
    if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE') continue;
    const rect = node.getBoundingClientRect();
    if (rect.width <= 0 && rect.height <= 0) continue;
    maxBottom = Math.max(maxBottom, rect.bottom - bodyRect.top);
  }
  if (maxBottom > 0) return Math.ceil(maxBottom + paddingBottom);
  return Math.ceil(body.scrollHeight || body.offsetHeight || 0);
}

function syncIframeContentHeight(iframe: HTMLIFrameElement, doc: Document): void {
  if (hasVisibleTemplateOverlay(doc)) return;
  const height = measureDashboardDocumentHeight(doc);
  if (height > 0) {
    iframe.style.height = `${height}px`;
  }
}

function findDashboardPager(
  doc: Document,
  pending: Pick<PendingPaginationScroll, 'anchor' | 'binding'>,
): HTMLElement | null {
  const anchorSelector = pending.anchor
    ? `.dashboard-pager[data-dashboard-page-anchor="${cssEscape(pending.anchor)}"]`
    : '';
  const bindingSelector = `.dashboard-pager[data-dashboard-binding="${cssEscape(pending.binding)}"]`;
  return (anchorSelector ? doc.querySelector<HTMLElement>(anchorSelector) : null)
    ?? doc.querySelector<HTMLElement>(bindingSelector);
}

function findPagerDataElement(pager: HTMLElement): HTMLElement {
  let cursor: Element | null = pager.previousElementSibling;
  while (cursor) {
    if (isVisibleElement(cursor)) {
      const explicit = cursor.querySelector<HTMLElement>('[data-dashboard-page-content]');
      if (explicit && isVisibleElement(explicit)) return explicit;
      const table = cursor.matches('table,[role="table"]')
        ? cursor as HTMLElement
        : cursor.querySelector<HTMLElement>('table,[role="table"]');
      if (table && isVisibleElement(table)) return table;
      const list = cursor.matches('ul,ol,[role="list"]')
        ? cursor as HTMLElement
        : cursor.querySelector<HTMLElement>('ul,ol,[role="list"]');
      if (list && isVisibleElement(list)) return list;
      return cursor as HTMLElement;
    }
    cursor = cursor.previousElementSibling;
  }
  return pager;
}

function isPaginationComponentBoundary(el: HTMLElement): boolean {
  if (el.hasAttribute('data-dashboard-page-container')) return true;
  const className = typeof el.className === 'string' ? el.className : '';
  return /\b(card|panel|section|block|module|list-card|table-card|result-card|dash-tab-panel)\b/.test(className);
}

function findPagerComponentStart(pager: HTMLElement): HTMLElement {
  const explicitContainer = pager.closest<HTMLElement>('[data-dashboard-page-container]');
  if (explicitContainer && isVisibleElement(explicitContainer)) {
    return explicitContainer;
  }

  const dataElement = findPagerDataElement(pager);
  if (dataElement === pager) return pager;

  let candidate: HTMLElement = dataElement;
  let parent = dataElement.parentElement;
  while (parent && parent !== pager.ownerDocument.body) {
    if (parent.contains(pager)) {
      candidate = parent;
      break;
    }
    if (isPaginationComponentBoundary(parent)) {
      candidate = parent;
      break;
    }
    candidate = parent;
    parent = parent.parentElement;
  }
  return candidate;
}

function capturePaginationViewportTop(
  iframe: HTMLIFrameElement,
  doc: Document,
  pending: Pick<PendingPaginationScroll, 'anchor' | 'binding'>,
): number | undefined {
  const pager = findDashboardPager(doc, pending);
  if (!pager) return undefined;
  const target = findPagerComponentStart(pager);
  const scrollContainer = findParentScrollContainer(iframe);
  if (!scrollContainer) return undefined;

  const frameRect = iframe.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const containerRect = scrollContainer.getBoundingClientRect();
  return frameRect.top - containerRect.top + targetRect.top;
}

function captureDocumentPaginationViewportTop(
  doc: Document,
  pending: Pick<PendingPaginationScroll, 'anchor' | 'binding'>,
): number | undefined {
  const pager = findDashboardPager(doc, pending);
  if (!pager) return undefined;
  const target = findPagerComponentStart(pager);
  return target.getBoundingClientRect().top;
}

function collectDashboardCheckedState(doc: Document): DashboardCheckedState[] {
  const inputs = Array.from(doc.querySelectorAll<HTMLInputElement>(
    '.paginator input[type="radio"]:checked, .tab-card input[type="radio"]:checked, input.pg-input:checked',
  ));
  return inputs.map((input) => ({
    id: input.id || '',
    name: input.name || '',
    value: input.value || '',
  }));
}

function restoreDashboardCheckedState(doc: Document, states: DashboardCheckedState[]): void {
  const win = doc.defaultView;
  const InputCtor = win?.HTMLInputElement;
  if (!InputCtor) return;
  for (const state of states) {
    const target = state.id
      ? doc.getElementById(state.id)
      : doc.querySelector<HTMLInputElement>(
        `input[type="radio"][name="${cssEscape(state.name)}"][value="${cssEscape(state.value)}"]`,
      );
    if (target instanceof InputCtor && target.type === 'radio') {
      target.checked = true;
      target.dispatchEvent(new win.Event('change', { bubbles: true }));
    }
  }
}

function activeAttribute(doc: Document, selector: string, attribute: string): string | undefined {
  const value = doc.querySelector(selector)?.getAttribute(attribute)?.trim();
  return value || undefined;
}

function activeIndexedAttribute(
  doc: Document,
  activeSelector: string,
  optionSelector: string,
  attribute: string,
): string | undefined {
  const active = Array.from(doc.querySelectorAll(activeSelector));
  const selected = active.findIndex((element) => element.classList.contains('on'));
  if (selected < 0) return undefined;
  const option = doc.querySelectorAll(optionSelector)[selected];
  const value = option?.getAttribute(attribute)?.trim();
  return value || undefined;
}

function collectDashboardInteractionState(doc: Document): DashboardInteractionState {
  return {
    section: activeAttribute(doc, '#er-sectiontabs .section-tab.active[data-sec]', 'data-sec'),
    litigationRole: activeAttribute(doc, '#er-filter .er-chip.active[data-role]', 'data-role'),
    litigationType: activeAttribute(doc, '#er-pie .pie-arc.on[data-type]', 'data-type'),
    litigationStage: activeAttribute(doc, '#er-bar .bar-rect.on[data-stage]', 'data-stage'),
    litigationYear: activeIndexedAttribute(doc, '#er-line .line-dot', '#er-line [data-year]', 'data-year'),
    litigationTab: activeAttribute(doc, '#er-tabs .er-tab.active[data-tab]', 'data-tab'),
    litigationPage: activeAttribute(doc, '#er-pager .pg-btn.active[data-goto]', 'data-goto'),
    litigationPieExpanded: doc.querySelector('#er-pie [data-pie-toggle]')?.textContent?.includes('收起') || false,
    operatingType: activeAttribute(doc, '#or-bar .hbar-row.on[data-or-type]', 'data-or-type'),
    operatingYear: activeIndexedAttribute(doc, '#or-line .line-dot', '#or-line [data-or-year]', 'data-or-year'),
    operatingTab: activeAttribute(doc, '#or-tabs .er-tab.active[data-or-tab]', 'data-or-tab'),
    operatingPage: activeAttribute(doc, '#or-pager .pg-btn.active[data-orgoto]', 'data-orgoto'),
  };
}

function clickDashboardControl(
  doc: Document,
  containerSelector: string,
  attribute: string,
  value: string | undefined,
): void {
  if (!value) return;
  const selector = `${containerSelector} [${attribute}="${cssEscape(value)}"]`;
  const target = doc.querySelector<HTMLElement>(selector);
  target?.click();
}

/**
 * 企业风险模板会在每个累计 partial 后重新执行脚本；这里通过真实 click 恢复模板自己的 JS state，
 * 而不是只补 active class，确保图表、明细表和分页内容与视觉选中态一致。
 */
function restoreDashboardInteractionState(doc: Document, state: DashboardInteractionState): void {
  clickDashboardControl(doc, '#er-filter', 'data-role', state.litigationRole);
  clickDashboardControl(doc, '#er-pie', 'data-type', state.litigationType);
  clickDashboardControl(doc, '#er-bar', 'data-stage', state.litigationStage);
  clickDashboardControl(doc, '#er-line', 'data-year', state.litigationYear);
  clickDashboardControl(doc, '#er-tabs', 'data-tab', state.litigationTab);
  clickDashboardControl(doc, '#er-pager', 'data-goto', state.litigationPage);
  if (state.litigationPieExpanded) {
    const toggle = doc.querySelector<HTMLElement>('#er-pie [data-pie-toggle]');
    if (toggle?.textContent?.includes('展开')) toggle.click();
  }

  clickDashboardControl(doc, '#or-bar', 'data-or-type', state.operatingType);
  clickDashboardControl(doc, '#or-line', 'data-or-year', state.operatingYear);
  clickDashboardControl(doc, '#or-tabs', 'data-or-tab', state.operatingTab);
  clickDashboardControl(doc, '#or-pager', 'data-orgoto', state.operatingPage);

  // 顶层分区最后恢复，避免前面的模板重绘改变用户当前看到的司法/经营风险板块。
  clickDashboardControl(doc, '#er-sectiontabs', 'data-sec', state.section);
}

function collectDashboardDocumentState(doc: Document): DashboardDocumentState {
  const pagers = Array.from(doc.querySelectorAll<HTMLElement>(
    '.dashboard-pager[data-dashboard-binding][data-dashboard-current-page]',
  )).map((pager) => ({
    binding: pager.getAttribute('data-dashboard-binding') || '',
    page: pager.getAttribute('data-dashboard-current-page') || '1',
  })).filter((pager) => pager.binding);
  const batchPage = doc.querySelector<HTMLElement>('#batch-pager button.active[data-page]')
    ?.getAttribute('data-page') || undefined;
  const root = doc.documentElement;
  const chainOpen = root.getAttribute('data-dashboard-chain-open') === 'true';
  const nodeCode = root.getAttribute('data-dashboard-chain-node-code') || undefined;
  const nodeName = root.getAttribute('data-dashboard-chain-node-name') || undefined;
  const chainPage = root.getAttribute('data-dashboard-chain-page') || undefined;
  return {
    checked: collectDashboardCheckedState(doc),
    risk: collectDashboardInteractionState(doc),
    pagers,
    batchPage,
    industryChain: (chainOpen || nodeCode) ? {
      open: chainOpen,
      nodeCode,
      nodeName,
      page: chainPage,
    } : undefined,
  };
}

function restoreDashboardDocumentState(doc: Document, state: DashboardDocumentState | null | undefined): void {
  if (!state) return;
  if (state.checked?.length) restoreDashboardCheckedState(doc, state.checked);
  if (state.risk) restoreDashboardInteractionState(doc, state.risk);
  for (const pager of state.pagers || []) {
    const target = doc.querySelector<HTMLElement>(
      `.dashboard-pager-btn[data-dashboard-binding="${cssEscape(pager.binding)}"]` +
      `[data-dashboard-page="${cssEscape(pager.page)}"]`,
    );
    target?.click();
  }
  if (state.batchPage) {
    doc.querySelector<HTMLElement>(`#batch-pager button[data-page="${cssEscape(state.batchPage)}"]`)?.click();
  }
  const chain = state.industryChain;
  if (chain?.open && chain.nodeCode) {
    const node = doc.querySelector<HTMLElement>(
      `.node-clickable[data-node-code="${cssEscape(chain.nodeCode)}"]`,
    );
    node?.click();
    doc.documentElement.setAttribute('data-dashboard-chain-node-code', chain.nodeCode);
    if (chain.nodeName) doc.documentElement.setAttribute('data-dashboard-chain-node-name', chain.nodeName);
    doc.documentElement.setAttribute('data-dashboard-chain-open', 'true');
    if (chain.page && chain.page !== '1') {
      let attempts = 0;
      const restorePage = () => {
        attempts += 1;
        const targetPage = Number(chain.page || 1);
        const exactButton = doc.querySelector<HTMLElement>(
          `#chain-list-overlay .chain-page-btn[data-chain-page="${cssEscape(chain.page || '')}"]`,
        );
        const footerText = doc.getElementById('chain-list-footer')?.textContent || '';
        const currentPage = Number(footerText.match(/第\s*(\d+)/)?.[1] || 1);
        if (currentPage === targetPage) return;
        const button = exactButton || (
          currentPage < targetPage
            ? doc.querySelector<HTMLElement>(
              `#chain-list-overlay .chain-page-btn[data-chain-page="${currentPage + 1}"]`,
            )
            : null
        );
        if (button && !button.hasAttribute('disabled')) {
          button.click();
          window.setTimeout(restorePage, 120);
          return;
        }
        if (attempts < 20) window.setTimeout(restorePage, 100);
      };
      window.setTimeout(restorePage, 100);
    }
  }
}

function bindDashboardDocumentStateTracking(
  doc: Document,
  notify: () => void,
  fallbackNode?: { code?: string; name?: string },
): void {
  const root = doc.documentElement;
  const schedule = () => window.setTimeout(notify, 0);
  doc.addEventListener('change', schedule, true);
  doc.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const node = target.closest<HTMLElement>('.node-clickable[data-node-code]');
    const center = target.closest<HTMLElement>('.chain-center.center-clickable');
    if (node || center) {
      const code = node?.getAttribute('data-node-code') || fallbackNode?.code || '';
      const name = node?.getAttribute('data-node-name') || fallbackNode?.name || '';
      root.setAttribute('data-dashboard-chain-open', 'true');
      root.setAttribute('data-dashboard-chain-page', '1');
      if (code) root.setAttribute('data-dashboard-chain-node-code', code);
      if (name) root.setAttribute('data-dashboard-chain-node-name', name);
    }
    const chainPage = target.closest<HTMLElement>('.chain-page-btn[data-chain-page]');
    if (chainPage && !chainPage.hasAttribute('disabled')) {
      root.setAttribute('data-dashboard-chain-page', chainPage.getAttribute('data-chain-page') || '1');
    }
    if (target.closest('.chain-modal-close, #chain-list-overlay')) {
      window.setTimeout(() => {
        const overlay = doc.getElementById('chain-list-overlay');
        if (!overlay || doc.defaultView?.getComputedStyle(overlay).display === 'none') {
          root.setAttribute('data-dashboard-chain-open', 'false');
          notify();
        }
      }, 0);
    }
    schedule();
  }, true);
}

const DASHBOARD_PENDING_COPY = /(查询中|加载中|分析中|持续更新中)/;

function pendingVisualKind(element: HTMLElement): 'value' | 'chart' | 'table' | 'count' {
  if (element.classList.contains('chart-empty')) return 'chart';
  if (element.classList.contains('table-empty')) return 'table';
  if (element.classList.contains('t-cnt')) return 'count';
  return 'value';
}

function createPendingVisual(doc: Document, kind: ReturnType<typeof pendingVisualKind>): HTMLElement {
  const visual = doc.createElement('span');
  visual.className = 'dashboard-stream-pending-visual';
  visual.setAttribute('aria-hidden', 'true');
  if (kind === 'chart') {
    for (let index = 0; index < 4; index += 1) {
      const bar = doc.createElement('span');
      bar.className = 'dashboard-stream-pending-bar';
      visual.appendChild(bar);
    }
  } else if (kind === 'table') {
    for (let index = 0; index < 3; index += 1) {
      const row = doc.createElement('span');
      row.className = 'dashboard-stream-pending-row';
      visual.appendChild(row);
    }
  }
  return visual;
}

function decorateDashboardPendingContent(doc: Document): void {
  const candidates = doc.querySelectorAll<HTMLElement>('.chart-empty, .table-empty, .rr-v, .t-cnt');
  candidates.forEach((element) => {
    if (element.hasAttribute('data-dashboard-stream-pending')) return;
    const copyText = element.textContent?.trim() || '';
    if (!DASHBOARD_PENDING_COPY.test(copyText) && copyText !== '…') return;

    const kind = pendingVisualKind(element);
    const copy = doc.createElement('span');
    copy.className = 'dashboard-stream-pending-copy';
    while (element.firstChild) copy.appendChild(element.firstChild);
    element.append(copy, createPendingVisual(doc, kind));
    element.setAttribute('data-dashboard-stream-pending', 'true');
    element.setAttribute('data-dashboard-stream-kind', kind);
    element.setAttribute('aria-label', copyText || '看板数据正在持续更新');
  });
}

function applyDashboardStreamingState(doc: Document, streaming: boolean): void {
  doc.documentElement.classList.toggle('dashboard-streaming-active', streaming);
  if (streaming) decorateDashboardPendingContent(doc);
  doc.querySelectorAll<HTMLElement>('[data-dashboard-stream-pending]').forEach((element) => {
    if (streaming) element.setAttribute('aria-busy', 'true');
    else element.removeAttribute('aria-busy');
  });
}

function scrollToPaginationAnchor(
  iframe: HTMLIFrameElement,
  doc: Document,
  pending: PendingPaginationScroll,
): void {
  const pager = findDashboardPager(doc, pending);
  if (!pager) return;

  syncIframeContentHeight(iframe, doc);
  const target = findPagerComponentStart(pager);
  const scrollContainer = findParentScrollContainer(iframe);
  if (!scrollContainer) return;

  const frameRect = iframe.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const containerRect = scrollContainer.getBoundingClientRect();
  const targetViewportTop = Number.isFinite(pending.targetViewportTop)
    ? pending.targetViewportTop!
    : PAGINATION_SCROLL_FALLBACK_TOP;
  const targetTop = scrollContainer.scrollTop + frameRect.top - containerRect.top + targetRect.top - targetViewportTop;
  scrollContainer.scrollTo({
    top: Math.max(0, targetTop),
    left: scrollContainer.scrollLeft,
    behavior: 'smooth',
  });
}

function scrollDashboardDocumentToPaginationAnchor(
  doc: Document,
  pending: PendingPaginationScroll,
): void {
  const pager = findDashboardPager(doc, pending);
  const win = doc.defaultView;
  if (!pager || !win) return;

  const target = findPagerComponentStart(pager);
  const targetViewportTop = Number.isFinite(pending.targetViewportTop)
    ? pending.targetViewportTop!
    : PAGINATION_SCROLL_FALLBACK_TOP;
  const targetTop = win.scrollY + target.getBoundingClientRect().top - targetViewportTop;
  win.scrollTo({
    top: Math.max(0, targetTop),
    left: win.scrollX,
    behavior: 'smooth',
  });
}

/**
 * 构造注入到 iframe 内的上下文脚本：
 *  - window.DASHBOARD_CTX —— 让模板 JS 知道自己属于哪个 agent / 看板 / 当前 inputs
 *  - window.dashboardPull(bindingName, extraInputs) —— 按需拉取单个 binding 数据（用于 manual binding 的点击下钻）
 *
 * 鉴权：父页面的全局 fetch 拦截器（api/client.ts）会给所有 /api/* 自动注入
 * Authorization 和租户上下文，但 iframe 里的 fetch 是 iframe 自己原生的，
 * 不会经过该拦截器。因此这里把当前的 Bearer token 和 tenantId 一并注入到
 * window.DASHBOARD_CTX，并在 fetch 时手动带上。
 */
function buildCtxScript(
  agentId: string | null | undefined,
  key: string | null | undefined,
  inputs: Record<string, unknown> | null | undefined,
  sessionId: string | null | undefined,
  snapshotId: string | null | undefined,
  authToken: string | null | undefined,
  tenantId: string | null | undefined,
): string {
  const ctx = {
    agentId: agentId || null,
    key: key || null,
    inputs: inputs || {},
    sessionId: sessionId || null,
    snapshotId: snapshotId || null,
    authToken: authToken || null,
    tenantId: tenantId || null,
  };
  // JSON.stringify 避免 HTML 注入（contextual 转义 < / & 等）
  const safeJson = JSON.stringify(ctx)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
  return `
<script>
(function(){
  window.DASHBOARD_CTX = ${safeJson};
  var __dashboardNativeFetch = window.fetch.bind(window);
  function dashboardRewriteLegacyApi(input) {
    if (typeof input !== 'string') return null;
    try {
      var url = new URL(input, window.location.href);
      if (url.origin !== window.location.origin || url.pathname.indexOf('/api/agents/') !== 0) {
        return null;
      }
      return '/api/v1' + url.pathname.slice(4) + url.search + url.hash;
    } catch (e) {
      return input.indexOf('/api/agents/') === 0 ? '/api/v1' + input.slice(4) : null;
    }
  }
  function dashboardNormalizeLegacyHeaders(input, init) {
    var ctx = window.DASHBOARD_CTX || {};
    var sourceHeaders = init && init.headers;
    if (!sourceHeaders && input && typeof input === 'object' && input.headers) {
      sourceHeaders = input.headers;
    }
    var headers = new Headers(sourceHeaders || {});
    if (headers.has('X-Team-Id') && !headers.has('X-Tenant-Id')) {
      headers.set('X-Tenant-Id', headers.get('X-Team-Id') || '');
    }
    if (ctx.tenantId && !headers.has('X-Tenant-Id')) {
      headers.set('X-Tenant-Id', ctx.tenantId);
    }
    if (ctx.authToken && !headers.has('Authorization')) {
      headers.set('Authorization', 'Bearer ' + ctx.authToken);
    }
    headers.delete('X-Team-Id');
    return Object.assign({}, init || {}, { headers: headers });
  }
  window.fetch = function(input, init) {
    var nextInput = input;
    var nextInit = init;
    var rewrittenUrl = null;
    if (typeof input === 'string' && input.indexOf('/api/agents/') === 0) {
      rewrittenUrl = '/api/v1' + input.slice(4);
      nextInput = rewrittenUrl;
    } else if (typeof input === 'string') {
      rewrittenUrl = dashboardRewriteLegacyApi(input);
      if (rewrittenUrl) nextInput = rewrittenUrl;
    } else if (input && typeof input === 'object' && input.url) {
      rewrittenUrl = dashboardRewriteLegacyApi(input.url);
      if (rewrittenUrl) nextInput = new Request(rewrittenUrl, input);
    }
    if (rewrittenUrl) {
      nextInit = dashboardNormalizeLegacyHeaders(input, init);
    }
    return __dashboardNativeFetch(nextInput, nextInit);
  };
  function dashboardFindScrollParent(el) {
    var parent = el && el.parentElement;
    while (parent) {
      var style = window.parent.getComputedStyle(parent);
      var overflowY = style.overflowY;
      if ((overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') && parent.scrollHeight > parent.clientHeight) {
        return parent;
      }
      parent = parent.parentElement;
    }
    return null;
  }
  function dashboardVisibleFrameRect() {
    try {
      var frame = window.frameElement;
      if (!frame || !window.parent) return null;
      var frameRect = frame.getBoundingClientRect();
      var top = 0;
      var bottom = window.parent.innerHeight || document.documentElement.clientHeight || 720;
      var scrollParent = dashboardFindScrollParent(frame);
      if (scrollParent) {
        var parentRect = scrollParent.getBoundingClientRect();
        top = Math.max(top, parentRect.top);
        bottom = Math.min(bottom, parentRect.bottom);
      }
      var visibleTop = Math.max(top, frameRect.top);
      var visibleBottom = Math.min(bottom, frameRect.bottom);
      var visibleHeight = Math.max(320, visibleBottom - visibleTop);
      return {
        top: Math.max(0, visibleTop - frameRect.top),
        height: Math.min(Math.max(320, frameRect.height), visibleHeight)
      };
    } catch (e) {
      return null;
    }
  }
  function dashboardSetStyle(el, prop, value) {
    if (!el || !el.style) return;
    if (el.style[prop] !== value) {
      el.style[prop] = value;
    }
  }
  function dashboardEnsureTemplateOverlayStyles() {
    if (document.getElementById('dashboard-template-overlay-style')) return;
    var style = document.createElement('style');
    style.id = 'dashboard-template-overlay-style';
    // 维护提醒：这些样式只服务 iframe 内的模板弹窗兜底状态。
    // 真正给用户看的企业名单/企业360弹窗由外层 React portal 渲染，避免被看板 iframe 裁切或遮罩错位。
    style.textContent = [
      '#chain-list-dialog,#co360-dialog{background:var(--bg-surface);border-radius:12px;box-shadow:0 16px 48px rgba(0,0,0,0.22);animation:dashboard-template-modal-in 0.18s ease-out;}',
      '#chain-list-header,#co360-header{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:0.5px solid var(--border-color);position:sticky;top:0;background:var(--bg-surface);z-index:2;border-radius:12px 12px 0 0;box-shadow:0 1px 4px rgba(0,0,0,0.06);}',
      '#chain-list-title,#co360-header-title{font-size:15px;font-weight:600;color:var(--text-primary);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.chain-modal-close,#co360-close-btn{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:6px;border:none;flex-shrink:0;margin-left:12px;background:transparent;cursor:pointer;color:var(--text-muted);font:inherit;font-size:18px;line-height:1;}',
      '.chain-modal-close:hover,#co360-close-btn:hover{background:var(--bg-elevated);color:var(--text-primary);}',
      '#chain-list-body,#co360-body{display:flex;flex-direction:column;padding:16px 20px;min-height:200px;scrollbar-gutter:stable;}',
      '#chain-list-body,#co360-body{scrollbar-width:thin;scrollbar-color:var(--bg-tertiary) transparent;}',
      '#chain-list-body::-webkit-scrollbar,#co360-body::-webkit-scrollbar{width:8px;height:8px;}',
      '#chain-list-body::-webkit-scrollbar-track,#co360-body::-webkit-scrollbar-track{background:transparent;}',
      '#chain-list-body::-webkit-scrollbar-thumb,#co360-body::-webkit-scrollbar-thumb{border-radius:4px;background:var(--bg-tertiary);}',
      '#chain-list-body::-webkit-scrollbar-thumb:hover,#co360-body::-webkit-scrollbar-thumb:hover{background:var(--border-color);}',
      '#chain-list-loading,#co360-loading{flex:1 1 auto;min-height:360px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0;color:var(--text-muted);font-size:13.5px;gap:14px;text-align:center;}',
      '.chain-spinner,.co360-spinner{width:24px;height:24px;border-radius:50%;border:2.5px solid var(--border-color);border-top-color:var(--text-secondary);animation:dashboard-template-spin 0.72s linear infinite;}',
      '#co360-frame{display:none;width:100%;border:none;}',
      '@keyframes dashboard-template-modal-in{from{opacity:0;transform:translateY(-10px);}to{opacity:1;transform:none;}}',
      '@keyframes dashboard-template-spin{to{transform:rotate(360deg);}}',
      '@media (prefers-reduced-motion: reduce){#chain-list-dialog,#co360-dialog,.chain-spinner,.co360-spinner{animation:none;}}'
    ].join('\\n');
    (document.head || document.documentElement).appendChild(style);
  }
  var dashboardLastChainListPayload = '';
  var dashboardLastRiskDetailPayload = '';
  function dashboardSyncChainListOverlay(overlay) {
    if (!overlay) return;
    var isOpen = window.getComputedStyle(overlay).display !== 'none';
    dashboardSetStyle(overlay, 'visibility', isOpen ? 'hidden' : '');
    dashboardSetStyle(overlay, 'pointerEvents', isOpen ? 'none' : '');
    var titleEl = document.getElementById('chain-list-title');
    var bodyEl = document.getElementById('chain-list-body');
    var payload = {
      type: 'dashboard:chain-list-overlay',
      open: isOpen,
      title: titleEl ? titleEl.textContent || '' : '',
      body_html: bodyEl ? bodyEl.innerHTML || '' : ''
    };
    var payloadKey = JSON.stringify(payload);
    if (payloadKey === dashboardLastChainListPayload) return;
    dashboardLastChainListPayload = payloadKey;
    try { parent.postMessage(payload, '*'); } catch (e) {}
  }
  function dashboardNormalizeDetailText(value) {
    return String(value || '').replace(/\\s+/g, ' ').trim();
  }
  function dashboardReadRiskDetailValue(bodyEl, label) {
    if (!bodyEl) return '';
    var terms = bodyEl.querySelectorAll('dt');
    for (var i = 0; i < terms.length; i++) {
      var term = terms[i];
      if (dashboardNormalizeDetailText(term.textContent) !== label) continue;
      var valueEl = term.nextElementSibling;
      return dashboardNormalizeDetailText(valueEl ? valueEl.textContent : '');
    }
    return '';
  }
  function dashboardPushDetailTag(tags, value) {
    var text = dashboardNormalizeDetailText(value);
    if (text && tags.indexOf(text) < 0) tags.push(text);
  }
  function dashboardSyncRiskDetailOverlay(overlay) {
    if (!overlay) return;
    var isOpen = overlay.classList.contains('show') || window.getComputedStyle(overlay).display !== 'none';
    dashboardSetStyle(overlay, 'visibility', isOpen ? 'hidden' : '');
    dashboardSetStyle(overlay, 'pointerEvents', isOpen ? 'none' : '');
    var card = document.getElementById('er-modal-card') || overlay.querySelector('.er-modal-card');
    var titleEl = card ? card.querySelector('.mh-title') : null;
    var subtitleEl = card ? card.querySelector('.mh-cat') : null;
    var bodyEl = card ? card.querySelector('.er-modal-body') : null;
    var tags = [];
    dashboardPushDetailTag(tags, subtitleEl ? subtitleEl.textContent || '' : '');
    dashboardPushDetailTag(tags, dashboardReadRiskDetailValue(bodyEl, '诉讼地位'));
    dashboardPushDetailTag(tags, dashboardReadRiskDetailValue(bodyEl, '案件进展'));
    var payload = {
      type: 'dashboard:risk-detail-overlay',
      open: isOpen,
      title: titleEl ? titleEl.textContent || '' : '',
      subtitle: subtitleEl ? subtitleEl.textContent || '' : '',
      tags: tags,
      body_html: bodyEl ? bodyEl.innerHTML || '' : ''
    };
    var payloadKey = JSON.stringify(payload);
    if (payloadKey === dashboardLastRiskDetailPayload) return;
    dashboardLastRiskDetailPayload = payloadKey;
    try { parent.postMessage(payload, '*'); } catch (e) {}
  }
  function dashboardPositionOverlay(overlay) {
    if (!overlay) return;
    dashboardEnsureTemplateOverlayStyles();
    var rect = dashboardVisibleFrameRect();
    dashboardSetStyle(overlay, 'position', 'absolute');
    dashboardSetStyle(overlay, 'left', '0px');
    dashboardSetStyle(overlay, 'right', '0px');
    dashboardSetStyle(overlay, 'bottom', 'auto');
    dashboardSetStyle(overlay, 'top', (rect ? rect.top : 0) + 'px');
    var overlayHeight = rect ? rect.height : Math.max(360, window.innerHeight || 640);
    dashboardSetStyle(overlay, 'minHeight', overlayHeight + 'px');
    var dialog = overlay.firstElementChild;
    if (dialog && dialog instanceof HTMLElement) {
      var maxDialogHeight = Math.max(260, overlayHeight - 48);
      var dialogHeight = Math.min(dialog.offsetHeight || maxDialogHeight, maxDialogHeight);
      var marginTop = Math.max(24, Math.floor((overlayHeight - dialogHeight) / 2));
      dashboardSetStyle(dialog, 'margin', marginTop + 'px auto 72px');
      dashboardSetStyle(dialog, 'maxHeight', maxDialogHeight + 'px');
      dashboardSetStyle(dialog, 'display', 'flex');
      dashboardSetStyle(dialog, 'flexDirection', 'column');
      dashboardSetStyle(dialog, 'overflow', 'hidden');
      var scrollBody = dialog.querySelector('#chain-list-body, #co360-body');
      if (scrollBody && scrollBody instanceof HTMLElement) {
        var header = dialog.querySelector('#chain-list-header, #co360-header');
        var headerHeight = header && header instanceof HTMLElement ? header.offsetHeight : 0;
        dashboardSetStyle(overlay, 'overflow', 'hidden');
        dashboardSetStyle(scrollBody, 'flex', '1 1 auto');
        dashboardSetStyle(scrollBody, 'display', 'flex');
        dashboardSetStyle(scrollBody, 'flexDirection', 'column');
        dashboardSetStyle(scrollBody, 'minHeight', '0px');
        dashboardSetStyle(scrollBody, 'maxHeight', Math.max(200, maxDialogHeight - headerHeight) + 'px');
        dashboardSetStyle(scrollBody, 'overflow', 'auto');
      }
    }
  }
  window.dashboardPositionOverlay = dashboardPositionOverlay;
  function dashboardWatchOverlay(id) {
    var overlay = document.getElementById(id);
    if (!overlay) return;
    var position = function() {
      if (id === 'chain-list-overlay') {
        // 企业名单仍由模板生成内容和分页行为；外层 React 只承载同一份 HTML。
        // 不要恢复全屏 iframe/遮罩方案，之前会导致背景和弹窗层级错乱。
        dashboardSyncChainListOverlay(overlay);
      }
      if (id === 'er-modal') {
        dashboardSyncRiskDetailOverlay(overlay);
        return;
      }
      if (window.getComputedStyle(overlay).display !== 'none') {
        dashboardPositionOverlay(overlay);
        setTimeout(function() { dashboardPositionOverlay(overlay); }, 0);
        setTimeout(function() { dashboardPositionOverlay(overlay); }, 80);
      }
    };
    position();
    new MutationObserver(position).observe(overlay, { attributes: true, childList: true, subtree: true });
    window.addEventListener('resize', position);
    try {
      var scrollParent = dashboardFindScrollParent(window.frameElement);
      if (scrollParent) scrollParent.addEventListener('scroll', position, { passive: true });
      window.parent.addEventListener('resize', position);
    } catch (e) {}
  }
  window.addEventListener('DOMContentLoaded', function() {
    dashboardWatchOverlay('chain-list-overlay');
    dashboardWatchOverlay('co360-overlay');
    dashboardWatchOverlay('er-modal');
  });
  window.addEventListener('message', function(ev) {
    var d = ev.data || {};
    if (d.type === 'dashboard:chain-list-close') {
      if (typeof window.closeNodeList === 'function') {
        window.closeNodeList();
      } else {
        var overlay = document.getElementById('chain-list-overlay');
        if (overlay) overlay.style.display = 'none';
      }
      dashboardLastChainListPayload = '';
      dashboardSyncChainListOverlay(document.getElementById('chain-list-overlay'));
      return;
    }
    if (d.type === 'dashboard:risk-detail-close') {
      if (typeof window.closeModal === 'function') {
        window.closeModal();
      } else {
        var detailOverlay = document.getElementById('er-modal');
        if (detailOverlay) {
          detailOverlay.classList.remove('show');
          detailOverlay.style.height = '';
        }
      }
      dashboardLastRiskDetailPayload = '';
      dashboardSyncRiskDetailOverlay(document.getElementById('er-modal'));
      return;
    }
    if (d.type === 'dashboard:chain-list-page') {
      var page = String(d.page || '');
      var btn = page ? document.querySelector('#chain-list-overlay .chain-page-btn[data-chain-page="' + page.replace(/"/g, '\\"') + '"]') : null;
      if (btn && !btn.disabled) btn.click();
    }
  });
  window.dashboardPull = function(bindingName, extraInputs) {
    var ctx = window.DASHBOARD_CTX || {};
    if (!ctx.agentId || !ctx.key) {
      return Promise.reject(new Error('DASHBOARD_CTX 未就绪'));
    }
    var merged = Object.assign({}, ctx.inputs || {}, extraInputs || {});
    var url = '/api/v1/agents/' + encodeURIComponent(ctx.agentId)
      + '/dashboards/' + encodeURIComponent(ctx.key)
      + '/bindings/' + encodeURIComponent(bindingName);
    var headers = {'Content-Type': 'application/json'};
    if (ctx.authToken) headers['Authorization'] = 'Bearer ' + ctx.authToken;
    if (ctx.tenantId) headers['X-Tenant-Id'] = ctx.tenantId;
    return fetch(url, {
      method: 'POST',
      headers: headers,
      credentials: 'same-origin',
      body: JSON.stringify({
        inputs: merged,
        session_id: ctx.sessionId || null,
        snapshot_id: ctx.snapshotId || null,
        parent_snapshot_id: ctx.snapshotId || null,
      }),
    }).then(function(r){
      if (!r.ok) {
        return r.text().then(function(t){ throw new Error('HTTP ' + r.status + ': ' + t); });
      }
      return r.json();
    });
  };
})();
</script>
`;
}

function updateDashboardSnapshotContext(
  doc: Document,
  snapshotId: string | null | undefined,
): void {
  const frameWindow = doc.defaultView as (Window & {
    DASHBOARD_CTX?: Record<string, unknown>;
  }) | null;
  if (!frameWindow?.DASHBOARD_CTX) return;
  frameWindow.DASHBOARD_CTX.snapshotId = snapshotId || null;
}

export const DashboardRenderer = forwardRef<DashboardRendererHandle, Props>(({
  html,
  agentId,
  dashboardKey,
  inputs,
  sessionId,
  snapshotId,
  streaming = false,
  finalizing = false,
  onReady,
  onPendingAiVisible,
  interactionState,
  onInteractionStateChange,
}, ref) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const co360FrameRef = useRef<HTMLIFrameElement>(null);
  const co360AbortRef = useRef<AbortController | null>(null);
  const pendingPaginationScrollRef = useRef<PendingPaginationScroll | null>(null);
  const pendingCo360PaginationScrollRef = useRef<PendingPaginationScroll | null>(null);
  const mainRenderTokenRef = useRef(0);
  const mainLoadedTokenRef = useRef(0);
  const pendingMainReadyRef = useRef<{ token: number; complete: () => void } | null>(null);
  const co360RenderTokenRef = useRef(0);
  const desiredStreamingRef = useRef(streaming);
  const finalizingRef = useRef(finalizing);
  const snapshotIdRef = useRef(snapshotId);
  const onReadyRef = useRef(onReady);
  const interactionStateRef = useRef<DashboardDocumentState | null>(
    (interactionState as DashboardDocumentState | null | undefined) || null,
  );
  const onInteractionStateChangeRef = useRef(onInteractionStateChange);
  const readyNotifiedRef = useRef('');
  const { theme } = useTheme();
  // 鉴权上下文：直接从 authStore 取，免得逐层往下传 prop。
  // 注：父页面的全局 fetch 拦截器（client.ts）只能拦到父页面的 fetch；
  // iframe 里的 fetch 是 iframe 自己的，必须把 token 显式注入进去。
  const authToken = useAuthStore((s) => s.token);
  const tenantId = useAuthStore((s) => s.tenant?.id ?? null);
  const paginateBinding = useDashboardStore((s) => s.paginateBinding);
  const [co360, setCo360] = useState<{
    open: boolean;
    title: string;
    html: string;
    inputs: Record<string, unknown> | null;
    snapshotId: string | null;
    loading: boolean;
    error: string | null;
  }>({ open: false, title: '', html: '', inputs: null, snapshotId: null, loading: false, error: null });
  const [templateListModal, setTemplateListModal] = useState<TemplateListModalState>({
    open: false,
    title: '',
    bodyHtml: '',
  });
  const [riskDetailModal, setRiskDetailModal] = useState<TemplateListModalState>({
    open: false,
    title: '',
    subtitle: '',
    tags: [],
    bodyHtml: '',
  });
  // 记录上一次写入时的主题：主题变了必须整写（CSS 变量在 shell 里）
  const lastThemeRef = useRef<string | null>(null);
  // 记录上一次注入的 ctx 关键字段：变了必须整写以更新 window.DASHBOARD_CTX。
  // token / tenantId 也纳入 key —— 重新登录或切租户后需要让 iframe 拿到最新值。
  const lastCtxKeyRef = useRef<string | null>(null);
  const lastHtmlRef = useRef<string | null>(null);
  const lastInteractionScopeRef = useRef<string | null>(null);
  // snapshotId 自身变化不要求重建文档；HTML 未变化时原地更新上下文即可，
  // 避免内容相同的 partial/final 因 ID 变化重复导航并闪烁。
  const ctxKey = `${agentId ?? ''}::${dashboardKey ?? ''}::${sessionId ?? ''}::${JSON.stringify(inputs ?? {})}::${authToken ?? ''}::${tenantId ?? ''}`;
  const interactionScopeKey = `${agentId ?? ''}::${dashboardKey ?? ''}::${sessionId ?? ''}::${JSON.stringify(inputs ?? {})}`;
  const desiredMainDocumentRef = useRef({ html, theme, ctxKey });
  // render 阶段立即更新目标文档。这样新 props 已提交、effect 尚未执行的窄窗口里，
  // 上一轮 iframe 的迟到 load 也会因目标不匹配而被拒绝。
  desiredMainDocumentRef.current = { html, theme, ctxKey };

  desiredStreamingRef.current = streaming;
  finalizingRef.current = finalizing;
  snapshotIdRef.current = snapshotId;
  onReadyRef.current = onReady;
  interactionStateRef.current = (interactionState as DashboardDocumentState | null | undefined) || null;
  onInteractionStateChangeRef.current = onInteractionStateChange;

  const notifyCurrentSnapshotReady = useCallback(() => {
    const currentSnapshotId = snapshotIdRef.current;
    if (!currentSnapshotId) return;
    // streaming 首屏和 final 收敛都要分别上报。首屏 ready 用于继续遮住上一轮结果，
    // final ready 用于结束 settling；同一文档从 streaming 切到 final 时也不能被去重掉。
    const readyPhase = finalizingRef.current ? 'final' : 'stream';
    const readyKey = `${currentSnapshotId}::${mainLoadedTokenRef.current}::${readyPhase}`;
    if (readyNotifiedRef.current === readyKey) return;
    readyNotifiedRef.current = readyKey;
    onReadyRef.current?.(snapshotIdRef.current);
  }, []);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument;
    if (!doc) return;

    const themeChanged = lastThemeRef.current !== theme;
    const ctxChanged = lastCtxKeyRef.current !== ctxKey;
    const htmlChanged = lastHtmlRef.current !== html;
    // partial/final 是完整累计快照。只有流式阶段且严格确认 AI block 外完全不变时，
    // 才允许局部替换，避免把融资等普通 binding 的后续结果漏在 iframe 外。
    const docInitialized = !!(doc.body && doc.body.hasChildNodes());
    // 只有流式展示标记变化时直接切换根 class，避免为一个纯视觉状态重写 iframe。
    if (docInitialized && !themeChanged && !ctxChanged && !htmlChanged) {
      updateDashboardSnapshotContext(doc, snapshotId);
      applyDashboardStreamingState(doc, streaming);
      if ((streaming || finalizing) && mainLoadedTokenRef.current === mainRenderTokenRef.current) {
        requestAnimationFrame(notifyCurrentSnapshotReady);
      }
      return;
    }
    const canPatchAiOnly = Boolean(
      streaming
      && !finalizing
      && lastHtmlRef.current
      && isStrictlyAiOnlyHtmlUpdate(lastHtmlRef.current, html),
    );
    if (docInitialized && !themeChanged && !ctxChanged && canPatchAiOnly && patchAiBlocks(doc, html)) {
      updateDashboardSnapshotContext(doc, snapshotId);
      applyDashboardStreamingState(doc, streaming);
      lastHtmlRef.current = html;
      return;
    }
    const documentState = docInitialized && lastInteractionScopeRef.current === interactionScopeKey
      ? collectDashboardDocumentState(doc)
      : interactionStateRef.current;

    // 首次写入 / 主题切换 / ctx 变化 / patch 失败兜底 → srcdoc 导航到新文档。
    // 与 document.open/write 不同，导航会创建新的 Window，全局初始化锁不会泄漏到下一轮查询。
    let wrapped = buildWidgetHtml(html, theme, dashboardKey);
    const ctxScript = buildCtxScript(agentId, dashboardKey, inputs, sessionId, snapshotId, authToken, tenantId);
    // 在 </body> 前注入 ctx + height-report 脚本：
    //   ctx 在前——模板内嵌脚本如有依赖可直接读
    //   height 脚本在后——保证它在内容渲染完后最后启动
    const renderToken = ++mainRenderTokenRef.current;
    const inject = ctxScript + CO360_BRIDGE_SCRIPT + EXTERNAL_LINK_BRIDGE_SCRIPT + PENDING_AI_BRIDGE_SCRIPT + PAGER_BRIDGE_SCRIPT + DASHBOARD_TAB_SCROLLBAR_STYLE + DASHBOARD_STREAMING_STYLE + HEIGHT_SCRIPT + DASHBOARD_READY_SCRIPT(renderToken);
    if (wrapped.includes('</body>')) {
      wrapped = wrapped.replace('</body>', inject + '</body>');
    } else {
      wrapped += inject;
    }
    lastThemeRef.current = theme;
    lastCtxKeyRef.current = ctxKey;
    lastHtmlRef.current = html;
    lastInteractionScopeRef.current = interactionScopeKey;

    let completed = false;
    const completeNavigation = () => {
      if (completed || renderToken !== mainRenderTokenRef.current) return;
      const desiredDocument = desiredMainDocumentRef.current;
      if (
        desiredDocument.html !== html
        || desiredDocument.ctxKey !== ctxKey
        || desiredDocument.theme !== theme
      ) return;
      const nextDoc = iframe.contentDocument;
      if (!nextDoc?.body?.hasChildNodes()) return;
      completed = true;
      mainLoadedTokenRef.current = renderToken;
      if (pendingMainReadyRef.current?.token === renderToken) {
        pendingMainReadyRef.current = null;
      }
      restoreDashboardDocumentState(nextDoc, documentState);
      const selectedNode = inputs?.node && typeof inputs.node === 'object'
        ? inputs.node as Record<string, unknown>
        : null;
      bindDashboardDocumentStateTracking(
        nextDoc,
        () => {
          if (renderToken !== mainRenderTokenRef.current) return;
          const current = collectDashboardDocumentState(nextDoc);
          const drilldown = interactionStateRef.current?.drilldown;
          onInteractionStateChangeRef.current?.(drilldown ? { ...current, drilldown } : current);
        },
        {
          code: typeof selectedNode?.value === 'string' ? selectedNode.value : undefined,
          name: typeof selectedNode?.label === 'string' ? selectedNode.label : undefined,
        },
      );
      const current = collectDashboardDocumentState(nextDoc);
      const drilldown = interactionStateRef.current?.drilldown;
      onInteractionStateChangeRef.current?.(drilldown ? { ...current, drilldown } : current);
      applyDashboardStreamingState(nextDoc, desiredStreamingRef.current);
      const pendingPaginationScroll = pendingPaginationScrollRef.current;
      if (pendingPaginationScroll) {
        pendingPaginationScrollRef.current = null;
        window.setTimeout(() => {
          if (iframeRef.current?.contentDocument) {
            scrollToPaginationAnchor(iframeRef.current, iframeRef.current.contentDocument, pendingPaginationScroll);
          }
        }, 80);
      }
      notifyCurrentSnapshotReady();
    };
    pendingMainReadyRef.current = { token: renderToken, complete: completeNavigation };
    iframe.addEventListener('load', completeNavigation, { once: true });
    iframe.srcdoc = wrapped;
    // 某些 WebView 对脚本触发的 srcdoc load 事件不稳定；readyState 只作同 token 的安全兜底。
    window.setTimeout(() => {
      if (renderToken === mainRenderTokenRef.current && iframe.contentDocument?.readyState === 'complete') {
        completeNavigation();
      }
    }, 1200);
  }, [html, theme, agentId, dashboardKey, sessionId, snapshotId, ctxKey, interactionScopeKey, authToken, tenantId, streaming, finalizing, notifyCurrentSnapshotReady]);

  const emitInteractionState = useCallback((patch: Partial<DashboardDocumentState> = {}) => {
    const doc = iframeRef.current?.contentDocument;
    const current = doc?.body?.hasChildNodes()
      ? collectDashboardDocumentState(doc)
      : interactionStateRef.current || {};
    onInteractionStateChangeRef.current?.({ ...current, ...patch });
  }, []);

  useEffect(() => {
    const co360Frame = co360FrameRef.current;
    const doc = co360Frame?.contentDocument;
    if (!co360Frame || !doc || !co360.open || !co360.html) return;
    const persistedDrilldown = (interactionStateRef.current?.drilldown || {});
    const checkedState = doc.body && doc.body.hasChildNodes()
      ? collectDashboardCheckedState(doc)
      : (persistedDrilldown.activeTab
        ? [{ id: persistedDrilldown.activeTab, name: 't360-tab', value: '' }]
        : []);
    let wrapped = buildWidgetHtml(co360.html, theme, 'enterprise-360');
    const ctxScript = buildCtxScript(
      agentId,
      'enterprise-360',
      co360.inputs,
      sessionId,
      co360.snapshotId,
      authToken,
      tenantId,
    );
    const inject = ctxScript + EXTERNAL_LINK_BRIDGE_SCRIPT + PENDING_AI_BRIDGE_SCRIPT + PAGER_BRIDGE_SCRIPT + DASHBOARD_TAB_SCROLLBAR_STYLE + HEIGHT_SCRIPT;
    if (wrapped.includes('</body>')) {
      wrapped = wrapped.replace('</body>', inject + '</body>');
    } else {
      wrapped += inject;
    }
    const renderToken = ++co360RenderTokenRef.current;
    const completeNavigation = () => {
      if (renderToken !== co360RenderTokenRef.current) return;
      const nextDoc = co360Frame.contentDocument;
      if (!nextDoc?.body?.hasChildNodes()) return;
      if (checkedState.length > 0) {
        restoreDashboardCheckedState(nextDoc, checkedState);
      }
      nextDoc.addEventListener('change', (event) => {
        const input = event.target as HTMLInputElement | null;
        if (!input?.matches?.('input[type="radio"]') || input.name !== 't360-tab' || !input.checked) return;
        const nextInputs = co360.inputs || {};
        emitInteractionState({
          drilldown: {
            open: true,
            companyName: String(nextInputs.company_name || ''),
            creditCode: String(nextInputs.credit_code || '') || undefined,
            activeTab: input.id || undefined,
          },
        });
      }, true);
      const pendingCo360PaginationScroll = pendingCo360PaginationScrollRef.current;
      if (pendingCo360PaginationScroll) {
        pendingCo360PaginationScrollRef.current = null;
        window.setTimeout(() => {
          const currentDoc = co360FrameRef.current?.contentDocument;
          if (currentDoc) {
            scrollDashboardDocumentToPaginationAnchor(currentDoc, pendingCo360PaginationScroll);
          }
        }, 80);
      }
    };
    co360Frame.addEventListener('load', completeNavigation, { once: true });
    co360Frame.srcdoc = wrapped;
  }, [co360.html, co360.inputs, co360.open, co360.snapshotId, theme, agentId, sessionId, authToken, tenantId, emitInteractionState]);

  const closeCo360 = () => {
    if (co360AbortRef.current) {
      co360AbortRef.current.abort();
      co360AbortRef.current = null;
    }
    pendingCo360PaginationScrollRef.current = null;
    setCo360({ open: false, title: '', html: '', inputs: null, snapshotId: null, loading: false, error: null });
    emitInteractionState({ drilldown: { open: false } });
  };

  const updateCo360Snapshot = useCallback((snapshot: DashboardSnapshot, nextInputs?: Record<string, unknown>) => {
    setCo360((prev) => ({
      ...prev,
      html: snapshot.html,
      inputs: nextInputs ?? snapshot.inputs ?? prev.inputs,
      snapshotId: snapshot.snapshot_id || prev.snapshotId,
      loading: false,
      error: null,
    }));
  }, []);

  const paginateCo360Binding = useCallback((
    binding: string,
    page: number,
    pageSize: number,
  ) => {
    if (!agentId || !co360.inputs) return;
    if (co360AbortRef.current) {
      co360AbortRef.current.abort();
    }
    const payload = buildPaginationPayload(co360.inputs, binding, page, pageSize);
    const controller = new AbortController();
    co360AbortRef.current = controller;
    setCo360((prev) => ({ ...prev, error: null }));
    void refreshDashboardStream(
      agentId,
      'enterprise-360',
      payload,
      (snapshot) => {
        if (!isDashboardSnapshotReadyForDisplay(snapshot)) {
          return;
        }
        updateCo360Snapshot(snapshot, payload);
      },
      (snapshot) => {
        updateCo360Snapshot(snapshot, payload);
      },
      {
        signal: controller.signal,
        sessionId,
        skipAi: true,
        scope: 'modal',
        parentSnapshotId: snapshotId || null,
        persist: true,
      },
    ).catch((e) => {
      if (controller.signal.aborted) return;
      setCo360((prev) => ({
        ...prev,
        loading: false,
        error: e?.message || '企业360透视分页加载失败',
      }));
    }).finally(() => {
      if (co360AbortRef.current === controller) {
        co360AbortRef.current = null;
      }
    });
  }, [agentId, co360.inputs, sessionId, snapshotId, updateCo360Snapshot]);

  const openEnterprise360 = useCallback((companyNameRaw: unknown, creditCodeRaw?: unknown) => {
    const companyName = String(companyNameRaw || '').trim();
    const creditCode = String(creditCodeRaw || '').trim();
    if (!companyName || !agentId) return;
    if (co360AbortRef.current) {
      co360AbortRef.current.abort();
    }
    const controller = new AbortController();
    co360AbortRef.current = controller;
    pendingCo360PaginationScrollRef.current = null;
    const inputs = {
      company_name: companyName,
      company_full_name: companyName,
      ...(creditCode ? { credit_code: creditCode } : {}),
    };
    setCo360({
      open: true,
      title: `${companyName} · 企业360透视`,
      html: '',
      inputs,
      snapshotId: null,
      loading: true,
      error: null,
    });
    emitInteractionState({
      drilldown: {
        open: true,
        companyName,
        creditCode: creditCode || undefined,
      },
    });
    void refreshDashboardStream(
      agentId,
      'enterprise-360',
      inputs,
      (snapshot) => {
        if (!isDashboardSnapshotReadyForDisplay(snapshot)) {
          return;
        }
        setCo360((prev) => ({
          ...prev,
          html: snapshot.html,
          inputs: snapshot.inputs || prev.inputs,
          snapshotId: snapshot.snapshot_id || prev.snapshotId,
          loading: false,
          error: null,
        }));
      },
      (snapshot) => {
        setCo360((prev) => ({
          ...prev,
          html: snapshot.html,
          inputs: snapshot.inputs || prev.inputs,
          snapshotId: snapshot.snapshot_id || prev.snapshotId,
          loading: false,
          error: null,
        }));
      },
      {
        signal: controller.signal,
        sessionId,
        waitAi: true,
        scope: 'modal',
        parentSnapshotId: snapshotId || null,
        persist: true,
      },
    ).catch((e) => {
      if (controller.signal.aborted) return;
      setCo360((prev) => ({
        ...prev,
        loading: false,
        error: e?.message || '企业360透视加载失败',
      }));
    }).finally(() => {
      if (co360AbortRef.current === controller) {
        co360AbortRef.current = null;
      }
    });
  }, [agentId, emitInteractionState, sessionId, snapshotId]);

  useEffect(() => {
    const drilldown = (interactionState as DashboardDocumentState | null | undefined)?.drilldown;
    if (!drilldown?.open || co360.open || !drilldown.companyName) return;
    openEnterprise360(drilldown.companyName, drilldown.creditCode);
  }, [co360.open, interactionState, openEnterprise360]);

  const closeTemplateListModal = useCallback(() => {
    setTemplateListModal({ open: false, title: '', bodyHtml: '' });
    iframeRef.current?.contentWindow?.postMessage({ type: 'dashboard:chain-list-close' }, '*');
  }, []);

  const closeRiskDetailModal = useCallback(() => {
    setRiskDetailModal({ open: false, title: '', subtitle: '', tags: [], bodyHtml: '' });
    iframeRef.current?.contentWindow?.postMessage({ type: 'dashboard:risk-detail-close' }, '*');
  }, []);

  const requestTemplateListPage = useCallback((page: string) => {
    iframeRef.current?.contentWindow?.postMessage({ type: 'dashboard:chain-list-page', page }, '*');
  }, []);

  const handleTemplateListBodyClick = useCallback((ev: MouseEvent<HTMLDivElement>) => {
    const target = ev.target instanceof Element ? ev.target : null;
    if (!target) return;
    const pageButton = target.closest('.chain-page-btn');
    if (pageButton instanceof HTMLButtonElement) {
      if (pageButton.disabled) return;
      const page = pageButton.getAttribute('data-chain-page') || '';
      if (page) requestTemplateListPage(page);
      return;
    }
    const companyLink = target.closest('.co-name-link');
    if (companyLink instanceof HTMLElement) {
      const companyName = companyLink.getAttribute('data-company') || companyLink.textContent || '';
      const creditCode = companyLink.getAttribute('data-credit-code') || '';
      openEnterprise360(companyName, creditCode || undefined);
    }
  }, [openEnterprise360, requestTemplateListPage]);

  // 监听 iframe 内上报的高度和企业 360 下钻消息。
  useEffect(() => {
    function onMsg(ev: MessageEvent) {
      const d = ev.data as {
        type?: string;
        height?: number;
        company_name?: string;
        credit_code?: string;
        binding?: string;
        anchor?: string;
        page?: number;
        pageSize?: number;
        open?: boolean;
        title?: string;
        body_html?: string;
        subtitle?: string;
        tags?: unknown;
        render_token?: number;
      };
      if (!d) return;
      const ifr = iframeRef.current;
      const co360Frame = co360FrameRef.current;
      if (!ifr) return;
      // 仅接受自家 iframe 上报，避免不同 iframe 互相串台
      const fromMainFrame = ev.source === ifr.contentWindow;
      const fromCo360Frame = Boolean(co360Frame && ev.source === co360Frame.contentWindow);
      if (ev.source && !fromMainFrame && !fromCo360Frame) return;
      const sourceFrame = fromCo360Frame && co360Frame ? co360Frame : ifr;
      if (d.type === 'dashboard:ready' && fromMainFrame) {
        const pendingReady = pendingMainReadyRef.current;
        if (pendingReady && Number(d.render_token) === pendingReady.token) {
          pendingReady.complete();
        }
        window.setTimeout(() => {
          window.requestAnimationFrame(() => {
            const doc = sourceFrame.contentDocument;
            if (doc) syncIframeContentHeight(sourceFrame, doc);
          });
        }, 0);
        return;
      }
      if (d.type === 'dashboard:height') {
        if (fromCo360Frame) return;
        const doc = sourceFrame.contentDocument;
        if (doc) syncIframeContentHeight(sourceFrame, doc);
        return;
      }
      if (d.type === 'dashboard:pending-ai-visible') {
        onPendingAiVisible?.();
        return;
      }
      if (d.type === 'dashboard:chain-list-overlay') {
        const frameDoc = ifr.contentDocument;
        if (frameDoc) {
          frameDoc.documentElement.setAttribute('data-dashboard-chain-open', String(Boolean(d.open)));
          const current = collectDashboardDocumentState(frameDoc);
          const drilldown = interactionStateRef.current?.drilldown;
          onInteractionStateChangeRef.current?.(drilldown ? { ...current, drilldown } : current);
        }
        setTemplateListModal({
          open: Boolean(d.open),
          title: String(d.title || ''),
          bodyHtml: String(d.body_html || ''),
        });
        return;
      }
      if (d.type === 'dashboard:risk-detail-overlay') {
        setRiskDetailModal({
          open: Boolean(d.open),
          title: String(d.title || ''),
          subtitle: String(d.subtitle || ''),
          tags: Array.isArray(d.tags) ? d.tags.map((tag) => String(tag || '').trim()).filter(Boolean) : [],
          bodyHtml: decorateRiskDetailBodyHtml(String(d.body_html || '')),
        });
        return;
      }
      if (d.type === 'dashboard:paginate-binding') {
        const binding = String(d.binding || '').trim();
        const anchor = String(d.anchor || '').trim();
        const page = Math.floor(Number(d.page || 1));
        const pageSize = Math.floor(Number(d.pageSize || 50));
        if (binding && Number.isFinite(page) && page > 0) {
          if (fromCo360Frame) {
            const targetViewportTop = sourceFrame.contentDocument
              ? captureDocumentPaginationViewportTop(sourceFrame.contentDocument, { anchor, binding })
              : undefined;
            pendingCo360PaginationScrollRef.current = { anchor, binding, targetViewportTop };
            paginateCo360Binding(binding, page, Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 50);
            return;
          }
          const targetViewportTop = sourceFrame.contentDocument
            ? capturePaginationViewportTop(sourceFrame, sourceFrame.contentDocument, { anchor, binding })
            : undefined;
          pendingPaginationScrollRef.current = { anchor, binding, targetViewportTop };
          void paginateBinding(binding, page, Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 50);
        }
        return;
      }
      if (d.type === 'dashboard:open-enterprise-360') {
        openEnterprise360(d.company_name, d.credit_code);
      }
      if (d.type === 'dashboard:moss-insight') {
        track('board_moss_insight', { board_id: typeof (d as Record<string, unknown>).board_id === 'string' ? (d as Record<string, unknown>).board_id as string : undefined });
      }
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [agentId, onPendingAiVisible, openEnterprise360, paginateBinding, paginateCo360Binding]);

  useImperativeHandle(ref, () => ({
    async exportImage(filename: string) {
      const ifr = iframeRef.current;
      const doc = ifr?.contentDocument;
      const win = ifr?.contentWindow;
      if (!ifr || !doc || !doc.body || !doc.documentElement || !win) {
        throw new Error('iframe 未就绪');
      }
      const { default: html2canvas } = await import('html2canvas');
      await waitForFonts(doc);

      const bodyStyle = win.getComputedStyle(doc.body);
      const documentStyle = win.getComputedStyle(doc.documentElement);
      const backgroundColor = resolveDashboardExportBackground([
        bodyStyle.backgroundColor,
        documentStyle.backgroundColor,
        window.getComputedStyle(ifr).backgroundColor,
        documentStyle.getPropertyValue('--bg-canvas'),
        documentStyle.getPropertyValue('--bg-primary'),
      ]);

      const canvas = await html2canvas(doc.body, {
        backgroundColor,
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        // 交给浏览器原生排版，避免 CanvasRenderer 用拉丁字符基线绘制回退中文字体时发生下沉和裁切。
        foreignObjectRendering: true,
        windowWidth: doc.documentElement.scrollWidth,
        windowHeight: doc.documentElement.scrollHeight,
      });
      const dataUrl = canvas.toDataURL('image/png');
      if (!dataUrl) {
        throw new Error('截图返回为空');
      }
      // 触发浏览器下载
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    },
  }), []);

  const co360Overlay = co360.open ? (
    <div className="dashboard-co360-overlay" role="dialog" aria-modal="true" aria-label="企业360透视">
      <div className="dashboard-co360-dialog">
        <div className="dashboard-co360-header">
          <div className="dashboard-co360-title">{co360.title || '企业360透视'}</div>
          <button type="button" className="dashboard-co360-close" onClick={closeCo360} aria-label="关闭">
            <X size={22} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
        <div className="dashboard-co360-body">
          {co360.loading && (
            <div className="dashboard-co360-state">
              <span className="dashboard-co360-spinner" aria-hidden="true" />
              <span>正在加载企业数据…</span>
            </div>
          )}
          {co360.error && <div className="dashboard-co360-error">{co360.error}</div>}
          {co360.html && (
            <iframe
              ref={co360FrameRef}
              title="enterprise-360"
              className="dashboard-co360-frame"
              sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox allow-downloads"
            />
          )}
        </div>
      </div>
    </div>
  ) : null;
  // 维护提醒：下钻弹窗必须 portal 到 document.body，才能位于整个 Moss 产品居中。
  // 企业名单的内容来自 iframe 模板，关闭/分页通过 postMessage 同步回模板，不要改成直接在 iframe 内显示。
  const templateListOverlay = templateListModal.open ? (
    <div
      className="dashboard-template-list-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={templateListModal.title || '企业名单'}
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget) {
          closeTemplateListModal();
        }
      }}
    >
      <div className="dashboard-template-list-dialog">
        <div className="dashboard-template-list-header">
          <div className="dashboard-template-list-title">{templateListModal.title || '企业名单'}</div>
          <button type="button" className="dashboard-template-list-close" onClick={closeTemplateListModal} aria-label="关闭">
            <X size={22} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
        <div
          className="dashboard-template-list-body"
          onClick={handleTemplateListBodyClick}
          // 看板模板由服务端可信模板生成；外层弹窗只负责承载同一份 HTML。
          dangerouslySetInnerHTML={{ __html: templateListModal.bodyHtml }}
        />
      </div>
    </div>
  ) : null;

  const riskDetailOverlay = riskDetailModal.open ? (
    <div
      className="dashboard-risk-detail-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={riskDetailModal.title || '风险详情'}
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget) {
          closeRiskDetailModal();
        }
      }}
    >
      <div className="dashboard-risk-detail-dialog">
        <div className="dashboard-risk-detail-header">
          <div className="dashboard-risk-detail-heading">
            <div className="dashboard-risk-detail-title">{riskDetailModal.title || '风险详情'}</div>
            {riskDetailModal.tags?.length ? (
              <div className="dashboard-risk-detail-tags">
                {riskDetailModal.tags.map((tag, index) => (
                  <span
                    key={`${tag}-${index}`}
                    className={`dashboard-risk-detail-tag ${getRiskDetailHeaderTagClass(tag, index)}`}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : riskDetailModal.subtitle ? (
              <div className="dashboard-risk-detail-tags">
                <span className="dashboard-risk-detail-tag is-kind">{riskDetailModal.subtitle}</span>
              </div>
            ) : null}
          </div>
          <button type="button" className="dashboard-risk-detail-close" onClick={closeRiskDetailModal} aria-label="关闭">
            <X size={22} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
        <div
          className="dashboard-risk-detail-body"
          // 看板模板由服务端可信模板生成；外层弹窗只负责承载同一份详情 HTML。
          dangerouslySetInnerHTML={{ __html: riskDetailModal.bodyHtml }}
        />
      </div>
    </div>
  ) : null;

  return (
    <>
      <iframe
        ref={iframeRef}
        title="dashboard"
        className="dashboard-iframe"
        sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox allow-downloads"
      />
      {templateListOverlay && createPortal(templateListOverlay, document.body)}
      {riskDetailOverlay && createPortal(riskDetailOverlay, document.body)}
      {co360Overlay && createPortal(co360Overlay, document.body)}
    </>
  );
});

DashboardRenderer.displayName = 'DashboardRenderer';
