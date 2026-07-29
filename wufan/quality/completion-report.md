# 完整性自检报告

- 档案：`wufan` v0.4.0
- 检查时间：2026-07-29T00:04:40Z
- 当前状态：`analyzed`
- 来源：55
- TODO：8/16 完成；8 open；6 blocker
- REQUESTS：8 open
- 自检结论：**登录小人组件与对话可运行参考范围通过；complete 门槛未通过。**

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
`exact-source reference, pass-within-runnable-chat-page-scope`。下一轮仍优先获得安全登录态
探索方式、dark populated/mobile baseline、当前部署源码映射和其余 private/public 发布范围确认。
