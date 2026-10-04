package com.example

import android.content.Intent
import android.content.pm.ActivityInfo
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import androidx.compose.runtime.collectAsState
import com.example.call.CallState
import com.example.ui.SignageViewModel
import com.example.ui.components.*
import com.example.ui.theme.MyApplicationTheme
import com.example.util.CrashReportingHandler
import com.example.watchdog.AppHeartbeat
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.io.File

class MainActivity : ComponentActivity() {
    private val requestCallPermissions = registerForActivityResult(
        androidx.activity.result.contract.ActivityResultContracts.RequestMultiplePermissions()
    ) { /* Denied permissions simply mean this side sends no local media — call still connects. */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler(CrashReportingHandler(applicationContext, defaultHandler))

        // Runs before any breadcrumb from *this* process start overwrites the
        // previous one — if last run died mid-call-setup with no JVM exception
        // (native crash, OOM kill), this is the only trace of it we get.
        com.example.util.Breadcrumbs.lastAbnormalExit(applicationContext)?.let { (stage, ageMs) ->
            CrashReportingHandler.report(
                applicationContext,
                "Abnormal Restart Detected",
                "Previous run died without a clean exit. Last known stage: $stage, ${ageMs}ms before this restart."
            )
        }

        // Dismiss native system splash immediately so Compose AppSplashScreen takes over
        installSplashScreen().setKeepOnScreenCondition { false }
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // "Display over other apps" exempts us from Android's background-activity-start
        // restriction, which is what lets the idle/crash watchdog actually bring this
        // activity back to front when it fires from a killed process. Only asked once
        // per process start — the user grants it manually in system settings.
        if (!overlayPermissionPrompted && !Settings.canDrawOverlays(this)) {
            overlayPermissionPrompted = true
            startActivity(
                Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName"))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            )
        }

        AppHeartbeat.touch(this)
        AppHeartbeat.scheduleNextCheck(this)
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.RESUMED) {
                while (true) {
                    AppHeartbeat.touch(this@MainActivity)
                    delay(20_000)
                }
            }
        }

        setContent {
            MyApplicationTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = Color(0xFF1C1B1F)
                ) {
                    SignagePlayerApp(onRequestCallPermissions = { requestCallPermissions.launch(it) })
                }
            }
        }
    }

    companion object {
        private var overlayPermissionPrompted = false
    }
}

