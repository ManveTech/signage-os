package com.example.ui.components

import android.content.Context
import android.content.res.Configuration
import android.os.StatFs
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.SignageUiState

fun getAvailableStorageGb(context: Context): String {
    return try {
        val stat = StatFs(context.filesDir.absolutePath)
        val availableBytes = stat.availableBlocksLong * stat.blockSizeLong
        val gb = availableBytes.toDouble() / (1024.0 * 1024.0 * 1024.0)
        String.format("%.1f GB free", gb)
    } catch (e: Exception) {
        "8.2 GB free"
    }
}

// Black-and-white pairing screen, blue glow top-center fading to black — no
// numbered walkthrough, just the code and the way to use it, the way a
// streaming box's TV sign-in screen does it.
private val PairBlack = Color(0xFF000000)
private val PairBlue = Color(0xFF2F6BFF)
private val PairMuted = Color(0xFF8A8A8E)

/** Splits a raw pairing code in half with a hyphen for readability — display only, never sent anywhere. */
private fun formatCodeForDisplay(code: String): String {
    if (code.length < 4) return code
    val mid = code.length / 2
    return "${code.substring(0, mid)}-${code.substring(mid)}"
}

@Composable
internal fun TopGlowBackground(content: @Composable BoxScope.() -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(PairBlack)
    ) {
        // Anchored to top-CENTER (not top-left) — matches the reference TV
        // sign-in screen and the same fade used in the app's own boot screen
        // (BootScreen.tsx: radial-gradient(... at 50% -10%)). Drawn in a
        // Canvas rather than a plain .background(brush) modifier because the
        // gradient's center needs the composable's actual pixel size, which
        // only DrawScope provides — a bare Offset can't express "50% across."
        Canvas(modifier = Modifier.fillMaxSize()) {
            drawRect(
                brush = Brush.radialGradient(
                    colors = listOf(PairBlue.copy(alpha = 0.35f), Color.Transparent),
                    center = Offset(size.width / 2f, 0f),
                    radius = size.width * 0.7f
                )
            )
        }
        content()
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
    val configuration = LocalConfiguration.current
    val isLandscape = configuration.orientation == Configuration.ORIENTATION_LANDSCAPE

    // The CMS a customer logs into to actually complete pairing is a
    // separate product from this player (the brand in the corner)
    // — a white-label customer's own name applies to both, but the
    // non-white-label default names the CMS specifically, not the player.
    val cmsName = if (uiState.isWhiteLabel && !uiState.whiteLabelName.isNullOrEmpty()) {
        uiState.whiteLabelName
    } else {
        "BlueStar DigiTech"
    }

    if (isLandscape) {
        TopGlowBackground {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 56.dp, vertical = 40.dp)
            ) {
                Row(modifier = Modifier.fillMaxWidth()) {
                    Spacer(modifier = Modifier.weight(1f))
                    BrandMark(uiState, height = 44.dp)
                }

                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.Center
                ) {
                    Text(
                        text = "Connect your screen",
                        color = Color.White,
                        fontSize = 34.sp,
                        fontWeight = FontWeight.Bold
                    )

                    Spacer(modifier = Modifier.height(10.dp))

                    Text(
                        text = "Sign in to your $cmsName dashboard to pair this display",
                        color = PairMuted,
                        fontSize = 15.sp
                    )

                    Spacer(modifier = Modifier.height(34.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(64.dp, Alignment.CenterHorizontally),
                        verticalAlignment = Alignment.Top
                    ) {
                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            if (uiState.pairingCode.isNotEmpty()) {
                                Box(
                                    modifier = Modifier
                                        .background(Color.White, RoundedCornerShape(8.dp))
                                        .padding(8.dp)
                                ) {
                                    QrCodeImage(
                                        content = pairQrContent(uiState.pairUrlTemplate, uiState.pairingCode),
                                        sizePx = 260,
                                        modifier = Modifier.size(180.dp)
                                    )
                                }
                            }
                            Text(
                                text = if (uiState.pairUrlTemplate.contains("{code}")) "Scan with your phone camera" else "Scan in the dashboard app",
                                color = PairMuted,
                                fontSize = 13.sp
                            )
                        }

                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Text(
                                text = "Or enter this code",
                                color = PairMuted,
                                fontSize = 13.sp
                            )
                            Text(
                                text = formatCodeForDisplay(uiState.pairingCode.ifEmpty { "------" }),
                                color = Color.White,
                                fontSize = 52.sp,
                                fontWeight = FontWeight.Bold,
                                fontFamily = FontFamily.Monospace,
                                letterSpacing = 2.sp,
                                modifier = Modifier.testTag("pairing_code_text")
                            )
                        }
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    CircularProgressIndicator(
                        color = PairBlue,
                        strokeWidth = 2.dp,
                        modifier = Modifier.size(14.dp)
                    )
                    Spacer(modifier = Modifier.width(10.dp))
                    Text(
                        text = pairingStatus(uiState),
                        color = PairMuted,
                        fontSize = 13.sp
                    )
                    Spacer(modifier = Modifier.weight(1f))
                    TextButton(onClick = onRefreshCode) {
                        Text("Refresh code", color = PairMuted, fontSize = 13.sp)
                    }
                }
            }
        }
    } else {
        TopGlowBackground {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 28.dp, vertical = 32.dp)
            ) {
                Row(modifier = Modifier.fillMaxWidth()) {
                    Spacer(modifier = Modifier.weight(1f))
                    BrandMark(uiState, height = 36.dp)
                }

                Column(
                    modifier = Modifier.weight(1f),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Text(
                        text = "Connect your screen",
                        color = Color.White,
                        fontSize = 28.sp,
                        fontWeight = FontWeight.Bold
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    Text(
                        text = "Sign in to your $cmsName dashboard to pair this display",
                        color = PairMuted,
                        fontSize = 13.sp,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.widthIn(max = 260.dp)
                    )

                    Spacer(modifier = Modifier.height(28.dp))

                    if (uiState.pairingCode.isNotEmpty()) {
                        Box(
                            modifier = Modifier
                                .background(Color.White, RoundedCornerShape(10.dp))
                                .padding(10.dp)
                        ) {
                            QrCodeImage(
                                content = pairQrContent(uiState.pairUrlTemplate, uiState.pairingCode),
                                sizePx = 300,
                                modifier = Modifier.size(200.dp)
                            )
                        }
                        Spacer(modifier = Modifier.height(10.dp))
                        Text(text = if (uiState.pairUrlTemplate.contains("{code}")) "Scan with your phone camera" else "Scan in the dashboard app", color = PairMuted, fontSize = 13.sp)
                    }

                    Spacer(modifier = Modifier.height(32.dp))
                    Text(text = "Or enter this code", color = PairMuted, fontSize = 13.sp)
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = formatCodeForDisplay(uiState.pairingCode.ifEmpty { "------" }),
                        color = Color.White,
                        fontSize = 40.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                        letterSpacing = 2.sp,
                        modifier = Modifier.testTag("pairing_code_text")
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    CircularProgressIndicator(
                        color = PairBlue,
                        strokeWidth = 2.dp,
                        modifier = Modifier.size(14.dp)
                    )
                    Spacer(modifier = Modifier.width(10.dp))
                    Text(text = pairingStatus(uiState), color = PairMuted, fontSize = 13.sp)
                }
                Spacer(modifier = Modifier.height(12.dp))
                TextButton(
                    onClick = onRefreshCode,
                    modifier = Modifier.align(Alignment.CenterHorizontally)
                ) {
                    Text("Refresh code", color = PairMuted, fontSize = 13.sp)
                }
            }
        }
    }
}

/** The pairing QR: a dashboard link with the code filled in, or just the code for older servers. */
internal fun pairQrContent(template: String, code: String): String =
    if (template.contains("{code}") && code.isNotEmpty()) template.replace("{code}", code) else code

/**
 * The line under the code: what the TV is waiting for. It showed the app's
 * start-up text ("Initializing system...") for as long as the code was up
 * whenever the code arrived through a background sync.
 */
internal fun pairingStatus(uiState: com.example.ui.SignageUiState): String = when {
    uiState.statusMessage.startsWith("Network") -> "No connection — retrying..."
    uiState.pairingCode.isNotEmpty() -> "Waiting to be added in the dashboard..."
    else -> "Getting a pairing code..."
}
