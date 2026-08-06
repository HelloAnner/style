type Theme = 'light' | 'dark';

interface ColorRamp {
  50: [string, string];   // [light, dark]
  100: [string, string];
  200: [string, string];
  400: [string, string];
  600: [string, string];
  800: [string, string];
  900: [string, string];
}

const COLOR_RAMPS: Record<string, ColorRamp> = {
  purple: {
    50:  ['#faf5ff', '#1a0a2e'],
    100: ['#f3e8ff', '#2d1654'],
    200: ['#e9d5ff', '#4c1d95'],
    400: ['#c084fc', '#a855f7'],
    600: ['#9333ea', '#c084fc'],
    800: ['#6b21a8', '#e9d5ff'],
    900: ['#581c87', '#f3e8ff'],
  },
  teal: {
    50:  ['#f0fdfa', '#042f2e'],
    100: ['#ccfbf1', '#134e4a'],
    200: ['#99f6e4', '#115e59'],
    400: ['#2dd4bf', '#14b8a6'],
    600: ['#0d9488', '#2dd4bf'],
    800: ['#115e59', '#99f6e4'],
    900: ['#134e4a', '#ccfbf1'],
  },
  coral: {
    50:  ['#fff7ed', '#2a1708'],
    100: ['#ffedd5', '#4a2512'],
    200: ['#fed7aa', '#7c3a1a'],
    400: ['#fb923c', '#f97316'],
    600: ['#ea580c', '#fb923c'],
    800: ['#9a3412', '#fed7aa'],
    900: ['#7c2d12', '#ffedd5'],
  },
  pink: {
    50:  ['#fdf2f8', '#2a0a1e'],
    100: ['#fce7f3', '#4a1234'],
    200: ['#fbcfe8', '#831843'],
    400: ['#f472b6', '#ec4899'],
    600: ['#db2777', '#f472b6'],
    800: ['#9d174d', '#fbcfe8'],
    900: ['#831843', '#fce7f3'],
  },
  blue: {
    50:  ['#eff6ff', '#0a1628'],
    100: ['#dbeafe', '#1e2d4a'],
    200: ['#bfdbfe', '#1e3a5f'],
    400: ['#60a5fa', '#3b82f6'],
    600: ['#2563eb', '#60a5fa'],
    800: ['#1e40af', '#bfdbfe'],
    900: ['#1e3a8a', '#dbeafe'],
  },
  green: {
    50:  ['#f0fdf4', '#052e16'],
    100: ['#dcfce7', '#14532d'],
    200: ['#bbf7d0', '#166534'],
    400: ['#4ade80', '#22c55e'],
    600: ['#16a34a', '#4ade80'],
    800: ['#166534', '#bbf7d0'],
    900: ['#14532d', '#dcfce7'],
  },
  amber: {
    50:  ['#fffbeb', '#2a1f04'],
    100: ['#fef3c7', '#4a3608'],
    200: ['#fde68a', '#78560d'],
    400: ['#fbbf24', '#f59e0b'],
    600: ['#d97706', '#fbbf24'],
    800: ['#92400e', '#fde68a'],
    900: ['#78350f', '#fef3c7'],
  },
  red: {
    50:  ['#fef2f2', '#2a0a0a'],
    100: ['#fee2e2', '#4a1212'],
    200: ['#fecaca', '#7f1d1d'],
    400: ['#f87171', '#ef4444'],
    600: ['#dc2626', '#f87171'],
    800: ['#991b1b', '#fecaca'],
    900: ['#7f1d1d', '#fee2e2'],
  },
  gray: {
    50:  ['#fafafa', '#18181b'],
    100: ['#f4f4f5', '#27272a'],
    200: ['#e4e4e7', '#3f3f46'],
    400: ['#a1a1aa', '#71717a'],
    600: ['#52525b', '#a1a1aa'],
    800: ['#27272a', '#e4e4e7'],
    900: ['#18181b', '#f4f4f5'],
  },
};

const STOPS = [50, 100, 200, 400, 600, 800, 900] as const;

