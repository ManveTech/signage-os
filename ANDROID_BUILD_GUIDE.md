# Android Build & Deployment Guide

## Prerequisites

1. **Android Studio** installed with:
   - Android SDK Platform 33 (or higher)
   - Android SDK Build-Tools
   - Android SDK Platform-Tools
   - Android Emulator (optional, for testing)

2. **Java JDK 17** or higher

3. **Node.js** and **npm** installed

4. **Environment Setup**:
   ```bash
   # Add to ~/.bashrc or ~/.zshrc
   export ANDROID_HOME=$HOME/Android/Sdk
   export PATH=$PATH:$ANDROID_HOME/emulator
   export PATH=$PATH:$ANDROID_HOME/platform-tools
   export PATH=$PATH:$ANDROID_HOME/tools
   export PATH=$PATH:$ANDROID_HOME/tools/bin
   ```

---

## Build Commands

### 1. Install Dependencies
```bash
npm install
```

### 2. Build Frontend
```bash
npm run build
```

### 3. Sync Capacitor
```bash
npm run android:sync
```

### 4. Build Debug APK
```bash
npm run android:build
```
Output: `android/app/build/outputs/apk/debug/app-debug.apk`

### 5. Build Release APK (Unsigned)
```bash
npm run android:release
```
Output: `android/app/build/outputs/apk/release/app-release-unsigned.apk`

### 6. Install on Connected Device
```bash
npm run android:install
```

### 7. Open in Android Studio
```bash
npm run android:open
```

---

## Release Build (Production)

### Step 1: Generate Keystore (First Time Only)
```bash
keytool -genkey -v -keystore signageos-release.keystore -alias signageos -keyalg RSA -keysize 2048 -validity 10000
```

**Important**: Store this keystore safely! You cannot update your app without it.

### Step 2: Create Keystore Properties
Create `android/keystore.properties`:

```properties
storeFile=/path/to/signageos-release.keystore
storePassword=YOUR_KEYSTORE_PASSWORD
keyAlias=signageos
keyPassword=YOUR_KEY_PASSWORD
```

**Important**: Add `keystore.properties` to `.gitignore`!

### Step 3: Update build.gradle
Edit `android/app/build.gradle` and add before `android {`:

```gradle
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
```

Inside `android { ... }`, add:

```gradle
signingConfigs {
    release {
        if (keystorePropertiesFile.exists()) {
            storeFile file(keystoreProperties['storeFile'])
            storePassword keystoreProperties['storePassword']
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
        }
    }
}

buildTypes {
    release {
        minifyEnabled true
        proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        signingConfig signingConfigs.release
    }
}
```

### Step 4: Build Signed Release APK
```bash
npm run android:release
```

Output: `android/app/build/outputs/apk/release/app-release.apk` (signed)

---

## Testing

### Run on Emulator
```bash
npm run android:run
```

### Run on Physical Device
1. Enable Developer Options on device
2. Enable USB Debugging
3. Connect via USB
4. Run: `npm run android:install`

### Check Connected Devices
```bash
adb devices
```

---

## App Configuration

### Update App Name
Edit `android/app/src/main/res/values/strings.xml`:
```xml
<string name="app_name">SignageOS</string>
```

### Update App ID
Edit `android/app/build.gradle`:
```gradle
defaultConfig {
    applicationId "com.signageOS.app"
    ...
}
```

Also update in `capacitor.config.ts`:
```typescript
appId: 'com.signageOS.app',
```

### Update Version
Edit `android/app/build.gradle`:
```gradle
defaultConfig {
    versionCode 1
    versionName "1.0.0"
    ...
}
```

---

## Common Issues & Solutions

### Issue 1: Gradle Build Failed
```bash
cd android
./gradlew clean
cd ..
npm run android:sync
npm run android:build
```

### Issue 2: SDK Not Found
Ensure `ANDROID_HOME` is set correctly:
```bash
echo $ANDROID_HOME
# Should output: /home/username/Android/Sdk
```

### Issue 3: Permission Denied on gradlew
```bash
chmod +x android/gradlew
```

### Issue 4: Device Not Detected
```bash
adb kill-server
adb start-server
adb devices
```

### Issue 5: App Crashes on Launch
Check logs:
```bash
adb logcat | grep -i "SignageOS"
```

### Issue 6: White Screen on Launch
- Ensure frontend build is recent: `npm run build`
- Sync Capacitor: `npm run android:sync`
- Clear app data on device and reinstall

---

## ProGuard Configuration

Edit `android/app/proguard-rules.pro`:

```proguard
# Keep Capacitor classes
-keep class com.getcapacitor.** { *; }

# Keep WebView JavaScript interface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep JSON serialization
-keepattributes *Annotation*
-keep class com.google.gson.** { *; }

# Keep model classes (if using)
-keep class com.signageOS.app.models.** { *; }
```

---

## App Signing for Google Play

### Generate Upload Key (One Time)
```bash
keytool -genkey -v -keystore upload-key.keystore -alias upload -keyalg RSA -keysize 2048 -validity 10000
```

### Sign APK
```bash
jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 -keystore upload-key.keystore android/app/build/outputs/apk/release/app-release-unsigned.apk upload
```

### Verify Signature
```bash
jarsigner -verify -verbose -certs android/app/build/outputs/apk/release/app-release-unsigned.apk
```

---

## App Bundle (AAB) for Play Store

Build an Android App Bundle instead of APK:

```bash
cd android
./gradlew bundleRelease
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

Upload this `.aab` file to Google Play Console.

---

## Performance Optimization

### Enable R8 Code Shrinking
Already enabled in release builds via `minifyEnabled true`

### Reduce APK Size
1. Enable ProGuard rules
2. Remove unused resources:
   ```gradle
   android {
       buildTypes {
           release {
               shrinkResources true
               minifyEnabled true
           }
       }
   }
   ```

3. Use WebP images instead of PNG
4. Enable code splitting in Vite config

---

## Debugging

### Chrome DevTools for WebView
1. Build debug APK
2. Connect device via USB
3. Open Chrome: `chrome://inspect`
4. Select your device/app
5. Click "Inspect"

### View Logs
```bash
# All logs
adb logcat

# Filter by app
adb logcat | grep "SignageOS"

# Save to file
adb logcat > android-logs.txt
```

---

## Continuous Integration (CI/CD)

### GitHub Actions Example

Create `.github/workflows/android-build.yml`:

```yaml
name: Android Build

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Setup Java JDK
        uses: actions/setup-java@v3
        with:
          distribution: 'temurin'
          java-version: '17'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build frontend
        run: npm run build
        
      - name: Sync Capacitor
        run: npm run android:sync
        
      - name: Build Android APK
        run: cd android && ./gradlew assembleDebug
        
      - name: Upload APK
        uses: actions/upload-artifact@v3
        with:
          name: app-debug
          path: android/app/build/outputs/apk/debug/app-debug.apk
```

---

## Next Steps

1. ✅ Generate keystore for release signing
2. ✅ Test on physical Android device
3. ✅ Configure ProGuard rules
4. ✅ Test offline functionality
5. ✅ Optimize app size
6. ✅ Submit to Google Play Store

---

**Last Updated**: August 3, 2026
