package com.example

import android.app.Application
import android.content.pm.ActivityInfo
import android.net.Uri
import android.os.Bundle
import android.widget.ImageView
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateDp
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.blur
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import androidx.media3.common.Player
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.ui.AspectRatioFrameLayout
import coil.compose.AsyncImage
import com.example.data.database.PlaylistAsset
import com.example.ui.SignageUiState
import com.example.ui.SignageViewModel
import com.example.ui.theme.MyApplicationTheme
import java.io.File
import androidx.annotation.OptIn
import androidx.compose.ui.platform.LocalContext
import coil.compose.AsyncImage
import coil.size.Size
import coil.size.Precision
import kotlinx.coroutines.isActive
import kotlinx.coroutines.delay
import androidx.compose.foundation.basicMarquee


class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        // Dismiss the native system splash immediately so our Compose AppSplashScreen
        // (which supports the dynamic whitelabel logo) takes over on the very first frame.
        installSplashScreen().setKeepOnScreenCondition { false }
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            MyApplicationTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = Color(0xFF1C1B1F) // Sleek Interface Dark Background
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
    val activity = LocalContext.current as? androidx.activity.ComponentActivity

    val allAssetsDownloaded = remember(uiState.playlist, uiState.isDownloading) {
        uiState.playlist.all { asset ->
            asset.mediaType.equals("youtube", ignoreCase = true) || 
            (!asset.localPath.isNullOrEmpty() && File(asset.localPath).exists())
        }
    }

    var playAnyway by remember(uiState.playlist) { mutableStateOf(false) }

    // Apply screen orientation: Portrait by default (pairing/standby), or from playlist settings
    LaunchedEffect(uiState.status, uiState.playlist, uiState.playlistOrientation) {
        val isPlaying = (uiState.status == "active" || uiState.status == "online" || uiState.status == "offline") && uiState.playlist.isNotEmpty()
        
        activity?.requestedOrientation = if (isPlaying) {
            if (uiState.playlistOrientation == "vertical") {
                ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
            } else {
                ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
            }
        } else {
            ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        if (uiState.showSplash) {
            AppSplashScreen(uiState = uiState)
        } else {
            // Main Screen Routing based on Status
            when (uiState.status) {
            "active", "online", "offline" -> {
                if (uiState.playlist.isEmpty()) {
                    StandbyScreen(
                        uiState = uiState,
                        onOpenAdmin = { viewModel.toggleAdminOverlay() }
                    )
                } else if (!allAssetsDownloaded && !playAnyway) {
                    DownloadProgressScreen(
                        uiState = uiState,
                        onTriggerDownloads = { viewModel.triggerPendingDownloads() },
                        onOpenAdmin = { viewModel.toggleAdminOverlay() },
                        onPlayAnyway = { playAnyway = true }
                    )
                } else {
                    PlaybackLoopScreen(
                        playlist = uiState.playlist,
                        currentIndex = uiState.currentAssetIndex,
                        orientation = uiState.playlistOrientation,
                        playlistLoop = uiState.playlistLoop,
                        transitionName = uiState.playlistTransition,
                        onOpenAdmin = { viewModel.toggleAdminOverlay() },
                        onVideoCompleted = { viewModel.advanceToNextAsset() },
                        volumePercent = uiState.playlistVolume
                    )

                    // Global Widget Overlay display
                    val widgetType = uiState.widgetType
                    val widgetLink = uiState.widgetLink ?: ""
                    if (!widgetType.isNullOrEmpty()) {
                        val alignment = when (uiState.widgetPlacement) {
                            "top-left" -> Alignment.TopStart
                            "top-right" -> Alignment.TopEnd
                            "bottom-left" -> Alignment.BottomStart
                            "bottom-right" -> Alignment.BottomEnd
                            else -> Alignment.TopEnd
                        }
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(24.dp),
                            contentAlignment = alignment
                        ) {
                            Card(
                                colors = CardDefaults.cardColors(
                                    containerColor = if (widgetType == "qrcode") Color.Transparent else Color(0xCC111827)
                                ),
                                shape = RoundedCornerShape(16.dp),
                                modifier = Modifier
                                    .width(200.dp)
                                    .padding(14.dp)
                            ) {
                                when (widgetType) {
                                    "qrcode" -> {
                                        val encodedLink = try {
                                            java.net.URLEncoder.encode(widgetLink, "UTF-8")
                                        } catch (e: Exception) {
                                            widgetLink
                                        }
                                        Box(
                                            modifier = Modifier
                                                .size(120.dp)
                                                .background(Color.White, RoundedCornerShape(12.dp))
                                                .padding(6.dp),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            AsyncImage(
                                                model = "https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=$encodedLink",
                                                contentDescription = "Scan QR Code Widget Overlay",
                                                modifier = Modifier.fillMaxSize(),
                                                contentScale = ContentScale.Fit
                                            )
                                        }
                                    }
                                    "weather" -> {
                                        WeatherWidget(location = widgetLink.ifEmpty { "Bengaluru" })
                                    }
                                    "clock" -> {
                                        ClockWidget(header = widgetLink.ifEmpty { "Lobby Clock" })
                                    }
                                    "rss" -> {
                                        RssTickerWidget(tickerText = widgetLink)
                                    }
                                }
                            }
                        }
                    }
                }
            }
            "suspended" -> {
                SuspendedScreen(
                    onOpenAdmin = { viewModel.toggleAdminOverlay() }
                )
            }
            else -> { // "pairing" status or default
                PairingSetupScreen(
                    uiState = uiState,
                    onRefreshCode = { viewModel.requestPairingCode() },
                    onOpenAdmin = { viewModel.toggleAdminOverlay() }
                )
            }
        }

        // Floating download progress card overlaid at the bottom-left of the screen
        if (uiState.isDownloading) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(24.dp),
                contentAlignment = Alignment.BottomStart
            ) {
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = Color(0xDD1C1B1F) // Sleek glassmorphic dark container
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

        // Admin Custom Server Settings Drawer / Dialog Window
        if (uiState.showAdminOverlay) {
            AdminSettingsDialog(
                uiState = uiState,
                onSave = { server, pb, vol -> 
                    viewModel.saveServerUrls(server, pb)
                    viewModel.saveVolumeSettings(vol)
                },
                onDismiss = { viewModel.hideAdminOverlay() },
                onReset = { viewModel.purgeCacheAndReset() },
                onInjectDemo = { viewModel.testWithSimulatedDemo() },
                onSimulateSuspended = { viewModel.simulateLicenceSuspended() }
            )
        }
    }
    }
}

