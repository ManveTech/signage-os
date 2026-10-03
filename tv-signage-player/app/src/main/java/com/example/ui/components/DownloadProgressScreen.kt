package com.example.ui.components

import android.content.res.Configuration
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.R
import com.example.data.database.PlaylistAsset
import com.example.ui.SignageUiState
import java.io.File

// Same black + top-centre blue glow language as the pairing screen
// (TopGlowBackground), so the first-run flow reads as one product:
// splash -> pair -> sync -> play.
private val SyncBlue = Color(0xFF2F6BFF)
private val SyncCyan = Color(0xFF5EC8FF)
private val SyncAmber = Color(0xFFF5B547)
private val SyncRed = Color(0xFFFF6B6B)
private val TextPrimary = Color.White
private val TextMuted = Color(0xFF8A8A8E)
private val TextFaint = Color(0xFF5C5C60)
private val Hairline = Color.White.copy(alpha = 0.08f)
private val PanelFill = Color.White.copy(alpha = 0.035f)

private enum class AssetSyncStatus { READY, DOWNLOADING, WAITING, MISSING }

private data class AssetRow(val asset: PlaylistAsset, val status: AssetSyncStatus)

private fun formatMb(bytes: Long): String = String.format("%.1f MB", bytes / (1024.0 * 1024.0))

/** "450 MB", "1.2 GB" */
internal fun formatSize(bytes: Long): String = when {
    bytes >= 1024L * 1024 * 1024 -> String.format("%.1f GB", bytes / (1024.0 * 1024 * 1024))
    bytes >= 10L * 1024 * 1024 -> String.format("%.0f MB", bytes / (1024.0 * 1024))
    else -> String.format("%.1f MB", bytes / (1024.0 * 1024))
}

private fun formatSpeed(bytesPerSecond: Long): String = when {
    bytesPerSecond >= 1024L * 1024 -> String.format("%.1f MB/s", bytesPerSecond / (1024.0 * 1024))
    else -> String.format("%.0f KB/s", bytesPerSecond / 1024.0)
}

private fun formatTimeLeft(seconds: Long): String = when {
    seconds < 45 -> "Less than a minute left"
    seconds < 90 * 60 -> "About ${(seconds + 30) / 60} min left"
    else -> "About ${(seconds + 1800) / 3600} h left"
}

/**
 * Readable name for a stored file: "diwali_banner_k2j9x0q1zz.png" -> "Diwali banner".
 * Strips the extension, PocketBase's random suffix, hash prefixes and
 * underscores — the raw storage names meant nothing to whoever is at the TV.
 */
internal fun friendlyMediaName(filename: String): String {
    var name = filename.substringAfterLast('/').substringBeforeLast('.')
    name = name.replace(Regex("^[0-9a-fA-F]{24,}_"), "")
    // PocketBase suffix: 10 lowercase letters/digits, containing a digit
    // (so a real word like "_collection" is kept).
    name = name.replace(Regex("_(?=[a-z]*[0-9])[a-z0-9]{10}$"), "")
    name = name.replace('_', ' ').replace('-', ' ').replace(Regex("\\s+"), " ").trim()
    if (name.isEmpty()) return "Untitled"
    return name.replaceFirstChar { it.uppercase() }
}

private fun typeLabel(asset: PlaylistAsset): String = when {
    asset.mediaType.equals("youtube", ignoreCase = true) -> "YouTube"
    asset.mediaType.equals("video", ignoreCase = true) -> "Video"
    else -> "Image"
}

