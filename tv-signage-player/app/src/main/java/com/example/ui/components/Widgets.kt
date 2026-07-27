package com.example.ui.components

import androidx.annotation.OptIn
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.basicMarquee
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Outline
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.example.ui.SignageUiState
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import java.io.File

class WipeShape(private val fraction: Float) : Shape {
    override fun createOutline(
        size: Size,
        layoutDirection: LayoutDirection,
        density: Density
    ): Outline {
        return Outline.Rectangle(
            Rect(0f, 0f, size.width * fraction, size.height)
        )
    }
}

@Composable
fun SignageLogo(
    uiState: SignageUiState,
    modifier: Modifier = Modifier,
    size: Dp = 40.dp,
    cornerRadius: Dp = 12.dp
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
                .background(Color(0xFF2563EB), RoundedCornerShape(cornerRadius))
        ) {
            Text(
                text = "SO",
                color = Color.White,
                fontSize = 16.sp,
                fontWeight = FontWeight.Black
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
        // Logo & Title Group
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
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .background(Color(0xFF2B2930), RoundedCornerShape(100.dp))
                    .border(1.dp, Color(0xFF49454F), RoundedCornerShape(100.dp))
                    .padding(horizontal = 14.dp, vertical = 6.dp)
            ) {
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
            Box(modifier = Modifier.size(24.dp)) {
                if (isSunny) {
                    Box(
                        modifier = Modifier
                            .size(16.dp)
                            .align(Alignment.Center)
                            .background(Color(0xFFF59E0B), CircleShape)
                    )
                } else if (isRainy) {
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
                    Box(
                        modifier = Modifier
                            .size(14.dp)
                            .align(Alignment.Center)
                            .background(Color(0xFF93C5FD), CircleShape)
                    )
                } else if (isCloudy) {
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
                } else {
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
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(48.dp)
            .background(Color(0xE6111827))
            .padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .background(Color(0xFFDC2626), RoundedCornerShape(4.dp))
                .padding(horizontal = 8.dp, vertical = 4.dp)
        ) {
            Text(
                text = "LIVE",
                color = Color.White,
                fontSize = 11.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = 0.5.sp
            )
        }
        Spacer(modifier = Modifier.width(12.dp))
        Text(
            text = tickerText.ifEmpty { "Welcome to SignageOS Digital Display Player Network Ticker" },
            color = Color.White,
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
            maxLines = 1,
            modifier = Modifier.basicMarquee(
                iterations = Int.MAX_VALUE,
                velocity = 45.dp
            )
        )
    }
}