@Composable
fun LiveTvStatusBar(
    uiState: SignageUiState,
    onSettingsClick: () -> Unit
) {
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val pulseScale by infiniteTransition.animateFloat(
        initialValue = 0.4f,
        targetValue = 1.0f,
        animationSpec = infiniteRepeatable(
            animation = tween(1000, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulse_scale"
    )

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .statusBarsPadding()
            .padding(horizontal = 24.dp, vertical = 16.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Bluestar Logo & Title Group
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            SignageLogo(uiState = uiState)

            Column(verticalArrangement = Arrangement.Center) {
                Text(
                    text = if (uiState.isWhiteLabel && !uiState.whiteLabelName.isNullOrEmpty()) uiState.whiteLabelName else "Bluestar",
                    color = Color.White,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    lineHeight = 22.sp
                )
                Text(
                    text = if (uiState.isWhiteLabel && !uiState.whiteLabelName.isNullOrEmpty()) "${uiState.whiteLabelName} Client" else "Signage Player v2.4.1",
                    color = Color(0xFF938F99),
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.5.sp
                )
            }
        }

        // Action Pill & Settings
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Connected / Pairing State Capsule
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .background(Color(0xFF2B2930), RoundedCornerShape(100.dp))
                    .border(1.dp, Color(0xFF49454F), RoundedCornerShape(100.dp))
                    .padding(horizontal = 14.dp, vertical = 6.dp)
            ) {
                // Pulsing dot indicator matching theme
                Box(
                    modifier = Modifier
                        .size(7.dp)
                        .background(Color(0xFFD0BCFF).copy(alpha = pulseScale), CircleShape)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = if (uiState.status == "active") "CONNECTED" else if (uiState.status == "suspended") "SUSPENDED" else "DISCONNECTED",
                    color = Color(0xFFD0BCFF),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium,
                    letterSpacing = 0.5.sp
                )
            }

            // Quick Actions Settings
            IconButton(
                onClick = onSettingsClick,
                modifier = Modifier
                    .testTag("admin_settings_button")
                    .background(Color(0xFF2B2930), CircleShape)
                    .border(1.dp, Color(0xFF49454F), CircleShape)
                    .size(38.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Settings,
                    contentDescription = "Open Admin Settings Drawer",
                    tint = Color(0xFFD0BCFF),
                    modifier = Modifier.size(18.dp)
                )
            }
        }
    }
}

fun getAvailableStorageGb(context: android.content.Context): String {
    return try {
        val stat = android.os.StatFs(context.filesDir.absolutePath)
        val availableBytes = stat.availableBlocksLong * stat.blockSizeLong
        val gb = availableBytes.toDouble() / (1024.0 * 1024.0 * 1024.0)
        String.format("%.1f GB free", gb)
    } catch (e: Exception) {
        "8.2 GB free"
    }
}

