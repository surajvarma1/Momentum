/**
 * Shim for ExpoTopicSubscriptionModule to prevent crashes in Expo Go on Android
 * where ExpoTopicSubscriptionModule is not included in the pre-built Expo Go client.
 */
import { requireOptionalNativeModule } from 'expo';

let nativeModule = null;
try {
  if (typeof requireOptionalNativeModule === 'function') {
    nativeModule = requireOptionalNativeModule('ExpoTopicSubscriptionModule');
  }
} catch {
  // Graceful fallback for Expo Go
}

export default nativeModule || {
  addListener: () => ({ remove: () => {} }),
  removeListeners: () => {},
  subscribeToTopic: async () => {},
  unsubscribeFromTopic: async () => {},
};
