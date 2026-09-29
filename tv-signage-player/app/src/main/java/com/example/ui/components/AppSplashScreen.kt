package com.example.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.EaseOutCubic
import androidx.compose.animation.core.LinearOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.BuildConfig
import com.example.ui.SignageUiState

// This project's own website theme (src/index.css: --color-ink-*, --color-brand-*,
// --color-glow-*) — not a borrowed palette, so the TV app's first screen actually
// matches the CMS it pairs with. No logo yet, so the wordmark carries the brand;
// "Blue"/"Star" are split to echo the two-tone treatment in the real logo mark.
private val Ink950 = Color(0xFF0B0D14)
private val Ink900 = Color(0xFF12141F)
private val Brand400 = Color(0xFF6B8AFF)
private val Brand500 = Color(0xFF4A6CF7)
private val GlowCyan = Color(0xFF5EEAD4)
private val GlowViolet = Color(0xFFA78BFA)

@Composable
fun AppSplashScreen(uiState: SignageUiState) {
    val brandName = if (uiState.isWhiteLabel && !uiState.whiteLabelName.isNullOrEmpty()) {
        uiState.whiteLabelName
    } else {
        null // null signals the default two-tone "BlueStar" wordmark below
    }

    // Staggered reveal: wordmark -> accent rule draws in -> tagline -> loading
    // bar. Nothing to scale in (no logo), so the wordmark itself carries the
    // entrance instead of just appearing.
    var stage by remember { mutableStateOf(0) }
    LaunchedEffect(Unit) {
        stage = 1
        kotlinx.coroutines.delay(450)
        stage = 2
        kotlinx.coroutines.delay(250)
        stage = 3
    }

    val wordmarkAlpha = remember { Animatable(0f) }
    val wordmarkOffset = remember { Animatable(14f) }
    LaunchedEffect(Unit) {
        wordmarkAlpha.animateTo(1f, tween(600, easing = LinearOutSlowInEasing))
    }
    LaunchedEffect(Unit) {
        wordmarkOffset.animateTo(0f, tween(600, easing = EaseOutCubic))
    }

    val ruleWidth = remember { Animatable(0f) }
    LaunchedEffect(stage) {
        if (stage >= 2) ruleWidth.animateTo(1f, tween(500, easing = EaseOutCubic))
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.radialGradient(
                    colors = listOf(Ink900, Ink950),
                    radius = 1000f
                )
            ),
        contentAlignment = Alignment.Center
    ) {
        // A faint ambient glow behind the wordmark — subtle nod to the
        // --color-glow-* tokens on the real site, not a literal logo.
        Canvas(modifier = Modifier.fillMaxSize()) {
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(GlowViolet.copy(alpha = 0.10f), Color.Transparent),
                    radius = size.minDimension * 0.35f
                ),
                radius = size.minDimension * 0.35f,
                center = Offset(size.width * 0.5f, size.height * 0.42f)
            )
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(GlowCyan.copy(alpha = 0.06f), Color.Transparent),
                    radius = size.minDimension * 0.28f
                ),
                radius = size.minDimension * 0.28f,
                center = Offset(size.width * 0.32f, size.height * 0.62f)
            )
        }

        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier
                .offset(y = wordmarkOffset.value.dp)
                .alpha(wordmarkAlpha.value)
        ) {
            Text(
                text = brandName?.let {
                    buildAnnotatedString { append(it) }
                } ?: buildAnnotatedString {
                    withStyle(SpanStyle(color = Color(0xFFE7EBF5))) { append("Blue") }
                    withStyle(SpanStyle(color = Brand400)) { append("Star") }
                },
                fontSize = 34.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.2.sp
            )

            if (brandName == null) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "OS",
                    color = Color(0xFF7C8598),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = 6.sp
                )
            }

            Spacer(modifier = Modifier.height(18.dp))

            Box(
                modifier = Modifier
                    .fillMaxWidth(0.42f * ruleWidth.value.coerceAtLeast(0.001f))
                    .height(2.dp)
                    .clip(RoundedCornerShape(1.dp))
                    .background(Brush.horizontalGradient(listOf(Color.Transparent, Brand500, Color.Transparent)))
            )

            Spacer(modifier = Modifier.height(22.dp))

            AnimatedVisibility(
                visible = stage >= 3,
                enter = fadeIn(tween(400)) + slideInVertically(
                    animationSpec = tween(400, easing = EaseOutCubic),
                    initialOffsetY = { it / 3 }
                )
            ) {
                Text(
                    text = "SIGNAGE PLAYER · v${BuildConfig.VERSION_NAME}",
                    color = Color(0xFF5A6478),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = 2.sp
                )
            }

            Spacer(modifier = Modifier.height(36.dp))

            AnimatedVisibility(
                visible = stage >= 3,
                enter = fadeIn(tween(400))
            ) {
                LoadingBar()
            }
        }
    }
}

/** A slim indeterminate bar sweeping left-to-right — reads as "working" without a spinner. */
@Composable
private fun LoadingBar() {
    val sweep = remember { Animatable(0f) }
    LaunchedEffect(Unit) {
        while (true) {
            sweep.snapTo(0f)
            sweep.animateTo(1f, tween(1100, easing = EaseOutCubic))
        }
    }
    Box(
        modifier = Modifier
            .width(120.dp)
            .height(3.dp)
            .clip(RoundedCornerShape(2.dp))
            .background(Color.White.copy(alpha = 0.06f))
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val segmentWidth = size.width * 0.4f
            val x = (size.width + segmentWidth) * sweep.value - segmentWidth
            drawRect(
                color = Brand500,
                topLeft = Offset(x, 0f),
                size = androidx.compose.ui.geometry.Size(segmentWidth, size.height)
            )
        }
    }
}
