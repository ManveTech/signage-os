package com.example

import android.app.Application
import android.content.pm.ActivityInfo
import android.net.Uri
import android.os.Bundle
import android.widget.VideoView
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
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
import coil.compose.AsyncImage
import com.example.data.database.PlaylistAsset
import com.example.ui.SignageUiState
import com.example.ui.SignageViewModel
import com.example.ui.theme.MyApplicationTheme
import java.io.File
import androidx.annotation.OptIn
import androidx.media3.common.util.UnstableApi
import androidx.media3.common.MediaItem
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import androidx.media3.ui.AspectRatioFrameLayout
import com.pierfrancescosoffritti.androidyoutubeplayer.core.player.views.YouTubePlayerView
import com.pierfrancescosoffritti.androidyoutubeplayer.core.player.listeners.AbstractYouTubePlayerListener
import com.pierfrancescosoffritti.androidyoutubeplayer.core.player.YouTubePlayer
import com.pierfrancescosoffritti.androidyoutubeplayer.core.player.options.IFramePlayerOptions
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector
import coil.size.Size
import coil.size.Precision


class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
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

    // Apply screen orientation from playlist settings
    LaunchedEffect(uiState.playlistOrientation) {
        activity?.requestedOrientation = if (uiState.playlistOrientation == "vertical") {
            ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
        } else {
            ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        // Main Screen Routing based on Status
        when (uiState.status) {
            "active", "online" -> {
                if (uiState.playlist.isEmpty()) {
                    StandbyScreen(
                        onOpenAdmin = { viewModel.toggleAdminOverlay() }
                    )
                } else {
                    PlaybackLoopScreen(
                        playlist = uiState.playlist,
                        currentIndex = uiState.currentAssetIndex,
                        orientation = uiState.playlistOrientation,
                        playlistLoop = uiState.playlistLoop,
                        playlistVolume = uiState.playlistVolume,
                        onOpenAdmin = { viewModel.toggleAdminOverlay() }
                    )
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
                                progress = uiState.downloadProgressFraction,
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
                onSave = { server, pb -> viewModel.saveServerUrls(server, pb) },
                onDismiss = { viewModel.hideAdminOverlay() },
                onReset = { viewModel.purgeCacheAndReset() },
                onInjectDemo = { viewModel.testWithSimulatedDemo() },
                onSimulateSuspended = { viewModel.simulateLicenceSuspended() }
            )
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
            // Creative rotated geometric logo
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(40.dp)
                    .background(Color(0xFFD0BCFF), RoundedCornerShape(12.dp))
            ) {
                // Rotated internal diamond
                Box(
                    modifier = Modifier
                        .size(16.dp)
                        .background(Color(0xFF381E72), RoundedCornerShape(2.dp))
                        .graphicsLayer(rotationZ = 45f)
                )
            }

            Column(verticalArrangement = Arrangement.Center) {
                Text(
                    text = "Bluestar",
                    color = Color.White,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    lineHeight = 22.sp
                )
                Text(
                    text = "Signage Player v2.4.1",
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
                    boldText = "cms.bluestar.io",
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
    playlistVolume: Int = 80,
    onOpenAdmin: () -> Unit
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
                fadeIn(animationSpec = tween(600)) togetherWith fadeOut(animationSpec = tween(600))
            },
            label = "media_transitions"
        ) { asset ->
            when (asset.mediaType) {
                "youtube" -> {
                    YouTubePlayerRenderer(videoId = asset.youtubeVideoId ?: "")
                }
                "video" -> {
                    LocalVideoPlayer(asset = asset, volume = playlistVolume / 100f)
                }
                else -> {
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
                    imageVector = when (activeAsset.mediaType) {
                        "youtube" -> Icons.Default.PlayArrow
                        "video" -> Icons.Default.PlayArrow
                        else -> Icons.Default.Star
                    },
                    contentDescription = "Media classification",
                    tint = Color(0xFF90CAF9),
                    modifier = Modifier.size(14.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "${currentIndex + 1}/${playlist.size} • ${activeAsset.filename}",
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

@OptIn(UnstableApi::class)
@Composable
fun LocalVideoPlayer(asset: PlaylistAsset, volume: Float = 0.8f) {
    val context = LocalContext.current
    val videoSource = if (!asset.localPath.isNullOrEmpty() && File(asset.localPath).exists()) {
        Uri.fromFile(File(asset.localPath))
    } else {
        Uri.parse(asset.url)
    }

    val exoPlayer = remember(videoSource) {
        val trackSelector = DefaultTrackSelector(context).apply {
            setParameters(
                buildUponParameters()
                    .setForceHighestSupportedBitrate(true)
            )
        }
        ExoPlayer.Builder(context)
            .setTrackSelector(trackSelector)
            .build().apply {
                val mediaItem = MediaItem.fromUri(videoSource)
                setMediaItem(mediaItem)
                repeatMode = ExoPlayer.REPEAT_MODE_ONE
                this.volume = volume.coerceIn(0f, 1f)
                prepare()
                playWhenReady = true
            }
    }

    // Update volume dynamically if it changes
    LaunchedEffect(volume) {
        exoPlayer.volume = volume.coerceIn(0f, 1f)
    }

    DisposableEffect(exoPlayer) {
        onDispose {
            exoPlayer.release()
        }
    }

    AndroidView(
        factory = { ctx ->
            PlayerView(ctx).apply {
                useController = false
                resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
                player = exoPlayer
            }
        },
        modifier = Modifier.fillMaxSize()
    )
}

@Composable
fun YouTubePlayerRenderer(videoId: String) {
    val context = LocalContext.current
    val youTubePlayerView = remember(videoId) {
        YouTubePlayerView(context).apply {
            enableAutomaticInitialization = false
            val listener = object : AbstractYouTubePlayerListener() {
                override fun onReady(youTubePlayer: YouTubePlayer) {
                    youTubePlayer.mute() // Autoplay muted
                    youTubePlayer.loadVideo(videoId, 0f)
                }
            }
            val options = IFramePlayerOptions.Builder()
                .controls(0)
                .rel(0)
                .ivLoadPolicy(3)
                .build()
            initialize(listener, options)
        }
    }

    DisposableEffect(youTubePlayerView) {
        onDispose {
            youTubePlayerView.release()
        }
    }

    AndroidView(
        factory = { youTubePlayerView },
        modifier = Modifier.fillMaxSize()
    )
}


@Composable
fun StandbyScreen(onOpenAdmin: () -> Unit) {
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
        // Futuristic Rotating Custom Radar Graphic
        Canvas(
            modifier = Modifier
                .size(160.dp)
                .padding(12.dp)
        ) {
            val center = Offset(size.width / 2, size.height / 2)
            val radius = size.width / 2

            // Draw concentric rings
            drawCircle(color = Color(0x1F64B5F6), radius = radius, style = Stroke(width = 1.dp.toPx()))
            drawCircle(color = Color(0x3364B5F6), radius = radius * 0.6f, style = Stroke(width = 1.dp.toPx()))
            drawCircle(color = Color(0x4D64B5F6), radius = radius * 0.3f, style = Stroke(width = 1.dp.toPx()))

            // Sweep visual line representation
            rotate(degrees = rotation) {
                drawLine(
                    brush = Brush.linearGradient(
                        colors = listOf(Color(0xFF64B5F6), Color.Transparent),
                        start = center,
                        end = Offset(size.width, size.height / 2)
                    ),
                    start = center,
                    end = Offset(size.width, size.height / 2),
                    strokeWidth = 3.dp.toPx()
                )
            }
        }

        Spacer(modifier = Modifier.height(30.dp))

        Text(
            text = "READY FOR SYNCED CONTENT",
            color = Color(0xFF81C784),
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.5.sp
        )

        Spacer(modifier = Modifier.height(10.dp))

        Text(
            text = "Bluestar Signage Client",
            color = Color.White,
            fontSize = 24.sp,
            fontWeight = FontWeight.SemiBold
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = "To stream promos, assign a playlist schedule of active photos or videos on the Node.js / Pocketbase CMS.",
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
    onSave: (String, String) -> Unit,
    onDismiss: () -> Unit,
    onReset: () -> Unit,
    onInjectDemo: () -> Unit,
    onSimulateSuspended: () -> Unit
) {
    var serverInput by remember { mutableStateOf(uiState.serverUrl) }
    var pbInput by remember { mutableStateOf(uiState.pocketbaseUrl) }

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
                onClick = { onSave(serverInput, pbInput) },
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1E3A5F))
            ) {
                Text("Apply Coord")
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
