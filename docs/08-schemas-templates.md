# Schema、命名与记录模板

## 1. `manifest.json`

最低结构：

```json
{
  "id": "style-id",
  "name": "可读名称",
  "version": "0.1.0",
  "status": "intake",
  "referenceMode": "strict",
  "requiredThemes": ["light", "dark"],
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601",
  "description": "一句话描述",
  "sourceCount": 0,
  "completion": {
    "requiredItems": 0,
    "completedItems": 0,
    "openItems": 0,
    "blockingItems": 0,
    "openRequests": 0,
    "selfAuditPassed": false
  },
  "coverage": {
    "desktop": "none",
    "mobile": "none",
    "lightTheme": "none",
    "darkTheme": "none",
    "componentStates": "none",
    "motion": "none",
    "accessibility": "none"
  },
  "entrypoints": {
    "agent": "AGENTS.md",
    "guide": "system/style-guide.md",
    "tokens": "system/tokens.json",
    "lightTokens": "system/themes/light.tokens.json",
    "darkTokens": "system/themes/dark.tokens.json",
    "implementation": "system/implementation.md",
    "acceptance": "quality/acceptance.md",
    "todo": "quality/TODO.md",
    "requests": "quality/REQUESTS.md",
    "completionReport": "quality/completion-report.md"
  },
  "lastValidated": null,
  "sources": []
}
```

状态枚举：`intake | inventoried | analyzed | reusable | validated | complete`。覆盖枚举：`none | partial | complete`。时间使用 ISO-8601。写完必须用 JSON parser 校验。

来源项：

```json
{
  "id": "SRC-001",
  "type": "screenshot | recording | url | webpage | computed-style | source | design-file | asset | document | note",
  "origin": "原始名称或 URL",
  "localPath": "sources/...",
  "sha256": null,
  "theme": "light | dark | shared | unknown",
  "route": null,
  "viewport": null,
  "dpr": null,
  "state": null,
  "collectedAt": "ISO-8601",
  "authorized": "provided | public | explicit | unknown"
}
```

## 2. `capture-manifest.json`

```json
{
  "environment": {
    "browser": "name/version",
    "os": "name/version",
    "locale": "zh-CN",
    "timezone": "Asia/Shanghai",
    "deviceScaleFactor": 1
  },
  "captures": [
    {
      "evidenceId": "SRC-010",
      "url": "https://example.com/dashboard",
      "route": "/dashboard",
      "theme": "light",
      "viewport": { "width": 1440, "height": 900 },
      "dpr": 1,
      "state": "default",
      "captureType": "viewport | full-page | component",
      "selector": null,
      "waitCondition": "fonts-ready + network-idle",
      "path": "sources/screenshots/original/light/...png",
      "sha256": "...",
      "capturedAt": "ISO-8601"
    }
  ]
}
```

不同批次环境不同，可在 capture 项覆盖全局环境或按 batch 分组。

## 3. 来源索引模板

```md
## SRC-001
- 类型：screenshot
- 原始来源：用户上传 `dashboard.png`
- 本地路径：sources/screenshots/original/light/...
- 主题：light
- 页面/组件：dashboard
- viewport / DPR：1440×900 / 1
- 状态：default
- 获取时间：...
- SHA-256：...
- 授权：用户提供
- 备注：原图，未修改
```

## 4. 文件命名

档案 ID 使用短、稳定 `kebab-case`。原始截图：

```text
<route-or-component>__<theme>__<viewport>__<state>__<sequence>.<ext>
```

其他文件建议：

```text
SRC-001__original-name.ext
EVD-001__SRC-001__button-padding-annotation.png
EXP-20260726-01__computed-styles.json
```

同名不可覆盖。先哈希去重；内容不同则新增 sequence/批次。路径不含凭据、查询 Token、用户隐私和不稳定随机 ID。

## 5. Token 示例

示例仅表示结构，值不能复制到具体档案：

```json
{
  "$metadata": {
    "profile": "example",
    "themes": ["light", "dark"],
    "evidence": ["SRC-001"],
    "precision": "exact-source"
  },
  "color": {
    "primitive": {
      "blue": {
        "600": { "$type": "color", "$value": "#2563eb" }
      }
    },
    "semantic": {
      "action": {
        "primary": {
          "background": {
            "$type": "color",
            "$value": {
              "light": "{color.primitive.blue.600}",
              "dark": "{color.primitive.blue.500}"
            }
          }
        }
      }
    }
  }
}
```

若采用的 Token 工具不支持 mode object，应使用该工具支持的标准形式；但聚合文件、主题展开文件和元数据的语义必须一致。

## 6. README 模板

```md
# <名称>

## 一句话风格定义
## 档案状态、完成率与 blocker
## light 主题入口
## dark 主题入口
## 视觉指纹
## 最重要的 Do / Don't
## 实现 Agent 阅读顺序
## 来源与证据入口
## 已知缺口、TODO 与用户请求
## 最新验证结果
```

## 7. CHANGELOG 模板

```md
## <version> — <date>
### Sources
### Analysis
### Tokens / implementation
### Validation
### Status / TODO
### Breaking changes
```

Token 名、组件 anatomy、主题映射或断点改变属于 breaking change，应升相应版本并提醒消费 Agent。

## 8. 覆盖矩阵模板

```md
| 对象 | 类型 | light desktop | dark desktop | light mobile | dark mobile | states | evidence | open TODO |
|---|---|---|---|---|---|---|---|---|
| App shell | pattern | observed | observed | partial | partial | default | SRC-... | TODO-... |
```

单元格枚举：`none | partial | observed | validated | n/a`。只有 validated 才代表该范围完成视觉或等价验证。

## 9. 校验

- manifest 的 sourceCount 等于实际来源项；
- TODO 的 `[ ]`、`[x]` 与 completion 计数一致；
- REQUESTS open 数与 manifest 一致；
- 所有 entrypoint 路径存在；
- 来源和证据引用无悬空；
- 时间与版本更新；
- JSON 可解析，Markdown 相对链接可解析；
- complete 时覆盖值全部为 complete，除有证据的 n/a 外无缺口。
