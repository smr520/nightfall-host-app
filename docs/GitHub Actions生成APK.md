# GitHub Actions 生成 APK

仓库包含两条独立工作流：

- `CI`：在 Pull Request、`main` 推送或手动运行时执行类型检查、ESLint、引擎、回归、UI 测试和 `expo-doctor`。
- `Android APK`：手动运行或推送 `v*` 标签时构建带内嵌 JavaScript 的 Release APK。

## 构建流程

1. 安装 Node.js 24、Java 17 和 Android SDK 36。
2. 使用 `npm ci` 安装锁定依赖。
3. 重新执行完整测试。
4. 从 GitHub Secrets 解码固定发布签名。
5. 使用 Expo Prebuild 生成 Android 原生工程。
6. 使用 Gradle 构建 Release APK。
7. 使用 `apksigner` 验证签名。
8. 生成 SHA-256，上传 Actions Artifact。
9. 标签构建通过后，创建对应版本的 GitHub Release。

## 手动测试构建

打开 GitHub 仓库：

```text
Actions → Android APK → Run workflow
```

手动构建不创建 Release；在本次 Run 页面底部的 Artifacts 下载：

```text
nightfall-host-0.6.0-apk
```

如果仓库没有配置签名 Secrets，手动构建仍会产出调试签名测试包。不要把这种包当成可长期覆盖升级的正式版。

## 正式版本

正式版要求：

1. `package.json` 与 `app.json` 的版本一致。
2. `app.json` 的 Android `versionCode` 比上一版更大。
3. 仓库已配置四个 Android 签名 Secrets。
4. 标签名严格为 `v` 加版本号，例如 `v0.6.0`。

推送标签后，工作流会创建同名 GitHub Release，并上传：

```text
nightfall-host-0.6.0.apk
nightfall-host-0.6.0.apk.sha256
```

## 安全边界

- 签名密钥只存在于本地备份和 GitHub Secrets，不进入 Git 历史、Actions Artifact 或源码压缩包。
- 正式标签缺少签名 Secrets 时构建直接失败。
- APK 使用固定发布签名，后续正式版可覆盖安装；旧仓库曾用临时调试签名发布的测试包可能必须先卸载一次。
- 这是直接安装 APK，不是 Google Play AAB，也不替代 Play 商店要求的分发审核。
