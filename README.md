# 夜幕 · 狼人杀主持助手

面向线下狼人杀主持人的离线工具，发布 Android、iOS、Windows 和 macOS 版本。它负责赛前配置、夜间行动记录、天亮复核、投票、技能提示和复盘；玩家模式单独保存自己的选本、身份、座位判断、出局状态和笔记。主持数据与玩家笔记互不覆盖。

## 当前能力

- 31 套完整阵容与 50 种角色资料，覆盖网易公开板、京城大师赛公开资料和常规线下阵容；板子按“已验证 / 主持引导 / 实验中”标明真实支持范围。
- 31 套板子均纳入自动整局矩阵，覆盖普通流程、平票 PK、手动天亮复核、遗言队列、出局技能、警徽和复盘往返。
- 支持首夜夜死、后续夜死、放逐、技能带走和自爆五类独立遗言策略；白天、警上、PK 和遗言可分别设置计时。
- 部分自动或主持人处理的技能会进入本局技能清单，主持人在软件内填写座位、目标、次数或裁定结果并写入复盘。
- 主持人可自定义夜间行动流程、放逐记录方式、放逐自投、出局结算顺序、桌规、夜间顺序、主持词、警长与平票策略，并查看每套板子的玩法介绍、来源和处理边界。
- 新局默认采用夜间行动流程：赛前只核对阵容、桌规、姓名和座位，不替每个座位预先写入身份。轮到狼人、预言家等角色时，主持台先要求点选本步实际睁眼的座位，确认后才进入刀人或技能操作；已出局角色默认保留空唤醒口播。仍可在桌规中显式改回“发牌后自行看牌”。
- 手机、平板、横屏和桌面窗口采用自适应布局；主要触控目标不小于 48 dp；提供标准、大字和超大主持提词。
- 玩家先选板子，再选择自己的座位和身份；其他板子的角色不会混入当前笔记。
- 玩家座位可标记出局或恢复在场，并同时编辑身份判断、具体身份和备注。
- 本地自动保存、进行中恢复、历史复盘、JSON 备份与恢复、旧存档迁移；保存中、成功和失败状态分别显示。
- 存档会校验存活状态、死亡记录、警徽处理、投票资格和结束结果的一致性；无法安全修复时会保留原数据并暂停覆盖。
- 无需账号、联网、相机、麦克风或定位权限。Android 正式包移除网络权限并关闭系统自动备份；Windows/macOS 桌面端只通过本地安全协议加载内置资源，不打开远程页面。
- 可为主持端设置 4–8 位数字 PIN；只保存加盐哈希，适合需要把同一台手机短暂交给玩家操作的场景。

## 重要边界

这是线下主持辅助工具，不是线上狼人杀客户端，也不是网易或京城大师赛的官方产品。板子名称和规则资料用于识别、研究和线下主持，相关商标及第三方资料权利归原权利人。

角色图鉴中存在“自动处理、部分处理、主持人处理”三档说明。骑士决斗、守墓人信息、部分觉醒与第三阵营技能等复杂机制仍需要主持人按赛前桌规裁定；软件不会把未完成的技能伪装成自动结算。游戏开始后，这些项目会进入本局技能清单，不能只凭记忆处理。具体边界以应用内技能表和 `docs/` 中已核对规则为准。

## 下载与安装

Android、iOS、Windows 和 macOS 安装包统一发布在仓库的 Releases 页面。

- Android APK 使用固定发布签名，后续同签名版本可覆盖安装。
- Windows 提供安装版和免安装版；当前没有商业代码签名证书，SmartScreen 可能提示“未知发布者”。
- macOS 提供 Intel 与 Apple Silicon 两个 DMG；当前未签名、未公证，首次打开需要在系统设置中允许。
- iOS 提供未签名 IPA，必须使用 Xcode、Sideloadly 或 AltStore 按自己的 Apple ID 重新签名后才能安装。

应用只在本机保存数据，卸载应用会删除本机对局与笔记，请先在“个性化 → 本机数据”中导出备份。

## 开发

环境要求：Node.js 24、npm 11、Java 17。原生 Android 构建还需要 Android SDK 36。

```powershell
npm ci
npm run typecheck
npm run lint
npm run test:engine
npm run test:regressions
npm run test:ui
```

使用 Expo Go 或本地模拟器启动：

```powershell
npm start
```

桌面端会把 Expo Web 静态导出封进 Electron 本地窗口。需要验证 SQLite Web 时，使用带 COOP/COEP 响应头的预览服务器：

```powershell
npm run desktop:prepare
npm run desktop:preview
```

构建原生工程：

```powershell
npx expo prebuild --platform android --no-install
Set-Location android
.\gradlew assembleRelease
```

Windows 安装版与免安装版：

```powershell
npm --prefix desktop ci
npm run desktop:build:win
```

macOS 必须在 macOS 上构建：

```sh
npm --prefix desktop ci
npm run desktop:build:mac:x64
npm run desktop:build:mac:arm64
```

没有 Android 签名环境变量时，本地 Release 构建会回退到调试签名。正式 CI 发布必须配置仓库 Secrets，具体步骤见 [GitHub Actions 构建说明](docs/GitHub%20Actions生成APK.md)。

## 项目结构

- `src/game/`：纯 TypeScript 规则、板子、流程、结算与存档结构。
- `src/ui/`：主持端、玩家端、设置、技能表与复盘界面。
- `src/player/`：玩家笔记模型、存档迁移和本机存储。
- `src/storage*.ts`：主持会话、历史和恢复数据。
- `desktop/`：Windows/macOS 的 Electron 主进程、预加载桥和安全打包配置。
- `scripts/`：单元、整局模拟、回归和界面测试。
- `docs/`：规则来源、流程说明、设备适配与构建记录。

## 数据与隐私

Android 正式包会移除网络权限并关闭系统自动备份；桌面端禁用权限请求、外部跳转和开发者工具，所有静态资源只从安装包内读取。应用不包含遥测、广告或账号系统。主持人和玩家的数据都在本机，导出备份、分享复盘和分享原始恢复数据都包含私密身份信息，应用会在操作前提示确认。任何设备都无法阻止专业外置采集设备，因此主持人仍应确认操作屏幕不会被玩家看到。

## 许可

本仓库的源代码、文档和官方发布物统一采用 [GPL-3.0-only](LICENSE)。这一口径覆盖 `v0.6.0` 及更早的官方历史发布物，也覆盖后续版本；每个 GitHub Release 都附带同一份 `LICENSE` 文件。分发修改版或衍生版时，必须按同一协议向接收者提供对应源码；仅在本地私下使用不触发分发义务。完整授权说明见 [NOTICE](NOTICE)。

## 参与贡献

提交问题时请写明板子、座位、操作步骤、预期结果和实际结果。规则存在版本差异时，请同时给出赛前桌规或公开来源；不要在公开 Issue 中粘贴真实玩家姓名、完整私密对局或其他个人信息。

- 可复现问题：[提交使用问题](https://github.com/smr520/nightfall-host-app/issues/new?template=bug_report.yml)
- 功能与流程建议：[提交功能建议](https://github.com/smr520/nightfall-host-app/issues/new?template=feature_request.yml) 或前往 [Discussions](https://github.com/smr520/nightfall-host-app/discussions)
- 安全或隐私漏洞：使用 [私密漏洞报告](https://github.com/smr520/nightfall-host-app/security/advisories/new)，不要公开发布私密存档或真实玩家信息

各入口的适用场景、隐私要求和代码提交规范见 [参与与反馈](CONTRIBUTING.md)。