@Composable
fun PairingSetupScreen(
    uiState: SignageUiState,
    onRefreshCode: () -> Unit,
    onOpenAdmin: () -> Unit
) {
    val context = LocalContext.current
    val systemStorage = remember(context) { getAvailableStorageGb(context) }

    // Oscillation for realistic hardware temp feel
    val infiniteTransition = rememberInfiniteTransition(label = "temp_osc")
    val tempFraction by infiniteTransition.animateFloat(
        initialValue = -0.5f,
        targetValue = 0.5f,
        animationSpec = infiniteRepeatable(
            animation = tween(2500, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "temp_fraction"
    )
    val displayTemp = remember(tempFraction) {
        String.format("%.1f°C", 52.0 + tempFraction)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF1C1B1F))
            .padding(horizontal = 24.dp, vertical = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        // Space to compensate for header removal
        Spacer(modifier = Modifier.height(24.dp))

        // Center setup content
        Column(
            modifier = Modifier
                .widthIn(max = 500.dp)
                .weight(1f),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            SignageLogo(uiState = uiState, size = 100.dp, cornerRadius = 16.dp)
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = "Connect your screen",
                color = Color.White,
                fontSize = 28.sp,
                fontWeight = FontWeight.Light,
                textAlign = TextAlign.Center
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Enter this pairing code in your CMS dashboard to start playback.",
                color = Color(0xFF938F99),
                fontSize = 14.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(horizontal = 16.dp)
            )

            Spacer(modifier = Modifier.height(32.dp))

            // Sleek card structure with accent details
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF2B2930), RoundedCornerShape(32.dp))
                    .border(1.dp, Color(0xFF49454F), RoundedCornerShape(32.dp))
                    .padding(horizontal = 24.dp, vertical = 32.dp),
                contentAlignment = Alignment.Center
            ) {
                // Subtle graphic background
                Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.TopEnd) {
                    Canvas(modifier = Modifier.size(80.dp)) {
                        drawCircle(
                            color = Color.White.copy(alpha = 0.03f),
                            radius = size.width,
                            style = Stroke(width = 4.dp.toPx())
                        )
                    }
                }

                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(20.dp)
                ) {
                    // Custom segmented display blocks matching HTML theme
                    val codeToShow = uiState.pairingCode.ifEmpty { "------" }
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.testTag("pairing_code_text")
                    ) {
                        codeToShow.forEach { char ->
                            if (char == '-') {
                                Text(
                                    text = "-",
                                    color = Color(0xFF49454E),
                                    fontSize = 24.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(horizontal = 4.dp)
                                )
                            } else {
                                Box(
                                    contentAlignment = Alignment.Center,
                                    modifier = Modifier
                                        .size(width = 44.dp, height = 62.dp)
                                        .background(Color(0xFF1C1B1F), RoundedCornerShape(12.dp))
                                        .border(1.dp, Color(0xFF49454F), RoundedCornerShape(12.dp))
                                ) {
                                    Text(
                                        text = char.toString(),
                                        color = Color(0xFFD0BCFF),
                                        fontSize = 28.sp,
                                        fontWeight = FontWeight.ExtraBold,
                                        fontFamily = FontFamily.Monospace
                                    )
                                }
                            }
                        }
                    }

                    // Matching badge style tag
                    Box(
                        modifier = Modifier
                            .background(Color(0xFF381E72), RoundedCornerShape(100.dp))
                            .padding(horizontal = 16.dp, vertical = 6.dp)
                    ) {
                        Text(
                            text = "PAIRING CODE",
                            color = Color(0xFFEADDFF),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.sp
                        )
                    }

                    // Connecting state polling hint
                    Row(
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        CircularProgressIndicator(
                            color = Color(0xFFD0BCFF),
                            strokeWidth = 2.dp,
                            modifier = Modifier.size(12.dp)
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(
                            text = uiState.statusMessage,
                            color = Color(0xFF938F99),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(32.dp))

            // Sleek Step indicators
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                SetupInstructionRow(
                    index = "1",
                    primaryText = "Login to ",
                    boldText = if (uiState.isWhiteLabel && !uiState.whiteLabelName.isNullOrEmpty()) {
                        "cms.${uiState.whiteLabelName.lowercase().replace(" ", "")}.com"
                    } else {
                        "cms.bluestar.io"
                    },
                    suffixText = " on your computer."
                )
                SetupInstructionRow(
                    index = "2",
                    primaryText = "Navigate to ",
                    boldText = "Screens > Add Device",
                    suffixText = "."
                )
                SetupInstructionRow(
                    index = "3",
                    primaryText = "Enter code ",
                    boldText = if (uiState.pairingCode.isNotEmpty()) uiState.pairingCode else "pairing code",
                    suffixText = " above."
                )
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Direct button targets for fast manual configuration & refreshing
        Row(
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            modifier = Modifier.padding(vertical = 12.dp)
        ) {
            FilledTonalButton(
                onClick = onRefreshCode,
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.filledTonalButtonColors(
                    containerColor = Color(0xFF2B2930),
                    contentColor = Color(0xFFD0BCFF)
                ),
                modifier = Modifier.border(1.dp, Color(0xFF49454F), RoundedCornerShape(14.dp))
            ) {
                Icon(
                    imageVector = Icons.Default.Refresh,
                    contentDescription = "Refresh Code Icon",
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text("Refresh Code", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            }

            Button(
                onClick = onOpenAdmin,
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0xFF381E72),
                    contentColor = Color(0xFFEADDFF)
                )
            ) {
                Icon(
                    imageVector = Icons.Default.Settings,
                    contentDescription = "Configure URLs",
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text("Admin Demo Tools", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

@Composable
fun SetupInstructionRow(
    index: String,
    primaryText: String,
    boldText: String,
    suffixText: String
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Round index bullet
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .size(32.dp)
                .background(Color(0xFF49454F), CircleShape)
        ) {
            Text(
                text = index,
                color = Color.White,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold
            )
        }

        // Highlight design keywords in light violet
        Text(
            text = androidx.compose.ui.text.buildAnnotatedString {
                append(primaryText)
                pushStyle(
                    androidx.compose.ui.text.SpanStyle(
                        color = Color(0xFFD0BCFF),
                        fontWeight = FontWeight.Medium
                    )
                )
                append(boldText)
                pop()
                append(suffixText)
            },
            color = Color(0xFFCAC4D0),
            fontSize = 14.sp,
            lineHeight = 20.sp,
            modifier = Modifier.padding(top = 4.dp)
        )
    }
}

@Composable
fun PlaybackLoopScreen(
    playlist: List<PlaylistAsset>,
    currentIndex: Int,
    orientation: String = "horizontal",
    playlistLoop: Boolean = true,
    transitionName: String = "fade",
    onOpenAdmin: () -> Unit,
    onVideoCompleted: () -> Unit = {},
    volumePercent: Int = 80
) {
    val activeAsset = playlist.getOrNull(currentIndex) ?: return

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black),
        contentAlignment = Alignment.Center
    ) {
        AnimatedContent(
            targetState = activeAsset,
            transitionSpec = {
                val duration = 800
                when (transitionName) {
                    "slide" -> {
                        (slideInHorizontally(animationSpec = tween(duration)) { it } + fadeIn(animationSpec = tween(duration))) togetherWith
                                (slideOutHorizontally(animationSpec = tween(duration)) { -it } + fadeOut(animationSpec = tween(duration)))
                    }
                    "zoom" -> {
                        (scaleIn(initialScale = 0.8f, animationSpec = tween(duration)) + fadeIn(animationSpec = tween(duration))) togetherWith
                                (scaleOut(targetScale = 1.2f, animationSpec = tween(duration)) + fadeOut(animationSpec = tween(duration)))
                    }
                    "slide-up" -> {
                        (slideInVertically(animationSpec = tween(duration)) { it } + fadeIn(animationSpec = tween(duration))) togetherWith
                                (slideOutVertically(animationSpec = tween(duration)) { -it } + fadeOut(animationSpec = tween(duration)))
                    }
                    "slide-down" -> {
                        (slideInVertically(animationSpec = tween(duration)) { -it } + fadeIn(animationSpec = tween(duration))) togetherWith
                                (slideOutVertically(animationSpec = tween(duration)) { it } + fadeOut(animationSpec = tween(duration)))
                    }
                    "bounce" -> {
                        val bounceEasing = Easing { fraction ->
                            val t = fraction - 1f
                            t * t * ((2f + 1f) * t + 2f) + 1f // Overshoot
                        }
                        (scaleIn(initialScale = 0.6f, animationSpec = tween(duration, easing = bounceEasing)) + fadeIn(animationSpec = tween(duration))) togetherWith
                                (scaleOut(targetScale = 1.4f, animationSpec = tween(duration)) + fadeOut(animationSpec = tween(duration)))
                    }
                    "spin" -> {
                        fadeIn(animationSpec = tween(duration)) togetherWith fadeOut(animationSpec = tween(0, delayMillis = duration))
                    }
                    // For flip, blur, wipe, we use fade as base enter/exit transitions
                    else -> {
                        fadeIn(animationSpec = tween(duration)) togetherWith fadeOut(animationSpec = tween(duration))
                    }
                }
            },
            label = "media_transitions"
        ) { asset ->
            val rotationZ by transition.animateFloat(
                transitionSpec = { tween(800, easing = FastOutSlowInEasing) },
                label = "rotationZ"
            ) { state ->
                if (state == EnterExitState.Visible) 0f else -180f
            }

            val rotationY by transition.animateFloat(
                transitionSpec = { tween(800, easing = FastOutSlowInEasing) },
                label = "rotationY"
            ) { state ->
                if (state == EnterExitState.Visible) 0f else -90f
            }

            val wipeFraction by transition.animateFloat(
                transitionSpec = { tween(800, easing = LinearOutSlowInEasing) },
                label = "wipe"
            ) { state ->
                if (state == EnterExitState.Visible) 1f else 0f
            }

            val blurRadiusVal = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
                val valDp by transition.animateDp(
                    transitionSpec = { tween(800) },
                    label = "blur"
                ) { state ->
                    if (state == EnterExitState.Visible) 0.dp else 25.dp
                }
                valDp
            } else {
                0.dp
            }

            var modifier = Modifier.fillMaxSize()
            when (transitionName) {
                "spin" -> {
                    modifier = modifier.graphicsLayer {
                        this.rotationZ = rotationZ
                    }
                }
                "flip" -> {
                    modifier = modifier.graphicsLayer {
                        this.rotationY = rotationY
                        cameraDistance = 12 * density
                    }
                }
                "blur" -> {
                    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
                        modifier = modifier.blur(blurRadiusVal)
                    }
                }
                "wipe" -> {
                    modifier = modifier.clip(WipeShape(wipeFraction))
                }
            }

            Box(
                modifier = modifier,
                contentAlignment = Alignment.Center
            ) {
                if (asset.mediaType.equals("video", ignoreCase = true)) {
                    LocalVideoRenderer(
                        asset = asset,
                        volumePercent = volumePercent,
                        onVideoCompleted = onVideoCompleted
                    )
                } else {
                    LocalImageRenderer(asset = asset)
                }
            }
        }

        // Invisible touch overlay to toggle admin configurations Dialog
        Box(
            modifier = Modifier
                .fillMaxSize()
                .clickable { onOpenAdmin() }
        )

        // Overlay element displaying active asset name and playback progress (bottom-right edge, clean)
        Box(
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(24.dp)
                .background(Color(0xBF101116), RoundedCornerShape(12.dp))
                .padding(horizontal = 14.dp, vertical = 8.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.Star,
                    contentDescription = "Media classification",
                    tint = Color(0xFF90CAF9),
                    modifier = Modifier.size(14.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "${currentIndex + 1}/${playlist.size}",
                    color = Color.White,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium,
                    fontFamily = FontFamily.Monospace
                )
            }
        }
    }
}

