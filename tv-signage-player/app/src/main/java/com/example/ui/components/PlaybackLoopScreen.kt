package com.example.ui.components

import android.content.res.Configuration
import android.net.Uri
import androidx.annotation.OptIn
import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.example.data.database.PlaylistAsset
import java.io.File

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
    val isVideo = activeAsset.mediaType.equals("video", ignoreCase = true)
    val context = LocalContext.current

    val sharedExoPlayer = remember {
        ExoPlayer.Builder(context).build().apply {
            volume = volumePercent / 100f
        }
    }

    DisposableEffect(sharedExoPlayer) {
        onDispose {
            sharedExoPlayer.release()
        }
    }

    val currentOnVideoCompleted by rememberUpdatedState(onVideoCompleted)
    val currentActiveAsset by rememberUpdatedState(activeAsset)

    DisposableEffect(sharedExoPlayer) {
        val listener = object : Player.Listener {
            override fun onPlaybackStateChanged(playbackState: Int) {
                if (playbackState == Player.STATE_ENDED) {
                    currentOnVideoCompleted()
                }
            }

            override fun onPlayerError(error: PlaybackException) {
                android.util.Log.e("PlaybackLoopScreen", "ExoPlayer playback error: ${currentActiveAsset.filename}", error)
                currentOnVideoCompleted()
            }
        }
        sharedExoPlayer.addListener(listener)
        onDispose {
            sharedExoPlayer.removeListener(listener)
        }
    }

    LaunchedEffect(sharedExoPlayer, volumePercent) {
        sharedExoPlayer.volume = volumePercent / 100f
    }

    val configuration = LocalConfiguration.current
    val isLandscape = configuration.orientation == Configuration.ORIENTATION_LANDSCAPE
    val isVerticalPlaylist = orientation.equals("vertical", ignoreCase = true)

    Box(
        modifier = if (isVerticalPlaylist && isLandscape) {
            Modifier
                .size(
                    width = configuration.screenHeightDp.dp,
                    height = configuration.screenWidthDp.dp
                )
                .rotate(90f)
                .background(Color.Black)
        } else {
            Modifier
                .fillMaxSize()
                .background(Color.Black)
        },
        contentAlignment = Alignment.Center
    ) {
        if (isVideo) {
            LocalVideoRenderer(
                asset = activeAsset,
                sharedExoPlayer = sharedExoPlayer,
                loopSingleVideo = playlist.size == 1 && playlistLoop
            )
        }

        AnimatedContent(
            targetState = if (isVideo) null else activeAsset,
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
                            t * t * ((2f + 1f) * t + 2f) + 1f
                        }
                        (scaleIn(initialScale = 0.6f, animationSpec = tween(duration, easing = bounceEasing)) + fadeIn(animationSpec = tween(duration))) togetherWith
                                (scaleOut(targetScale = 1.4f, animationSpec = tween(duration)) + fadeOut(animationSpec = tween(duration)))
                    }
                    "spin" -> {
                        fadeIn(animationSpec = tween(duration)) togetherWith fadeOut(animationSpec = tween(0, delayMillis = duration))
                    }
                    else -> {
                        fadeIn(animationSpec = tween(duration)) togetherWith fadeOut(animationSpec = tween(duration))
                    }
                }
            },
            label = "media_transitions"
        ) { asset ->
            if (asset != null) {
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
                    LocalImageRenderer(asset = asset)
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

    val contentScale = when (asset.objectFit) {
        "contain" -> ContentScale.Fit
        "fill" -> ContentScale.FillBounds
        "none" -> ContentScale.None
        else -> ContentScale.Crop
    }

    val scale = (asset.scalePercent ?: 100).toFloat() / 100f

    AsyncImage(
        model = ImageRequest.Builder(context)
            .data(imageSource)
            .crossfade(false)
            .allowHardware(true)
            .build(),
        contentDescription = asset.filename,
        modifier = Modifier
            .fillMaxSize()
            .graphicsLayer(
                scaleX = scale,
                scaleY = scale
            ),
        contentScale = contentScale
    )
}

@OptIn(UnstableApi::class)
@Composable
fun LocalVideoRenderer(
    asset: PlaylistAsset,
    sharedExoPlayer: ExoPlayer,
    loopSingleVideo: Boolean = false
) {
    val videoSource = if (!asset.localPath.isNullOrEmpty() && File(asset.localPath).exists()) {
        File(asset.localPath)
    } else {
        null
    }

    LaunchedEffect(asset.id, videoSource) {
        sharedExoPlayer.repeatMode = if (loopSingleVideo) Player.REPEAT_MODE_ONE else Player.REPEAT_MODE_OFF
        val mediaItem = if (videoSource != null) {
            MediaItem.fromUri(Uri.fromFile(videoSource))
        } else {
            MediaItem.fromUri(Uri.parse(asset.url))
        }

        sharedExoPlayer.stop()
        sharedExoPlayer.clearMediaItems()
        sharedExoPlayer.setMediaItem(mediaItem)
        sharedExoPlayer.seekTo(0L)
        sharedExoPlayer.prepare()
        sharedExoPlayer.playWhenReady = true
    }

    LaunchedEffect(loopSingleVideo) {
        sharedExoPlayer.repeatMode = if (loopSingleVideo) Player.REPEAT_MODE_ONE else Player.REPEAT_MODE_OFF
    }

    var playerViewRef: PlayerView? = null

    DisposableEffect(Unit) {
        onDispose {
            playerViewRef?.player = null
            try {
                sharedExoPlayer.stop()
                sharedExoPlayer.clearMediaItems()
            } catch (_: Exception) {}
        }
    }

    val scale = (asset.scalePercent ?: 100).toFloat() / 100f

    AndroidView(
        factory = { ctx ->
            PlayerView(ctx).apply {
                player = sharedExoPlayer
                useController = false
                resizeMode = when (asset.objectFit) {
                    "contain" -> AspectRatioFrameLayout.RESIZE_MODE_FIT
                    "fill" -> AspectRatioFrameLayout.RESIZE_MODE_FILL
                    else -> AspectRatioFrameLayout.RESIZE_MODE_ZOOM
                }
                setBackgroundColor(android.graphics.Color.BLACK)
                playerViewRef = this
            }
        },
        modifier = Modifier
            .fillMaxSize()
            .graphicsLayer(
                scaleX = scale,
                scaleY = scale
            )
    )
}}
