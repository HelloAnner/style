# EVD-006：登录小人源码映射

## 结论

截图中的登录小人已在当前线上生产 bundle 中定位并恢复为可读 React 组件。

`Observed · exact-source · high · shared role / light screenshot · SRC-013, SRC-054, SRC-055`

## 版本核对

| 位置 | 结果 |
|---|---|
| `/Users/anner/fine/ai/corevo` | `master` / `14394dc7ca16aa13c62e8a089c6ffff4953424f3` |
| `web/src/pages/auth/AuthPage.tsx` | 旧版居中玻璃卡片；无小人、无左侧 slogan |
| `web/src/components/Chat/ChatContainer.tsx` | 有无眼流体头像，但不是登录小人 |
| `sources/webpages/assets/app/index-ChXKQFVA.js` | 含截图对应的新版登录壳层、slogan 和完整小人实现 |

因此，本组件不能从当前本地 `AuthPage.tsx` 直接复制；当前事实以已归档生产 bundle
`SRC-013` 为准。这是既有 `GAP-004` 的新增具体实例。

## 生产符号映射

| bundle 符号 | 恢复后的语义 | 档案产物 |
|---|---|---|
| `La` | 左眼几何 | `LEFT_EYE` |
| `Oa` | 右眼几何 | `RIGHT_EYE` |
| `zh` | 默认视线 | `DEFAULT_GAZE` |
| `nBe` | 登录小人 React 组件 | `WufanLoginMascot` |
| `HO` | 新版认证页面壳层 | `demo.html` 中的定位/面板上下文 |

## 精确参数

### 根定位

```text
position: absolute
right: clamp(384px, 28.4vw, 444px)
top: 52%
transform: translateY(-50%) scaleX(-1)
z-index: 1
pointer-events: none
```

### 主体

```text
svg: 240×300
viewBox: 0 0 30 38
ellipse: cx=6 cy=19 rx=24 ry=19
gradient: (0,0) → (1,1)
0% #EC4899
50% #8B5CF6
100% #3B82F6
accent: circle cx=14 cy=1 r=3 #EC4899 opacity .5
```

### 眼睛

| 参数 | 左眼 | 右眼 |
|---|---:|---:|
| sclera center | 17,14 | 25,18 |
| sclera radius | 3.8 | 3.2 |
| pupil radius | 2.2 | 1.8 |
| default pupil offset | +1.8,-0.5 | +1.5,-0.5 |
| highlight offset | -1.2,-1 | -1,-0.8 |
| highlight radius | 0.9 | 0.7 |

闭眼路径分别为 `M14 14 Q17 11 20 14` 和 `M22 18 Q25 15 28 18`，
白色、`1.5` 描边、round linecap。

### 动效

- 漂浮：Y `0 → -5 → 0px`，`5s`、`easeInOut`、无限循环；
- 眨眼：每 `3000 + random(0..4000)ms`，闭眼 `150ms`；
- 视线更新延迟 `200ms`；
- 允许角度为角色左侧法线的 ±70°；
- 距离到 `300px` 达到最大强度；
- 每帧向目标插值 `0.08`；
- 瞳孔中心以 `orbitR - pupilR` 为最大偏移半径。

## 截图核对

- `SRC-054`：`3196×1922` RGBA，推断 DPR2，对应 `1598×961` CSS viewport；
- `SRC-055`：`1132×1096` RGBA，为用户提供的登录小人与面板交界局部图；
- 两张图均显示三段渐变、粉色装饰圆、左右不同尺寸眼睛、深蓝瞳孔和白色高光；
- 登录面板覆盖角色右侧，来源并没有把主体裁成半圆。

## 可复用实现

- React：`examples/reference/login-mascot/WufanLoginMascot.tsx`
- 机器规格：`examples/reference/login-mascot/spec.json`
- 零构建演示：`examples/reference/login-mascot/demo.html`

这三个文件是由 `SRC-013` 恢复的派生产物，不替代原始 bundle。
