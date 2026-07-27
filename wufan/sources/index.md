# 来源与证据索引

当前登记 **53** 项来源。`SRC-046`–`SRC-053` 是保留但已判定不稳定的首次自动截图，不应用作主题事实。

## 关键来源

- `SRC-002`：暗色登录后新任务页原图。
- `SRC-003`：明色登录后对话页原图。
- `SRC-004`：用户提供的前端源码快照（本地保存，公开发布待确认）。
- `SRC-012` / `SRC-013`：当前线上部署的 CSS/JS，优先于较旧源码判断当前版本。
- `SRC-014`：明色 What’s New 截图；与线上 JS 一致，但与用户源码 commit 中组件实现不同。
- `SRC-016`–`SRC-045`：公开页面双视口截图和计算样式。

## 完整清单

### SRC-001
- 类型：`url`
- 原始来源：https://www.wufanai.com/
- 本地路径：无（URL 入口）
- 主题：`shared`
- 页面/路由：`/`
- viewport / DPR：`unknown / unknown`
- 状态：`n/a`
- 获取时间：`2026-07-26T23:36:35Z`
- SHA-256：`n/a`
- 授权类别：`explicit`
- 备注：User-designated Wufan reference site.

### SRC-002
- 类型：`screenshot`
- 原始来源：User-provided clipboard screenshot
- 本地路径：`sources/screenshots/original/dark/app__dark__3188x1936__new-task-default__01.png`
- 主题：`dark`
- 页面/路由：`/ (authenticated app, new task)`
- viewport / DPR：`{'width': 1594, 'height': 968, 'physicalWidth': 3188, 'physicalHeight': 1936} / 2`
- 状态：`default`
- 获取时间：`2026-07-26T23:36:35Z`
- SHA-256：`4b75231f61689bef26d8a12e3f8fe1086d8d838b57fdefd8b9d8652049ff89a5`
- 授权类别：`provided`
- 备注：DPR inferred from 240px source sidebar rendering as ~480 physical pixels; contains user display name.

### SRC-003
- 类型：`screenshot`
- 原始来源：User-provided clipboard screenshot
- 本地路径：`sources/screenshots/original/light/app__light__3188x1948__chat-default__01.png`
- 主题：`light`
- 页面/路由：`/s/:sessionId (authenticated app, chat)`
- viewport / DPR：`{'width': 1594, 'height': 974, 'physicalWidth': 3188, 'physicalHeight': 1948} / 2`
- 状态：`default`
- 获取时间：`2026-07-26T23:36:35Z`
- SHA-256：`500f7ac9a978d1d1fb737c4a54f28ea690e019abe5084608bc73b68fb371b77e`
- 授权类别：`provided`
- 备注：DPR inferred; contains user display name and conversation content.

### SRC-004
- 类型：`source`
- 原始来源：/Users/anner/fine/ai/corevo at commit 14394dc7ca16aa13c62e8a089c6ffff4953424f3
- 本地路径：`sources/source-code/private/corevo-web-14394dc/SOURCE-MANIFEST.json`
- 主题：`shared`
- 页面/路由：`n/a`
- viewport / DPR：`unknown / unknown`
- 状态：`n/a`
- 获取时间：`2026-07-26T23:36:35Z`
- SHA-256：`ba091e3a0fc021bb3671122268079327fe18e32d9421477b27bd27dabde67ad4`
- 授权类别：`explicit`
- 备注：Sanitized frontend snapshot, private-publication pending; source commit predates current deployed assets and differs in WhatsNew.

### SRC-005
- 类型：`webpage`
- 原始来源：https://www.wufanai.com/
- 本地路径：`sources/webpages/homepage__20260727.html`
- 主题：`dark`
- 页面/路由：`/`
- viewport / DPR：`unknown / unknown`
- 状态：`n/a`
- 获取时间：`2026-07-26T23:36:35Z`
- SHA-256：`0c3fbc3ed8ae80f38358887baa44d7263aed3bb3b41e4c7715f9cb6e26acebd0`
- 授权类别：`public`

### SRC-006
- 类型：`asset`
- 原始来源：https://www.wufanai.com/css/index.css?v=7ec727d4
- 本地路径：`sources/webpages/assets/css/index__7ec727d4.css`
- 主题：`dark`
- 页面/路由：`/`
- viewport / DPR：`unknown / unknown`
- 状态：`n/a`
- 获取时间：`2026-07-26T23:36:35Z`
- SHA-256：`d3a9a4831f29cc90a9ac7314685f6be6d109bbe72eda94e6f1624aa98d858115`
- 授权类别：`public`