@Composable
fun SignagePlayerApp(
    viewModel: SignageViewModel = viewModel(),
    onRequestCallPermissions: (Array<String>) -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val callState by viewModel.videoCallManager.callState.collectAsState()
    val activity = LocalContext.current as? ComponentActivity

    // Only ask for camera/mic once this screen is actually licensed for video
    // conferencing — never prompts on ordinary signage-only screens.
    LaunchedEffect(uiState.cameraMountEnabled) {
        if (uiState.cameraMountEnabled) {
            onRequestCallPermissions(arrayOf(android.Manifest.permission.CAMERA, android.Manifest.permission.RECORD_AUDIO))
        }
    }

    // Something is playable (the full playlist, the previous one while a new
    // one downloads, or the files that did arrive). Only when nothing at all
    // is playable does the full-screen download progress take over.
    val hasPlayableContent = uiState.playbackPlaylist.isNotEmpty()

    LaunchedEffect(uiState.status, uiState.playlist, uiState.playlistOrientation) {
        val isPlaying = com.example.ui.isPlayingStatus(uiState.status) && uiState.playlist.isNotEmpty()
        
        try {
            activity?.requestedOrientation = if (isPlaying) {
                if (uiState.playlistOrientation == "vertical") {
                    ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
                } else {
                    ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
                }
            } else {
                ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
            }
        } catch (e: Exception) {
            android.util.Log.e("SignagePlayerApp", "Device orientation change not supported on this hardware", e)
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        if (callState !is CallState.Idle) {
            // A licensed screen was called — swap fully into the meeting view.
            // The signage state machine underneath keeps ticking untouched and
            // resumes automatically the instant the call ends and callState
            // returns to Idle.
            VideoCallScreen(callManager = viewModel.videoCallManager)
        } else if (!uiState.showSplash) {
            when {
                uiState.status == "suspended" -> {
                    Box(modifier = Modifier.fillMaxSize()) {
                        SuspendedScreen(
                            onOpenAdmin = {}
                        )
                    }
                }
                // Any paired status plays — not just active/online/offline.
                // "warning" (or any status added later) used to fall through to
                // the pairing screen on a TV that was already set up.
                com.example.ui.isPlayingStatus(uiState.status) -> {
                    // Portrait playlist on a display that is still landscape
                    // (the TV ignored requestedOrientation): rotate everything
                    // ourselves. If the OS did switch to portrait, the window
                    // is already taller than wide and nothing is rotated.
                    val configuration = androidx.compose.ui.platform.LocalConfiguration.current
                    val rotateForPortrait = uiState.playlistOrientation == "vertical" &&
                        configuration.screenWidthDp > configuration.screenHeightDp
                    Box(modifier = Modifier.fillMaxSize()) {
                        Box(modifier = Modifier.fillMaxSize().then(if (rotateForPortrait) Modifier.rotatedToPortrait() else Modifier)) {
                            if (uiState.paused) {
                                PausedScreen(uiState = uiState)
                            } else if (uiState.playlist.isEmpty()) {
                                StandbyScreen(
                                    uiState = uiState,
                                    onOpenAdmin = {}
                                )
                            } else if (!hasPlayableContent) {
                                DownloadProgressScreen(
                                    uiState = uiState,
                                    onTriggerDownloads = { viewModel.triggerPendingDownloads() },
                                    onOpenAdmin = {}
                                )
                            } else {
                                val playlistKey = uiState.playbackPlaylist.joinToString(",") { "${it.id}_${it.duration}_${it.localPath}" }
                                key(playlistKey) {
                                    PlaybackLoopScreen(
                                        playlist = uiState.playbackPlaylist,
                                        currentIndex = uiState.currentAssetIndex,
                                        orientation = uiState.playlistOrientation,
                                        playlistLoop = uiState.playlistLoop,
                                        transitionName = uiState.playlistTransition,
                                        onOpenAdmin = {},
                                        onVideoCompleted = { viewModel.advanceToNextAsset() },
                                        // Playlist volume × the screen's own volume (set in the dashboard).
                                        volumePercent = uiState.playlistVolume * uiState.screenVolume.coerceIn(0, 100) / 100
                                    )
                                }

                                val widgetType = uiState.widgetType
                                val widgetLink = uiState.widgetLink ?: ""
                                if (!widgetType.isNullOrEmpty()) {
                                    val activeWidgets = widgetType.split(",").map { it.trim().lowercase() }.filter { it.isNotEmpty() }
                                    
                                    var rssText = ""
                                    var qrLink = ""
                                    var weatherLoc = ""
                                    var clockText = ""

                                    if (widgetLink.startsWith("{") && widgetLink.endsWith("}")) {
                                        try {
                                            val json = org.json.JSONObject(widgetLink)
                                            rssText = json.optString("rss", "")
                                            qrLink = json.optString("qrcode", "")
                                            weatherLoc = json.optString("weather", "")
                                            clockText = json.optString("clock", "")
                                        } catch (e: Exception) {
                                            android.util.Log.e("MainActivity", "Failed to parse widgetLink JSON", e)
                                        }
                                    } else {
                                        when {
                                            activeWidgets.contains("rss") -> rssText = widgetLink
                                            activeWidgets.contains("qrcode") -> qrLink = widgetLink
                                            activeWidgets.contains("weather") -> weatherLoc = widgetLink
                                            activeWidgets.contains("clock") -> clockText = widgetLink
                                        }
                                    }

                                    if (activeWidgets.contains("rss")) {
                                        Box(
                                            modifier = Modifier.fillMaxSize(),
                                            contentAlignment = Alignment.BottomCenter
                                        ) {
                                            RssTickerWidget(tickerText = rssText)
                                        }
                                    }

                                    val hasFloatWidget = activeWidgets.any { it == "qrcode" || it == "weather" || it == "clock" }
                                    if (hasFloatWidget) {
                                        val alignment = when (uiState.widgetPlacement) {
                                            "top-left" -> Alignment.TopStart
                                            "top-right" -> Alignment.TopEnd
                                            "bottom-left" -> Alignment.BottomStart
                                            "bottom-right" -> Alignment.BottomEnd
                                            else -> Alignment.TopEnd
                                        }
                                        val extraBottomPadding = if (activeWidgets.contains("rss") && uiState.widgetPlacement?.startsWith("bottom") == true) 56.dp else 24.dp
                                        
                                        Box(
                                            modifier = Modifier
                                                .fillMaxSize()
                                                .padding(
                                                    start = 24.dp,
                                                    top = 24.dp,
                                                    end = 24.dp,
                                                    bottom = extraBottomPadding
                                                ),
                                            contentAlignment = alignment
                                        ) {
                                            val floatWidgetType = activeWidgets.firstOrNull { it == "qrcode" || it == "weather" || it == "clock" }
                                            if (floatWidgetType == "qrcode") {
                                                val encodedLink = try {
                                                    java.net.URLEncoder.encode(qrLink, "UTF-8")
                                                } catch (e: Exception) {
                                                    qrLink
                                                }
                                                AsyncImage(
                                                    model = "https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=$encodedLink",
                                                    contentDescription = "Scan QR Code Widget Overlay",
                                                    modifier = Modifier.size(120.dp),
                                                    contentScale = ContentScale.Fit
                                                )
                                            } else if (floatWidgetType == "clock") {
                                                ClockWidget(header = clockText.ifEmpty { "Lobby Clock" })
                                            } else if (floatWidgetType != null) {
                                                Card(
                                                    colors = CardDefaults.cardColors(
                                                        containerColor = Color(0xCC111827)
                                                    ),
                                                    shape = RoundedCornerShape(16.dp),
                                                    modifier = Modifier
                                                        .width(200.dp)
                                                        .padding(14.dp)
                                                ) {
                                                    when (floatWidgetType) {
                                                        "weather" -> {
                                                            WeatherWidget(location = weatherLoc.ifEmpty { "Bengaluru" })
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                else -> {
                    PairingSetupScreen(
                        uiState = uiState,
                        onRefreshCode = { viewModel.requestPairingCode() },
                        onOpenAdmin = {}
                    )
                }
            }
        }

        // Splash sits on top and fades out (250ms, same as the phone app's
        // BootScreen) over the real content instead of cutting to it.
        androidx.compose.animation.AnimatedVisibility(
            visible = uiState.showSplash && callState is CallState.Idle,
            enter = androidx.compose.animation.EnterTransition.None,
            exit = androidx.compose.animation.fadeOut(androidx.compose.animation.core.tween(250))
        ) {
            AppSplashScreen(uiState = uiState, onLogoStarted = { viewModel.onSplashLogoStarted() })
        }

        // New content downloading while the current playlist keeps playing.
        // This is a customer-facing display, so it's a small, quiet pill in the
        // corner — it used to be a large "Downloading Media..." card over the
        // content (shown even for a background re-download after Sync).
        if (uiState.isDownloading && hasPlayableContent && !uiState.paused && callState is CallState.Idle && !uiState.showSplash) {
            UpdatingContentPill(
                progress = uiState.downloadProgressFraction,
                modifier = Modifier
                    .fillMaxSize()
                    .padding(20.dp)
            )
        }
    }
}

/**
 * Lays the content out in portrait (width and height swapped) and turns it
 * 90° so it fills a landscape display mounted on its side. Matches Android's
 * own default portrait rotation on landscape-native devices (ROTATION_270:
 * the TV is turned 90° clockwise, so content is drawn turned 90° counter-
 * clockwise to appear upright).
 */
internal fun Modifier.rotatedToPortrait(): Modifier = this.layout { measurable, constraints ->
    val width = constraints.maxWidth
    val height = constraints.maxHeight
    val placeable = measurable.measure(androidx.compose.ui.unit.Constraints.fixed(height, width))
    layout(width, height) {
        placeable.placeWithLayer(x = (width - height) / 2, y = (height - width) / 2) {
            rotationZ = -90f
        }
    }
}