function generateBaseVars(theme: Theme): string {
  const isLight = theme === 'light';
  return `
  --bg-primary: ${isLight ? '#FAF9F7' : '#0A0A0F'};
  --bg-canvas: var(--bg-primary);
  --bg-surface: ${isLight ? '#FFFFFF' : '#121218'};
  --bg-secondary: ${isLight ? '#F7F8FA' : '#18181F'};
  --bg-elevated: ${isLight ? '#FFFFFF' : '#1A1A20'};
  --bg-tertiary: ${isLight ? '#F1F3F5' : '#202027'};
  --text-primary: ${isLight ? '#1A1A1A' : '#FAFAFA'};
  --text-secondary: ${isLight ? '#3A3A3A' : '#E4E4E7'};
  --text-tertiary: ${isLight ? '#5F6368' : '#A1A1AA'};
  --text-muted: ${isLight ? '#7A7A7A' : '#71717A'};
  --border-color: ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)'};
  --border-radius: 8px;
  --interactive-default: ${isLight ? '#F0EFED' : '#3F3F46'};
  --interactive-hover: ${isLight ? '#E8E7E5' : '#52525B'};
  --brand-primary: ${isLight ? '#2563EB' : '#60A5FA'};
  --accent-color: var(--brand-primary);
  --btn-primary-bg: var(--brand-primary);
  --btn-primary-text: ${isLight ? '#FFFFFF' : '#0A0A0F'};
  --color-error: ${isLight ? '#DC2626' : '#F87171'};
  --font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --widget-max-width: 100%;
  --widget-padding: 16px;
  --dashboard-air-blue: ${isLight ? '#E3F7FF' : '#102D3D'};
  --dashboard-glacier-blue: ${isLight ? '#A9E3FA' : '#18506A'};
  --dashboard-ice-white: ${isLight ? '#FCFEFF' : '#14252E'};
  --dashboard-lime-mist: ${isLight ? '#E8F4A8' : '#34451D'};
  --dashboard-lime-glow: ${isLight ? '#D7F052' : '#9FBE35'};
  --dashboard-cobalt: ${isLight ? '#0878D1' : '#70C8FF'};
  --dashboard-olive-ink: ${isLight ? '#4E651C' : '#D8EB8B'};
  --dashboard-deep-blue: ${isLight ? '#18506F' : '#B6DDEA'};
  --dashboard-hero-start: ${isLight ? '#ECF8F0' : '#203128'};
  --dashboard-hero-end: ${isLight ? '#DCEEDF' : '#29402F'};
  --dashboard-hero-border: ${isLight ? '#BED9C5' : 'rgba(161, 207, 173, 0.28)'};
  --dashboard-tab-hero-start: ${isLight ? '#FBFDFC' : '#1C2924'};
  --dashboard-tab-hero-end: ${isLight ? '#EEF8E8' : '#293A2B'};
  --dashboard-tab-hero-border: ${isLight ? '#CDE3D4' : 'rgba(164, 205, 173, 0.24)'};
  --dashboard-kpi-start: ${isLight ? '#F8FCFD' : '#17272F'};
  --dashboard-kpi-end: ${isLight ? '#EAF5F2' : '#233431'};
  --dashboard-kpi-blue-end: ${isLight ? '#E1F2F8' : '#193844'};
  --dashboard-kpi-green-end: ${isLight ? '#EEF7E8' : '#293A29'};
  --dashboard-kpi-blend-end: ${isLight ? '#E7F4F0' : '#213834'};
  --dashboard-kpi-neutral-end: ${isLight ? '#EDF5F7' : '#223238'};
  --dashboard-kpi-surface: ${isLight ? '#FBFDFE' : '#18252C'};
  --dashboard-kpi-border: ${isLight ? '#E2E7E3' : 'rgba(214, 228, 219, 0.14)'};
  --dashboard-kpi-accent: ${isLight ? '#AFC8C0' : '#75978C'};
  --dashboard-kpi-number: ${isLight ? '#244652' : '#C6DEE5'};
  --dashboard-kpi-label: ${isLight ? '#3F6068' : '#AFC8CE'};
  --dashboard-kpi-trial-start: ${isLight ? '#E3F3F7' : '#1D3540'};
  --dashboard-kpi-trial-end: ${isLight ? '#F5FBFD' : '#17282F'};
  --dashboard-kpi-trial-border: ${isLight ? '#D8E3DF' : 'rgba(175, 200, 193, 0.22)'};
  --dashboard-kpi-trial-accent: ${isLight ? '#8FAFA6' : '#88A9A0'};
  --dashboard-kpi-trial-text: ${isLight ? '#2F6FE4' : '#78A5FF'};
  --dashboard-kpi-trial-label: ${isLight ? '#55746C' : '#A6C2BA'};
  --dashboard-kpi-accent-blue: ${isLight ? '#247FB2' : '#76C6FF'};
  --dashboard-kpi-accent-green: ${isLight ? '#557C2F' : '#B3D77D'};
  --dashboard-kpi-accent-deep: ${isLight ? '#18506F' : '#9CD8EA'};
  --dashboard-kpi-accent-cobalt: ${isLight ? '#3C73C8' : '#8DAEFF'};
  --dashboard-kpi-line-blue: ${isLight ? 'rgba(64, 145, 190, 0.68)' : 'rgba(118, 198, 255, 0.58)'};
  --dashboard-kpi-line-green: ${isLight ? 'rgba(104, 142, 72, 0.68)' : 'rgba(179, 215, 125, 0.58)'};
  --dashboard-kpi-line-deep: ${isLight ? 'rgba(49, 105, 128, 0.68)' : 'rgba(156, 216, 234, 0.58)'};
  --dashboard-kpi-line-cobalt: ${isLight ? 'rgba(82, 124, 190, 0.68)' : 'rgba(141, 174, 255, 0.58)'};
  --dashboard-frost-border: ${isLight ? 'rgba(71, 170, 211, 0.25)' : 'rgba(113, 207, 242, 0.24)'};
  --dashboard-lime-border: ${isLight ? 'rgba(155, 184, 45, 0.30)' : 'rgba(190, 218, 80, 0.28)'};`;
}

const DASHBOARD_PALETTE_KEYS = new Set([
  'enterprise-360',
  'bidding-query',
  'company-filter',
  'industry-chain',
  'batch-query',
  'enterprise-risk',
]);

