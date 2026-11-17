# 多端构建与发布

正式包由 `.github/workflows/android-apk.yml` 在推送 `v*` 版本标签时统一构建 Android APK、Windows 安装版/免安装版、macOS Intel/Apple Silicon DMG 和未签名 iOS IPA。普通源码检查由 `.github/workflows/ci.yml` 负责，不再让每次 `main` 提交覆盖 GitHub Releases 的“最新版本”。

## 本地构建

本地需要 Node.js 24、Java 17 和 Android SDK 36。未设置发布签名环境变量时，Expo 生成的 Release 构建会使用调试签名，只适合本机安装测试。

```powershell
npm ci
npx expo prebuild --platform android --no-install
Set-Location android
.\gradlew assembleRelease
```

输出位置：

```text
android/app/build/outputs/apk/release/app-release.apk
```

## 固定发布签名

正式 CI 使用仓库 Secrets，不从源码读取或提交私钥：

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

`plugins/with-android-release-signing.js` 只在这些变量齐全时覆盖生成工程的 Release 签名；变量缺失时保留 Expo 默认调试签名。标签构建如果缺少签名变量会直接失败，避免误发无法覆盖安装的正式版。

签名文件必须长期备份。丢失后不能继续给已安装用户提供覆盖升级，只能换包名或让用户卸载重装。

## 正式发布

确认 `package.json`、`app.json` 的版本一致后，推送匹配标签，例如：

```powershell
git tag v0.6.0
git push origin v0.6.0
```

工作流会依次运行完整检查、生成 Android 工程、构建 APK、验证签名、生成 SHA-256，并发布到 GitHub Releases。也可以在 Actions 页面手动运行构建，但手动构建只上传 Artifact，不创建正式 Release。

## Windows 与 macOS

`desktop/` 是 Expo Web 静态导出的 Electron 外壳。它使用 `nightfall://app` 安全协议读取安装包内资源，并设置 SQLite Web 所需的 COOP/COEP 响应头；外部导航、新窗口、权限请求和打包后的开发者工具全部关闭。

Windows 和 macOS 当前没有商业代码签名证书：

- Windows 会生成 NSIS 安装版和 Portable 免安装版，SmartScreen 可能提示未知发布者。
- macOS 会分别生成 Intel 与 Apple Silicon DMG，未做 Apple 公证，首次启动需要用户在“隐私与安全性”中允许。

## iOS

iOS 由 macOS Runner 执行 Expo Prebuild、CocoaPods 和 `xcodebuild`，再打包为 `Payload/*.app` 的 IPA。仓库没有 Apple Developer 证书时，产物是未签名 IPA，不能直接安装；用户需要用 Xcode、Sideloadly 或 AltStore 按自己的 Apple ID 重新签名。需要 App Store 或 TestFlight 版本时，必须另行配置 Apple 证书与 Provisioning Profile。