@Composable
fun LocalImageRenderer(asset: PlaylistAsset) {
    val context = LocalContext.current
    val imageSource = if (!asset.localPath.isNullOrEmpty() && File(asset.localPath).exists()) {
        File(asset.localPath)
    } else {
        asset.url
    }

    AsyncImage(
        model = coil.request.ImageRequest.Builder(context)
            .data(imageSource)
            .bitmapConfig(android.graphics.Bitmap.Config.ARGB_8888)
            .allowHardware(true)
            .size(Size.ORIGINAL)
            .precision(Precision.EXACT)
            .build(),
        contentDescription = asset.filename,
        modifier = Modifier.fillMaxSize(),
        contentScale = ContentScale.Fit
    )
}

@OptIn(androidx.media3.common.util.UnstableApi::class)
@Composable
fun LocalVideoRenderer(
    asset: PlaylistAsset,
    volumePercent: Int = 80,
    onVideoCompleted: () -> Unit
) {
    val context = LocalContext.current
    val videoSource = if (!asset.localPath.isNullOrEmpty() && File(asset.localPath).exists()) {
        File(asset.localPath)
    } else {
        null
    }

    val exoPlayer = remember(asset.id) {
        ExoPlayer.Builder(context).build().apply {
            volume = volumePercent / 100f
            repeatMode = Player.REPEAT_MODE_OFF
            val mediaItem = if (videoSource != null) {
                MediaItem.fromUri(android.net.Uri.fromFile(videoSource))
            } else {
                MediaItem.fromUri(android.net.Uri.parse(asset.url))
            }
            setMediaItem(mediaItem)
            prepare()
            playWhenReady = true
        }
    }

    LaunchedEffect(volumePercent) {
        exoPlayer.volume = volumePercent / 100f
    }

    DisposableEffect(exoPlayer) {
        val listener = object : Player.Listener {
            override fun onPlaybackStateChanged(playbackState: Int) {
                if (playbackState == Player.STATE_ENDED) {
                    onVideoCompleted()
                }
            }

            override fun onPlayerError(error: PlaybackException) {
                android.util.Log.e("LocalVideoRenderer", "ExoPlayer error playing video: ${asset.filename}", error)
                onVideoCompleted()
            }
        }
        exoPlayer.addListener(listener)
        onDispose {
            exoPlayer.removeListener(listener)
            exoPlayer.release()
        }
    }

    AndroidView(
        factory = { ctx ->
            PlayerView(ctx).apply {
                player = exoPlayer
                useController = false
                resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
                setBackgroundColor(android.graphics.Color.BLACK)
            }
        },
        modifier = Modifier.fillMaxSize()
    )
}


