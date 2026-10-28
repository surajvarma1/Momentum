# Momentum — Store Readiness & Release Preparation

**App Identifier:** `com.momentum.todo`  
**Version:** `1.0.0` (Build 1)  
**Target SDKs:** Android 15 (API 35), iOS 18  
**Architecture:** Offline-First SQLite, Expo SDK 58, React 19  

---

## 1. Google Play Store Readiness (Android)

### 1.1 Permission Audit
In `app.json`, only strictly necessary permissions are requested:
- `POST_NOTIFICATIONS`: Android 13+ runtime permission for task reminders and focus interval notifications. An in-app explanation modal precedes the system permission prompt.
- `SCHEDULE_EXACT_ALARM`: Configured for precise local task reminders.
- `RECEIVE_BOOT_COMPLETED`: For rescheduling active reminders after device reboot.
- `INTERNET`: For Supabase authentication, cloud sync, and Bytez AI decomposition.

No sensitive permissions (location, camera, microphone, external storage) are requested, eliminating Google Play privacy review friction.

### 1.2 Status Bar & Display Insets
All modal and stack screens incorporate `ScreenHeader` with `useSafeAreaInsets` (`paddingTop: insets.top`), ensuring titles and back navigation clear camera punch-holes, teardrop notches, and dynamic system bars on Android 12+.

### 1.3 Android App Bundle (AAB) Generation
Verified build configuration:
```bash
# Build production Android App Bundle via EAS
npx eas build --platform android --profile production
```

---

## 2. Apple App Store Readiness (iOS)

### 2.1 Privacy Manifest & Data Practices
- **No Third-Party Ad Trackers**: Momentum does not bundle tracking SDKs or share identifier data with data brokers.
- **Keychain Storage**: Authentication sessions and refresh tokens utilize iOS Keychain with `kSecAttrAccessibleAfterFirstUnlock`.
- **Local Storage Disclosure**: User tasks remain on-device in local SQLite by default. Cloud sync requires intentional opt-in and authentication.

### 2.2 Human Interface Guidelines (HIG) Compliance
- 44x44pt touch targets enforced across all interactive controls.
- Dynamic color theming supporting system dark and light modes.
- Strikethrough animations with 400ms micro-delays for haptic task completion feedback.

---

## 3. Web & Cross-Platform Integrity

### 3.1 OPFS Web Lock Prevention
Web builds utilize a singleton mutex (`DatabaseProvider.ts`) preventing `createSyncAccessHandle` locking issues on Chromium-based browsers during Fast Refresh or multi-tab usage.

### 3.2 Offline-First Resilience
If the device loses connectivity or backend services become unreachable:
- Full CRUD task operations continue uninterrupted via local SQLite.
- AI Goal Decomposer seamlessly routes to the deterministic local planner.
- Sync outbox queues mutations for transparent background synchronization when connection restores.

---

## 4. Pre-Submission Verification Summary

| Check | Tool / Standard | Result | Evidence |
|---|---|---|---|
| **TypeScript Typecheck** | `tsc --noEmit` | **0 Errors** | `npm run typecheck` exited code 0 |
| **Automated Unit & Domain Tests** | Jest (13 suites, 146 tests) | **146 Passed** | `npm test` exited code 0 |
| **Expo Environment Health** | `expo-doctor` | **20/20 Passed** | No issues detected |
| **Security Audit** | Code-level audit report | **Passed** | Zero client-side API keys |
| **Safe Area Compliance** | `ScreenHeader.tsx` insets | **Verified** | Notch & status bar cleared |
