# 设计风格档案库：Agent 入口规范

## 1. 核心目标

本目录是一套可追溯、可扩展、可由其他 AI 独立消费的设计风格档案库。除 `docs/` 外，每个直接子文件夹代表一个独立业务系统或设计系统。

用户要求“参考 `<style-id>`”时，默认表示**严格复刻其设计系统**，不是相似、灵感或大致模仿。业务信息、数据、字段和流程可以变化；相同语义的组件、字体、字号、字重、色彩、间距、尺寸、圆角、边框、阴影、图标、布局、状态、动效及响应式规则必须精确一致。只有用户明确要求“近似/借鉴”时才允许降低严格度，并须记录例外。

每个系统必须将 `light` 与 `dark` 作为两个独立主题采集、分析、实现和验收。禁止跨主题混用证据或 Token，禁止通过简单反色推测另一主题。

## 2. 文档是强制规范

详细规范已拆分到 `docs/`。任何 Agent 开始工作前必须先读 [`docs/README.md`](docs/README.md)，再按其中的任务路由完整阅读对应文档；不得只读本文件后直接采集或实现。

关键入口：

- 核心契约：[`docs/01-core-contract.md`](docs/01-core-contract.md)
- 档案结构：[`docs/02-profile-structure.md`](docs/02-profile-structure.md)
- 主动探索：[`docs/03-active-exploration.md`](docs/03-active-exploration.md)
- 证据与分析：[`docs/04-evidence-analysis.md`](docs/04-evidence-analysis.md)
- 设计系统产物：[`docs/05-design-system-spec.md`](docs/05-design-system-spec.md)
- 严格复刻：[`docs/06-replication-workflow.md`](docs/06-replication-workflow.md)
- 完整性门槛：[`docs/07-quality-completion.md`](docs/07-quality-completion.md)
- Schema 与模板：[`docs/08-schemas-templates.md`](docs/08-schemas-templates.md)
- 安全与权利：[`docs/09-security-rights.md`](docs/09-security-rights.md)
- 子档案 AGENTS 模板：[`docs/10-profile-agent-template.md`](docs/10-profile-agent-template.md)

## 3. 意图路由

### 新建、采集或补充档案

必须阅读 `01`、`02`、`03`、`04`、`05`、`07`、`08`、`09`。先主动探索现有输入和可访问来源，再询问真正阻塞的问题。所有原始输入原样保存，所有结论引用证据。

### 使用某档案设计或开发新业务

先读目标子文件夹自己的 `AGENTS.md`，再阅读 `01`、`05`、`06`、`07`、`09`。必须检查目标档案 `manifest.json.status`：只有 `complete` 才能无条件声称可严格复刻；否则先说明缺口并询问用户是否补充资料或接受带缺口继续。

### 更新已有档案

先读该档案的 `AGENTS.md`、`README.md`、`manifest.json`、`CHANGELOG.md`、`sources/index.md` 和 `quality/TODO.md`。不得覆盖或删除历史原件；新证据按批次追加，结论变化写入变更日志。

## 4. 每个子档案必须有自己的 `AGENTS.md`

每个 `<style-id>/AGENTS.md` 是另一个 AI 进入该子文件夹时的第一入口，必须：

1. 声明严格复刻契约和双主题要求；
2. 要求先实时读取 `manifest.json`，不依赖可能过期的状态描述；
3. 给出档案内部阅读顺序；
4. 指向父级规范；
5. 说明采集、更新和消费时分别该做什么；
6. 禁止近似值、主题混用和静默“优化”；
7. 要求按 `quality/acceptance.md` 验收并输出偏差报告；
8. 在父级 `docs/` 不可访问时，仍提供足够的核心规则使 Agent 不会误用档案。

新建档案时必须基于 `docs/10-profile-agent-template.md` 同时创建该文件。缺少子档案 `AGENTS.md` 是 blocker。

## 5. 主动探索原则

