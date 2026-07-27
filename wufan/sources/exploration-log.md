# 主动探索日志

## EXP-20260726-01

- 输入：仅有空目录名称 `wufan`
- 目标：建立档案入口、完整性机制和用户请求队列
- 环境：本地文件系统
- 动作：建立 manifest、README、子档案 AGENTS、TODO、REQUESTS、gaps 和自检报告
- 新增文件：见 `CHANGELOG.md`
- 发现：当前没有 URL、截图、源码、录屏、设计稿或素材可供探索
- 限制：缺少参考系统身份和全部原始证据
- 覆盖变化：无设计覆盖
- 新增/关闭 TODO：完成 TODO-014；TODO-001 至 TODO-013 保持开放
- 需要用户：REQ-001 至 REQ-007

## EXP-20260726-02

- 输入：网站 `https://www.wufanai.com/`、用户截图 SRC-002/SRC-003/SRC-014、源码路径 `/Users/anner/fine/ai/corevo`
- 目标：完成第一轮 URL + 截图 + 源码混合主动探索，生成双主题精确 Token 和可消费规范
- 环境：macOS；Playwright 1.56.1；Chromium 141.0.7390.37；Python Pillow 12.3.0；locale zh-CN；Asia/Shanghai；自动截图 DPR1
- 安全检查：网站公开且 robots 允许公开页面；未登录、未提交表单；源码先静态检查，未执行；发现私有 Git remote、tracked env 文件和用户截图隐私，未归档 env/secret，私有资料通过本地 exclude 阻止公开推送
- 网站动作：获取 `/`、`/learn`、`/pricing`、`/login` HTML；归档当前生产 CSS/JS、Logo、品牌字体；读取 robots/sitemap；自动截取 desktop/mobile、Product login light/dark 和 Marketing fixed-dark；提取 DOM、计算样式、字体、CSS variables
- 源码动作：读取项目 AGENTS/package/config；确认 React/Vite/Tailwind/Framer/Lucide；分析 globals.css、ThemeProvider、App、Sidebar、Chat、InputBar、MessageBubble、WhatsNew、breakpoint；建立 sanitized frontend snapshot（不含 env 与 AppleDouble）
- 截图动作：原样保存三张用户图并计算哈希；推断 Retina DPR≈2；使用 Pillow 提取尺寸/色板；生成 Sidebar/Composer/Message 派生裁切
- 交叉验证：发现源码 commit 2026-07-23 早于线上资产；线上 What’s New 与 SRC-014 一致，但与源码同名组件结构冲突；当前规则以线上 CSS/JS/计算样式优先
- 新增文件：53 项来源、31 张截图、10 份计算样式、公开字体清单、source snapshot、analysis/system/quality 全套初版、可重复采集/分析/Token 脚本
- Token：Product light 453 个运行时变量、dark 449 个，93 个共享；另生成 Marketing 36 个固定暗色变量
- 覆盖变化：Marketing 首页/教程/定价 desktop+mobile observed；Product login 双主题 desktop+mobile observed；登录后 Product 仅部分 desktop
- 限制：无安全登录态；登录后同页双主题/mobile/状态矩阵缺失；源码版本落后；字体与私有资料公开授权待确认；未执行 archive→new-system 视觉回归
- 新增/关闭 TODO：关闭 TODO-001/004/008/009/011；保留 8 个开放项
- 需要用户：REQ-002/003/005/006/007/008/009/010
