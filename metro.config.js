const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);

if (!config.resolver.assetExts.includes('wasm')) {
  config.resolver.assetExts.push('wasm');
}

const enhanceMiddleware = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, metroServer) => {
  const enhancedMiddleware = enhanceMiddleware
    ? enhanceMiddleware(middleware, metroServer)
    : middleware;
  return (request, response, next) => {
    response.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    return enhancedMiddleware(request, response, next);
  };
};

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
