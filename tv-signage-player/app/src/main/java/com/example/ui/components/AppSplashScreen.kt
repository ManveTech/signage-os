package com.example.ui.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.SignageUiState

// Same as the phone app's boot screen (src/components/BootScreen.tsx): black,
// a soft blue glow from the top, and the animated BlueStar DigiTech logo —
// nothing else. A white-labeled player shows the customer's own name
// instead, never this logo.
private val GlowBlue = Color(0x592F6BFF) // rgba(47,107,255,0.35)

@Composable
fun AppSplashScreen(uiState: SignageUiState, onLogoStarted: () -> Unit = {}) {
    val brandName = if (uiState.isWhiteLabel && !uiState.whiteLabelName.isNullOrEmpty()) {
        uiState.whiteLabelName
    } else {
        null // null: the default animated BlueStar DigiTech logo below
    }

    // Timed from when the logo reveal actually starts (its layers decoded),
    // not from first composition — the caller uses this to time dismissal.
    var logoStarted by remember { mutableStateOf(brandName != null) }
    LaunchedEffect(logoStarted) {
        if (logoStarted) onLogoStarted()
    }

    val nameAlpha = remember { Animatable(0f) }
    LaunchedEffect(Unit) {
        if (brandName != null) nameAlpha.animateTo(1f, tween(600, easing = LinearOutSlowInEasing))
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black),
        contentAlignment = Alignment.Center
    ) {
        // The phone's radial-gradient(ellipse 140% 70% at 50% -10%, glow, transparent 60%).
        Canvas(modifier = Modifier.fillMaxSize()) {
            val rx = size.width * 1.4f * 0.6f
            val ry = size.height * 0.7f * 0.6f
            val center = Offset(size.width / 2f, -0.1f * size.height)
            scale(scaleX = 1f, scaleY = ry / rx, pivot = center) {
                drawCircle(
                    brush = Brush.radialGradient(listOf(GlowBlue, Color.Transparent), center = center, radius = rx),
                    radius = rx,
                    center = center
                )
            }
        }

        if (brandName != null) {
            Text(
                text = brandName,
                color = Color(0xFFE7EBF5),
                fontSize = 34.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.2.sp,
                modifier = Modifier.alpha(nameAlpha.value)
            )
        } else {
            // The phone shows it at min(78% of the width, 420px).
            SplashLogoAnimation(
                modifier = Modifier.width(420.dp),
                onReady = { logoStarted = true }
            )
        }
    }
}
