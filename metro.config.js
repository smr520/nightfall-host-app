const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);

// Opt-in browser-only UI inspection. Neither adapter is used in Android builds.
if (process.env.NIGHTFALL_UI_PREVIEW === '1') {
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (platform === 'web' && moduleName === 'expo-sqlite/kv-store') {
      return { filePath: path.join(__dirname, 'scripts/preview/kv-store.ts'), type: 'sourceFile' };
    }
    if (platform === 'web' && moduleName === 'expo-screen-capture') {
      return { filePath: path.join(__dirname, 'scripts/preview/screen-capture.ts'), type: 'sourceFile' };
    }
    return context.resolveRequest(context, moduleName, platform);
  };
}
module.exports = config;