@Composable
fun DownloadProgressScreen(
    uiState: SignageUiState,
    onTriggerDownloads: () -> Unit,
    onOpenAdmin: () -> Unit
) {
    val isLandscape = LocalConfiguration.current.orientation == Configuration.ORIENTATION_LANDSCAPE

    // Re-derived whenever progress ticks, since a file landing on disk is
    // exactly what moves the fraction — cheap for playlist-sized lists.
    val rows = remember(uiState.playlist, uiState.downloadProgressFraction, uiState.downloadCurrentFile, uiState.isDownloading) {
        uiState.playlist.sortedBy { it.sortOrder }.map { asset ->
            val ready = asset.mediaType.equals("youtube", ignoreCase = true) ||
                (!asset.localPath.isNullOrEmpty() && File(asset.localPath).exists())
            val status = when {
                ready -> AssetSyncStatus.READY
                uiState.isDownloading && asset.filename == uiState.downloadCurrentFile -> AssetSyncStatus.DOWNLOADING
                uiState.isDownloading -> AssetSyncStatus.WAITING
                else -> AssetSyncStatus.MISSING
            }
            AssetRow(asset, status)
        }
    }
    val readyCount = rows.count { it.status == AssetSyncStatus.READY }
    val phase = phaseOf(uiState)

    val animatedProgress by animateFloatAsState(
        targetValue = uiState.downloadProgressFraction.coerceIn(0f, 1f),
        animationSpec = tween(700, easing = FastOutSlowInEasing),
        label = "syncProgress"
    )

    TopGlowBackground {
        if (isLandscape) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 56.dp, vertical = 40.dp)
            ) {
                TopBar(uiState = uiState, phase = phase)
                Spacer(modifier = Modifier.height(20.dp))

                Row(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(56.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    ProgressColumn(
                        uiState = uiState,
                        phase = phase,
                        progress = animatedProgress,
                        readyCount = readyCount,
                        totalCount = rows.size,
                        onRetry = onTriggerDownloads,
                        modifier = Modifier.weight(1.15f)
                    )
                    AssetPanel(
                        rows = rows,
                        uiState = uiState,
                        maxRows = 7,
                        modifier = Modifier.weight(0.85f)
                    )
                }

                Footer()
            }
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 32.dp, vertical = 36.dp)
            ) {
                TopBar(uiState = uiState, phase = phase)
                Spacer(modifier = Modifier.height(20.dp))

                Column(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth(),
                    verticalArrangement = Arrangement.Center
                ) {
                    ProgressColumn(
                        uiState = uiState,
                        phase = phase,
                        progress = animatedProgress,
                        readyCount = readyCount,
                        totalCount = rows.size,
                        onRetry = onTriggerDownloads,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(modifier = Modifier.height(36.dp))
                    AssetPanel(
                        rows = rows,
                        uiState = uiState,
                        maxRows = 6,
                        modifier = Modifier.fillMaxWidth()
                    )
                }

                Footer()
            }
        }
    }
}

private enum class SyncPhase { DOWNLOADING, OFFLINE, RETRYING }

private fun phaseOf(uiState: SignageUiState): SyncPhase = when {
    uiState.isDownloading -> SyncPhase.DOWNLOADING
    uiState.downloadOffline -> SyncPhase.OFFLINE
    else -> SyncPhase.RETRYING
}

@Composable
private fun TopBar(uiState: SignageUiState, phase: SyncPhase) {
    val whiteLabelName = uiState.whiteLabelName
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (uiState.isWhiteLabel && !whiteLabelName.isNullOrEmpty()) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                SignageLogo(uiState = uiState, size = 30.dp, cornerRadius = 8.dp)
                Spacer(modifier = Modifier.width(10.dp))
                Text(whiteLabelName, color = TextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Bold)
            }
        } else {
            Image(
                painter = painterResource(R.drawable.bluestar_lockup),
                contentDescription = "BlueStar DigiTech",
                modifier = Modifier.height(34.dp)
            )
        }
        Spacer(modifier = Modifier.weight(1f))
        // Which screen this is — handy for whoever is installing a row of TVs.
        if (uiState.screenName.isNotBlank()) {
            Text(
                text = uiState.screenName,
                color = TextMuted,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.widthIn(max = 260.dp)
            )
            Spacer(modifier = Modifier.width(14.dp))
        }
        StatusPill(phase = phase)
    }
}

@Composable
private fun StatusPill(phase: SyncPhase) {
    val pulse = rememberInfiniteTransition(label = "statusPulse")
    val dotAlpha by pulse.animateFloat(
        initialValue = 1f,
        targetValue = 0.3f,
        animationSpec = infiniteRepeatable(tween(900), RepeatMode.Reverse),
        label = "statusDot"
    )
    val (color, label) = when (phase) {
        SyncPhase.DOWNLOADING -> SyncBlue to "DOWNLOADING"
        SyncPhase.OFFLINE -> SyncRed to "NO CONNECTION"
        SyncPhase.RETRYING -> SyncAmber to "RETRYING"
    }
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .clip(CircleShape)
            .background(color.copy(alpha = 0.12f))
            .border(1.dp, color.copy(alpha = 0.35f), CircleShape)
            .padding(horizontal = 14.dp, vertical = 6.dp)
    ) {
        Box(
            modifier = Modifier
                .size(7.dp)
                .alpha(if (phase == SyncPhase.DOWNLOADING) dotAlpha else 1f)
                .background(color, CircleShape)
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(
            text = label,
            color = color,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.5.sp
        )
    }
}

