# 参与与反馈

夜幕主持是线下狼人杀主持工具。反馈时请尽量写清当前板子、人数、流程阶段、操作步骤、预期结果和实际结果，便于复现和判断规则问题。

## 反馈入口

- 使用中遇到的流程错误、判断错误、界面问题或安装问题：[提交使用问题](https://github.com/smr520/nightfall-host-app/issues/new?template=bug_report.yml)。
- 新玩法、桌规差异、主持流程或界面建议：[提交功能建议](https://github.com/smr520/nightfall-host-app/issues/new?template=feature_request.yml)，也可以到 [Discussions](https://github.com/smr520/nightfall-host-app/discussions) 交流。
- 安全、隐私、存档损坏或数据隔离问题：[私密报告](https://github.com/smr520/nightfall-host-app/security/advisories/new)，不要公开贴出漏洞细节或完整私密存档。

公开反馈中不要包含真实玩家姓名、PIN、完整身份表和可直接恢复的对局备份。规则存在门店或赛事差异时，请注明赛前桌规或公开来源，不要把一种桌规当成所有线下局的标准。

## 参与代码

提交代码前请先确认改动属于规则、界面、存档还是构建流程，并为行为变化补充相应测试。规则实现放在 `src/game/`，界面通过该层读取结果；状态更新应保持不可变。

提交前运行：

```powershell
npm run typecheck
npm run lint
npm run test:engine
npm run test:regressions
npm run test:ui
```

代码、文档和官方发布物采用 [GPL-3.0-only](LICENSE)。分发修改后的版本时，需要按同一许可证向接收者提供对应源代码。不要提交签名证书、密码、访问令牌、真实玩家资料或其他敏感信息。