@Composable
fun StandbyScreen(uiState: SignageUiState, onOpenAdmin: () -> Unit) {
    val infiniteTransition = rememberInfiniteTransition(label = "radar")
    val rotation by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(4500, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "rotation"
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF070709))
            .clickable { onOpenAdmin() }
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        SignageLogo(uiState = uiState, size = 160.dp, cornerRadius = 24.dp)

        Spacer(modifier = Modifier.height(30.dp))

        Text(
            text = if (uiState.isWhiteLabel && !uiState.whiteLabelName.isNullOrEmpty()) {
                "READY FOR ${uiState.whiteLabelName.uppercase()} CONTENT"
            } else {
                "READY FOR SYNCED CONTENT"
            },
            color = Color(0xFF81C784),
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.5.sp
        )

        Spacer(modifier = Modifier.height(10.dp))

        Text(
            text = if (uiState.isWhiteLabel && !uiState.whiteLabelName.isNullOrEmpty()) {
                "${uiState.whiteLabelName} Signage Client"
            } else {
                "Bluestar Signage Client"
            },
            color = Color.White,
            fontSize = 24.sp,
            fontWeight = FontWeight.SemiBold
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = if (uiState.isWhiteLabel && !uiState.whiteLabelName.isNullOrEmpty()) {
                "To stream promos, assign a playlist schedule of active photos or videos on your ${uiState.whiteLabelName} CMS."
            } else {
                "To stream promos, assign a playlist schedule of active photos or videos on the Node.js / Pocketbase CMS."
            },
            color = Color.White.copy(alpha = 0.5f),
            fontSize = 12.sp,
            textAlign = TextAlign.Center,
            modifier = Modifier.widthIn(max = 480.dp),
            lineHeight = 18.sp
        )
    }
}

@Composable
fun SuspendedScreen(onOpenAdmin: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(Color(0xFF2C1313), Color(0xFF0F0707))
                )
            )
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = Icons.Default.Warning,
            contentDescription = "Screen Subscription Paused Icon",
            tint = Color(0xFFEF5350),
            modifier = Modifier.size(64.dp)
        )

        Spacer(modifier = Modifier.height(24.dp))

        Text(
            text = "SCREEN SUSPENDED",
            color = Color(0xFFEF5350),
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 2.sp
        )

        Spacer(modifier = Modifier.height(12.dp))

        Text(
            text = "Licence Suspended / Expired",
            color = Color.White,
            fontSize = 26.sp,
            fontWeight = FontWeight.Light,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(10.dp))

        Text(
            text = "This screen is temporarily suspended. Please renew your license via the CMS Billing Portal to resume television signage activities.",
            color = Color.White.copy(alpha = 0.6f),
            fontSize = 12.sp,
            textAlign = TextAlign.Center,
            modifier = Modifier.widthIn(max = 500.dp),
            lineHeight = 18.sp
        )

        Spacer(modifier = Modifier.height(32.dp))

        Button(
            onClick = onOpenAdmin,
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFD32F2F)),
            shape = RoundedCornerShape(12.dp)
        ) {
            Text("Admin Controls / Settings", fontSize = 13.sp)
        }
    }
}