@Composable
private fun ProgressColumn(
    uiState: SignageUiState,
    phase: SyncPhase,
    progress: Float,
    readyCount: Int,
    totalCount: Int,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier
) {
  BoxWithConstraints(modifier = modifier) {
    // Short screens (small-dp TV boxes, phones used for testing) can't fit
    // the full-size stack — and Compose silently drops whatever doesn't fit,
    // which would be the Retry button. Tighten type and gaps instead.
    val compact = maxHeight != Dp.Infinity && maxHeight < 330.dp
    val isPaused = phase != SyncPhase.DOWNLOADING

    // Seconds until the automatic retry, ticking once a second.
    var now by remember { mutableLongStateOf(android.os.SystemClock.elapsedRealtime()) }
    LaunchedEffect(uiState.downloadRetryAt) {
        while (uiState.downloadRetryAt > 0) {
            now = android.os.SystemClock.elapsedRealtime()
            kotlinx.coroutines.delay(1000)
        }
    }
    val retryIn = if (uiState.downloadRetryAt > 0) ((uiState.downloadRetryAt - now) / 1000).coerceAtLeast(0) else -1L

    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = "SETTING UP THIS SCREEN",
            color = SyncBlue,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 2.sp
        )
        Spacer(modifier = Modifier.height(if (compact) 6.dp else 10.dp))
        Text(
            text = when (phase) {
                SyncPhase.DOWNLOADING -> "Getting your content ready"
                SyncPhase.OFFLINE -> "Waiting for an internet connection"
                SyncPhase.RETRYING -> "A few files need another try"
            },
            color = TextPrimary,
            fontSize = if (compact) 26.sp else 32.sp,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(if (compact) 6.dp else 10.dp))
        Text(
            text = when (phase) {
                SyncPhase.DOWNLOADING -> "Your media is being saved to this display, so it keeps playing smoothly — even if the internet drops later."
                SyncPhase.OFFLINE -> uiState.errorMessage ?: "This display can't reach the internet. Check its network cable or Wi-Fi."
                SyncPhase.RETRYING -> uiState.errorMessage ?: "Some files couldn't be downloaded. They'll be tried again automatically."
            },
            color = if (isPaused) (if (phase == SyncPhase.OFFLINE) SyncRed else SyncAmber) else TextMuted,
            fontSize = if (compact) 13.sp else 15.sp,
            lineHeight = if (compact) 18.sp else 21.sp,
            maxLines = if (compact) 2 else 3,
            overflow = TextOverflow.Ellipsis
        )

        Spacer(modifier = Modifier.height(if (compact) 16.dp else 32.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.Bottom
        ) {
            Text(
                text = "${Math.round(progress * 100)}",
                color = TextPrimary,
                fontSize = if (compact) 46.sp else 64.sp,
                fontWeight = FontWeight.Bold,
                lineHeight = if (compact) 46.sp else 64.sp
            )
            Text(
                text = "%",
                color = TextMuted,
                fontSize = if (compact) 18.sp else 24.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(start = 4.dp, bottom = if (compact) 6.dp else 10.dp)
            )
            Spacer(modifier = Modifier.weight(1f))
            Column(horizontalAlignment = Alignment.End, modifier = Modifier.padding(bottom = if (compact) 8.dp else 12.dp)) {
                Text(
                    text = "$readyCount of $totalCount files ready",
                    color = TextPrimary.copy(alpha = 0.9f),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium
                )
                if (uiState.downloadBytesTotal > 0) {
                    Text(
                        text = "${formatSize(uiState.downloadBytesDone)} of ${formatSize(uiState.downloadBytesTotal)}",
                        color = TextMuted,
                        fontSize = 13.sp
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(if (compact) 10.dp else 14.dp))
        SyncProgressBar(progress = progress, isPaused = isPaused)
        Spacer(modifier = Modifier.height(if (compact) 10.dp else 14.dp))

        if (!isPaused) {
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = if (uiState.downloadCurrentFile.isNotEmpty()) friendlyMediaName(uiState.downloadCurrentFile) else "Checking files…",
                    color = TextPrimary.copy(alpha = 0.85f),
                    fontSize = 13.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )
                val details = listOfNotNull(
                    if (uiState.downloadBytesPerSecond > 0) formatSpeed(uiState.downloadBytesPerSecond) else null,
                    if (uiState.downloadSecondsLeft >= 0) formatTimeLeft(uiState.downloadSecondsLeft) else null
                )
                if (details.isNotEmpty()) {
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(details.joinToString("  ·  "), color = TextMuted, fontSize = 13.sp)
                }
            }
        } else {
            Row(verticalAlignment = Alignment.CenterVertically) {
                RetryButton(onClick = onRetry, compact = compact)
                Spacer(modifier = Modifier.width(16.dp))
                Text(
                    text = if (retryIn >= 0) "Trying again automatically in ${retryIn / 60}:${String.format("%02d", retryIn % 60)}" else "Will try again automatically",
                    color = TextMuted,
                    fontSize = 13.sp
                )
            }
        }
    }
  }
}