Agent 不应把用户变成采集工具。获得 URL、截图、源码、设计稿或素材后，应先使用现有工具进行安全、只读、可追溯的最大化探索，包括页面枚举、双主题和多视口截图、DOM/计算样式提取、字体与资源识别、组件状态采集、源码静态分析及必要的本地运行验证。具体流程见 `docs/03-active-exploration.md`。

只有完成一轮主动探索后，才集中向用户询问工具无法获得、权限阻止或证据仍不足的内容。每个问题都要写明缺什么、为什么重要、如何提供，并同步到 `quality/REQUESTS.md`、`quality/TODO.md` 和 `quality/gaps.md`。

## 6. 完整性的硬约束

- 每个档案从创建开始维护 `quality/TODO.md`；已完成项保留为 `[x]`。
- 每轮工作都要更新覆盖矩阵、待办、用户请求、自检报告和 manifest 计数。
- 只有双主题、关键页面/组件/状态、响应式、Token、实现指南与视觉回归全部满足，且开放待办为 0，状态才能设为 `complete`。
- `intake`、`inventoried`、`analyzed`、`reusable`、`validated` 都不等于完整。
- 任何未知、近似替代、低置信关键结论或未解释冲突都阻止 `complete`。

## 7. 工作纪律

- 先检查现有文件，不重复建档。
- 原始资料不可变；派生裁切、标注和转换文件与原件分开。
- 观察、推断、建议严格区分；无法观察就是未知。
- 不执行不受信任代码，不绕过登录/付费墙/访问控制，不归档凭据和隐私数据。
- 文档使用相对路径；JSON/CSS 写完必须校验。
- 不在根目录散落某个风格的资料。
- 回复用户时报告：档案路径、状态、完成率、主动探索内容、双主题覆盖、产物、开放待办、阻塞项和下一步最有价值的输入。

## 8. Worktree 统一目录、编号与登记

- 本仓库所有功能 worktree 必须统一创建在仓库根目录的 `.worktree/` 隐藏目录中，禁止散落到仓库同级目录、系统临时目录或其他任意位置。
- `.worktree/` 必须加入根目录 `.gitignore`，目录内的 worktree、编号登记和临时资料都不得提交到 Git。
- 每次创建 worktree 前，必须先在 `.worktree/registry.md` 中分配并登记一个全局递增、永不复用的四位编号。编号从 `0001` 开始，取历史最大编号加一；多个 Agent 并行工作时，编号分配与登记必须串行完成，避免重复。
- 功能 worktree 目录统一命名为 `.worktree/<编号>-<feature-slug>/`，临时本地分支统一命名为 `worktree/<编号>-<feature-slug>`；例如 `.worktree/0001-login-page/` 对应 `worktree/0001-login-page`。
- `registry.md` 至少记录：编号、功能名称、分支、相对路径、基线提交、创建时间、当前状态、功能提交、集成提交、清理时间和备注。状态按 `active → committed → integrated → pushed → cleaned` 更新；失败或受阻时标记为 `blocked` 并写明原因，不得删除历史记录。
- 创建、提交、集成、推送和清理 worktree 后都要立即更新对应登记。清理时只移除已安全交付的功能 worktree 和临时分支，保留 `.worktree/registry.md` 及历史编号记录。

## 9. 功能完成后的自动提交与推送授权

- 用户持续授权：每一次功能完成且相关检查通过后，Agent 必须自动提交该功能的相关改动并自动推送，无需再次询问或等待用户确认。
- 提交前只暂存本次功能相关文件，不得夹带用户已有改动或其他无关变更；提交信息必须准确概括本次功能。
- 较大功能仍按 worktree 流程开发、提交并串行集成到默认主分支；最终自动推送默认主分支到 `origin`。小范围、低风险修改可直接在干净的默认主分支完成，并在检查通过后自动提交和推送。
- 自动推送不代表允许强制推送。若检查失败、远端拒绝、认证失败、存在无法安全处理的冲突或工作区包含会被影响的无关改动，应停止危险操作、保留现场并向用户报告。
