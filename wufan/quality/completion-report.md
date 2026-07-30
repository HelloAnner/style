# 完整性自检报告

- 档案：`wufan` v0.6.0
- 检查时间：2026-07-30T00:00:00Z
- 当前状态：`analyzed`
- 来源：60
- TODO：11/19 完成；8 open；6 blocker
- REQUESTS：8 open
- 自检结论：**登录小人、对话主路径、过程轨迹、反馈、右侧面板、工作室/文件预览和执行通知的可运行参考
  范围通过；complete 门槛未通过。**

## 三阶段自检

### 建档/输入后

- 证据登记：通过——五张用户原图原样保存并哈希；网站/源码/生产资产均建立来源。
- 安全：通过当前范围——未登录、未提交、未执行源码；排除 env/secret；私有资料未推送 public Git。
- 主动探索：通过当前权限——已自动截图、抓取公开资产、提取计算样式、分析源码和图片。

### 分析/Token 后

- 证据自检：通过当前结论——关键基础值引用 runtime/source；推断单独标记。
- 主题自检：部分通过——453 light / 449 dark Token 已分离；登录后页面视觉配对不足。
- 覆盖自检：未通过——Product mobile、状态矩阵和多个业务子系统缺失。
- 精确性自检：部分通过——基础 Token 精确；用户截图 DPR 为推断，中文字体/当前源码映射未知。
- 一致性自检：通过——聚合/展开 JSON 与 CSS 由同一脚本生成并可解析。
- 冲突自检：通过记录——What’s New/Logo 版本冲突已解释并登记 GAP-004。
- 登录小人自检：通过组件范围——从 SRC-013 恢复 exact-source 参数，并与 light/dark 原图、用户本轮原图和本地运行结果交叉验证。
- 对话代码自检：通过可运行参考范围——从 SRC-012/013 恢复当前生产几何，以 SRC-003
  核对 light populated，以 SRC-002 核对 dark shell，并用 SRC-004 补充 mobile anatomy；
  未把 dark populated/mobile actual 冒充来源 baseline。
- 对话交互自检：通过目标组件范围——以 SRC-056/057 重建过程轨迹与六态 fixtures；
  以 SRC-058 重建固定原因浮层，以 SRC-060 校正 Wufan 原生反馈 API、回滚和
  AutomationToast；右面板明确记录为 SRC-004/013/058 的跨版本组合，未把脱敏 panel
  内容宣称为生产业务数据。
- 工作室自检：通过 source-derived 组件范围——以 Wufan 源码 SRC-059 重建常驻文件画布、
  共享/会话文件、多标签去重/上限，以及文件预览、编辑和 HTML 渲染；重型解析器仍为 fixture。

### 结束前

- 可消费性：部分通过——另一个 AI 可实现已覆盖的基础系统，但必须读取 TODO/gaps。
- 验证自检：未通过——只有来源 baseline，未完成 archive→target actual/diff。
- 待办自检：通过——所有失败项进入 TODO；用户依赖进入 REQUESTS。
- 发布自检：未通过——用户原图/私有源码公开授权未确认。

## 自动校验

- Manifest JSON：通过。
- Token JSON：通过。
- Product runtime Token：light 453、dark 449、shared 93。
- Marketing Token：36。
- 图像：33 项来源元数据与 SHA-256；5 个既有可重建裁切。
- 捕获：20 张稳定公开页面截图 + 10 份计算样式；8 张初次不稳定截图保留但标记 superseded。
- 登录小人：React/Framer Motion、机器规格和零构建 demo 的 JSON/HTML 语法通过；HeadlessChrome 151 在 light/dark desktop 和 390×844 mobile 运行通过；眨眼与视线跟随已观察。
- 对话工作区：React/CSS/脱敏 mock/机器规格和零构建 demo 已建立；agent-browser 0.8.5
  在 1594×974 light/dark、390×844 light/dark 运行；主题切换、发送 active/append 和 mobile
  drawer 通过；保存 5 张 actual 与运行时指标。
- 对话交互：React bundle 通过；静态 demo 在 1594×974 light 验证 running spinner/shine、
  右侧 execution 面板、300px 点踩浮层、原因提交禁用/互斥 localStorage、failed notice
  及点击打开 automation；Wufan 原生 PUT/DELETE 反馈字段已写入契约。保存 3 张 actual，
  两份 JSON Schema 与样例通过 Draft 2020-12 + format 校验。
- 工作室：React bundle和零构建 demo 通过；1594×974 light/dark 与 390×844 dark 验证
  文件画布、共享/会话分组、多标签、Markdown、HTML render、最大化和关闭；保存 4 张 actual。
- 图像总数：33 项来源截图；登录小人新增 2 张实际渲染截图作为 validation artifact。

## 未通过 complete 的原因

1. 登录后 Product 没有同页 light/dark 完整配对；
2. 登录后 mobile 未观察；
3. hover/focus/loading/error/open 与动效矩阵未视觉验证；
4. 用户源码不是当前线上对应 commit；
5. 中文字体和公开再发布授权未关闭；
6. 未完成目标实现的双主题、多视口视觉回归；
7. TODO/REQUESTS 未清零。

## 判定

保持 `analyzed`，不得称整个档案完整。登录小人可标为
`exact-source, pass-within-component-scope`；对话示例可标为
`exact-source reference, pass-within-runnable-chat-interactions-scope`。下一轮仍优先获得安全登录态
探索方式、dark populated/mobile baseline、当前部署源码映射和其余 private/public 发布范围确认。