@Composable
fun AdminSettingsDialog(
    uiState: SignageUiState,
    onSave: (String, String, Int) -> Unit,
    onDismiss: () -> Unit,
    onReset: () -> Unit,
    onInjectDemo: () -> Unit,
    onSimulateSuspended: () -> Unit
) {
    var serverInput by remember(uiState.serverUrl) { mutableStateOf(uiState.serverUrl) }
    var pbInput by remember(uiState.pocketbaseUrl) { mutableStateOf(uiState.pocketbaseUrl) }
    var volumeInput by remember(uiState.screenVolume) { mutableStateOf(uiState.screenVolume) }
    val scrollState = rememberScrollState()

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.Settings,
                    contentDescription = null,
                    tint = Color(0xFF90CAF9),
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Screen Administrative Tooling",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
            }
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(scrollState)
                    .padding(vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Text(
                    text = "Configure connectivity coordinates. Local host computers can typically be reached from the Android emulator at '10.0.2.2'.",
                    color = Color.White.copy(alpha = 0.6f),
                    fontSize = 11.sp,
                    lineHeight = 16.sp
                )

                OutlinedTextField(
                    value = serverInput,
                    onValueChange = { serverInput = it },
                    label = { Text("CMS Server URL Location") },
                    textStyle = LocalTextStyle.current.copy(color = Color.White),
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("server_url_input"),
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Color(0xFF64B5F6),
                        unfocusedBorderColor = Color.White.copy(alpha = 0.3f)
                    )
                )

                OutlinedTextField(
                    value = pbInput,
                    onValueChange = { pbInput = it },
                    label = { Text("Pocketbase Server URL Location") },
                    textStyle = LocalTextStyle.current.copy(color = Color.White),
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("pb_url_input"),
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Color(0xFF64B5F6),
                        unfocusedBorderColor = Color.White.copy(alpha = 0.3f)
                    )
                )

                Text(
                    text = "SCREEN VOLUME ($volumeInput%)",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF90CAF9),
                    letterSpacing = 1.sp
                )

                Slider(
                    value = volumeInput.toFloat(),
                    onValueChange = { volumeInput = it.toInt() },
                    valueRange = 0f..100f,
                    colors = SliderDefaults.colors(
                        thumbColor = Color(0xFFD0BCFF),
                        activeTrackColor = Color(0xFFD0BCFF),
                        inactiveTrackColor = Color(0xFF49454F)
                    ),
                    modifier = Modifier.fillMaxWidth().testTag("volume_slider")
                )

                Divider(
                    color = Color.White.copy(alpha = 0.15f),
                    modifier = Modifier.padding(vertical = 4.dp)
                )

                Text(
                    text = "SIMULATOR PREVIEWS & SANDBOXING",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF90CAF9),
                    letterSpacing = 1.sp
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    FilledTonalButton(
                        onClick = onInjectDemo,
                        modifier = Modifier
                            .weight(1f)
                            .testTag("sim_playback_btn"),
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.filledTonalButtonColors(
                            containerColor = Color(0x3B64B5F6),
                            contentColor = Color(0xFF94D2FC)
                        )
                    ) {
                        Text("Sim Playback", fontSize = 11.sp)
                    }

                    FilledTonalButton(
                        onClick = onSimulateSuspended,
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.filledTonalButtonColors(
                            containerColor = Color(0x3BEF5350),
                            contentColor = Color(0xFFFFB2B0)
                        )
                    ) {
                        Text("Sim Suspend", fontSize = 11.sp)
                    }
                }

                Button(
                    onClick = onReset,
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("purge_and_reset_btn"),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFB71C1C)),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Delete,
                        contentDescription = null,
                        modifier = Modifier.size(14.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Purge Cache & Clear Pairing", fontSize = 12.sp)
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { onSave(serverInput, pbInput, volumeInput) },
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1E3A5F))
            ) {
                Text("Apply Settings")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Dismiss", color = Color.White.copy(alpha = 0.7f))
            }
        },
        containerColor = Color(0xFF13151D),
        shape = RoundedCornerShape(20.dp)
    )
}

class WipeShape(private val fraction: Float) : androidx.compose.ui.graphics.Shape {
    override fun createOutline(
        size: androidx.compose.ui.geometry.Size,
        layoutDirection: androidx.compose.ui.unit.LayoutDirection,
        density: androidx.compose.ui.unit.Density
    ): androidx.compose.ui.graphics.Outline {
        return androidx.compose.ui.graphics.Outline.Rectangle(
            androidx.compose.ui.geometry.Rect(0f, 0f, size.width * fraction, size.height)
        )
    }
}

@Composable
fun SignageLogo(
    uiState: SignageUiState,
    modifier: Modifier = Modifier,
    size: androidx.compose.ui.unit.Dp = 40.dp,
    cornerRadius: androidx.compose.ui.unit.Dp = 12.dp
) {
    if (uiState.isWhiteLabel && !uiState.whiteLabelLogoPath.isNullOrEmpty() && File(uiState.whiteLabelLogoPath).exists()) {
        AsyncImage(
            model = File(uiState.whiteLabelLogoPath),
            contentDescription = "Signage Logo",
            modifier = modifier
                .size(size)
                .clip(RoundedCornerShape(cornerRadius)),
            contentScale = ContentScale.Fit
        )
    } else {
        // Default Bluestar Logo
        Box(
            contentAlignment = Alignment.Center,
            modifier = modifier
                .size(size)
                .background(Color(0xFFD0BCFF), RoundedCornerShape(cornerRadius))
        ) {
            val innerSize = size * 0.4f
            val innerCorner = cornerRadius * 0.16f
            Box(
                modifier = Modifier
                    .size(innerSize)
                    .background(Color(0xFF381E72), RoundedCornerShape(innerCorner))
                    .graphicsLayer(rotationZ = 45f)
            )
        }
    }
}

