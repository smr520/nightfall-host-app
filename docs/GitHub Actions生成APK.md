# GitHub Actions 生成多端安装包

仓库包含两条独立工作流：

- `CI`：在 Pull Request、`main` 推送或手动运行时执行类型检查、ESLint、引擎、回归、UI 测试和 `expo-doctor`。
- `Release packages`：手动运行或推送 `v*` 标签时并行构建 Android APK、Windows 安装版/免安装版、macOS Intel/Apple Silicon DMG 和未签名 iOS IPA。

## 构建流程

1. 在 Linux 验证任务中执行 TypeScript、ESLint、引擎、回归、UI、桌面脚本和 Expo 配置检查。
2. Android 使用 Node.js 24、Java 17、Android SDK 36 和固定发布签名构建 APK。
3. Windows 使用 Expo Web 导出和 Electron Builder 生成 NSIS 安装版与 Portable 免安装版。
4. macOS 分别在 Intel 与 Apple Silicon Runner 上生成 DMG。
5. iOS 在 macOS Runner 上执行 Expo Prebuild、CocoaPods 和 `xcodebuild`，生成未签名 IPA。
6. 所有安装包生成 SHA-256，并上传 Actions Artifact。
7. 标签构建全部通过后，创建对应版本的 GitHub Release。

## 手动测试构建

打开 GitHub 仓库：

```text
Actions → Release packages → Run workflow
```

手动构建不创建 Release；在本次 Run 页面底部的 Artifacts 下载：

```text
android-apk
windows-desktop
macos-x64
macos-arm64
ios-unsigned-ipa
```

如果仓库没有配置签名 Secrets，手动构建仍会产出调试签名测试包。不要把这种包当成可长期覆盖升级的正式版。

## 正式版本

正式版要求：

1. `package.json`、`app.json` 与 `desktop/package.json` 的版本一致。
2. `app.json` 的 Android `versionCode` 比上一版更大。
3. 仓库已配置四个 Android 签名 Secrets。
4. 标签名严格为 `v` 加版本号，例如 `v0.6.0`。

推送标签后，工作流会创建同名 GitHub Release，并上传：

```text
nightfall-host-1.1.0.apk
nightfall-host-1.1.0-windows-x64-setup.exe
nightfall-host-1.1.0-windows-x64-portable.exe
nightfall-host-1.1.0-mac-x64.dmg
nightfall-host-1.1.0-mac-arm64.dmg
nightfall-host-1.1.0-ios-unsigned.ipa
```

## 安全边界

- 签名密钥只存在于本地备份和 GitHub Secrets，不进入 Git 历史、Actions Artifact 或源码压缩包。
- 正式标签缺少签名 Secrets 时构建直接失败。
- APK 使用固定发布签名，后续正式版可覆盖安装；旧仓库曾用临时调试签名发布的测试包可能必须先卸载一次。
- Windows 与 macOS 当前没有商业签名证书，系统会提示未知发布者或阻止未公证应用；这不会改变源码与许可证，但会降低首次安装信任度。
- iOS 产物未签名，不能直接安装；只有配置 Apple Developer 证书后才可能生成 TestFlight 或 App Store 可接受签名包。
