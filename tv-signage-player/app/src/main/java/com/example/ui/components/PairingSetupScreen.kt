package com.example.ui.components

import android.content.Context
import android.content.res.Configuration
import android.os.StatFs
import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
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

@Composable
fun PairingSetupScreen(
    uiState: SignageUiState,
    onRefreshCode: () -> Unit,
    onOpenAdmin: () -> Unit
) {
    val context = LocalContext.current
    val systemStorage = remember(context) { getAvailableStorageGb(context) }

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

    val configuration = LocalConfiguration.current
    val isLandscape = configuration.orientation == Configuration.ORIENTATION_LANDSCAPE

    if (isLandscape) {
        Row(
            modifier = Modifier
                .fillMaxSize()
                .background(Color(0xFF1C1B1F))
                .padding(horizontal = 32.dp, vertical = 24.dp),
            horizontalArrangement = Arrangement.spacedBy(32.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(
                modifier = Modifier
                    .weight(1.1f)
                    .fillMaxHeight(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                SignageLogo(uiState = uiState, size = 80.dp, cornerRadius = 14.dp)
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text = "Connect your screen",
                    color = Color.White,
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Light,
                    textAlign = TextAlign.Center
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Enter this pairing code in your CMS dashboard to start playback.",
                    color = Color(0xFF938F99),
                    fontSize = 12.sp,
                    textAlign = TextAlign.Center
                )
                Spacer(modifier = Modifier.height(20.dp))

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFF2B2930), RoundedCornerShape(24.dp))
                        .border(1.dp, Color(0xFF49454F), RoundedCornerShape(24.dp))
                        .padding(horizontal = 16.dp, vertical = 20.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.TopEnd) {
                        Canvas(modifier = Modifier.size(50.dp)) {
                            drawCircle(
                                color = Color.White.copy(alpha = 0.03f),
                                radius = size.width,
                                style = Stroke(width = 3.dp.toPx())
                            )
                        }
                    }

                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        val codeToShow = uiState.pairingCode.ifEmpty { "------" }
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.testTag("pairing_code_text")
                        ) {
                            codeToShow.forEach { char ->
                                if (char == '-') {
                                    Text(
                                        text = "-",
                                        color = Color(0xFF49454E),
                                        fontSize = 20.sp,
                                        fontWeight = FontWeight.Bold,
                                        modifier = Modifier.padding(horizontal = 2.dp)
                                    )
                                } else {
                                    Box(
                                        contentAlignment = Alignment.Center,
                                        modifier = Modifier
                                            .size(width = 36.dp, height = 48.dp)
                                            .background(Color(0xFF1C1B1F), RoundedCornerShape(8.dp))
                                            .border(1.dp, Color(0xFF49454F), RoundedCornerShape(8.dp))
                                    ) {
                                        Text(
                                            text = char.toString(),
                                            color = Color(0xFFD0BCFF),
                                            fontSize = 22.sp,
                                            fontWeight = FontWeight.ExtraBold,
                                            fontFamily = FontFamily.Monospace
                                        )
                                    }
                                }
                            }
                        }

                        Box(
                            modifier = Modifier
                                .background(Color(0xFF381E72), RoundedCornerShape(100.dp))
                                .padding(horizontal = 12.dp, vertical = 4.dp)
                        ) {
                            Text(
                                text = "PAIRING CODE",
                                color = Color(0xFFEADDFF),
                                fontSize = 9.sp,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 1.sp
                            )
                        }

                        Row(
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            CircularProgressIndicator(
                                color = Color(0xFFD0BCFF),
                                strokeWidth = 2.dp,
                                modifier = Modifier.size(10.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = uiState.statusMessage,
                                color = Color(0xFF938F99),
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }
                }
            }

            Column(
                modifier = Modifier
                    .weight(0.9f)
                    .fillMaxHeight()
                    .verticalScroll(rememberScrollState()),
                horizontalAlignment = Alignment.Start,
                verticalArrangement = Arrangement.Center
            ) {
                Text(
                    text = "STEPS TO ACTIVATE",
                    color = Color(0xFFD0BCFF),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.5.sp,
                    modifier = Modifier.padding(bottom = 16.dp)
                )

                Column(
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.fillMaxWidth()
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

                Spacer(modifier = Modifier.height(24.dp))

                Row(
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    FilledTonalButton(
                        onClick = onRefreshCode,
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.filledTonalButtonColors(
                            containerColor = Color(0xFF2B2930),
                            contentColor = Color(0xFFD0BCFF)
                        ),
                        modifier = Modifier
                            .fillMaxWidth()
                            .border(1.dp, Color(0xFF49454F), RoundedCornerShape(12.dp))
                    ) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = "Refresh Code Icon",
                            modifier = Modifier.size(14.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Refresh", fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }
    } else {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(Color(0xFF1C1B1F))
                .padding(horizontal = 24.dp, vertical = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Spacer(modifier = Modifier.height(24.dp))

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

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFF2B2930), RoundedCornerShape(32.dp))
                        .border(1.dp, Color(0xFF49454F), RoundedCornerShape(32.dp))
                        .padding(horizontal = 24.dp, vertical = 32.dp),
                    contentAlignment = Alignment.Center
                ) {
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

            FilledTonalButton(
                onClick = onRefreshCode,
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.filledTonalButtonColors(
                    containerColor = Color(0xFF2B2930),
                    contentColor = Color(0xFFD0BCFF)
                ),
                modifier = Modifier.padding(vertical = 12.dp).border(1.dp, Color(0xFF49454F), RoundedCornerShape(14.dp))
            ) {
                Icon(
                    imageVector = Icons.Default.Refresh,
                    contentDescription = "Refresh Code Icon",
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text("Refresh Code", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
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

        Text(
            text = buildAnnotatedString {
                append(primaryText)
                pushStyle(
                    SpanStyle(
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