### SRC-007
- 类型：`asset`
- 原始来源：https://www.wufanai.com/img/wf-logo.svg
- 本地路径：`sources/webpages/assets/img/wf-logo.svg`
- 主题：`shared`
- 页面/路由：`/`
- viewport / DPR：`unknown / unknown`
- 状态：`n/a`
- 获取时间：`2026-07-26T23:36:35Z`
- SHA-256：`491a1880902f19490688d38340fa49a28192dc6c712282b9d5174793bd801f7c`
- 授权类别：`public`

### SRC-008
- 类型：`asset`
- 原始来源：https://www.wufanai.com/fonts/SmileySans-Oblique.woff2
- 本地路径：`sources/webpages/assets/fonts/SmileySans-Oblique.woff2`
- 主题：`shared`
- 页面/路由：`/`
- viewport / DPR：`unknown / unknown`
- 状态：`n/a`
- 获取时间：`2026-07-26T23:36:35Z`
- SHA-256：`731f22973349404b15a88a99ef3b5dd4104c0965c23b7e485c1f11e84fea99e2`
- 授权类别：`public`

### SRC-009
- 类型：`webpage`
- 原始来源：https://www.wufanai.com/learn
- 本地路径：`sources/webpages/learn__20260727.html`
- 主题：`dark`
- 页面/路由：`/learn`
- viewport / DPR：`unknown / unknown`
- 状态：`n/a`
- 获取时间：`2026-07-26T23:36:35Z`
- SHA-256：`50cb25f53845c445fb6ee47008a0d77fb32942916e63edcd2bae1f8f675b0f99`
- 授权类别：`public`

### SRC-010
- 类型：`webpage`
- 原始来源：https://www.wufanai.com/pricing
- 本地路径：`sources/webpages/pricing__20260727.html`
- 主题：`dark`
- 页面/路由：`/pricing`
- viewport / DPR：`unknown / unknown`
- 状态：`n/a`
- 获取时间：`2026-07-26T23:36:35Z`
- SHA-256：`c4f3b089574bd7f84191651a842de786648043a2ad8c4adca55d835e26c3336c`
- 授权类别：`public`

### SRC-011
- 类型：`webpage`
- 原始来源：https://www.wufanai.com/login
- 本地路径：`sources/webpages/login__20260727.html`
- 主题：`shared`
- 页面/路由：`/login`
- viewport / DPR：`unknown / unknown`
- 状态：`n/a`
- 获取时间：`2026-07-26T23:36:35Z`
- SHA-256：`c48ccbde924d181119b0e1983060a2a73dfa7f49c096acd91cb312357acf6569`
- 授权类别：`public`

### SRC-012
- 类型：`asset`
- 原始来源：https://www.wufanai.com/assets/index-CjeRCaxU.css
- 本地路径：`sources/webpages/assets/app/index-CjeRCaxU.css`
- 主题：`shared`
- 页面/路由：`/login`
- viewport / DPR：`unknown / unknown`
- 状态：`n/a`
- 获取时间：`2026-07-26T23:36:35Z`
- SHA-256：`d74880cdb5b1df56a691052823e31deadc71881c6cedba524a0828c1e662ec73`
- 授权类别：`public`

### SRC-013
- 类型：`asset`
- 原始来源：https://www.wufanai.com/assets/index-ChXKQFVA.js
- 本地路径：`sources/webpages/assets/app/index-ChXKQFVA.js`
- 主题：`shared`
- 页面/路由：`/login`
- viewport / DPR：`unknown / unknown`
- 状态：`n/a`
- 获取时间：`2026-07-26T23:36:35Z`
- SHA-256：`958e0610e36bbb394c63add706a4053fd7d418b41beab9e71e6bb844e4b313b6`
- 授权类别：`public`

### SRC-014
- 类型：`screenshot`
- 原始来源：User-provided clipboard screenshot
- 本地路径：`sources/screenshots/original/light/app__light__860x1292__whats-new-default__01.png`
- 主题：`light`
- 页面/路由：`authenticated app / What’s New`
- viewport / DPR：`{'physicalWidth': 860, 'physicalHeight': 1292} / 2`
- 状态：`default`
- 获取时间：`2026-07-26T23:36:35Z`
- SHA-256：`30419228cf8edf6d715b5872b39ab5c6fdd613f0cebac496d680a7d562752550`
- 授权类别：`provided`
- 备注：Likely DPR 2 component crop; no viewport context. Matches current deployed JS, not provided source commit WhatsNew implementation.