function buildDashboardPaletteOverrides(dashboardKey?: string | null): string {
  if (!dashboardKey || !DASHBOARD_PALETTE_KEYS.has(dashboardKey)) return '';

  const kpiAccentSequence = dashboardKey === 'enterprise-risk' ? `
  .kpi {
    border-top: 0.5px solid var(--dashboard-kpi-border) !important;
  }
  .kpi.blue {
    --dashboard-kpi-card-accent: var(--dashboard-kpi-accent-blue);
    --dashboard-kpi-card-line: var(--dashboard-kpi-line-blue);
  }
  .kpi.amber {
    --dashboard-kpi-card-accent: var(--amber-800);
    --dashboard-kpi-card-line: rgba(217, 119, 6, 0.5);
  }
  .kpi.red, .kpi.alert {
    --dashboard-kpi-card-accent: var(--red-600);
    --dashboard-kpi-card-line: rgba(220, 38, 38, 0.5);
  }
  .kpi.coral {
    --dashboard-kpi-card-accent: var(--coral-600);
    --dashboard-kpi-card-line: rgba(249, 115, 22, 0.5);
  }
  .kpi::after {
    background: var(--dashboard-kpi-card-line) !important;
  }
  .kpi.red.alert {
    background-color: var(--red-50) !important;
    border-color: var(--red-400) !important;
    box-shadow: 0 0 0 1px var(--red-200) !important;
  }
  .kpi .k-label .dot {
    background: var(--dashboard-kpi-card-accent) !important;
  }` : `
  .kpi:nth-child(4n + 1), .kpi:nth-of-type(4n + 1) {
    --dashboard-kpi-card-accent: var(--dashboard-kpi-accent-blue);
    --dashboard-kpi-card-line: var(--dashboard-kpi-line-blue);
  }
  .kpi:nth-child(4n + 2), .kpi:nth-of-type(4n + 2) {
    --dashboard-kpi-card-accent: var(--dashboard-kpi-accent-green);
    --dashboard-kpi-card-line: var(--dashboard-kpi-line-green);
  }
  .kpi:nth-child(4n + 3), .kpi:nth-of-type(4n + 3) {
    --dashboard-kpi-card-accent: var(--dashboard-kpi-accent-deep);
    --dashboard-kpi-card-line: var(--dashboard-kpi-line-deep);
  }
  .kpi:nth-child(4n), .kpi:nth-of-type(4n) {
    --dashboard-kpi-card-accent: var(--dashboard-kpi-accent-cobalt);
    --dashboard-kpi-card-line: var(--dashboard-kpi-line-cobalt);
  }`;

  return `<style data-dashboard-palette="glacier-lime">
  .hero, .biz-hero {
    background: linear-gradient(135deg, var(--dashboard-tab-hero-start) 0%, var(--dashboard-tab-hero-end) 100%) !important;
    border-color: var(--dashboard-tab-hero-border) !important;
    box-shadow: 0 1px 2px rgba(36, 52, 43, 0.035), 0 8px 22px rgba(57, 78, 65, 0.055) !important;
  }
  .hero::before, .biz-hero::before {
    display: none !important;
  }
  .kpi {
    --dashboard-kpi-card-accent: var(--dashboard-kpi-accent-blue);
    --dashboard-kpi-card-line: var(--dashboard-kpi-line-blue);
    position: relative;
    overflow: hidden;
    background-color: var(--dashboard-kpi-surface) !important;
    background-image: none !important;
    border-color: var(--dashboard-kpi-border) !important;
    border-top: 0.5px solid var(--dashboard-kpi-border) !important;
    box-shadow: 0 2px 8px rgba(49, 78, 68, 0.06) !important;
  }
  .kpi:not(:has(.risk-rows))::before {
    content: '' !important;
    display: block !important;
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    height: 3px !important;
    background: var(--dashboard-kpi-card-line) !important;
    border-radius: 0 !important;
    pointer-events: none !important;
  }
  .card,
  .group-card,
  .dist-row,
  .node-row,
  .leader-item,
  .cert-item,
  .item-list > li,
  .result-table tbody tr {
    border-color: var(--dashboard-kpi-border) !important;
  }
  .group-card,
  .dist-row,
  .node-row,
  .leader-item,
  .cert-item {
    background: var(--dashboard-kpi-surface) !important;
    box-shadow: 0 1px 3px rgba(35, 56, 46, 0.04) !important;
  }
  .kpi.b, .kpi.blue {
    --dashboard-kpi-card-accent: var(--dashboard-kpi-accent-blue);
    --dashboard-kpi-card-line: var(--dashboard-kpi-line-blue);
  }
  .kpi.g, .kpi.green {
    --dashboard-kpi-card-accent: var(--dashboard-kpi-accent-green);
    --dashboard-kpi-card-line: var(--dashboard-kpi-line-green);
  }
  .kpi.a, .kpi.amber {
    --dashboard-kpi-card-accent: var(--dashboard-kpi-accent-deep);
    --dashboard-kpi-card-line: var(--dashboard-kpi-line-deep);
  }
  .kpi.p, .kpi.purple, .kpi.teal {
    --dashboard-kpi-card-accent: var(--dashboard-kpi-accent-cobalt);
    --dashboard-kpi-card-line: var(--dashboard-kpi-line-cobalt);
  }
${kpiAccentSequence}
  .kpi.b .label, .kpi.b .value,
  .kpi.blue .label, .kpi.blue > .value,
  .kpi.g .label, .kpi.g .value,
  .kpi.green .label, .kpi.green > .value,
  .kpi.a .label, .kpi.a > .value,
  .kpi.amber .label, .kpi.amber > .value,
  .kpi.p .label, .kpi.p .value,
  .kpi.purple .label, .kpi.purple > .value,
  .kpi.teal .label, .kpi.teal > .value { color: var(--dashboard-kpi-card-accent) !important; }
  .kpi .label,
  .kpi > .value,
  .kpi .unit { color: var(--dashboard-kpi-card-accent) !important; }
  .kpi .sub { color: var(--text-muted) !important; }
  </style>`;
}

function generateColorVars(theme: Theme): string {
  const idx = theme === 'light' ? 0 : 1;
  const lines: string[] = [];
  for (const [name, ramp] of Object.entries(COLOR_RAMPS)) {
    for (const stop of STOPS) {
      lines.push(`  --${name}-${stop}: ${ramp[stop][idx]};`);
    }
    lines.push(`  --${name}-300: var(--${name}-200);`);
    lines.push(`  --${name}-500: var(--${name}-400);`);
    lines.push(`  --${name}-700: var(--${name}-800);`);
  }
  return lines.join('\n');
}

