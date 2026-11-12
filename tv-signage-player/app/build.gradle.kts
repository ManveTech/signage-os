plugins {
  alias(libs.plugins.android.application)
  alias(libs.plugins.kotlin.compose)
  alias(libs.plugins.google.devtools.ksp)
  alias(libs.plugins.roborazzi)
  alias(libs.plugins.secrets)
}

/**
 * A value from tv-signage-player/.env, falling back to the environment and
 * then to [fallback]. Keeps .env as the one place to configure a build, the
 * same convention the secrets plugin uses for GEMINI_API_KEY.
 */
fun envOrDefault(key: String, fallback: String): String {
  val fromEnvFile = rootProject.file(".env")
    .takeIf { it.exists() }
    ?.readLines()
    ?.firstOrNull { it.trimStart().startsWith("$key=") }
    ?.substringAfter('=')
    ?.trim()
    ?.trim('"')
  return fromEnvFile?.takeIf { it.isNotEmpty() }
    ?: System.getenv(key)?.takeIf { it.isNotEmpty() }
    ?: fallback
}

android {
  namespace = "com.example"
  compileSdk { version = release(36) { minorApiLevel = 1 } }

  defaultConfig {
    applicationId = "com.aistudio.tvsignageplayer.fkvsqm"
    minSdk = 24
    targetSdk = 36
    versionCode = 13
    versionName = "1.12"

    testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

    // Crash reporting, read from .env (or the environment, which is how CI
    // would set it). Empty is the default and means off: an empty DSN
    // disables the Sentry SDK completely.
    //
    // Deliberately not routed through the secrets plugin like GEMINI_API_KEY:
    // that generates a BuildConfig field, and an empty value generates one
    // that doesn't compile. These only ever need to reach the manifest.
    manifestPlaceholders["SENTRY_DSN"] = envOrDefault("SENTRY_DSN", "")
    manifestPlaceholders["SENTRY_ENVIRONMENT"] = envOrDefault("SENTRY_ENVIRONMENT", "production")

    // ARM only. The WebRTC and media native libraries were being shipped for
    // four architectures — 41 MB of a 64 MB APK was native code, and 24 MB of
    // that was x86/x86_64, which no Android TV box, stick or commercial
    // display can execute.
    //
    // This matters beyond download size: installing extracts the native libs
    // and AOT-compiles the app, so every megabyte is also work the TV has to
    // do and space it has to find while installing — and an install that
    // never finishes is the symptom we are chasing.
    //
    // x86_64 is only needed by the Android emulator (see isEmulator() in
    // SignageRepository, which redirects localhost to 10.0.2.2 for a local
    // dev server). Build for one with:
    //
    //     ./gradlew assembleDebug -PwithEmulatorAbis
    //
    // Never ship that APK to a TV — it is 20 MB of dead weight there.
    ndk {
      abiFilters += if (project.hasProperty("withEmulatorAbis")) {
        listOf("arm64-v8a", "armeabi-v7a", "x86_64")
      } else {
        listOf("arm64-v8a", "armeabi-v7a")
      }
    }
  }

  signingConfigs {
    create("release") {
      val keystorePath = System.getenv("KEYSTORE_PATH") ?: "${rootDir}/my-upload-key.jks"
      storeFile = file(keystorePath)
      storePassword = System.getenv("STORE_PASSWORD")
      keyAlias = "upload"
      keyPassword = System.getenv("KEY_PASSWORD")
    }
    create("debugConfig") {
      storeFile = file("${rootDir}/debug.keystore")
      storePassword = "android"
      keyAlias = "androiddebugkey"
      keyPassword = "android"
    }
  }

  buildTypes {
    release {
      isCrunchPngs = false
      isMinifyEnabled = false
      proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
      signingConfig = signingConfigs.getByName("release")
    }
    debug {
    }
  }
  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_11
    targetCompatibility = JavaVersion.VERSION_11
  }
  buildFeatures {
    compose = true
    buildConfig = true
  }
  testOptions { unitTests { isIncludeAndroidResources = true } }
}

// Configure the Secrets Gradle Plugin to use .env and .env.example files
// to match the convention used in Web projects.
secrets {
  propertiesFileName = ".env"
  defaultPropertiesFileName = ".env.example"
}

// Some unused dependencies are commented out below instead of being removed.
// This makes it easy to add them back in the future if needed.
dependencies {
  implementation(platform(libs.androidx.compose.bom))
  implementation(platform(libs.firebase.bom))
  // implementation(libs.accompanist.permissions)
  implementation(libs.androidx.activity.compose)
  // implementation(libs.androidx.camera.camera2)
  // implementation(libs.androidx.camera.core)
  // implementation(libs.androidx.camera.lifecycle)
  // implementation(libs.androidx.camera.view)
  implementation(libs.androidx.compose.material.icons.core)
  implementation(libs.androidx.compose.material.icons.extended)
  implementation(libs.androidx.compose.material3)
  implementation(libs.androidx.compose.ui)
  implementation(libs.androidx.compose.ui.graphics)
  implementation(libs.androidx.compose.ui.tooling.preview)
  implementation(libs.androidx.core.ktx)
  implementation(libs.androidx.core.splashscreen)
  // implementation(libs.androidx.datastore.preferences)
  implementation(libs.androidx.lifecycle.runtime.compose)
  implementation(libs.androidx.lifecycle.runtime.ktx)
  implementation(libs.androidx.lifecycle.viewmodel.compose)
  // implementation(libs.androidx.navigation.compose)
  implementation(libs.androidx.room.ktx)
  implementation(libs.androidx.room.runtime)
  implementation(libs.androidx.media3.exoplayer)
  implementation(libs.androidx.media3.ui)
  implementation(libs.android.youtube.player)
  implementation(libs.coil.compose)
  implementation(libs.converter.moshi)
  // implementation(libs.firebase.ai)
  implementation(libs.kotlinx.coroutines.android)
  implementation(libs.kotlinx.coroutines.core)
  implementation(libs.logging.interceptor)
  implementation(libs.moshi.kotlin)
  implementation(libs.okhttp)
  // implementation(libs.play.services.location)
  implementation(libs.retrofit)
  implementation(libs.sentry.android)
  implementation(libs.socket.io.client) {
    exclude(group = "org.json", module = "json")
  }
  implementation(libs.stream.webrtc.android)
  implementation(libs.zxing.core)
  testImplementation(libs.androidx.compose.ui.test.junit4)
  testImplementation(libs.androidx.core)
  testImplementation(libs.androidx.junit)
  testImplementation(libs.junit)
  testImplementation(libs.kotlinx.coroutines.test)
  testImplementation(libs.robolectric)
  testImplementation(libs.roborazzi)
  testImplementation(libs.roborazzi.compose)
  testImplementation(libs.roborazzi.junit.rule)
  androidTestImplementation(platform(libs.androidx.compose.bom))
  androidTestImplementation(libs.androidx.compose.ui.test.junit4)
  androidTestImplementation(libs.androidx.espresso.core)
  androidTestImplementation(libs.androidx.junit)
  androidTestImplementation(libs.androidx.runner)
  debugImplementation(libs.androidx.compose.ui.test.manifest)
  debugImplementation(libs.androidx.compose.ui.tooling)
  "ksp"(libs.androidx.room.compiler)
  "ksp"(libs.moshi.kotlin.codegen)
}