### SRC-015
- 类型：`asset`
- 原始来源：Public web font dependencies
- 本地路径：`sources/assets/fonts/public/FONT-MANIFEST.json`
- 主题：`shared`
- 页面/路由：`n/a`
- viewport / DPR：`unknown / unknown`
- 状态：`n/a`
- 获取时间：`2026-07-26T23:36:35Z`
- SHA-256：`25b70f716e4fc77239f3bd9c13e6f8c6a608f2da3f2947906f81f1a2512cd349`
- 授权类别：`public`
- 备注：12 public web font files plus CSS; redistribution license verification remains open.

### SRC-016
- 类型：`screenshot`
- 原始来源：https://www.wufanai.com/
- 本地路径：`sources/screenshots/original/dark/homepage__dark__1440x900__default__01__full-page.png`
- 主题：`dark`
- 页面/路由：`/`
- viewport / DPR：`{'width': 1440, 'height': 900} / 1`
- 状态：`default`
- 获取时间：`2026-07-26T23:36:35Z`
- SHA-256：`c9d36b763eab2fd43712e13b5e0f6380177beb9b48230237dfe2aa32e25e871b`
- 授权类别：`public`
- 备注：Automated Chromium capture; full-page. Marketing routes have a fixed dark design; login theme set via corevo-theme.

### SRC-017
- 类型：`screenshot`
- 原始来源：https://www.wufanai.com/
- 本地路径：`sources/screenshots/original/dark/homepage__dark__1440x900__default__01__viewport.png`
- 主题：`dark`
- 页面/路由：`/`
- viewport / DPR：`{'width': 1440, 'height': 900} / 1`
- 状态：`default`
- 获取时间：`2026-07-26T23:36:35Z`
- SHA-256：`cea399ca6e912719731278809b2dc2fbefdec3c1ed058188fbade79c62b2793f`
- 授权类别：`public`
- 备注：Automated Chromium capture; viewport. Marketing routes have a fixed dark design; login theme set via corevo-theme.

### SRC-018
- 类型：`screenshot`
- 原始来源：https://www.wufanai.com/
- 本地路径：`sources/screenshots/original/dark/homepage__dark__390x844__default__01__full-page.png`
- 主题：`dark`
- 页面/路由：`/`
- viewport / DPR：`{'width': 390, 'height': 844} / 1`
- 状态：`default`
- 获取时间：`2026-07-26T23:36:35Z`
- SHA-256：`838c58ea1357c67d711815aa93fa288562bb70aa4b1dd53d07318f77b555a3f2`
- 授权类别：`public`
- 备注：Automated Chromium capture; full-page. Marketing routes have a fixed dark design; login theme set via corevo-theme.

### SRC-019
- 类型：`screenshot`
- 原始来源：https://www.wufanai.com/
- 本地路径：`sources/screenshots/original/dark/homepage__dark__390x844__default__01__viewport.png`
- 主题：`dark`
- 页面/路由：`/`
- viewport / DPR：`{'width': 390, 'height': 844} / 1`
- 状态：`default`
- 获取时间：`2026-07-26T23:36:35Z`
- SHA-256：`597cdde97b95a1ac25f76230d36c5f18d24af1181eb92d5311786de78f88fc61`
- 授权类别：`public`
- 备注：Automated Chromium capture; viewport. Marketing routes have a fixed dark design; login theme set via corevo-theme.

### SRC-020
- 类型：`screenshot`
- 原始来源：https://www.wufanai.com/learn
- 本地路径：`sources/screenshots/original/dark/learn__dark__1440x900__default__01__full-page.png`
- 主题：`dark`
- 页面/路由：`/learn`
- viewport / DPR：`{'width': 1440, 'height': 900} / 1`
- 状态：`default`
- 获取时间：`2026-07-26T23:36:35Z`
- SHA-256：`7285c262e04e00e22698219dbd2e2f9672b6bf39d78e28d62024df62e7af31dc`
- 授权类别：`public`
- 备注：Automated Chromium capture; full-page. Marketing routes have a fixed dark design; login theme set via corevo-theme.