function generateSvgClasses(theme: Theme): string {
  const isLight = theme === 'light';
  const lines: string[] = [];
  for (const name of Object.keys(COLOR_RAMPS)) {
    const fill = `var(--${name}-${isLight ? 50 : 800})`;
    const stroke = `var(--${name}-${isLight ? 400 : 200})`;
    const text = `var(--${name}-${isLight ? 800 : 100})`;
    lines.push(`.c-${name} rect, .c-${name} circle, .c-${name} ellipse { fill: ${fill}; stroke: ${stroke}; stroke-width: 1; }`);
    lines.push(`.c-${name} text { fill: ${text}; }`);
  }
  return lines.join('\n');
}

function generateDualSvgClasses(): string {
  const lines: string[] = [];
  for (const themeName of ['light', 'dark'] as Theme[]) {
    const isLight = themeName === 'light';
    const prefix = `:root[data-theme="${themeName}"]`;
    for (const name of Object.keys(COLOR_RAMPS)) {
      const fill = `var(--${name}-${isLight ? 50 : 800})`;
      const stroke = `var(--${name}-${isLight ? 400 : 200})`;
      const text = `var(--${name}-${isLight ? 800 : 100})`;
      lines.push(`${prefix} .c-${name} rect, ${prefix} .c-${name} circle, ${prefix} .c-${name} ellipse { fill: ${fill}; stroke: ${stroke}; stroke-width: 1; }`);
      lines.push(`${prefix} .c-${name} text { fill: ${text}; }`);
    }
  }
  return lines.join('\n');
}

const RESIZE_SCRIPT = `
<script>
(function() {
  var lastH = 0;
  var stableCount = 0;
  var throttleMs = 60;
  var tid = 0;
  function measureContentHeight() {
    var root = document.getElementById('widget-root');
    if (!root) return document.body.scrollHeight;
    var paddingBottom = parseFloat(getComputedStyle(document.body).paddingBottom) || 0;
    return Math.ceil(root.offsetTop + Math.max(root.scrollHeight, root.getBoundingClientRect().height) + paddingBottom);
  }
  function report() {
    if (window.__lockWidgetCanvasSizes) window.__lockWidgetCanvasSizes();
    var h = measureContentHeight();
    if (h === lastH) { stableCount++; return; }
    if (window.__heightLocked && h < lastH) return;
    stableCount = 0;
    lastH = h;
    parent.postMessage({ type: 'widget-resize', height: h }, '*');
  }
  window.__forceReport = function() { stableCount = 0; report(); };
  var _ro = new ResizeObserver(function() {
    if (stableCount > 5) { if (!tid) tid = setTimeout(function(){ tid=0; report(); }, 500); return; }
    if (!tid) tid = setTimeout(function(){ tid=0; report(); }, throttleMs);
  });
  _ro.observe(document.body);
  window.sendPrompt = function(text) {
    parent.postMessage({ type: 'widget-send-prompt', text: text }, '*');
  };
})();
</script>`;

const STREAMING_STYLES = `
<style id="streaming-styles">
  body::after {
    content: '';
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 9999;
    background: linear-gradient(
      135deg,
      transparent 0%,
      transparent 30%,
      var(--shimmer-highlight) 50%,
      transparent 70%,
      transparent 100%
    );
    background-size: 400% 400%;
    animation: w-glow 2s ease-in-out infinite;
  }
  @keyframes w-glow {
    0% { background-position: 100% 100%; }
    100% { background-position: 0% 0%; }
  }
</style>`;

const WIDGET_SCROLLBAR_STYLES = `
/* Keep widget iframe scrollbars native. Dashboard drilldown modals rely on this styling;
   custom overlay scrollbars can accidentally scroll the product page behind the modal. */
html, body, * {
  scrollbar-color: var(--interactive-default) transparent;
  scrollbar-width: thin;
}
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  border-radius: 4px;
  background: var(--interactive-default);
}
::-webkit-scrollbar-thumb:hover {
  background: var(--interactive-hover);
}`;

const HYDRATION_SAFETY_SCRIPT = `
<script>
(function() {
  if (window.__widgetHydrationSafetyInstalled) return; window.__widgetHydrationSafetyInstalled = true;
  function showWidgetError(message) {
    if (window.__widgetErrorVisible) return;
    window.__widgetErrorVisible = true;
    var host = document.getElementById('widget-root') || document.body;
    var box = document.createElement('div');
    box.setAttribute('data-widget-error', 'true');
    box.style.cssText = [
      'margin:8px 0',
      'padding:12px 14px',
      'border-radius:8px',
      'border:1px solid rgba(220,38,38,0.28)',
      'background:rgba(254,242,242,0.96)',
      'color:#991b1b',
      'font:12px/1.5 var(--font-family,system-ui,sans-serif)',
      'white-space:pre-wrap'
    ].join(';');
    box.textContent = '组件渲染失败：' + (message || '脚本执行异常');
    host.appendChild(box);
    if (window.__forceReport) setTimeout(window.__forceReport, 0);
  }
  window.__widgetRenderError = showWidgetError;
  window.addEventListener('error', function(event) {
    showWidgetError(event && (event.message || (event.error && event.error.message)));
  });
  window.addEventListener('unhandledrejection', function(event) {
    var reason = event && event.reason;
    showWidgetError(reason && (reason.message || String(reason)));
  });
  var raw = Document.prototype.getElementById;
  function h(el) { var m = String((el.style && el.style.height) || el.getAttribute('height') || '').match(/(\\d+(?:\\.\\d+)?)px?/); return m ? Math.max(1, Math.round(Number(m[1]))) : 180; }
  function c(el) { var x = el.querySelector && el.querySelector('canvas'); if (x && typeof x.getContext === 'function') return x; x = (el.ownerDocument || document).createElement('canvas'); var y = h(el); x.height = y; x.style.width = '100%'; x.style.height = y + 'px'; x.setAttribute('data-widget-canvas-proxy', 'true'); el.appendChild(x); return x; }
  function p(el) { if (!el || typeof el.getContext === 'function') return el; try { Object.defineProperty(el, 'getContext', { configurable: true, value: function(t, a) { return c(el).getContext(t, a); }}); } catch (e) {} return el; }
  Document.prototype.getElementById = function(id) { return p(raw.call(this, id)); };
})();
</script>`;

