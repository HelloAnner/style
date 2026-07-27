#!/usr/bin/env node
/** Read-only capture of public Wufan pages. Does not submit forms or use credentials. */
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
const candidates = [
  process.env.PLAYWRIGHT_MODULE,
  '/Users/anner/.nvm/versions/node/v22.23.1/lib/node_modules/playwright',
  (() => { try { return path.join(execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim(), 'playwright'); } catch { return null; } })(),
].filter(Boolean);
let playwright;
for (const candidate of candidates) {
  try { playwright = require(candidate); break; } catch {}
}
if (!playwright) throw new Error('Playwright module not found; set PLAYWRIGHT_MODULE.');

const { chromium } = playwright;
const root = path.resolve(import.meta.dirname, '../..');
const screenshotRoot = path.join(root, 'sources/screenshots/original');
const computedRoot = path.join(root, 'sources/computed-styles');
await fs.mkdir(path.join(screenshotRoot, 'dark'), { recursive: true });
await fs.mkdir(path.join(screenshotRoot, 'light'), { recursive: true });
await fs.mkdir(computedRoot, { recursive: true });

const browser = await chromium.launch({ headless: true });
const viewports = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '390x844', width: 390, height: 844 },
];
const targets = [
  { id: 'homepage', url: 'https://www.wufanai.com/', themes: ['dark'], selectors: ['.site-header', '.hero', '#hero-title', '.hero-lede', '.hero-start-cta'] },
  { id: 'learn', url: 'https://www.wufanai.com/learn', themes: ['dark'], selectors: ['header', 'main', 'h1', 'a', 'button'] },
  { id: 'pricing', url: 'https://www.wufanai.com/pricing', themes: ['dark'], selectors: ['header', 'main', 'h1', 'a', 'button'] },
  { id: 'login', url: 'https://www.wufanai.com/login', themes: ['light', 'dark'], selectors: ['header', 'main', 'h1', 'form', 'input', 'button'] },
];

for (const target of targets) {
  for (const theme of target.themes) {
    for (const viewport of viewports) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 1,
        colorScheme: theme,
        locale: 'zh-CN',
        timezoneId: 'Asia/Shanghai',
      });
      if (target.id === 'login') {
        await context.addInitScript((mode) => localStorage.setItem('corevo-theme', mode), theme);
      }
      const page = await context.newPage();
      await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.evaluate(() => document.fonts?.ready).catch(() => {});
      await page.waitForTimeout(target.id === 'homepage' ? 8_000 : 3_000);
      await page.addStyleTag({ content: `
        *, *::before, *::after { animation-play-state: paused !important; transition-duration: 0s !important; caret-color: transparent !important; }
      `});

      const base = `${target.id}__${theme}__${viewport.name}__default__01`;
      const themeDir = path.join(screenshotRoot, theme);
      await page.screenshot({ path: path.join(themeDir, `${base}__viewport.png`) });
      await page.screenshot({ path: path.join(themeDir, `${base}__full-page.png`), fullPage: true });

      const snapshot = await page.evaluate(({ selectors, requestedTheme }) => {
        const styleObject = (el, pseudo = null) => {
          const s = getComputedStyle(el, pseudo);
          const rect = el.getBoundingClientRect();
          const props = [
            'display','position','width','height','margin','padding','gap','color','background','backgroundColor',
            'border','borderRadius','boxShadow','opacity','fontFamily','fontSize','fontWeight','lineHeight',
            'letterSpacing','textAlign','transform','transition','animation','zIndex','overflow','backdropFilter'
          ];
          return {
            rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            style: Object.fromEntries(props.map((p) => [p, s[p]])),
          };
        };
        const elements = {};
        for (const selector of selectors) {
          const el = document.querySelector(selector);
          if (el) elements[selector] = styleObject(el);
        }
        const rootStyle = getComputedStyle(document.documentElement);
        const customProperties = {};
        for (const name of rootStyle) {
          if (name.startsWith('--')) customProperties[name] = rootStyle.getPropertyValue(name).trim();
        }
        return {
          capturedAt: new Date().toISOString(),
          requestedTheme,
          url: location.href,
          title: document.title,
          htmlAttributes: Object.fromEntries([...document.documentElement.attributes].map((x) => [x.name, x.value])),
          body: styleObject(document.body),
          customProperties,
          elements,
          fonts: [...document.fonts].map((f) => ({ family: f.family, style: f.style, weight: f.weight, status: f.status })),
          stylesheets: [...document.styleSheets].map((s) => s.href || 'inline'),
        };
      }, { selectors: target.selectors, requestedTheme: theme });
      snapshot.environment = { browser: `Chromium ${browser.version()}`, os: process.platform, locale: 'zh-CN', timezone: 'Asia/Shanghai', viewport, dpr: 1 };
      await fs.writeFile(path.join(computedRoot, `${base}.json`), JSON.stringify(snapshot, null, 2) + '\n');
      console.log(base, snapshot.url);
      await context.close();
    }
  }
}
await browser.close();
