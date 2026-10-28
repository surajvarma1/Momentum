const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// 1. Allow Metro to bundle .wasm files as assets (required by expo-sqlite on web)
config.resolver.assetExts.push('wasm');

// 2. Ensure package exports are enabled for modern expo-sqlite resolution
config.resolver.unstable_enablePackageExports = true;

// 3. Fallback resolution for ExpoTopicSubscriptionModule in Expo Go Android
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
