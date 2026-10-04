package com.example.ui.components

import android.graphics.BitmapFactory
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.sp
import com.example.R
import com.example.ui.SignageUiState
import java.io.File

/**
 * The brand in the corner of the pairing screen: the BlueStar DigiTech logo
 * (the splash's final frame, from the same layers), or for a white-labeled
 * player the customer's own logo — or their name if no logo is downloaded.
 */
@Composable
fun BrandMark(uiState: SignageUiState, height: Dp) {
    if (uiState.isWhiteLabel && !uiState.whiteLabelName.isNullOrEmpty()) {
        val path = uiState.whiteLabelLogoPath
        val logo = remember(path) {
            path?.takeIf { File(it).exists() }?.let { runCatching { BitmapFactory.decodeFile(it)?.asImageBitmap() }.getOrNull() }
        }
        if (logo != null) {
            Image(bitmap = logo, contentDescription = uiState.whiteLabelName, contentScale = ContentScale.Fit, modifier = Modifier.height(height))
        } else {
            Text(text = uiState.whiteLabelName, color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.5.sp)
        }
        return
    }
    Box(modifier = Modifier.height(height).aspectRatio(1217f / 399f)) {
        for (layer in listOf(R.drawable.splash_logo_icon, R.drawable.splash_logo_wordmark, R.drawable.splash_logo_digitech, R.drawable.splash_logo_tagline)) {
            Image(
                painter = painterResource(layer),
                contentDescription = null,
                contentScale = ContentScale.Fit,
                modifier = Modifier.fillMaxSize()
            )
        }
    }
}