const RECEIVER_SCRIPT = `
<script>
(function() {
  var root = document.getElementById('widget-root');
  var prevHTML = '';
  window.__heightLocked = false;
  var __loadedLibs = {};
  var __canvasLockObserver = null;
  var __canvasLocking = false;
  var __reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var streamFrame = null;
  var streamDoc = null;
  var streamOpen = false;
  var streamStyle = '';
  var streamScript = '';
  var streamResizeObserver = null;
  var streamReport = null;

  function ensureScript(src, key) {
    return new Promise(function(resolve) {
      if (key && __loadedLibs[key]) return resolve();
      var exists = Array.from(document.getElementsByTagName('script')).some(function(s) { return s.src === src; });
      if (exists) {
        if (key) __loadedLibs[key] = true;
        return resolve();
      }
      var s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.onload = function() { if (key) __loadedLibs[key] = true; resolve(); };
      s.onerror = function() {
        if (window.__widgetRenderError) window.__widgetRenderError('依赖加载失败：' + src);
        resolve();
      };
      document.head.appendChild(s);
    });
  }

  function lockCanvasSizes(scope) {
    if (!scope || __canvasLocking) return;
    __canvasLocking = true;
    var canvases = scope.querySelectorAll('canvas');
    try {
      for (var i = 0; i < canvases.length; i++) {
        var c = canvases[i];
        var lockH = c.dataset.widgetLockHeight || c.style.height;
        if (!lockH) {
          var attrH = c.getAttribute('height');
          if (attrH) lockH = attrH + 'px';
        }
        if (lockH) {
          c.dataset.widgetLockHeight = lockH;
          if (c.style.getPropertyValue('height') !== lockH || c.style.getPropertyPriority('height') !== 'important') {
            c.style.setProperty('height', lockH, 'important');
          }
        }
      }
    } finally {
      __canvasLocking = false;
    }
  }

  function installCanvasSizeLocks(scope) {
    lockCanvasSizes(scope);
    if (__canvasLockObserver || typeof MutationObserver === 'undefined') return;
    __canvasLockObserver = new MutationObserver(function() {
      lockCanvasSizes(root);
    });
    __canvasLockObserver.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['style', 'height']
    });
  }

  window.__lockWidgetCanvasSizes = function() {
    lockCanvasSizes(root);
  };

  function cloneForMorph(node, enter) {
    var clone = node.cloneNode(true);
    if (enter) markStreamEnter(clone);
    return clone;
  }

  function markStreamEnter(node) {
    if (__reduceMotion || !node || node.nodeType !== 1) return;
    if (node.nodeName === 'SCRIPT' || node.nodeName === 'STYLE' || node.nodeName === 'LINK') return;
    node.classList.add('widget-stream-enter');
    setTimeout(function() {
      if (node.classList) node.classList.remove('widget-stream-enter');
    }, 360);
  }

  function shellStylesHtml() {
    return Array.from(document.querySelectorAll('style')).map(function(style) {
      return '<style>' + (style.textContent || '') + '</style>';
    }).join('');
  }

  function resetNativeStream() {
    if (streamResizeObserver) {
      streamResizeObserver.disconnect();
      streamResizeObserver = null;
    }
    streamFrame = null;
    streamDoc = null;
    streamOpen = false;
    streamStyle = '';
    streamScript = '';
    streamReport = null;
  }

  function startNativeStream() {
    resetNativeStream();
    root.innerHTML = '';
    streamFrame = document.createElement('iframe');
    streamFrame.id = 'widget-stream-frame';
    streamFrame.style.cssText = 'width:100%;height:220px;border:0;display:block;background:transparent;';
    root.appendChild(streamFrame);
    streamDoc = streamFrame.contentDocument || (streamFrame.contentWindow && streamFrame.contentWindow.document);
    if (!streamDoc) return;
    var theme = document.documentElement.getAttribute('data-theme') || 'light';
    streamDoc.open();
    streamDoc.write('<!DOCTYPE html><html data-theme="' + theme + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' + shellStylesHtml() + '<style id="widget-stream-style"></style></head><body><div id="widget-stream-root">');
    streamOpen = true;
    installStreamBridge();
  }

  function installStreamBridge() {
    if (!streamFrame || !streamDoc) return;
    if (!streamDoc.body) {
      setTimeout(installStreamBridge, 0);
      return;
    }
    var win = streamFrame.contentWindow;
    if (win) {
      win.sendPrompt = function(text) {
        parent.postMessage({ type: 'widget-send-prompt', text: text }, '*');
      };
      win.addEventListener('error', function(event) {
        if (window.__widgetRenderError) {
          window.__widgetRenderError(event && (event.message || (event.error && event.error.message)));
        }
      });
      win.addEventListener('unhandledrejection', function(event) {
        var reason = event && event.reason;
        if (window.__widgetRenderError) window.__widgetRenderError(reason && (reason.message || String(reason)));
      });
    }
    var report = function() {
      if (!streamFrame || !streamDoc || !streamDoc.documentElement || !streamDoc.body) return;
      var h = Math.max(
        streamDoc.documentElement.scrollHeight,
        streamDoc.body.scrollHeight,
        streamDoc.body.offsetHeight
      );
      h = Math.max(1, Math.ceil(h));
      streamFrame.style.height = h + 'px';
      parent.postMessage({ type: 'widget-resize', height: h }, '*');
    };
    streamReport = report;
    if (typeof ResizeObserver !== 'undefined') {
      streamResizeObserver = new ResizeObserver(function() { report(); });
      streamResizeObserver.observe(streamDoc.body);
    }
    [60, 160, 360, 800, 1500].forEach(function(ms) {
      setTimeout(report, ms);
    });
  }

  function setStreamTheme(theme) {
    if (streamDoc && streamDoc.documentElement) {
      streamDoc.documentElement.setAttribute('data-theme', theme);
    }
  }

  function stripWrappingTag(text, tag) {
    return text
      .replace(new RegExp('^\\\\s*<' + tag + '[^>]*>', 'i'), '')
      .replace(new RegExp('</' + tag + '>\\\\s*$', 'i'), '');
  }

  function hasHydrationTargets(html) {
    return /<canvas\\b|id=(["'])[^"']*(chart|canvas|composition)[^"']*\\1/i.test(html || '');
  }

  function setHydrating(value) {
    document.body.classList.toggle('widget-hydrating', !!value);
    document.body.classList.toggle('widget-hydrated', !value);
  }

  function appendStreamChunk(chunk) {
    if (!streamOpen || !streamDoc) startNativeStream();
    if (!streamDoc) return;
    if (chunk.channel === 'style') {
      streamStyle += chunk.delta || '';
      var styleEl = streamDoc.getElementById('widget-stream-style');
      if (styleEl) styleEl.textContent = stripWrappingTag(streamStyle, 'style');
      return;
    }
    if (chunk.channel === 'script') {
      streamScript += chunk.delta || '';
      return;
    }
    if (chunk.channel === 'markup' && streamOpen) {
      streamDoc.write(chunk.delta || '');
      if (streamReport) {
        setTimeout(streamReport, 0);
        setTimeout(streamReport, 80);
      }
    }
  }

  function ensureChildScript(doc, win, src, globalName) {
    return new Promise(function(resolve) {
      if (globalName && win && win[globalName]) return resolve();
      var exists = Array.from(doc.getElementsByTagName('script')).some(function(s) { return s.src === src; });
      if (exists) return resolve();
      var s = doc.createElement('script');
      s.src = src;
      s.async = false;
      s.onload = function() { resolve(); };
      s.onerror = function() {
        if (window.__widgetRenderError) window.__widgetRenderError('依赖加载失败：' + src);
        resolve();
      };
      doc.head.appendChild(s);
    });
  }

  function replayChildScripts(doc, scripts, done) {
    function runNext(i) {
      if (i >= scripts.length) {
        if (done) done();
        return;
      }
      var old = scripts[i];
      var s = doc.createElement('script');
      Array.from(old.attributes).forEach(function(attr) {
        s.setAttribute(attr.name, attr.value);
      });
      var type = (old.getAttribute('type') || '').trim().toLowerCase();
      var isModule = type === 'module';
      if (old.src || isModule) {
        s.onload = function() { runNext(i + 1); };
        s.onerror = function() {
          if (window.__widgetRenderError) window.__widgetRenderError('脚本加载失败：' + (old.src || 'module script'));
          runNext(i + 1);
        };
        if (!old.src) s.textContent = old.textContent;
        doc.body.appendChild(s);
        return;
      }
      s.textContent = old.textContent;
      doc.body.appendChild(s);
      runNext(i + 1);
    }
    runNext(0);
  }

  function completeNativeStream() {
    if (!streamDoc) return;
    if (streamOpen) {
      streamDoc.write('</div></body></html>');
      streamDoc.close();
      streamOpen = false;
    }
    runStreamHydration();
  }

  function runStreamHydration() {
    if (!streamDoc) return;
    var text = (streamScript || '').trim();
    if (!text) return;
    var doc = streamDoc;
    var win = streamFrame && streamFrame.contentWindow;
    var tmp = doc.createElement('div');
    if (/^<script[\\s>]/i.test(text)) {
      tmp.innerHTML = text;
    } else {
      var inline = doc.createElement('script');
      inline.textContent = stripWrappingTag(text, 'script');
      tmp.appendChild(inline);
    }
    var scripts = Array.from(tmp.querySelectorAll('script'));
    var combined = doc.documentElement.innerHTML + '\\n' + text;
    var tasks = [];
    if (/\\bnew\\s+Chart\\s*\\(|\\bChart\\s*\\(/.test(combined)) {
      tasks.push(ensureChildScript(doc, win, 'https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js', 'Chart'));
    }
    if (/\\becharts\\./.test(combined)) {
      tasks.push(ensureChildScript(doc, win, 'https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js', 'echarts'));
    }
    Promise.all(tasks).then(function() {
      replayChildScripts(doc, scripts, function() {
        [120, 360, 800, 1500].forEach(function(ms) {
          setTimeout(function() {
            if (!streamFrame || !streamDoc) return;
            var h = Math.max(streamDoc.documentElement.scrollHeight, streamDoc.body.scrollHeight);
            streamFrame.style.height = Math.max(1, Math.ceil(h)) + 'px';
            parent.postMessage({ type: 'widget-resize', height: h }, '*');
          }, ms);
        });
      });
    });
  }

  function morphChildren(parent, templateParent) {
    var newNodes = Array.from(templateParent.childNodes);
    var oldNodes = Array.from(parent.childNodes);

    for (var i = 0; i < newNodes.length; i++) {
      var nn = newNodes[i];
      if (i < oldNodes.length) {
        var on = oldNodes[i];
        if (on.nodeType === nn.nodeType && on.nodeName === nn.nodeName) {
          if (nn.nodeType === 3) {
            if (on.textContent !== nn.textContent) on.textContent = nn.textContent;
          } else if (nn.nodeType === 1) {
            if (nn.nodeName === 'SCRIPT') continue;
            if (on.outerHTML === nn.outerHTML) continue;
            syncAttributes(on, nn);
            morphChildren(on, nn);
          }
        } else {
          parent.replaceChild(cloneForMorph(nn, true), on);
        }
      } else {
        parent.appendChild(cloneForMorph(nn, true));
      }
    }
    while (parent.childNodes.length > newNodes.length) {
      parent.removeChild(parent.lastChild);
    }
  }

  function syncAttributes(oldEl, newEl) {
    var oldAttrs = Array.from(oldEl.attributes);
    for (var a = 0; a < oldAttrs.length; a++) {
      if (!newEl.hasAttribute(oldAttrs[a].name)) oldEl.removeAttribute(oldAttrs[a].name);
    }
    var newAttrs = Array.from(newEl.attributes);
    for (var a = 0; a < newAttrs.length; a++) {
      if (oldEl.getAttribute(newAttrs[a].name) !== newAttrs[a].value) {
        oldEl.setAttribute(newAttrs[a].name, newAttrs[a].value);
      }
    }
  }

  function morphRoot(newHTML) {
    var tmp = document.createElement('div');
    tmp.innerHTML = newHTML;
    setHydrating(hasHydrationTargets(newHTML));
    morphChildren(root, tmp);
    installCanvasSizeLocks(root);
  }

  window.addEventListener('message', function(e) {
    if (!e.data || typeof e.data !== 'object') return;
    if (!root) return;

    if (streamFrame && e.source === streamFrame.contentWindow) {
      if (e.data.type === 'widget-send-prompt' || e.data.type === 'widget-fullscreen') {
        parent.postMessage(e.data, '*');
        return;
      }
    }

    if (e.data.type === 'widget-set-theme') {
      if (e.data.theme === 'light' || e.data.theme === 'dark') {
        document.documentElement.setAttribute('data-theme', e.data.theme);
        setStreamTheme(e.data.theme);
      }
      return;
    }

    if (e.data.type === 'widget-stream-start') {
      startNativeStream(e.data.mode);
      return;
    }

    if (e.data.type === 'widget-stream-chunk') {
      appendStreamChunk(e.data.chunk || {});
      return;
    }

    if (e.data.type === 'widget-stream-complete') {
      completeNativeStream();
      return;
    }

    if (e.data.type === 'widget-stream-abort') {
      resetNativeStream();
      root.innerHTML = '';
      setHydrating(false);
      return;
    }

    if (e.data.type === 'widget-replace') {
      resetNativeStream();
      if (e.data.html === prevHTML) return;
      prevHTML = e.data.html;
      morphRoot(e.data.html);
    } else if (e.data.type === 'widget-finalize') {
      var glow = document.getElementById('streaming-styles');
      if (glow) {
        glow.style.transition = 'opacity 0.3s ease';
        glow.style.opacity = '0';
        setTimeout(function() { glow.remove(); }, 300);
      }
      var curH = document.documentElement.scrollHeight;
      document.body.style.minHeight = curH + 'px';
      window.__heightLocked = true;

      var scripts = Array.from(root.querySelectorAll('script'));
      var htmlText = root.innerHTML || '';
      var needChartJs = /\\bnew\\s+Chart\\s*\\(|\\bChart\\s*\\(/.test(htmlText) && typeof window.Chart === 'undefined';
      var needEcharts = /\\becharts\\./.test(htmlText) && typeof window.echarts === 'undefined';

      function preloadDeps() {
        var tasks = [];
        if (needChartJs) {
          tasks.push(ensureScript('https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js', 'chartjs'));
        }
        if (needEcharts) {
          tasks.push(ensureScript('https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js', 'echarts'));
        }
        if (tasks.length === 0) return Promise.resolve();
        return Promise.all(tasks).then(function(){});
      }

      function isSatisfiedKnownDependency(script) {
        var src = script && script.src ? String(script.src) : '';
        if (!src) return false;
        if (typeof window.Chart !== 'undefined' && /(?:^|\\/|@)chart\\.js(?:@|\\/)/i.test(src)) return true;
        if (typeof window.echarts !== 'undefined' && /(?:^|\\/|@)echarts(?:@|\\/)/i.test(src)) return true;
        return false;
      }

      function runNext(i) {
        if (i >= scripts.length) {
          lockCanvasSizes(root);
          setHydrating(false);
          [200, 500, 1000, 2000].forEach(function(ms) {
            setTimeout(function() { if (window.__forceReport) window.__forceReport(); }, ms);
          });
          setTimeout(function() {
            document.body.style.minHeight = '';
            window.__heightLocked = false;
            if (window.__forceReport) window.__forceReport();
          }, 600);
          return;
        }
        var old = scripts[i];
        if (!old.parentNode) {
          runNext(i + 1);
          return;
        }
        if (isSatisfiedKnownDependency(old)) {
          old.parentNode.removeChild(old);
          runNext(i + 1);
          return;
        }
        var s = document.createElement('script');
        Array.from(old.attributes).forEach(function(attr) {
          s.setAttribute(attr.name, attr.value);
        });
        var type = (old.getAttribute('type') || '').trim().toLowerCase();
        var isModule = type === 'module';
        if (old.src) {
          s.onload = s.onerror = function() { runNext(i + 1); };
          if (!old.hasAttribute('async') && !isModule) s.async = false;
          old.parentNode.replaceChild(s, old);
        } else {
          s.textContent = old.textContent;
          if (isModule) {
            s.onload = s.onerror = function() { runNext(i + 1); };
            old.parentNode.replaceChild(s, old);
            return;
          }
          old.parentNode.replaceChild(s, old);
          runNext(i + 1);
        }
      }
      preloadDeps().then(function() { runNext(0); });
    }
  });
})();
</script>`;