@Composable
fun DownloadProgressScreen(
    uiState: SignageUiState,
    onTriggerDownloads: () -> Unit,
    onOpenAdmin: () -> Unit,
    onPlayAnyway: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0F0E13)) // Premium dark slate background
            .clickable { onOpenAdmin() }
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // Logo & Title Group at the top
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            modifier = Modifier.padding(bottom = 40.dp)
        ) {
            SignageLogo(uiState = uiState, size = 54.dp, cornerRadius = 12.dp)
            
            Column(verticalArrangement = Arrangement.Center) {
                Text(
                    text = if (uiState.isWhiteLabel && !uiState.whiteLabelName.isNullOrEmpty()) uiState.whiteLabelName else "Bluestar",
                    color = Color.White,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "SYNCING MEDIA ASSETS",
                    color = Color(0xFF938F99),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.5.sp
                )
            }
        }

        // Futuristic pulsating glow loading container
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier.size(200.dp)
        ) {
            // Background pulsing glow ring
            CircularProgressIndicator(
                progress = { uiState.downloadProgressFraction },
                modifier = Modifier.size(160.dp),
                color = if (uiState.isDownloading) Color(0xFFD0BCFF) else Color(0xFFE57373),
                strokeWidth = 10.dp,
                trackColor = Color(0xFF2B2930)
            )
            
            // Text displaying percentage inside the circle
            Column(
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "${Math.round(uiState.downloadProgressFraction * 100)}%",
                    color = Color.White,
                    fontSize = 32.sp,
                    fontWeight = FontWeight.ExtraBold
                )
                Text(
                    text = if (uiState.isDownloading) "SYNCING" else "PAUSED",
                    color = Color(0xFFCAC4D0),
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 2.sp
                )
            }
        }

        Spacer(modifier = Modifier.height(40.dp))

        // Progress Details Card
        Card(
            colors = CardDefaults.cardColors(
                containerColor = Color(0xFF1D1B20)
            ),
            shape = RoundedCornerShape(24.dp),
            modifier = Modifier
                .widthIn(max = 500.dp)
                .fillMaxWidth()
                .border(1.dp, Color(0xFF35343A), RoundedCornerShape(24.dp))
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = if (uiState.isDownloading) "Downloading Display Assets" else "Download Incomplete",
                    color = Color.White,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = if (uiState.isDownloading) {
                        uiState.downloadProgressMessage.ifEmpty { "Preparing assets for playback..." }
                    } else {
                        "Some playlist assets could not be downloaded. Please verify internet connection."
                    },
                    color = Color(0xFFEADDFF),
                    fontSize = 13.sp,
                    textAlign = TextAlign.Center,
                    lineHeight = 18.sp
                )
                
                Spacer(modifier = Modifier.height(20.dp))
                
                // Detailed horizontal progress bar
                LinearProgressIndicator(
                    progress = { uiState.downloadProgressFraction },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(8.dp)
                        .clip(CircleShape),
                    color = if (uiState.isDownloading) Color(0xFFD0BCFF) else Color(0xFFE57373),
                    trackColor = Color(0xFF49454F)
                )

                if (!uiState.isDownloading) {
                    Spacer(modifier = Modifier.height(24.dp))
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Button(
                            onClick = onTriggerDownloads,
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF381E72)),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("Retry Download", color = Color(0xFFEADDFF), fontSize = 13.sp, fontWeight = FontWeight.Bold)
                        }
                        Button(
                            onClick = onPlayAnyway,
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1B3A5F)),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("Play Anyway", color = Color(0xFFE0F7FA), fontSize = 13.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                Text(
                    text = "Screen playback will begin automatically as soon as all media files are stored locally for seamless offline streaming.",
                    color = Color(0xFF938F99),
                    fontSize = 11.sp,
                    textAlign = TextAlign.Center,
                    lineHeight = 16.sp
                )
            }
        }

        Spacer(modifier = Modifier.height(30.dp))

        // Small indicator showing admin tools tap hint
        Text(
            text = "Tap screen to access Admin Tools",
            color = Color(0xFF49454F),
            fontSize = 11.sp,
            fontWeight = FontWeight.Medium
        )
    }
}

@Composable
fun AppSplashScreen(uiState: SignageUiState) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF1C1B1F)),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            // Logo
            SignageLogo(uiState = uiState, size = 120.dp, cornerRadius = 24.dp)
            
            Spacer(modifier = Modifier.height(24.dp))
            
            // Name
            Text(
                text = if (uiState.isWhiteLabel && !uiState.whiteLabelName.isNullOrEmpty()) uiState.whiteLabelName else "Bluestar",
                color = Color.White,
                fontSize = 32.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.sp
            )
            
            Spacer(modifier = Modifier.height(8.dp))
            
            // Subtitle
            Text(
                text = if (uiState.isWhiteLabel && !uiState.whiteLabelName.isNullOrEmpty()) "${uiState.whiteLabelName} Signage Client" else "Signage Player v2.4.1",
                color = Color(0xFF938F99),
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.5.sp
            )
            
            Spacer(modifier = Modifier.height(48.dp))
            
            // Pulse loading bar
            CircularProgressIndicator(
                color = Color(0xFFD0BCFF),
                strokeWidth = 3.dp,
                modifier = Modifier.size(28.dp)
            )
        }
    }
}