### SRC-021
- 类型：`screenshot`
- 原始来源：https://www.wufanai.com/learn
- 本地路径：`sources/screenshots/original/dark/learn__dark__1440x900__default__01__viewport.png`
- 主题：`dark`
- 页面/路由：`/learn`
- viewport / DPR：`{'width': 1440, 'height': 900} / 1`
- 状态：`default`
- 获取时间：`2026-07-26T23:36:35Z`
- SHA-256：`ddec1db21d28e93aa0f40decf7dfed5ac53766e44972fe8946fac44894f01634`
- 授权类别：`public`
- 备注：Automated Chromium capture; viewport. Marketing routes have a fixed dark design; login theme set via corevo-theme.

### SRC-022
- 类型：`screenshot`
- 原始来源：https://www.wufanai.com/learn
- 本地路径：`sources/screenshots/original/dark/learn__dark__390x844__default__01__full-page.png`
- 主题：`dark`
- 页面/路由：`/learn`
- viewport / DPR：`{'width': 390, 'height': 844} / 1`
- 状态：`default`
- 获取时间：`2026-07-26T23:36:35Z`
- SHA-256：`79ed3c953a254f8075c22200f4583bc978d344c04ad4f9495a0e8724b600744a`
- 授权类别：`public`
- 备注：Automated Chromium capture; full-page. Marketing routes have a fixed dark design; login theme set via corevo-theme.

### SRC-023
- 类型：`screenshot`
- 原始来源：https://www.wufanai.com/learn
- 本地路径：`sources/screenshots/original/dark/learn__dark__390x844__default__01__viewport.png`
- 主题：`dark`
- 页面/路由：`/learn`
- viewport / DPR：`{'width': 390, 'height': 844} / 1`
- 状态：`default`
- 获取时间：`2026-07-26T23:36:35Z`
- SHA-256：`7a1ac7fe8b9dcbbc1572082c1a67a71c2b94af6b1d057a8d1cf074da374628fa`
- 授权类别：`public`
- 备注：Automated Chromium capture; viewport. Marketing routes have a fixed dark design; login theme set via corevo-theme.

### SRC-024
- 类型：`screenshot`
- 原始来源：https://www.wufanai.com/login
- 本地路径：`sources/screenshots/original/dark/login__dark__1440x900__default__01__full-page.png`
- 主题：`dark`
- 页面/路由：`/login`
- viewport / DPR：`{'width': 1440, 'height': 900} / 1`
- 状态：`default`
- 获取时间：`2026-07-26T23:36:35Z`
- SHA-256：`5f6159edb535d0fb19d689f3550048aa246b9d637c332a5ea2451d6a15ed4a51`
- 授权类别：`public`
- 备注：Automated Chromium capture; full-page. Marketing routes have a fixed dark design; login theme set via corevo-theme.

### SRC-025
- 类型：`screenshot`
- 原始来源：https://www.wufanai.com/login
- 本地路径：`sources/screenshots/original/dark/login__dark__1440x900__default__01__viewport.png`
- 主题：`dark`
- 页面/路由：`/login`
- viewport / DPR：`{'width': 1440, 'height': 900} / 1`
- 状态：`default`
- 获取时间：`2026-07-26T23:36:35Z`
- SHA-256：`828db34a4e667629102450796a81379ff7252d8ecdf793bce08a5f377821ec92`
- 授权类别：`public`
- 备注：Automated Chromium capture; viewport. Marketing routes have a fixed dark design; login theme set via corevo-theme.

### SRC-026
- 类型：`screenshot`
- 原始来源：https://www.wufanai.com/login
- 本地路径：`sources/screenshots/original/dark/login__dark__390x844__default__01__full-page.png`
- 主题：`dark`
- 页面/路由：`/login`
- viewport / DPR：`{'width': 390, 'height': 844} / 1`
- 状态：`default`
- 获取时间：`2026-07-26T23:36:35Z`
- SHA-256：`a032e5de4efd1f48c1cb41c4269b96fa672b301b63c470d6f06d1e02a137545a`
- 授权类别：`public`
- 备注：Automated Chromium capture; full-page. Marketing routes have a fixed dark design; login theme set via corevo-theme.

