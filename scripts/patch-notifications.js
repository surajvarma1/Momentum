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

// 2. Patch AccessHandlePoolVFS to prevent OPFS createSyncAccessHandle deadlock on web
const vfsFile = path.resolve(
  __dirname,
  '../node_modules/expo-sqlite/web/wa-sqlite/AccessHandlePoolVFS.js'
);
if (fs.existsSync(vfsFile)) {
  let vfsContent = fs.readFileSync(vfsFile, 'utf8');
  if (!vfsContent.includes('OPFS access handle lock timeout')) {
    vfsContent = vfsContent.replace(
      'const accessHandle = await handle.createSyncAccessHandle();',
      `const accessHandle = await Promise.race([
          handle.createSyncAccessHandle(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('OPFS access handle lock timeout')), 1200),
          ),
        ]);`
    );
    fs.writeFileSync(vfsFile, vfsContent, 'utf8');
    console.log('[Momentum Patch] Successfully patched AccessHandlePoolVFS.js for web');
  }
}

// 3. Patch expo-sqlite worker.ts to fall back to MemoryVFS when OPFS is unavailable or locked
const workerFile = path.resolve(
  __dirname,
  '../node_modules/expo-sqlite/web/worker.ts'
);
if (fs.existsSync(workerFile)) {
  let workerContent = fs.readFileSync(workerFile, 'utf8');
  if (!workerContent.includes('AccessHandlePoolVFS OPFS unavailable or locked')) {
    workerContent = workerContent.replace(
      `    if (_vfs == null) {
      _vfs = await AccessHandlePoolVFS.create(VFS_NAME_PERSISTENT, module);
      if (_vfs == null) {
        throw new Error('Failed to initialize AccessHandlePoolVFS');
      }
    }`,
      `    if (_vfs == null) {
      try {
        _vfs = await AccessHandlePoolVFS.create(VFS_NAME_PERSISTENT, module);
        if (_vfs) {
          _sqlite3.vfs_register(_vfs, true);
        }
      } catch (opfsErr) {
        console.warn('AccessHandlePoolVFS OPFS unavailable or locked, falling back to MemoryVFS:', opfsErr);
        _vfs = null;
      }
    }`
    );
    fs.writeFileSync(workerFile, workerContent, 'utf8');
    console.log('[Momentum Patch] Successfully patched expo-sqlite worker.ts for web');
  }
}