@Composable
fun WeatherWidget(location: String) {
    val locLower = location.lowercase()
    var temp = 24
    var condition = "Sunny"
    var isRainy = false
    var isSunny = true
    var isSnowing = false
    var isCloudy = false
    var isWindy = false

    if (locLower.contains("london") || locLower.contains("rain") || locLower.contains("seattle")) {
        temp = 14
        condition = "Rainy"
        isRainy = true
        isSunny = false
    } else if (locLower.contains("delhi") || locLower.contains("hot") || locLower.contains("desert") || locLower.contains("chennai")) {
        temp = 38
        condition = "Hot & Sunny"
        isSunny = true
    } else if (locLower.contains("snow") || locLower.contains("cold") || locLower.contains("moscow") || locLower.contains("ice")) {
        temp = -2
        condition = "Snowing"
        isSnowing = true
        isSunny = false
    } else if (locLower.contains("cloud") || locLower.contains("paris") || locLower.contains("tokyo") || locLower.contains("mumbai")) {
        temp = 19
        condition = "Partly Cloudy"
        isCloudy = true
        isSunny = false
    } else if (locLower.contains("wind") || locLower.contains("storm") || locLower.contains("chicago")) {
        temp = 16
        condition = "Windy"
        isWindy = true
        isSunny = false
    }

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Text(
            text = "WEATHER",
            color = Color(0xFF94A3B8),
            fontSize = 8.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.sp,
            modifier = Modifier.fillMaxWidth()
        )
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.padding(vertical = 4.dp)
        ) {
            // Drawn Weather Icon
            Box(modifier = Modifier.size(24.dp)) {
                if (isSunny) {
                    // Golden sun
                    Box(
                        modifier = Modifier
                            .size(16.dp)
                            .align(Alignment.Center)
                            .background(Color(0xFFF59E0B), CircleShape)
                    )
                } else if (isRainy) {
                    // Dark cloud & raindrops
                    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.align(Alignment.Center)) {
                        Box(
                            modifier = Modifier
                                .size(width = 18.dp, height = 10.dp)
                                .background(Color(0xFF64748B), RoundedCornerShape(5.dp))
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(2.dp), modifier = Modifier.padding(top = 2.dp)) {
                            Box(modifier = Modifier.size(width = 1.dp, height = 3.dp).background(Color(0xFF38BDF8)))
                            Box(modifier = Modifier.size(width = 1.dp, height = 3.dp).background(Color(0xFF38BDF8)))
                            Box(modifier = Modifier.size(width = 1.dp, height = 3.dp).background(Color(0xFF38BDF8)))
                        }
                    }
                } else if (isSnowing) {
                    // Cold snowflake placeholder (white circle + dots)
                    Box(
                        modifier = Modifier
                            .size(14.dp)
                            .align(Alignment.Center)
                            .background(Color(0xFF93C5FD), CircleShape)
                    )
                } else if (isCloudy) {
                    // Cloud + Sun peaking out
                    Box(modifier = Modifier.fillMaxSize()) {
                        Box(
                            modifier = Modifier
                                .size(10.dp)
                                .align(Alignment.TopStart)
                                .background(Color(0xFFF59E0B), CircleShape)
                        )
                        Box(
                            modifier = Modifier
                                .size(width = 16.dp, height = 10.dp)
                                .align(Alignment.BottomEnd)
                                .background(Color(0xFF94A3B8), RoundedCornerShape(5.dp))
                        )
                    }
                } else { // windy
                    // Wind lines
                    Column(
                        verticalArrangement = Arrangement.spacedBy(3.dp),
                        modifier = Modifier.align(Alignment.Center).fillMaxWidth()
                    ) {
                        Box(modifier = Modifier.fillMaxWidth(0.8f).height(2.dp).background(Color(0xFF2DD4BF), RoundedCornerShape(1.dp)))
                        Box(modifier = Modifier.fillMaxWidth(0.9f).height(2.5.dp).background(Color(0xFF2DD4BF), RoundedCornerShape(1.dp)))
                        Box(modifier = Modifier.fillMaxWidth(0.7f).height(2.dp).background(Color(0xFF2DD4BF), RoundedCornerShape(1.dp)))
                    }
                }
            }

            Text(
                text = "$temp°C",
                color = Color.White,
                fontSize = 16.sp,
                fontWeight = FontWeight.ExtraBold
            )
        }
        Text(
            text = "$location · $condition",
            color = Color(0xFFE2E8F0),
            fontSize = 9.sp,
            fontWeight = FontWeight.Medium,
            textAlign = TextAlign.Center,
            maxLines = 1,
            overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
        )
    }
}

@Composable
fun ClockWidget(header: String) {
    var timeText by remember { mutableStateOf("") }
    LaunchedEffect(Unit) {
        while (isActive) {
            val sdf = java.text.SimpleDateFormat("hh:mm:ss a", java.util.Locale.getDefault())
            timeText = sdf.format(java.util.Date())
            delay(1000)
        }
    }

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Text(
            text = header.ifEmpty { "CLOCK" }.uppercase(),
            color = Color(0xFF94A3B8),
            fontSize = 8.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.sp,
            modifier = Modifier.fillMaxWidth()
        )
        Text(
            text = timeText,
            color = Color.White,
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Monospace,
            modifier = Modifier.padding(vertical = 4.dp)
        )
    }
}

@OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)
@Composable
fun RssTickerWidget(tickerText: String) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Text(
            text = "LIVE TICKER",
            color = Color(0xFF94A3B8),
            fontSize = 8.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.sp,
            modifier = Modifier.fillMaxWidth()
        )
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color(0x22FFFFFF), RoundedCornerShape(8.dp))
                .padding(horizontal = 8.dp, vertical = 6.dp)
        ) {
            Text(
                text = tickerText.ifEmpty { "Welcome to SignageOS Digital Display Player Network Ticker" },
                color = Color.White,
                fontSize = 9.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                modifier = Modifier.basicMarquee(
                    iterations = Int.MAX_VALUE,
                    velocity = 30.dp
                )
            )
        }
    }
}