### SRC-027
- 类型：`screenshot`
- 原始来源：https://www.wufanai.com/login
- 本地路径：`sources/screenshots/original/dark/login__dark__390x844__default__01__viewport.png`
- 主题：`dark`
- 页面/路由：`/login`
- viewport / DPR：`{'width': 390, 'height': 844} / 1`
- 状态：`default`
- 获取时间：`2026-07-26T23:36:35Z`
- SHA-256：`a032e5de4efd1f48c1cb41c4269b96fa672b301b63c470d6f06d1e02a137545a`
- 授权类别：`public`
- 备注：Automated Chromium capture; viewport. Marketing routes have a fixed dark design; login theme set via corevo-theme.

### SRC-028
- 类型：`screenshot`
- 原始来源：https://www.wufanai.com/pricing
- 本地路径：`sources/screenshots/original/dark/pricing__dark__1440x900__default__01__full-page.png`
- 主题：`dark`
- 页面/路由：`/pricing`
- viewport / DPR：`{'width': 1440, 'height': 900} / 1`
- 状态：`default`
- 获取时间：`2026-07-26T23:36:35Z`
- SHA-256：`68607d936f1eff46a7c0c3b0a217b8253d855236b5fad714b2c4afecd69b653a`
- 授权类别：`public`
- 备注：Automated Chromium capture; full-page. Marketing routes have a fixed dark design; login theme set via corevo-theme.

### SRC-029
- 类型：`screenshot`
- 原始来源：https://www.wufanai.com/pricing
- 本地路径：`sources/screenshots/original/dark/pricing__dark__1440x900__default__01__viewport.png`
- 主题：`dark`
- 页面/路由：`/pricing`
- viewport / DPR：`{'width': 1440, 'height': 900} / 1`
- 状态：`default`
- 获取时间：`2026-07-26T23:36:35Z`
- SHA-256：`8139b1858890361ae405921e789beaeebeedb2777be5e2ff245674a44b95b2a8`
- 授权类别：`public`
- 备注：Automated Chromium capture; viewport. Marketing routes have a fixed dark design; login theme set via corevo-theme.

### SRC-030
- 类型：`screenshot`
- 原始来源：https://www.wufanai.com/pricing
- 本地路径：`sources/screenshots/original/dark/pricing__dark__390x844__default__01__full-page.png`
- 主题：`dark`
- 页面/路由：`/pricing`
- viewport / DPR：`{'width': 390, 'height': 844} / 1`
- 状态：`default`
- 获取时间：`2026-07-26T23:36:35Z`
- SHA-256：`dec52a3a8d6699aff2cacd645038132cc4c3febf7558e307ceb82766dbf17b8e`
- 授权类别：`public`
- 备注：Automated Chromium capture; full-page. Marketing routes have a fixed dark design; login theme set via corevo-theme.

### SRC-031
- 类型：`screenshot`
- 原始来源：https://www.wufanai.com/pricing
- 本地路径：`sources/screenshots/original/dark/pricing__dark__390x844__default__01__viewport.png`
- 主题：`dark`
- 页面/路由：`/pricing`
- viewport / DPR：`{'width': 390, 'height': 844} / 1`
- 状态：`default`
- 获取时间：`2026-07-26T23:36:35Z`
- SHA-256：`a3e41a07f4985813f10c18cef179673d7785199b0463b950641b4535c8a70ecb`
- 授权类别：`public`
- 备注：Automated Chromium capture; viewport. Marketing routes have a fixed dark design; login theme set via corevo-theme.

### SRC-032
- 类型：`screenshot`
- 原始来源：https://www.wufanai.com/login
- 本地路径：`sources/screenshots/original/light/login__light__1440x900__default__01__full-page.png`
- 主题：`light`
- 页面/路由：`/login`
- viewport / DPR：`{'width': 1440, 'height': 900} / 1`
- 状态：`default`
- 获取时间：`2026-07-26T23:36:35Z`
- SHA-256：`4238c6b350f70eef62bf2a256c00c5d64ac12583c5063af1742109d913671a1f`
- 授权类别：`public`
- 备注：Automated Chromium capture; full-page. Marketing routes have a fixed dark design; login theme set via corevo-theme.

