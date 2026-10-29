const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// 1. Allow Metro to bundle .wasm files as assets (required by expo-sqlite on web)
config.resolver.assetExts.push('wasm');

// 2. Ensure package exports are enabled for modern expo-sqlite resolution
config.resolver.unstable_enablePackageExports = true;

// 3. Route /worker to the expo-sqlite web worker bundle for web support
const originalEnhanceMiddleware = config.server?.enhanceMiddleware;
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware, server) => {
    const customMiddleware = (req, res, next) => {
      // Enable COOP and COEP headers for WebAssembly & SharedArrayBuffer in expo-sqlite web worker
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');

      const url = req.url || '';
      if (
        url === '/worker' ||
        url.startsWith('/worker?') ||
        url === '/worker.js' ||
        url.startsWith('/worker.js?')
      ) {
        req.url = '/node_modules/expo-sqlite/web/worker.bundle?platform=web&dev=true&hot=false';
      }
      return middleware(req, res, next);
    };
    return originalEnhanceMiddleware
      ? originalEnhanceMiddleware(customMiddleware, server)
      : customMiddleware;
  },
};

// 4. Fallback resolution for ExpoTopicSubscriptionModule in Expo Go Android
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName.includes('TopicSubscriptionModule.android') ||
    moduleName.endsWith('TopicSubscriptionModule.android.js') ||
    (moduleName.endsWith('TopicSubscriptionModule') && platform === 'android')
  ) {
    return {
      filePath: path.resolve(__dirname, 'src/shims/TopicSubscriptionModule.js'),
      type: 'sourceFile',
    };
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