export function buildWidgetHtml(widgetCode: string, theme: Theme, dashboardKey?: string | null): string {
  const isSvg = widgetCode.trimStart().startsWith('<svg');
  const baseVars = generateBaseVars(theme);
  const colorVars = generateColorVars(theme);
  const svgClasses = generateSvgClasses(theme);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
:root {
${baseVars}
${colorVars}
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: var(--font-family);
  color: var(--text-primary);
  background: transparent;
  padding: var(--widget-padding);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  overflow: hidden;
}
${WIDGET_SCROLLBAR_STYLES}
${svgClasses}
svg { max-width: 100%; height: auto; }
</style>
</head>
<body>
${HYDRATION_SAFETY_SCRIPT}
${isSvg ? widgetCode : `<div id="widget-root">${widgetCode}</div>`}
${buildDashboardPaletteOverrides(dashboardKey)}
${RESIZE_SCRIPT}
<script>
[100, 300, 800, 1500].forEach(function(ms) {
  setTimeout(function() { if (window.__forceReport) window.__forceReport(); }, ms);
});
</script>
</body>
</html>`;
}

export function buildWidgetShellHtml(theme: Theme): string {
  const lightBase = generateBaseVars('light');
  const lightColors = generateColorVars('light');
  const darkBase = generateBaseVars('dark');
  const darkColors = generateColorVars('dark');
  const dualSvg = generateDualSvgClasses();

  return `<!DOCTYPE html>
<html data-theme="${theme}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
:root[data-theme="light"] {
${lightBase}
${lightColors}
  --shimmer-color: rgba(0,0,0,0.03);
  --shimmer-highlight: rgba(0,0,0,0.06);
}
:root[data-theme="dark"] {
${darkBase}
${darkColors}
  --shimmer-color: rgba(255,255,255,0.04);
  --shimmer-highlight: rgba(255,255,255,0.09);
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: var(--font-family);
  color: var(--text-primary);
  background: transparent;
  padding: var(--widget-padding);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  overflow: hidden;
}
${WIDGET_SCROLLBAR_STYLES}
${dualSvg}
svg { max-width: 100%; height: auto; }
body.widget-hydrating canvas, body.widget-hydrating [id*="chart" i]:empty, body.widget-hydrating [id*="composition" i]:empty, body.widget-hydrating [data-widget-canvas-proxy="true"] {
  display: block; min-height: 120px; border-radius: 6px;
  background: linear-gradient(90deg, transparent, var(--shimmer-highlight), transparent) -120% 0/260% 100% no-repeat,
    linear-gradient(to top, var(--shimmer-highlight) 0 58%, transparent 58%) 12% 100%/8% 72% no-repeat, linear-gradient(to top, var(--shimmer-highlight) 0 38%, transparent 38%) 30% 100%/8% 72% no-repeat,
    linear-gradient(to top, var(--shimmer-highlight) 0 76%, transparent 76%) 48% 100%/8% 72% no-repeat, linear-gradient(to top, var(--shimmer-highlight) 0 46%, transparent 46%) 66% 100%/8% 72% no-repeat,
    repeating-linear-gradient(to top, transparent 0 31px, var(--border-color) 32px), var(--shimmer-color);
  animation: widget-hydration-shimmer 1.4s ease-in-out infinite;
}
@keyframes widget-hydration-shimmer { 100% { background-position: 120% 0,12% 100%,30% 100%,48% 100%,66% 100%,0 0,0 0; } }
@media (prefers-reduced-motion: reduce) { body.widget-hydrating canvas,
  body.widget-hydrating [id*="chart" i]:empty, body.widget-hydrating [id*="composition" i]:empty,
  body.widget-hydrating [data-widget-canvas-proxy="true"] { animation: none; } }
@media (prefers-reduced-motion: no-preference) {
  .widget-stream-enter {
    animation: widget-stream-enter 260ms cubic-bezier(0.16, 1, 0.3, 1) both;
    will-change: opacity, translate, filter;
  }
  @keyframes widget-stream-enter {
    from {
      opacity: 0;
      translate: 0 6px;
      filter: blur(2px);
    }
    to {
      opacity: 1;
      translate: 0 0;
      filter: blur(0);
    }
  }
}
</style>
${STREAMING_STYLES}
</head>
<body>
<div id="widget-root"></div>
${RESIZE_SCRIPT}
${HYDRATION_SAFETY_SCRIPT}
${RECEIVER_SCRIPT}
</body>
</html>`;
}