### SRC-033
- 类型：`screenshot`
- 原始来源：https://www.wufanai.com/login
- 本地路径：`sources/screenshots/original/light/login__light__1440x900__default__01__viewport.png`
- 主题：`light`
- 页面/路由：`/login`
- viewport / DPR：`{'width': 1440, 'height': 900} / 1`
- 状态：`default`
- 获取时间：`2026-07-26T23:36:35Z`
- SHA-256：`f32cbca440f733a8ef121e35d74cec01d7b3b9f8104eef5ea71bdab1b0be56b4`
- 授权类别：`public`
- 备注：Automated Chromium capture; viewport. Marketing routes have a fixed dark design; login theme set via corevo-theme.

### SRC-034
- 类型：`screenshot`
- 原始来源：https://www.wufanai.com/login
- 本地路径：`sources/screenshots/original/light/login__light__390x844__default__01__full-page.png`
- 主题：`light`
- 页面/路由：`/login`
- viewport / DPR：`{'width': 390, 'height': 844} / 1`
- 状态：`default`
- 获取时间：`2026-07-26T23:36:35Z`
- SHA-256：`07dd52782fe53c193fd2ba4d753b31c1951cfd385065fee46a8225582c7ab65b`
- 授权类别：`public`
- 备注：Automated Chromium capture; full-page. Marketing routes have a fixed dark design; login theme set via corevo-theme.

### SRC-035
- 类型：`screenshot`
- 原始来源：https://www.wufanai.com/login
- 本地路径：`sources/screenshots/original/light/login__light__390x844__default__01__viewport.png`
- 主题：`light`
- 页面/路由：`/login`
- viewport / DPR：`{'width': 390, 'height': 844} / 1`
- 状态：`default`
- 获取时间：`2026-07-26T23:36:35Z`
- SHA-256：`07dd52782fe53c193fd2ba4d753b31c1951cfd385065fee46a8225582c7ab65b`
- 授权类别：`public`
- 备注：Automated Chromium capture; viewport. Marketing routes have a fixed dark design; login theme set via corevo-theme.

### SRC-036
- 类型：`computed-style`
- 原始来源：https://www.wufanai.com/
- 本地路径：`sources/computed-styles/homepage__dark__1440x900__default__01.json`
- 主题：`dark`
- 页面/路由：`/`
- viewport / DPR：`{'width': 1440, 'height': 900} / 1`
- 状态：`default`
- 获取时间：`2026-07-26T23:36:35Z`
- SHA-256：`27bad5a0de5b7b3e768155417f6526aa49d371535ea141c0af1e2f069416cecc`
- 授权类别：`public`

### SRC-037
- 类型：`computed-style`
- 原始来源：https://www.wufanai.com/
- 本地路径：`sources/computed-styles/homepage__dark__390x844__default__01.json`
- 主题：`dark`
- 页面/路由：`/`
- viewport / DPR：`{'width': 390, 'height': 844} / 1`
- 状态：`default`
- 获取时间：`2026-07-26T23:36:35Z`
- SHA-256：`715c5d277e74d9f3b6ab6976f5c1c6dd3689e89ffcb17972082469464393a4b9`
- 授权类别：`public`

### SRC-038
- 类型：`computed-style`
- 原始来源：https://www.wufanai.com/learn
- 本地路径：`sources/computed-styles/learn__dark__1440x900__default__01.json`
- 主题：`dark`
- 页面/路由：`/learn`
- viewport / DPR：`{'width': 1440, 'height': 900} / 1`
- 状态：`default`
- 获取时间：`2026-07-26T23:36:35Z`
- SHA-256：`a6a3206abb6bd9dabdff6199d8aa3535ab2114f0676098956b22351b7169e1e8`
- 授权类别：`public`

### SRC-039
- 类型：`computed-style`
- 原始来源：https://www.wufanai.com/learn
- 本地路径：`sources/computed-styles/learn__dark__390x844__default__01.json`
- 主题：`dark`
- 页面/路由：`/learn`
- viewport / DPR：`{'width': 390, 'height': 844} / 1`
- 状态：`default`
- 获取时间：`2026-07-26T23:36:35Z`
- SHA-256：`802bae9065f3afe06fcc6615f1b9ee9573697ad0342004abf3a9babdc83d1df1`
- 授权类别：`public`

### SRC-040
- 类型：`computed-style`
- 原始来源：https://www.wufanai.com/login
- 本地路径：`sources/computed-styles/login__dark__1440x900__default__01.json`
- 主题：`dark`
- 页面/路由：`/login`
- viewport / DPR：`{'width': 1440, 'height': 900} / 1`
- 状态：`default`
- 获取时间：`2026-07-26T23:36:35Z`
- SHA-256：`0169caaf177ba0bee072114d2428fdd9814f7f98508056eabeb58ddfb2a5316b`
- 授权类别：`public`

