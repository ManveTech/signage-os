package com.example

import android.content.pm.ActivityInfo
import android.os.Bundle
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import com.example.ui.SignageViewModel
import com.example.ui.components.*
import com.example.ui.theme.MyApplicationTheme
import com.example.util.CrashReportingHandler
import java.io.File

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler(CrashReportingHandler(applicationContext, defaultHandler))

        // Dismiss native system splash immediately so Compose AppSplashScreen takes over
        installSplashScreen().setKeepOnScreenCondition { false }
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            MyApplicationTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = Color(0xFF1C1B1F)
                ) {
                    SignagePlayerApp()
                }
            }
        }
    }
}

@Composable
fun SignagePlayerApp(
    viewModel: SignageViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val activity = LocalContext.current as? ComponentActivity

    val allAssetsDownloaded = remember(uiState.playlist) {
        uiState.playlist.all { asset ->
            asset.mediaType.equals("youtube", ignoreCase = true) ||
            (!asset.localPath.isNullOrEmpty() && File(asset.localPath).exists())
        }
    }

    LaunchedEffect(uiState.status, uiState.playlist, uiState.playlistOrientation) {
        val isPlaying = (uiState.status == "active" || uiState.status == "online" || uiState.status == "offline") && uiState.playlist.isNotEmpty()
        
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
        if (uiState.showSplash) {
            AppSplashScreen(uiState = uiState)
        } else {
            when (uiState.status) {
                "active", "online", "offline" -> {
                    Box(modifier = Modifier.fillMaxSize()) {
                        Box(modifier = Modifier.fillMaxSize()) {
                            if (uiState.playlist.isEmpty()) {
                                StandbyScreen(
                                    uiState = uiState,
                                    onOpenAdmin = {}
                                )
                            } else if (!allAssetsDownloaded) {
                                DownloadProgressScreen(
                                    uiState = uiState,
                                    onTriggerDownloads = { viewModel.triggerPendingDownloads() },
                                    onOpenAdmin = {}
                                )
                            } else {
                                val playlistKey = uiState.playlist.joinToString(",") { "${it.id}_${it.duration}_${it.localPath}" }
                                key(playlistKey) {
                                    PlaybackLoopScreen(
                                        playlist = uiState.playlist,
                                        currentIndex = uiState.currentAssetIndex,
                                        orientation = uiState.playlistOrientation,
                                        playlistLoop = uiState.playlistLoop,
                                        transitionName = uiState.playlistTransition,
                                        onOpenAdmin = {},
                                        onVideoCompleted = { viewModel.advanceToNextAsset() },
                                        volumePercent = uiState.playlistVolume
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
                "suspended" -> {
                    Box(modifier = Modifier.fillMaxSize()) {
                        SuspendedScreen(
                            onOpenAdmin = {}
                        )
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

        if (uiState.isDownloading && allAssetsDownloaded) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(24.dp),
                contentAlignment = Alignment.BottomStart
            ) {
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = Color(0xDD1C1B1F)
                    ),
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier
                        .width(320.dp)
                        .border(1.dp, Color(0xFF49454F), RoundedCornerShape(16.dp))
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            CircularProgressIndicator(
                                progress = { uiState.downloadProgressFraction },
                                modifier = Modifier.size(28.dp),
                                color = Color(0xFFD0BCFF),
                                strokeWidth = 3.dp,
                                trackColor = Color(0xFF49454F)
                            )
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = "Downloading Media...",
                                    color = Color.White,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                Spacer(modifier = Modifier.height(2.dp))
                                Text(
                                    text = uiState.downloadProgressMessage,
                                    color = Color(0xFFCAC4D0),
                                    fontSize = 11.sp,
                                    maxLines = 1,
                                    overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