/** Wide bar with a soft light sweep while active — reads as "working" even between progress ticks. */
@Composable
private fun SyncProgressBar(progress: Float, isPaused: Boolean) {
    val sweep = rememberInfiniteTransition(label = "barSweep")
    val sweepX by sweep.animateFloat(
        initialValue = -0.3f,
        targetValue = 1.3f,
        animationSpec = infiniteRepeatable(tween(1600, easing = LinearEasing)),
        label = "barSweepX"
    )
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(8.dp)
            .clip(CircleShape)
            .background(Color.White.copy(alpha = 0.08f))
    ) {
        Box(
            modifier = Modifier
                .fillMaxHeight()
                .fillMaxWidth(progress.coerceAtLeast(0.015f))
                .clip(CircleShape)
                .background(
                    if (isPaused) {
                        Brush.horizontalGradient(listOf(SyncAmber.copy(alpha = 0.7f), SyncAmber))
                    } else {
                        Brush.horizontalGradient(listOf(SyncBlue, SyncCyan))
                    }
                )
                .drawWithContent {
                    drawContent()
                    if (!isPaused) {
                        val band = size.width * 0.25f
                        val cx = size.width * sweepX
                        drawRect(
                            brush = Brush.horizontalGradient(
                                colors = listOf(Color.Transparent, Color.White.copy(alpha = 0.35f), Color.Transparent),
                                startX = cx - band,
                                endX = cx + band
                            )
                        )
                    }
                }
        )
    }
}

@Composable
private fun RetryButton(onClick: () -> Unit, compact: Boolean = false) {
    // Grab D-pad focus on appearance — on a TV there's no pointer, so an
    // unfocused button would need the user to hunt for it with the remote.
    val focusRequester = remember { FocusRequester() }
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()
    LaunchedEffect(Unit) { runCatching { focusRequester.requestFocus() } }

    Button(
        onClick = onClick,
        interactionSource = interaction,
        colors = ButtonDefaults.buttonColors(
            containerColor = Color.White,
            contentColor = Color.Black
        ),
        border = if (focused) BorderStroke(2.dp, SyncCyan) else null,
        shape = RoundedCornerShape(10.dp),
        contentPadding = PaddingValues(horizontal = 28.dp, vertical = if (compact) 8.dp else 12.dp),
        modifier = Modifier.focusRequester(focusRequester)
    ) {
        Text("Retry now", fontSize = 14.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun AssetPanel(
    rows: List<AssetRow>,
    uiState: SignageUiState,
    maxRows: Int,
    modifier: Modifier = Modifier
) {
  BoxWithConstraints(modifier = modifier) {
    // Fit as many rows as the space allows (TV panels vary, and portrait
    // gives much less height): panel header + "+N more" line ≈ 76dp, ~41dp
    // per row. Never more than maxRows, never fewer than 2.
    val fitRows = if (maxHeight == Dp.Infinity) maxRows
        else ((maxHeight - 76.dp) / 41.dp).toInt().coerceIn(2, maxRows)
    // Keep whatever's actively downloading in view even in long playlists.
    val visible = remember(rows, fitRows) {
        if (rows.size <= fitRows) rows else {
            val activeIndex = rows.indexOfFirst { it.status == AssetSyncStatus.DOWNLOADING }.coerceAtLeast(0)
            val start = (activeIndex - fitRows / 2).coerceIn(0, rows.size - fitRows)
            rows.subList(start, start + fitRows)
        }
    }
    val hidden = rows.size - visible.size

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(PanelFill)
            .border(1.dp, Hairline, RoundedCornerShape(16.dp))
            .padding(vertical = 8.dp)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 20.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "PLAYLIST",
                color = TextMuted,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.5.sp
            )
            Spacer(modifier = Modifier.weight(1f))
            Text("${rows.size} items", color = TextFaint, fontSize = 12.sp)
        }
        visible.forEachIndexed { i, row ->
            if (i > 0) {
                Box(
                    modifier = Modifier
                        .padding(horizontal = 20.dp)
                        .fillMaxWidth()
                        .height(1.dp)
                        .background(Hairline)
                )
            }
            AssetRowView(row = row, uiState = uiState)
        }
        if (hidden > 0) {
            Text(
                text = "+ $hidden more",
                color = TextFaint,
                fontSize = 12.sp,
                modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp)
            )
        }
    }
  }
}