### SRC-041
- 类型：`computed-style`
- 原始来源：https://www.wufanai.com/login
- 本地路径：`sources/computed-styles/login__dark__390x844__default__01.json`
- 主题：`dark`
- 页面/路由：`/login`
- viewport / DPR：`{'width': 390, 'height': 844} / 1`
- 状态：`default`
- 获取时间：`2026-07-26T23:36:35Z`
- SHA-256：`c765527bde50cd2d4090a2feb2dcffa2632c1abbb5b01723cd0a2aaff0e302d1`
- 授权类别：`public`

### SRC-042
- 类型：`computed-style`
- 原始来源：https://www.wufanai.com/login
- 本地路径：`sources/computed-styles/login__light__1440x900__default__01.json`
- 主题：`light`
- 页面/路由：`/login`
- viewport / DPR：`{'width': 1440, 'height': 900} / 1`
- 状态：`default`
- 获取时间：`2026-07-26T23:36:35Z`
- SHA-256：`e66e3faec7ee64a792a19fe6a8f91ed1ea2a677ca647a2460c9e52fca5fb2252`
- 授权类别：`public`

### SRC-043
- 类型：`computed-style`
- 原始来源：https://www.wufanai.com/login
- 本地路径：`sources/computed-styles/login__light__390x844__default__01.json`
- 主题：`light`
- 页面/路由：`/login`
- viewport / DPR：`{'width': 390, 'height': 844} / 1`
- 状态：`default`
- 获取时间：`2026-07-26T23:36:35Z`
- SHA-256：`0751147c4950db45150ab75c3fdeaea740b1461705924b61bf111b4adb71b5a0`
- 授权类别：`public`

### SRC-044
- 类型：`computed-style`
- 原始来源：https://www.wufanai.com/pricing
- 本地路径：`sources/computed-styles/pricing__dark__1440x900__default__01.json`
- 主题：`dark`
- 页面/路由：`/pricing`
- viewport / DPR：`{'width': 1440, 'height': 900} / 1`
- 状态：`default`
- 获取时间：`2026-07-26T23:36:35Z`
- SHA-256：`7c2a5e4b4b5185d581f9e361d6e93e388eb09798a2ac0cdb41772e4e7cb15fa5`
- 授权类别：`public`

### SRC-045
- 类型：`computed-style`
- 原始来源：https://www.wufanai.com/pricing
- 本地路径：`sources/computed-styles/pricing__dark__390x844__default__01.json`
- 主题：`dark`
- 页面/路由：`/pricing`
- viewport / DPR：`{'width': 390, 'height': 844} / 1`
- 状态：`default`
- 获取时间：`2026-07-26T23:36:35Z`
- SHA-256：`381cbf20492f9d231dfbfe19d48aaf3315f1b88a03367c00f29b93c84646d833`
- 授权类别：`public`

### SRC-046
- 类型：`screenshot`
- 原始来源：https://www.wufanai.com/
- 本地路径：`sources/screenshots/original/unknown/homepage__emulated-dark__1440x900__full-page__01.png`
- 主题：`unknown`
- 页面/路由：`/`
- viewport / DPR：`unknown / unknown`
- 状态：`loading/animation-unstable`
- 获取时间：`2026-07-26T23:36:35Z`
- SHA-256：`fb2f7e48aa67d384a12d423c10422da4a5efb9871a0f50febfb74b2cdae4e750`
- 授权类别：`public`
- 备注：Preliminary emulated-color-scheme capture; superseded by stable SRC-016+ capture and not valid as a product theme reference.

### SRC-047
- 类型：`screenshot`
- 原始来源：https://www.wufanai.com/
- 本地路径：`sources/screenshots/original/unknown/homepage__emulated-dark__1440x900__viewport__01.png`
- 主题：`unknown`
- 页面/路由：`/`
- viewport / DPR：`unknown / unknown`
- 状态：`loading/animation-unstable`
- 获取时间：`2026-07-26T23:36:35Z`
- SHA-256：`e060b77bd747b4c54d5d7c2b48979bd38319563bab782b96c42457610ae35add`
- 授权类别：`public`
- 备注：Preliminary emulated-color-scheme capture; superseded by stable SRC-016+ capture and not valid as a product theme reference.

