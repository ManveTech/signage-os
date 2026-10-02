package com.example.ui.components

import android.os.Build
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.Easing
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.example.R

/**
 * Code-driven recreation of the BlueStar DigiTech logo reveal (originally a
 * 2.9s video) — built from the real logo cut into four same-size, pre-aligned
 * layers (res/drawable-nodpi/splash_logo_*.png), so it stays sharp and needs
 * no video decoder. Mirrors src/components/SplashLogoAnimation.tsx in the
 * web/phone app; keep the two timelines in sync.
 *
 *   0.0–0.25s icon fades in alone, centred, with a blue glow that settles
 *   0.25–0.5s icon slides left as BLUESTAR wipes in from behind it
 *   0.35–0.8s a light sheen sweeps across icon + wordmark
 *   0.55–0.8s DIGITECH fades up
 *   0.7–0.95s tagline fades up
 */
const val SPLASH_LOGO_DURATION_MS = 1000

private const val CANVAS_ASPECT = 1217f / 399f
// Icon's own centre sits ~15.5% across the canvas; this shift puts it
// dead-centre for the opening "icon alone" beat.
private const val ICON_CENTRING_SHIFT = 0.345f
// Wordmark/DIGITECH/tagline all start at x≈377 of the 1217px-wide canvas.
private const val TEXT_LEFT = 0.31f

private val EaseOutQuint: Easing = CubicBezierEasing(0.22f, 1f, 0.36f, 1f)
private val GlowBlue = Color(0xFF2F8CFF)

@Composable
fun SplashLogoAnimation(modifier: Modifier = Modifier) {
    // One clock for the whole sequence, so every layer's timing is relative
    // to the same start and can never drift apart.
    val clock = remember { Animatable(0f) }
    LaunchedEffect(Unit) {
        clock.animateTo(
            SPLASH_LOGO_DURATION_MS.toFloat(),
            tween(SPLASH_LOGO_DURATION_MS, easing = LinearEasing)
        )
    }
    val ms = clock.value
    fun phase(startMs: Int, durationMs: Int, easing: Easing = EaseOutQuint): Float =
        easing.transform(((ms - startMs) / durationMs).coerceIn(0f, 1f))

    val iconIn = phase(0, 250)
    val slide = phase(250, 250)
    val glow = 1f - phase(0, 500, FastOutSlowInEasing)
    val wipe = phase(250, 300)
    val sheen = phase(350, 450, FastOutSlowInEasing)
    val sheenAlpha = when {
        ms < 350f || ms > 800f -> 0f
        sheen < 0.2f -> sheen / 0.2f
        sheen > 0.8f -> (1f - sheen) / 0.2f
        else -> 1f
    }
    val digitechIn = phase(550, 250)
    val taglineIn = phase(700, 250)

    // A soft white band masked (SrcAtop) to the layer's own pixels, so it
    // lights up only the logo, never the background around it.
    val sheenModifier = Modifier
        .graphicsLayer(compositingStrategy = CompositingStrategy.Offscreen)
        .drawWithContent {
            drawContent()
            if (sheenAlpha > 0f) {
                val halfBand = size.width * 0.24f
                val centerX = -0.5f * size.width + 2f * size.width * sheen
                drawRect(
                    brush = Brush.linearGradient(
                        colorStops = arrayOf(
                            0f to Color.Transparent,
                            0.5f to Color.White.copy(alpha = 0.75f * sheenAlpha),
                            1f to Color.Transparent
                        ),
                        start = Offset(centerX - halfBand, 0f),
                        end = Offset(centerX + halfBand, size.height * 0.27f)
                    ),
                    blendMode = BlendMode.SrcAtop
                )
            }
        }

    Box(
        modifier = modifier
            .aspectRatio(CANVAS_ASPECT)
            .semantics { contentDescription = "BlueStar DigiTech" }
    ) {
        val iconTransform = Modifier
            .fillMaxSize()
            .graphicsLayer {
                translationX = size.width * ICON_CENTRING_SHIFT * (1f - slide)
                val s = 1.08f - 0.08f * iconIn
                scaleX = s
                scaleY = s
                alpha = iconIn
            }

        // Glow: a blurred, blue-tinted copy of the icon behind it. Modifier.blur
        // is a no-op before Android 12, where this would just be a hard blue
        // silhouette — so older devices skip the glow rather than show that.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && glow > 0f) {
            Image(
                painter = painterResource(R.drawable.splash_logo_icon),
                contentDescription = null,
                contentScale = ContentScale.Fit,
                colorFilter = ColorFilter.tint(GlowBlue),
                modifier = iconTransform
                    .blur(18.dp)
                    .graphicsLayer { alpha = glow * 0.9f }
            )
        }

        Image(
            painter = painterResource(R.drawable.splash_logo_icon),
            contentDescription = null,
            contentScale = ContentScale.Fit,
            modifier = iconTransform.then(sheenModifier)
        )

        Image(
            painter = painterResource(R.drawable.splash_logo_wordmark),
            contentDescription = null,
            contentScale = ContentScale.Fit,
            modifier = Modifier
                .fillMaxSize()
                .drawWithContent {
                    clipRect(
                        left = size.width * TEXT_LEFT,
                        right = size.width * (TEXT_LEFT + (1f - TEXT_LEFT) * wipe)
                    ) {
                        this@drawWithContent.drawContent()
                    }
                }
                .then(sheenModifier)
        )

        Image(
            painter = painterResource(R.drawable.splash_logo_digitech),
            contentDescription = null,
            contentScale = ContentScale.Fit,
            modifier = Modifier
                .fillMaxSize()
                .graphicsLayer {
                    alpha = digitechIn
                    translationY = size.height * 0.02f * (1f - digitechIn)
                }
        )

        Image(
            painter = painterResource(R.drawable.splash_logo_tagline),
            contentDescription = null,
            contentScale = ContentScale.Fit,
            modifier = Modifier
                .fillMaxSize()
                .graphicsLayer {
                    alpha = taglineIn
                    translationY = size.height * 0.02f * (1f - taglineIn)
                }
        )
    }
}