@Composable
private fun AssetRowView(row: AssetRow, uiState: SignageUiState) {
    val active = row.status == AssetSyncStatus.DOWNLOADING
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(if (active) SyncBlue.copy(alpha = 0.08f) else Color.Transparent)
            .padding(horizontal = 20.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        StatusIcon(status = row.status, size = 16.dp)
        Spacer(modifier = Modifier.width(12.dp))
        Text(
            text = friendlyMediaName(row.asset.filename),
            color = when (row.status) {
                AssetSyncStatus.READY, AssetSyncStatus.DOWNLOADING -> TextPrimary
                else -> TextMuted
            },
            fontSize = 13.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f)
        )
        Spacer(modifier = Modifier.width(12.dp))
        Text(
            text = when (row.status) {
                AssetSyncStatus.DOWNLOADING ->
                    if (uiState.downloadCurrentTotalBytes > 0) {
                        "${Math.round(100.0 * uiState.downloadCurrentBytes / uiState.downloadCurrentTotalBytes)}%"
                    } else "…"
                AssetSyncStatus.MISSING -> "Waiting to retry"
                else -> {
                    val size = row.asset.fileSizeBytes ?: 0L
                    if (size > 0) "${typeLabel(row.asset)} · ${formatSize(size)}" else typeLabel(row.asset)
                }
            },
            color = when (row.status) {
                AssetSyncStatus.DOWNLOADING -> SyncCyan
                AssetSyncStatus.MISSING -> SyncAmber
                else -> TextFaint
            },
            fontSize = 12.sp,
            fontWeight = if (active) FontWeight.SemiBold else FontWeight.Normal
        )
    }
}

@Composable
private fun StatusIcon(status: AssetSyncStatus, size: Dp) {
    when (status) {
        AssetSyncStatus.DOWNLOADING -> CircularProgressIndicator(
            color = SyncCyan,
            strokeWidth = 2.dp,
            trackColor = SyncCyan.copy(alpha = 0.15f),
            modifier = Modifier.size(size)
        )
        AssetSyncStatus.READY -> Canvas(modifier = Modifier.size(size)) {
            drawCircle(color = SyncBlue)
            val w = this.size.width
            val stroke = w * 0.13f
            drawLine(Color.White, Offset(w * 0.28f, w * 0.52f), Offset(w * 0.44f, w * 0.68f), stroke, StrokeCap.Round)
            drawLine(Color.White, Offset(w * 0.44f, w * 0.68f), Offset(w * 0.73f, w * 0.36f), stroke, StrokeCap.Round)
        }
        AssetSyncStatus.WAITING -> Canvas(modifier = Modifier.size(size)) {
            drawCircle(color = TextFaint, radius = this.size.width / 2 - 1.dp.toPx(), style = Stroke(1.5.dp.toPx()))
        }
        AssetSyncStatus.MISSING -> Canvas(modifier = Modifier.size(size)) {
            drawCircle(color = SyncAmber, radius = this.size.width / 2 - 1.dp.toPx(), style = Stroke(1.5.dp.toPx()))
            val w = this.size.width
            drawLine(SyncAmber, Offset(w / 2, w * 0.3f), Offset(w / 2, w * 0.56f), w * 0.12f, StrokeCap.Round)
            drawCircle(SyncAmber, radius = w * 0.07f, center = Offset(w / 2, w * 0.72f))
        }
    }
}

@Composable
private fun Footer() {
    Spacer(modifier = Modifier.height(16.dp))
    Text(
        text = "Your playlist starts playing automatically as soon as it's ready.",
        color = TextFaint,
        fontSize = 12.sp
    )
}

/**
 * Shown in a corner over playing content while new media downloads in the
 * background. Deliberately small and quiet — this is a customer-facing
 * display.
 */
@Composable
fun UpdatingContentPill(progress: Float, modifier: Modifier = Modifier) {
    val animated by animateFloatAsState(progress.coerceIn(0f, 1f), tween(700), label = "pill")
    Box(modifier = modifier, contentAlignment = Alignment.BottomEnd) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .clip(CircleShape)
                .background(Color.Black.copy(alpha = 0.45f))
                .padding(horizontal = 10.dp, vertical = 6.dp)
        ) {
            CircularProgressIndicator(
                progress = { animated },
                modifier = Modifier.size(12.dp),
                color = Color.White.copy(alpha = 0.85f),
                strokeWidth = 1.5.dp,
                trackColor = Color.White.copy(alpha = 0.2f)
            )
            Spacer(modifier = Modifier.width(7.dp))
            Text(
                text = "Updating content",
                color = Color.White.copy(alpha = 0.8f),
                fontSize = 11.sp,
                fontWeight = FontWeight.Medium
            )
        }
    }
}
