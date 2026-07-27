# 悟帆 AI 设计风格档案

## 一句话风格定义

Product 是暖白/近黑双主题、低对比 surface、紧凑圆角和紫蓝 Agent 人格图形组成的 AI 工作空间；Marketing 是固定暗色、衬线编辑感与抽象动态艺术组成的品牌叙事表面。

## 档案状态

- 状态：`analyzed`
- 结论：已完成第一轮网站、截图、源码、运行时 CSS 和双主题 Token 深度分析；**尚未 complete，不能对所有页面保证完全复刻**。
- 完成率与 blocker：以 `manifest.json` 和 `quality/TODO.md` 为准。

## Product Light

- 分析：`analysis/themes/light.md`
- 完整 Token：`system/themes/light.tokens.json`
- CSS：`system/themes/light.css`

## Product Dark

- 分析：`analysis/themes/dark.md`
- 完整 Token：`system/themes/dark.tokens.json`
- CSS：`system/themes/dark.css`

## Marketing

- Token：`system/marketing.tokens.json`
- CSS：`system/marketing.css`
- 注意：固定暗色，不与 Product 双主题混用。

## 视觉指纹

1. Light `#FAF9F7` / Dark `#0A0A0F`；
2. 极淡边框与细微 surface 阶梯；
3. Inter + 14px 内容排版；
4. 4–32px 紧凑 spacing；
5. 8–20px 中等圆角；
6. 240px Sidebar、56px Header、12px layout gap；
7. 低饱和控件 + 紫蓝 Agent 人格图形；
8. 800px Composer / 880px MessageList；
9. light/dark 不是反色，而是完整语义映射；
10. Marketing serif、Product sans 的明确分层。

## 实现 Agent 阅读顺序

1. `AGENTS.md`
2. `manifest.json`
3. `quality/TODO.md`、`quality/gaps.md`
4. `system/style-guide.md`
5. 目标 surface/theme Token
6. `analysis/components.md`、`analysis/layout.md`、`analysis/patterns.md`
7. `system/implementation.md`
8. `quality/acceptance.md`

## 来源

见 `sources/index.md`、`sources/capture-manifest.json` 和 `sources/exploration-log.md`。

## 关键缺口

登录后同页双主题、登录后移动端、状态矩阵、当前部署对应源码、字体/源码公开权和完整视觉回归。详见 `quality/REQUESTS.md`。