### SRC-048
- 类型：`screenshot`
- 原始来源：https://www.wufanai.com/
- 本地路径：`sources/screenshots/original/unknown/homepage__emulated-dark__390x844__full-page__01.png`
- 主题：`unknown`
- 页面/路由：`/`
- viewport / DPR：`unknown / unknown`
- 状态：`loading/animation-unstable`
- 获取时间：`2026-07-26T23:36:35Z`
- SHA-256：`1664767a6028a5843bc4fd0988ad253b10e92f82154f12b4ca1d32ff565f895e`
- 授权类别：`public`
- 备注：Preliminary emulated-color-scheme capture; superseded by stable SRC-016+ capture and not valid as a product theme reference.

### SRC-049
- 类型：`screenshot`
- 原始来源：https://www.wufanai.com/
- 本地路径：`sources/screenshots/original/unknown/homepage__emulated-dark__390x844__viewport__01.png`
- 主题：`unknown`
- 页面/路由：`/`
- viewport / DPR：`unknown / unknown`
- 状态：`loading/animation-unstable`
- 获取时间：`2026-07-26T23:36:35Z`
- SHA-256：`7c7fb691f015520b6a67ef8d2217228a3e58647df7c43dcdba17675c8cc0fa3d`
- 授权类别：`public`
- 备注：Preliminary emulated-color-scheme capture; superseded by stable SRC-016+ capture and not valid as a product theme reference.

### SRC-050
- 类型：`screenshot`
- 原始来源：https://www.wufanai.com/
- 本地路径：`sources/screenshots/original/unknown/homepage__emulated-light__1440x900__full-page__01.png`
- 主题：`unknown`
- 页面/路由：`/`
- viewport / DPR：`unknown / unknown`
- 状态：`loading/animation-unstable`
- 获取时间：`2026-07-26T23:36:35Z`
- SHA-256：`d0e3c143ca2c880a8d46b8a3ff5a011e97c6b55ac211a72c9134166527ebdc25`
- 授权类别：`public`
- 备注：Preliminary emulated-color-scheme capture; superseded by stable SRC-016+ capture and not valid as a product theme reference.

### SRC-051
- 类型：`screenshot`
- 原始来源：https://www.wufanai.com/
- 本地路径：`sources/screenshots/original/unknown/homepage__emulated-light__1440x900__viewport__01.png`
- 主题：`unknown`
- 页面/路由：`/`
- viewport / DPR：`unknown / unknown`
- 状态：`loading/animation-unstable`
- 获取时间：`2026-07-26T23:36:35Z`
- SHA-256：`d0f2d9a165eb846bc5742bd40fcf3c6dedf1a4deff4fcea329c18fed723dbc29`
- 授权类别：`public`
- 备注：Preliminary emulated-color-scheme capture; superseded by stable SRC-016+ capture and not valid as a product theme reference.

### SRC-052
- 类型：`screenshot`
- 原始来源：https://www.wufanai.com/
- 本地路径：`sources/screenshots/original/unknown/homepage__emulated-light__390x844__full-page__01.png`
- 主题：`unknown`
- 页面/路由：`/`
- viewport / DPR：`unknown / unknown`
- 状态：`loading/animation-unstable`
- 获取时间：`2026-07-26T23:36:35Z`
- SHA-256：`e7dbc10e4ce97759f0737496d5eadcab2101b10f0a7dc4aea620129ef571e717`
- 授权类别：`public`
- 备注：Preliminary emulated-color-scheme capture; superseded by stable SRC-016+ capture and not valid as a product theme reference.

### SRC-053
- 类型：`screenshot`
- 原始来源：https://www.wufanai.com/
- 本地路径：`sources/screenshots/original/unknown/homepage__emulated-light__390x844__viewport__01.png`
- 主题：`unknown`
- 页面/路由：`/`
- viewport / DPR：`unknown / unknown`
- 状态：`loading/animation-unstable`
- 获取时间：`2026-07-26T23:36:35Z`
- SHA-256：`5aadebdbf36dbb7cc681cfd47e6aa8594a6d4b2b40852f1d3b7104705f0d7208`
- 授权类别：`public`
- 备注：Preliminary emulated-color-scheme capture; superseded by stable SRC-016+ capture and not valid as a product theme reference.

