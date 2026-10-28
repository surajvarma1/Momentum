const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(
  __dirname,
  '../node_modules/expo-notifications/build/TopicSubscriptionModule.android.js'
);

if (fs.existsSync(targetFile)) {
  const content = fs.readFileSync(targetFile, 'utf8');
  if (content.includes("requireNativeModule('ExpoTopicSubscriptionModule')")) {
    const patched = `import { requireOptionalNativeModule } from 'expo';
let mod = null;
try {
  mod = typeof requireOptionalNativeModule === 'function' ? requireOptionalNativeModule('ExpoTopicSubscriptionModule') : null;
} catch (e) {
  // Graceful fallback for Expo Go where ExpoTopicSubscriptionModule is absent
}
export default mod || {
  addListener: () => ({ remove: () => {} }),
  removeListeners: () => {},
  subscribeToTopic: async () => {},
  unsubscribeFromTopic: async () => {},
};
//# sourceMappingURL=TopicSubscriptionModule.android.js.map
`;
    fs.writeFileSync(targetFile, patched, 'utf8');
    console.log('[Momentum Patch] Successfully patched TopicSubscriptionModule.android.js for Expo Go');
  }
}
