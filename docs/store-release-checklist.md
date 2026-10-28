# Momentum — Google Play Release & Deployment Readiness Checklist

> **Target Release:** Momentum 3.0.0 (Release Candidate)  
> **Target Platform:** Android 16 (API Level 36)  
> **Status:** Release Candidate Ready (Verification Passed)

---

## 1. Google Play Requirements Compliance

| Requirement | Published Standard (August 31, 2026) | Momentum Status | Verification |
|---|---|---|---|
| **Target API Level** | Android 16 (API level 36) or higher | ✅ **API 36 Configured** | `app.json` has `targetSdkVersion: 36` and `compileSdkVersion: 36`. |
| **64-bit Architecture** | 64-bit native libraries included | ✅ Compliant | Built with React Native 0.88 / Expo SDK 58 64-bit architecture (`arm64-v8a`, `x86_64`). |
| **App Bundle Format** | Android App Bundle (`.aab`) required | ✅ AAB Pipeline Ready | `eas build --platform android` outputs optimized `.aab`. |
| **Permissions Policy** | Minimum required permissions only | ✅ Least Privilege | Only `POST_NOTIFICATIONS` requested. No exact alarms, camera, or SMS permissions. |
| **Data Safety & Privacy Policy** | Public privacy URL matching actual data collection | ✅ Disclosed | `docs/privacy-policy.md` documents Guest Mode vs Cloud Sync data flows. |
| **Account Deletion Link** | In-app deletion and web deletion pathway | ✅ Compliant | In-app deletion button and privacy contact documented. |

---

## 2. Release Signing & Credentials Configuration

> [!CAUTION]
> NEVER commit keystores, signing keys, or production service role keys to Git.

### Keystore Generation (Run once for release build)
```bash
keytool -genkey -v -keystore momentum-release-key.keystore \
  -alias momentum-key-alias -keyalg RSA -keysize 2048 -validity 10000
```

### EAS Credentials Configuration (`eas.json` template)
```json
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      },
      "env": {
        "EXPO_PUBLIC_SUPABASE_URL": "@SUPABASE_PROD_URL",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "@SUPABASE_PROD_ANON_KEY"
      }
    }
  }
}
```

---

## 3. Store Listing Assets Checklist

- [x] **App Title:** Momentum — Tasks, Focus & Goal Decomposer
- [x] **Short Description (max 80 chars):** Build momentum. Crush your goals with offline-first tasks and AI planning.
- [x] **Full Description:** Comprehensive overview of offline storage, focus timer, bounded reminders, and AI breakdown.
- [x] **App Icon:** 512 x 512 px 32-bit PNG with alpha (`assets/images/icon.png`).
- [x] **Feature Graphic:** 1024 x 500 px JPEG or 24-bit PNG.
- [x] **Screenshots:** Phone screenshots (16:9 / 18:9 aspect ratios, minimum 1080p).
  - Screen 1: Today Dashboard (Progress ring, priorities)
  - Screen 2: All Tasks & Tag Filters
  - Screen 3: Interactive Focus Arena Timer
  - Screen 4: AI Goal Decomposer Review Screen
  - Screen 5: Velocity & Real Streak Insights

---

## 4. Internal Testing & Rollout Strategy

1. **Internal Testing Track (Week 1):**
   - Deploy build to 10 internal testers on physical Android 14, 15, and 16 preview devices.
   - Test offline task creation $\rightarrow$ restart app $\rightarrow$ verify persistence.
   - Test airplane mode transitions during sync operations.
2. **Closed Beta Track (Week 2):**
   - 100 pre-release beta users.
   - Verify notification delivery across device quiet hours and battery saver (Doze) states.
3. **Phased Production Rollout (Week 3):**
   - Day 1: 5% rollout
   - Day 2: 15% rollout
   - Day 3: 50% rollout
   - Day 5: 100% rollout

---

## 5. Rollback and Incident Response

If a critical crash or regression is identified post-release:
1. **Immediate Halt:** In the Google Play Console, halt the phased rollout immediately.
2. **Targeted Hotfix:** Check out the release tag, patch the bug, increment `versionCode`, and create an expedited release build.
3. **Data Protection Guarantee:** Because local task data is persisted in SQLite with versioned migrations, rolling back or hotfixing the app does not alter existing offline tasks.
